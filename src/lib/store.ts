// JSON-file-backed store — no database (per project decision).
// Reads/writes data/*.json with an atomic write (write temp file, then rename) so a
// crash mid-write can't corrupt the store.

import { promises as fs } from "fs";
import path from "path";
import type {
  Supplier,
  Batch,
  SupplierInput,
  BatchInput,
  User,
  PrintLog,
} from "./types";
import {
  nextSupplierId,
  nextBatchId,
  nextUserId,
  nextPrintId,
} from "./ids";
import { enrichBatch, flowerAgeDays } from "./carbon";

const DATA_DIR = path.join(process.cwd(), "data");
const SUPPLIERS_FILE = path.join(DATA_DIR, "suppliers.json");
const BATCHES_FILE = path.join(DATA_DIR, "batches.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PRINTS_FILE = path.join(DATA_DIR, "prints.json");

async function readJson<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeJson<T>(file: string, data: T[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

// --- Suppliers ------------------------------------------------------------

export async function getSuppliers(): Promise<Supplier[]> {
  return readJson<Supplier>(SUPPLIERS_FILE);
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const all = await getSuppliers();
  return all.find((s) => s.id === id) ?? null;
}

export async function addSupplier(input: SupplierInput): Promise<Supplier> {
  const all = await getSuppliers();
  const now = new Date();
  const supplier: Supplier = {
    ...input,
    id: nextSupplierId(all.length, now.getUTCFullYear()),
    status: "active",
    createdAt: now.toISOString(),
  };
  all.push(supplier);
  await writeJson(SUPPLIERS_FILE, all);
  return supplier;
}

// Patch farm profile / calc settings / status. Id + createdAt are never changed.
export async function updateSupplier(
  id: string,
  patch: Partial<Omit<Supplier, "id" | "createdAt">>,
): Promise<Supplier | null> {
  const all = await getSuppliers();
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch, id: all[idx].id, createdAt: all[idx].createdAt };
  await writeJson(SUPPLIERS_FILE, all);
  return all[idx];
}

// --- Batches --------------------------------------------------------------

export async function getBatches(): Promise<Batch[]> {
  return readJson<Batch>(BATCHES_FILE);
}

export async function getBatch(id: string): Promise<Batch | null> {
  const all = await getBatches();
  return all.find((b) => b.id === id) ?? null;
}

export async function getBatchesBySupplier(
  supplierId: string,
): Promise<Batch[]> {
  const all = await getBatches();
  return all.filter((b) => b.supplierId === supplierId);
}

// SUP logs a round. Age (freshness) is computed immediately; the carbon figure is
// deferred to the KYN "คำนวณ" step (computeBatch), matching the flowchart.
export async function addBatch(input: BatchInput): Promise<Batch> {
  const supplier = await getSupplier(input.supplierId);
  if (!supplier) throw new Error(`ไม่พบฟาร์ม: ${input.supplierId}`);
  if (supplier.status === "suspended") throw new Error("ฟาร์มนี้ถูกระงับการใช้งาน");

  const all = await getBatches();
  const now = new Date();
  const entryDate = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const batch: Batch = {
    id: nextBatchId(all.length, now.getUTCFullYear()),
    supplierId: input.supplierId,
    flowerCount: input.flowerCount,
    cutDate: input.cutDate,
    distanceKm: input.distanceKm,
    destination: input.destination,
    basketId: input.basketId || supplier.basketId,
    entryDate,
    co2ePerFlower: 0,
    ageDays: flowerAgeDays(input.cutDate, entryDate),
    status: input.status ?? "submitted",
    shipmentStatus: "cutting",
    createdAt: now.toISOString(),
  };
  all.push(batch);
  await writeJson(BATCHES_FILE, all);
  return batch;
}

// KYN engine: run the carbon calculation and mark the batch computed. Also advances a
// "cutting" shipment to "in_transit". No-op if the batch is missing a basket.
export async function computeBatch(id: string): Promise<Batch | null> {
  const all = await getBatches();
  const idx = all.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  const b = all[idx];
  const supplier = await getSupplier(b.supplierId);
  if (!supplier) return null;

  const { co2ePerFlower, ageDays } = enrichBatch(b, supplier);
  all[idx] = {
    ...b,
    co2ePerFlower,
    ageDays,
    status: "computed",
    shipmentStatus: b.shipmentStatus === "cutting" ? "in_transit" : b.shipmentStatus,
  };
  await writeJson(BATCHES_FILE, all);
  return all[idx];
}

// Generic patch (e.g. shipment status update). Recomputes nothing.
export async function updateBatch(
  id: string,
  patch: Partial<Omit<Batch, "id" | "supplierId" | "createdAt">>,
): Promise<Batch | null> {
  const all = await getBatches();
  const idx = all.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch, id: all[idx].id, supplierId: all[idx].supplierId, createdAt: all[idx].createdAt };
  await writeJson(BATCHES_FILE, all);
  return all[idx];
}

// --- Users ----------------------------------------------------------------

export async function getUsers(): Promise<User[]> {
  return readJson<User>(USERS_FILE);
}

// Match by username OR email, case-insensitive.
export async function getUserByLogin(login: string): Promise<User | null> {
  const q = login.trim().toLowerCase();
  const all = await getUsers();
  return (
    all.find(
      (u) => u.username.toLowerCase() === q || u.email.toLowerCase() === q,
    ) ?? null
  );
}

export async function addUser(
  input: Omit<User, "id" | "createdAt">,
): Promise<User> {
  const all = await getUsers();
  const user: User = {
    ...input,
    id: nextUserId(all.length),
    createdAt: new Date().toISOString(),
  };
  all.push(user);
  await writeJson(USERS_FILE, all);
  return user;
}

// --- Print logs (Thai Post → KYN Shipment/QR log) -------------------------

export async function getPrints(): Promise<PrintLog[]> {
  return readJson<PrintLog>(PRINTS_FILE);
}

export async function addPrint(
  input: Omit<PrintLog, "id" | "printedAt"> & { printedAt?: string },
): Promise<PrintLog> {
  const all = await getPrints();
  const log: PrintLog = {
    ...input,
    id: nextPrintId(all.length),
    printedAt: input.printedAt ?? new Date().toISOString(),
  };
  all.push(log);
  await writeJson(PRINTS_FILE, all);
  return log;
}

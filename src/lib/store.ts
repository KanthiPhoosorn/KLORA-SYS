// JSON-file-backed store — no database (per project decision).
// Reads/writes data/suppliers.json and data/batches.json with an atomic write
// (write temp file, then rename) so a crash mid-write can't corrupt the store.

import { promises as fs } from "fs";
import path from "path";
import type {
  Supplier,
  Batch,
  SupplierInput,
  BatchInput,
} from "./types";
import { nextSupplierId, nextBatchId } from "./ids";
import { enrichBatch } from "./carbon";

const DATA_DIR = path.join(process.cwd(), "data");
const SUPPLIERS_FILE = path.join(DATA_DIR, "suppliers.json");
const BATCHES_FILE = path.join(DATA_DIR, "batches.json");

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
    createdAt: now.toISOString(),
  };
  all.push(supplier);
  await writeJson(SUPPLIERS_FILE, all);
  return supplier;
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

// Creating a batch runs the carbon engine (the "กลางน้ำ / KYN" calculation step).
export async function addBatch(input: BatchInput): Promise<Batch> {
  const supplier = await getSupplier(input.supplierId);
  if (!supplier) {
    throw new Error(`Supplier not found: ${input.supplierId}`);
  }

  const all = await getBatches();
  const now = new Date();
  const entryDate = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const { co2ePerFlower, ageDays } = enrichBatch(
    { ...input, entryDate },
    supplier,
  );

  const batch: Batch = {
    id: nextBatchId(all.length, now.getUTCFullYear()),
    supplierId: input.supplierId,
    flowerCount: input.flowerCount,
    cutDate: input.cutDate,
    distanceKm: input.distanceKm,
    entryDate,
    co2ePerFlower,
    ageDays,
    createdAt: now.toISOString(),
  };
  all.push(batch);
  await writeJson(BATCHES_FILE, all);
  return batch;
}

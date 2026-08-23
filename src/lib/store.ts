// Postgres (Neon) store via Drizzle. The public function signatures are identical to the
// previous JSON-file store, so API routes and pages need no changes.
//
// Convention: nullable columns come back from Drizzle as `null`; the domain types use
// optional (`?`, i.e. `undefined`). `clean()` converts null -> undefined on every row read.

import { eq, and, or, desc, sql, isNull } from "drizzle-orm";
import { db } from "./db";
import { suppliers, batches, users, members, invites, notifications, prints, otp } from "./db/schema";
import type {
  Supplier,
  Batch,
  SupplierInput,
  BatchInput,
  User,
  PrintLog,
  Member,
  Invite,
  MemberRole,
  Notification,
} from "./types";
import {
  nextSupplierId,
  nextBatchId,
  nextUserId,
  nextPrintId,
  nextMemberId,
  nextInviteId,
} from "./ids";
import { enrichBatch, flowerAgeDays, basketReuseCounts } from "./carbon";

// null -> undefined so rows match the domain types' optional fields.
function clean<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const k in row) out[k] = row[k] === null ? undefined : row[k];
  return out as T;
}

const trailingNum = (id: string): number => {
  const m = /(\d+)$/.exec(id);
  return m ? parseInt(m[1], 10) : 0;
};

// --- Suppliers ------------------------------------------------------------

export async function getSuppliers(): Promise<Supplier[]> {
  const rows = await db.select().from(suppliers);
  return rows.map((r) => clean<Supplier>(r));
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const r = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return r[0] ? clean<Supplier>(r[0]) : null;
}

export async function addSupplier(input: SupplierInput): Promise<Supplier> {
  const now = new Date();
  const ids = await db.select({ id: suppliers.id }).from(suppliers);
  const maxN = ids.reduce((mx, r) => Math.max(mx, trailingNum(r.id)), 0);
  const row = {
    ...input,
    id: nextSupplierId(maxN, now.getUTCFullYear()),
    status: "active" as const,
    createdAt: now.toISOString(),
  };
  const [inserted] = await db.insert(suppliers).values(row).returning();
  return clean<Supplier>(inserted);
}

export async function updateSupplier(
  id: string,
  patch: Partial<Omit<Supplier, "id" | "createdAt">>,
): Promise<Supplier | null> {
  const [updated] = await db.update(suppliers).set(patch).where(eq(suppliers.id, id)).returning();
  return updated ? clean<Supplier>(updated) : null;
}

// --- Batches --------------------------------------------------------------

export async function getBatches(): Promise<Batch[]> {
  const rows = await db.select().from(batches);
  return rows.map((r) => clean<Batch>(r));
}

export async function getBatch(id: string): Promise<Batch | null> {
  const r = await db.select().from(batches).where(eq(batches.id, id)).limit(1);
  return r[0] ? clean<Batch>(r[0]) : null;
}

export async function getBatchesBySupplier(supplierId: string): Promise<Batch[]> {
  const rows = await db.select().from(batches).where(eq(batches.supplierId, supplierId));
  return rows.map((r) => clean<Batch>(r));
}

export async function addBatch(input: BatchInput): Promise<Batch> {
  const supplier = await getSupplier(input.supplierId);
  if (!supplier) throw new Error(`ไม่พบฟาร์ม: ${input.supplierId}`);
  if (supplier.status === "suspended") throw new Error("ฟาร์มนี้ถูกระงับการใช้งาน");

  const now = new Date();
  const entryDate = now.toISOString().slice(0, 10);
  const ids = await db.select({ id: batches.id }).from(batches);
  const maxN = ids.reduce((mx, r) => Math.max(mx, trailingNum(r.id)), 0);

  const row = {
    id: nextBatchId(maxN, now.getUTCFullYear()),
    supplierId: input.supplierId,
    flowerCount: input.flowerCount,
    variety: input.variety,
    cutDate: input.cutDate,
    distanceKm: input.distanceKm,
    destination: input.destination,
    carrier: input.carrier,
    postalCode: input.postalCode,
    branch: input.branch,
    boxMaterial: input.boxMaterial,
    weightKg: input.weightKg,
    basketIds: (input.basketIds ?? []).filter(Boolean),
    entryDate,
    co2ePerFlower: 0,
    ageDays: flowerAgeDays(input.cutDate, entryDate),
    status: input.status ?? ("submitted" as const),
    shipmentStatus: "cutting" as const,
    createdAt: now.toISOString(),
  };
  const [inserted] = await db.insert(batches).values(row).returning();
  return clean<Batch>(inserted);
}

export async function computeBatch(id: string): Promise<Batch | null> {
  const b = await getBatch(id);
  if (!b) return null;
  const supplier = await getSupplier(b.supplierId);
  if (!supplier) return null;

  const siblings = await getBatchesBySupplier(b.supplierId);
  const reuse = basketReuseCounts(siblings);
  const { co2ePerFlower, ageDays } = enrichBatch(b, supplier, (bid) => reuse.get(bid) ?? 0);

  const [updated] = await db
    .update(batches)
    .set({
      co2ePerFlower,
      ageDays,
      status: "computed",
      shipmentStatus: b.shipmentStatus === "cutting" ? "in_transit" : b.shipmentStatus,
    })
    .where(eq(batches.id, id))
    .returning();
  return updated ? clean<Batch>(updated) : null;
}

export async function updateBatch(
  id: string,
  patch: Partial<Omit<Batch, "id" | "supplierId" | "createdAt">>,
): Promise<Batch | null> {
  const [updated] = await db.update(batches).set(patch).where(eq(batches.id, id)).returning();
  return updated ? clean<Batch>(updated) : null;
}

// --- Users ----------------------------------------------------------------

export async function getUsers(): Promise<User[]> {
  const rows = await db.select().from(users);
  return rows.map((r) => clean<User>(r));
}

// Match by username OR email, case-insensitive.
export async function getUserByLogin(login: string): Promise<User | null> {
  const q = login.trim().toLowerCase();
  const r = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = ${q} or lower(${users.email}) = ${q}`)
    .limit(1);
  return r[0] ? clean<User>(r[0]) : null;
}

export async function addUser(input: Omit<User, "id" | "createdAt">): Promise<User> {
  const ids = await db.select({ id: users.id }).from(users);
  const maxN = ids.reduce((mx, r) => Math.max(mx, trailingNum(r.id)), 0);
  const row = { ...input, id: nextUserId(maxN), createdAt: new Date().toISOString() };
  const [inserted] = await db.insert(users).values(row).returning();
  return clean<User>(inserted);
}

export async function updateUser(
  id: string,
  patch: Partial<Omit<User, "id" | "createdAt">>,
): Promise<User | null> {
  const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  return updated ? clean<User>(updated) : null;
}

// --- Notifications --------------------------------------------------------

export async function getNotifications(supplierId?: string): Promise<Notification[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(supplierId ? or(isNull(notifications.supplierId), eq(notifications.supplierId, supplierId)) : undefined)
    .orderBy(desc(notifications.createdAt));
  return rows.map((r) => clean<Notification>(r));
}

// --- Team members + invites (จัดการระบบ) ----------------------------------

export async function getMembers(supplierId?: string): Promise<Member[]> {
  const rows = await db
    .select()
    .from(members)
    .where(supplierId ? eq(members.supplierId, supplierId) : undefined);
  return rows.map((r) => clean<Member>(r));
}

export async function addMember(input: Omit<Member, "id" | "createdAt">): Promise<Member> {
  const ids = await db.select({ id: members.id }).from(members);
  const maxN = ids.reduce((mx, r) => Math.max(mx, trailingNum(r.id)), 0);
  const row = { ...input, id: nextMemberId(maxN), createdAt: new Date().toISOString() };
  const [inserted] = await db.insert(members).values(row).returning();
  return clean<Member>(inserted);
}

export async function updateMember(
  id: string,
  patch: Partial<Pick<Member, "role" | "name" | "email">>,
): Promise<Member | null> {
  const [updated] = await db.update(members).set(patch).where(eq(members.id, id)).returning();
  return updated ? clean<Member>(updated) : null;
}

export async function removeMember(id: string): Promise<boolean> {
  const deleted = await db.delete(members).where(eq(members.id, id)).returning({ id: members.id });
  return deleted.length > 0;
}

export async function getInvites(supplierId?: string): Promise<Invite[]> {
  const rows = await db
    .select()
    .from(invites)
    .where(supplierId ? eq(invites.supplierId, supplierId) : undefined);
  return rows.map((r) => clean<Invite>(r));
}

export async function addInvite(supplierId: string, email: string, role: MemberRole): Promise<Invite> {
  const ids = await db.select({ id: invites.id }).from(invites);
  const maxN = ids.reduce((mx, r) => Math.max(mx, trailingNum(r.id)), 0);
  const row = {
    id: nextInviteId(maxN),
    supplierId,
    email,
    role,
    invitedAt: new Date().toISOString(),
    status: "pending" as const,
  };
  const [inserted] = await db.insert(invites).values(row).returning();
  return clean<Invite>(inserted);
}

export async function updateInvite(id: string, status: Invite["status"]): Promise<Invite | null> {
  const [updated] = await db.update(invites).set({ status }).where(eq(invites.id, id)).returning();
  return updated ? clean<Invite>(updated) : null;
}

// --- OTP (password reset) — email stubbed; code surfaced in the API for the demo. --------

export async function setOtp(email: string, code: string, ttlMs = 10 * 60 * 1000): Promise<void> {
  await db
    .insert(otp)
    .values({ email, code, expiresAt: Date.now() + ttlMs })
    .onConflictDoUpdate({ target: otp.email, set: { code, expiresAt: Date.now() + ttlMs } });
}

export async function checkOtp(email: string, code: string): Promise<boolean> {
  const r = await db
    .select()
    .from(otp)
    .where(sql`lower(${otp.email}) = ${email.toLowerCase()} and ${otp.code} = ${code} and ${otp.expiresAt} > ${Date.now()}`)
    .limit(1);
  return r.length > 0;
}

export async function clearOtp(email: string): Promise<void> {
  await db.delete(otp).where(sql`lower(${otp.email}) = ${email.toLowerCase()}`);
}

// --- Print logs (Thai Post → KYN Shipment/QR log) -------------------------

export async function getPrints(): Promise<PrintLog[]> {
  const rows = await db.select().from(prints);
  return rows.map((r) => clean<PrintLog>(r));
}

export async function addPrint(
  input: Omit<PrintLog, "id" | "printedAt"> & { printedAt?: string },
): Promise<PrintLog> {
  const ids = await db.select({ id: prints.id }).from(prints);
  const maxN = ids.reduce((mx, r) => Math.max(mx, trailingNum(r.id)), 0);
  const row = {
    ...input,
    id: nextPrintId(maxN),
    printedAt: input.printedAt ?? new Date().toISOString(),
  };
  const [inserted] = await db.insert(prints).values(row).returning();
  return clean<PrintLog>(inserted);
}

export async function updatePrint(
  id: string,
  patch: Partial<Omit<PrintLog, "id">>,
): Promise<PrintLog | null> {
  const [updated] = await db.update(prints).set(patch).where(eq(prints.id, id)).returning();
  return updated ? clean<PrintLog>(updated) : null;
}

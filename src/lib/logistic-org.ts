// Logistic companies → branches → accounts (doc tab "Logistic", 17 Oct 2026). Server only.
//   - A company (CID-…) is created by its own sign-up (pending until KYN checks it) or from a KYN invite link.
//   - It always has a head office (สำนักงานใหญ่); other branches register through the company's one link
//     and stay pending until the head office approves them.
//   - Every lot belongs to the branch the farm drops it at (สาขาต้นทาง). A branch account sees its own
//     branch's lots, a head-office account its whole company's — a new company starts empty.
import { cache } from "react";
import { eq, asc } from "drizzle-orm";
import { randomInt } from "crypto";
import { db } from "./db";
import { logisticOrgs, logisticBranches, users, appSettings, batches, carrierLinks, suppliers } from "./db/schema";
import type { LogisticOrg, LogisticBranch, BranchEvent, User, Batch } from "./types";
import { getBatches } from "./store";
import { RECORDS_EXPORTS } from "./carriers";

const clean = <T>(row: Record<string, unknown>): T => {
  const out: Record<string, unknown> = {};
  for (const k in row) out[k] = row[k] === null ? undefined : row[k];
  return out as T;
};
const toNull = <T extends Record<string, unknown>>(p: T) =>
  Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === undefined ? null : v])) as T;

// --- companies -------------------------------------------------------------------------------------------

export async function getOrg(code?: string | null): Promise<LogisticOrg | null> {
  if (!code) return null;
  const [r] = await db.select().from(logisticOrgs).where(eq(logisticOrgs.orgCode, code)).limit(1);
  return r ? clean<LogisticOrg>(r) : null;
}
export async function getOrgs(): Promise<LogisticOrg[]> {
  return (await db.select().from(logisticOrgs).orderBy(asc(logisticOrgs.createdAt))).map((r) => clean<LogisticOrg>(r));
}
export async function addOrg(o: Omit<LogisticOrg, "createdAt">): Promise<LogisticOrg> {
  const [r] = await db.insert(logisticOrgs).values(toNull({ ...o, createdAt: new Date().toISOString() })).returning();
  return clean<LogisticOrg>(r);
}
export async function updateOrg(code: string, patch: Partial<Omit<LogisticOrg, "orgCode" | "createdAt">>): Promise<LogisticOrg | null> {
  const set = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? null : v]));
  const [r] = await db.update(logisticOrgs).set(set).where(eq(logisticOrgs.orgCode, code)).returning();
  return r ? clean<LogisticOrg>(r) : null;
}
export async function orgByJoinToken(token: string): Promise<LogisticOrg | null> {
  if (!token) return null;
  const [r] = await db.select().from(logisticOrgs).where(eq(logisticOrgs.joinToken, token.toUpperCase())).limit(1);
  return r ? clean<LogisticOrg>(r) : null;
}
/** "K7Q2-M9XA" — no 0/O/1/I to misread off a screen or paper */
export function newJoinToken(): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => Array.from({ length: 4 }, () => A[randomInt(A.length)]).join("");
  return `${pick()}-${pick()}`;
}

// KYN's company invite link (/logistic/register?invite=TOKEN): a company that signs up through it is
// active at once; one signing up alone waits for KYN to check it.
export interface CompanyInvite { token: string; createdAt: string; createdBy?: string }
export async function getCompanyInvite(): Promise<CompanyInvite | null> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.key, "logistic_invite")).limit(1);
  const v = r?.value as CompanyInvite | null | undefined;
  return v && v.token ? v : null;
}
export async function setCompanyInvite(by: string, close = false): Promise<CompanyInvite | null> {
  const now = new Date().toISOString();
  const value = close ? { token: "", createdAt: now, createdBy: by } : { token: newJoinToken(), createdAt: now, createdBy: by };
  await db.insert(appSettings).values({ key: "logistic_invite", value, updatedAt: now, updatedBy: by })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: now, updatedBy: by } });
  return close ? null : value;
}

// --- branches --------------------------------------------------------------------------------------------

export async function getBranches(orgCode?: string): Promise<LogisticBranch[]> {
  const q = db.select().from(logisticBranches);
  const rows = orgCode ? await q.where(eq(logisticBranches.orgCode, orgCode)).orderBy(asc(logisticBranches.id)) : await q.orderBy(asc(logisticBranches.id));
  return rows.map((r) => clean<LogisticBranch>(r));
}
export async function getBranch(id?: string | null): Promise<LogisticBranch | null> {
  if (!id) return null;
  const [r] = await db.select().from(logisticBranches).where(eq(logisticBranches.id, id)).limit(1);
  return r ? clean<LogisticBranch>(r) : null;
}
async function nextBranchId(): Promise<string> {
  const ids = await db.select({ id: logisticBranches.id }).from(logisticBranches);
  const n = ids.reduce((mx, r) => Math.max(mx, Number(/(\d+)$/.exec(r.id)?.[1] ?? 0)), 0);
  return `LBR-${String(n + 1).padStart(4, "0")}`;
}
export async function addBranch(b: Omit<LogisticBranch, "id" | "createdAt" | "history"> & { history?: BranchEvent[] }): Promise<LogisticBranch> {
  const now = new Date().toISOString();
  for (let attempt = 0; ; attempt++) {
    try {
      const [r] = await db.insert(logisticBranches).values(toNull({ ...b, id: await nextBranchId(), history: b.history ?? [], createdAt: now })).returning();
      return clean<LogisticBranch>(r);
    } catch (e) {
      if (attempt >= 3) throw e; // two sign-ups at once took the same id — try the next one
    }
  }
}
/** Change a branch; `event` goes to the end of its history (ประวัติ). */
export async function updateBranch(id: string, patch: Partial<Omit<LogisticBranch, "id" | "orgCode" | "createdAt" | "history">>, event?: Omit<BranchEvent, "at">): Promise<LogisticBranch | null> {
  const cur = await getBranch(id);
  if (!cur) return null;
  const set: Record<string, unknown> = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? null : v]));
  if (event) set.history = [...cur.history, { ...event, at: new Date().toISOString() }];
  const [r] = await db.update(logisticBranches).set(set).where(eq(logisticBranches.id, id)).returning();
  return r ? clean<LogisticBranch>(r) : null;
}
/** The accounts of a branch (สมาชิก) */
export async function branchUsers(branchId: string): Promise<User[]> {
  return (await db.select().from(users).where(eq(users.branchId, branchId))).map((r) => clean<User>(r));
}
export async function orgUsers(orgCode: string): Promise<User[]> {
  return (await db.select().from(users).where(eq(users.orgCode, orgCode))).map((r) => clean<User>(r));
}

// --- access -----------------------------------------------------------------------------------------------

export type AccessState = "active" | "org_pending" | "branch_pending" | "blocked";
export interface LogisticAccess {
  state: AccessState;
  /** why a login is refused (blocked) */
  reason?: string;
  org: LogisticOrg | null;
  branch: LogisticBranch | null;
  /** the account belongs to the head office — it sees and manages every branch of its company */
  hq: boolean;
}

/** Where a logistic account stands: its company and branch, and whether it may work. Looked up once per
 *  request (a page asks several times: session, layout, page, lot scope). An account with no branch is
 *  never the head office — it sees nothing until it has one. */
export async function logisticAccess(user: Pick<User, "role" | "orgCode" | "branchId">): Promise<LogisticAccess> {
  return accessFor(user.orgCode ?? null, user.branchId ?? null);
}
const accessFor = cache(async (orgCode: string | null, branchId: string | null): Promise<LogisticAccess> => {
  const [org, branch] = await Promise.all([getOrg(orgCode), getBranch(branchId)]);
  const hq = !!branch?.isHq && branch.orgCode === org?.orgCode;
  if (!org) return { state: "active", org: null, branch, hq: false };
  if (org.status === "suspended") return { state: "blocked", reason: "บัญชีบริษัทนี้ถูกระงับการใช้งาน กรุณาติดต่อ KYN", org, branch, hq };
  if (org.status === "rejected") return { state: "blocked", reason: `การลงทะเบียนบริษัทไม่ผ่านการตรวจสอบ${org.rejectReason ? ` — ${org.rejectReason}` : ""}`, org, branch, hq };
  if (branch?.status === "disabled") return { state: "blocked", reason: "สาขานี้ถูกปิดการใช้งาน กรุณาติดต่อสำนักงานใหญ่", org, branch, hq };
  if (branch?.status === "rejected") return { state: "blocked", reason: `สำนักงานใหญ่ไม่อนุมัติการลงทะเบียนสาขานี้${branch.rejectReason ? ` — ${branch.rejectReason}` : ""}`, org, branch, hq };
  if (org.status === "pending") return { state: "org_pending", org, branch, hq };
  if (branch?.status === "pending") return { state: "branch_pending", org, branch, hq };
  return { state: "active", org, branch, hq };
});

/** Write APIs: a logistic account may change data only while its company and branch are active. */
export async function logisticWriteRefusal(user: Pick<User, "role" | "orgCode" | "branchId">): Promise<string | null> {
  if (user.role !== "logistic") return null;
  const a = await logisticAccess(user);
  if (a.state === "active") return null;
  if (a.state === "branch_pending") return "สาขายังรอการอนุมัติจากสำนักงานใหญ่ — ยังบันทึกข้อมูลไม่ได้";
  if (a.state === "org_pending") return "บริษัทยังรอการตรวจสอบจากผู้ดูแลระบบ — ยังบันทึกข้อมูลไม่ได้";
  return a.reason ?? "บัญชีนี้ใช้งานไม่ได้";
}

// --- whose lots ------------------------------------------------------------------------------------------

export type LotTest = (lot: Pick<Batch, "branchId" | "carrierOrg">) => boolean;

/** Which lots an account sees. KYN: all. Head office: its company's (optionally one of its branches).
 *  Branch: its own. A farm or an unplaced account: none here (farms have their own lists). */
export async function lotScope(user: Pick<User, "role" | "orgCode" | "branchId">, onlyBranch?: string | null): Promise<LotTest> {
  if (user.role === "kyn") return () => true;
  if (user.role !== "logistic") return () => false;
  const a = await logisticAccess(user);
  if (!a.org || !a.branch) return () => false;
  if (a.hq) {
    const mine = new Set((await getBranches(a.org.orgCode)).map((b) => b.id));
    if (onlyBranch) return mine.has(onlyBranch) ? (l) => l.branchId === onlyBranch : () => false;
    const org = a.org.orgCode;
    return (l) => (l.branchId ? mine.has(l.branchId) : l.carrierOrg === org);
  }
  const own = a.branch.id;
  return (l) => l.branchId === own;
}

/** Carrier-side refusal for one lot (print, export record, edit). */
export async function lotRefusal(user: Pick<User, "role" | "orgCode" | "branchId">, lot: Pick<Batch, "branchId" | "carrierOrg"> | null | undefined): Promise<string | null> {
  if (user.role !== "logistic" || !lot) return null;
  const write = await logisticWriteRefusal(user);
  if (write) return write;
  return (await lotScope(user))(lot) ? null : "ล็อตนี้ไม่ได้ส่งผ่านสาขาของคุณ — ดำเนินการไม่ได้";
}

/** The lots this account works with (see lotScope); `onlyBranch` = a head office looking at one branch. */
export async function myLots(user: Pick<User, "role" | "orgCode" | "branchId">, onlyBranch?: string | null, opts: { withCancelled?: boolean } = {}): Promise<Batch[]> {
  const [test, all] = await Promise.all([lotScope(user, onlyBranch), getBatches(opts)]);
  return all.filter(test);
}

/** สาขาต้นทาง of a farm's round → the branch record that owns the lot. `asked` is the form's branch id; a
 *  bound farm may only use its carrier's branches. An "อื่นๆ (ระบุ)" text with no record keeps the text and no
 *  branch (no carrier sees it until KYN sorts it out). Mutates `fields`; returns an error to show, or null. */
export async function placeRound(fields: { branch?: string; branchId?: string }, asked: unknown, boundOrg?: string, keep?: string): Promise<string | null> {
  const id = typeof asked === "string" ? asked.trim() : "";
  if (id) {
    const b = await getBranch(id);
    const live = b && b.status === "active" && (await getOrg(b.orgCode))?.status === "active";
    if (!b || (!live && b.id !== keep)) return "สาขาต้นทางนี้ใช้งานไม่ได้ กรุณาเลือกสาขาอื่น";
    if (boundOrg && b.orgCode !== boundOrg) return "ฟาร์มนี้ส่งได้เฉพาะสาขาของผู้ขนส่งที่ผูกไว้";
    fields.branchId = b.id;
    fields.branch = b.name;
    return null;
  }
  const name = (fields.branch ?? "").trim();
  fields.branchId = undefined;
  if (!name) return null;
  const liveOrgs = new Set((await getOrgs()).filter((o) => o.status === "active").map((o) => o.orgCode));
  const hits = (await getBranches(boundOrg)).filter((b) => b.status === "active" && liveOrgs.has(b.orgCode) && b.name === name);
  if (hits.length === 1) fields.branchId = hits[0].id; // a typed name that is exactly one branch
  return null;
}

/** สาขาต้นทาง choices for a farm's round: every active branch (with its company), or only the carrier's own
 *  when the farm is bound to one. `keep` = the lot's current branch, listed even if since closed. */
export interface OriginBranch { id: string; name: string; company: string; lat?: number; lng?: number }
export async function originBranches(boundOrg?: string | null, keep?: string | null): Promise<OriginBranch[]> {
  const [orgs, branches] = await Promise.all([getOrgs(), getBranches(boundOrg ?? undefined)]);
  const live = new Map(orgs.filter((o) => o.status === "active").map((o) => [o.orgCode, o.company]));
  return branches
    .filter((b) => b.id === keep || (b.status === "active" && live.has(b.orgCode)))
    .map((b) => ({ id: b.id, name: b.name, company: live.get(b.orgCode) ?? orgs.find((o) => o.orgCode === b.orgCode)?.company ?? b.orgCode, lat: b.lat, lng: b.lng }))
    .sort((a, b) => a.company.localeCompare(b.company, "th") || Number(b.name === "สำนักงานใหญ่") - Number(a.name === "สำนักงานใหญ่") || a.name.localeCompare(b.name, "th"));
}

/** A branch's new name, everywhere it is written: its accounts, its lots, its producer links, bound farms. */
export async function renameBranchEverywhere(id: string, name: string): Promise<void> {
  await db.update(users).set({ branch: name }).where(eq(users.branchId, id));
  await db.update(batches).set({ branch: name }).where(eq(batches.branchId, id));
  await db.update(carrierLinks).set({ branch: name }).where(eq(carrierLinks.branchId, id));
  await db.update(suppliers).set({ carrierBranch: name }).where(eq(suppliers.carrierBranchId, id));
}

/** A producer link works only while its company and its branch do (a closed branch's link stops too). */
export async function linkUsable(link: { orgCode: string; branchId?: string | null }): Promise<boolean> {
  const org = await getOrg(link.orgCode);
  if (org && org.status !== "active") return false;
  const b = link.branchId ? await getBranch(link.branchId) : null;
  return !b || b.status === "active";
}

/** "เพิ่มข้อมูลรอบส่งออก" (recording an export, or a round for a farm) is for ศูนย์คัดแยกสินค้า / ผู้ส่งออก only. */
export async function exportRefusal(user: Pick<User, "role" | "orgCode" | "branchId">): Promise<string | null> {
  if (user.role !== "logistic") return null;
  const a = await logisticAccess(user);
  if (a.org && !RECORDS_EXPORTS.includes(a.org.providerType)) return "บันทึกรอบส่งออกได้เฉพาะศูนย์คัดแยกสินค้าและผู้ส่งออก";
  return null;
}

/** Postgres unique violation (a code / name taken by a sign-up a moment earlier) */
export const isUniqueViolation = (e: unknown): boolean => {
  const x = e as { code?: string; cause?: { code?: string } } | null;
  return x?.code === "23505" || x?.cause?.code === "23505";
};
/** Undo a sign-up that failed half way: the company (its branches go with it) / one branch. */
export async function dropOrg(code: string): Promise<void> {
  await db.delete(logisticOrgs).where(eq(logisticOrgs.orgCode, code));
}
export async function dropBranch(id: string): Promise<void> {
  await db.delete(logisticBranches).where(eq(logisticBranches.id, id));
}

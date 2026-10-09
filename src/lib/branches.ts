// Logistic branch list (KYN spec §2.5 "Branch Tagging Module" — table `logistic_branches`).
// Every shipment is stamped with a branch so KYN can compare sustainability between branches.
//
// ⚠ KYN has not supplied the real branch master list yet. These are the standard Thai
// distribution hubs as placeholders — replace wholesale when KYN sends `logistic_branches`.

export interface Branch {
  id: string; // branch_id, e.g. BR-BKK-01
  name: string; // branch_name
  lat: number; // origin point for the transport distance (สาขาต้นทาง → ผู้รับ); city/hub centre
  lng: number;
}

export const BRANCHES: Branch[] = [
  { id: "BR-BKK-01", name: "ศูนย์กระจายสินค้าดอนเมือง (กรุงเทพฯ)", lat: 13.9126, lng: 100.6068 },
  { id: "BR-BKK-02", name: "ศูนย์กระจายสินค้าบางนา (กรุงเทพฯ)", lat: 13.6681, lng: 100.6045 },
  { id: "BR-BKK-03", name: "ศูนย์กระจายสินค้าหลักสี่ (กรุงเทพฯ)", lat: 13.8873, lng: 100.5789 },
  { id: "BR-CNX-01", name: "สาขาเชียงใหม่", lat: 18.7883, lng: 98.9853 },
  { id: "BR-CEI-01", name: "สาขาเชียงราย", lat: 19.9105, lng: 99.8406 },
  { id: "BR-PYO-01", name: "สาขาพะเยา", lat: 19.1666, lng: 99.9019 },
  { id: "BR-KKC-01", name: "สาขาขอนแก่น", lat: 16.4322, lng: 102.8236 },
  { id: "BR-NMA-01", name: "สาขานครราชสีมา", lat: 14.9799, lng: 102.0977 },
  { id: "BR-CBI-01", name: "สาขาชลบุรี", lat: 13.3611, lng: 100.9847 },
  { id: "BR-HDY-01", name: "สาขาหาดใหญ่ (สงขลา)", lat: 7.0084, lng: 100.4747 },
  { id: "BR-HKT-01", name: "สาขาภูเก็ต", lat: 7.8804, lng: 98.3923 },
];

/** A branch by id or by (part of) its name — logistic accounts store the branch as text. */
export function findBranch(idOrName?: string | null): Branch | undefined {
  const q = (idOrName ?? "").trim();
  if (!q) return undefined;
  const core = (s: string) => s.replace(/^(สาขา|ศูนย์กระจายสินค้า)\s*/, "").replace(/\s*\(.*\)$/, "").trim();
  return BRANCHES.find((b) => b.id === q || b.name === q) ?? BRANCHES.find((b) => core(b.name) === core(q) || (core(q).length >= 3 && b.name.includes(core(q))));
}

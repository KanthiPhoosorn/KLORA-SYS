// Logistic branch list (KYN spec §2.5 "Branch Tagging Module" — table `logistic_branches`).
// Every shipment is stamped with a branch so KYN can compare sustainability between branches.
//
// ⚠ KYN has not supplied the real branch master list yet. These are the standard Thai
// distribution hubs as placeholders — replace wholesale when KYN sends `logistic_branches`.

export interface Branch {
  id: string; // branch_id, e.g. BR-BKK-01
  name: string; // branch_name
}

export const BRANCHES: Branch[] = [
  { id: "BR-BKK-01", name: "ศูนย์กระจายสินค้าดอนเมือง (กรุงเทพฯ)" },
  { id: "BR-BKK-02", name: "ศูนย์กระจายสินค้าบางนา (กรุงเทพฯ)" },
  { id: "BR-BKK-03", name: "ศูนย์กระจายสินค้าหลักสี่ (กรุงเทพฯ)" },
  { id: "BR-CNX-01", name: "สาขาเชียงใหม่" },
  { id: "BR-CEI-01", name: "สาขาเชียงราย" },
  { id: "BR-PYO-01", name: "สาขาพะเยา" },
  { id: "BR-KKC-01", name: "สาขาขอนแก่น" },
  { id: "BR-NMA-01", name: "สาขานครราชสีมา" },
  { id: "BR-CBI-01", name: "สาขาชลบุรี" },
  { id: "BR-HDY-01", name: "สาขาหาดใหญ่ (สงขลา)" },
  { id: "BR-HKT-01", name: "สาขาภูเก็ต" },
];

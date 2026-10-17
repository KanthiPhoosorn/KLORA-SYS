// One-off migration (17 Oct 2026, doc tab "Logistic"): logistic companies and their branches become real
// records. A company (CID-…) has a head office (สำนักงานใหญ่) and branches that register through the
// company's link and wait for the head office to approve them. Every lot belongs to the branch the farm
// drops it at (สาขาต้นทาง), so a company sees only its own lots — a new company starts empty.
//   npx tsx --env-file=.env.local scripts/add-logistic-orgs.ts
// Idempotent: tables/columns are created if missing; existing companies are seeded only once.
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);

// The branch list Thai Post's demo company used before branches were records (src/lib/branches.ts placeholders).
const DEMO_BRANCHES: [string, string, number, number][] = [
  ["ศูนย์กระจายสินค้าดอนเมือง (กรุงเทพฯ)", "กรุงเทพมหานคร", 13.9126, 100.6068],
  ["ศูนย์กระจายสินค้าบางนา (กรุงเทพฯ)", "กรุงเทพมหานคร", 13.6681, 100.6045],
  ["ศูนย์กระจายสินค้าหลักสี่ (กรุงเทพฯ)", "กรุงเทพมหานคร", 13.8873, 100.5789],
  ["สาขาเชียงใหม่", "เชียงใหม่", 18.7883, 98.9853],
  ["สาขาเชียงราย", "เชียงราย", 19.9105, 99.8406],
  ["สาขาพะเยา", "พะเยา", 19.1666, 99.9019],
  ["สาขาขอนแก่น", "ขอนแก่น", 16.4322, 102.8236],
  ["สาขานครราชสีมา", "นครราชสีมา", 14.9799, 102.0977],
  ["สาขาชลบุรี", "ชลบุรี", 13.3611, 100.9847],
  ["สาขาหาดใหญ่ (สงขลา)", "สงขลา", 7.0084, 100.4747],
  ["สาขาภูเก็ต", "ภูเก็ต", 7.8804, 98.3923],
  ["สาขาฝาง", "เชียงใหม่", 19.9186, 99.2135],
];

(async () => {
  await sql`CREATE TABLE IF NOT EXISTS logistic_orgs (
    org_code text PRIMARY KEY,
    company text NOT NULL,
    provider_type text NOT NULL DEFAULT 'private',
    phone text, tax_id text,
    address text, subdistrict text, district text, province text, postcode text,
    lat double precision, lng double precision,
    status text NOT NULL DEFAULT 'active',
    reject_reason text,
    join_token text UNIQUE, join_created_at text, join_created_by text,
    created_at text NOT NULL, decided_at text, decided_by text
  )`;
  await sql`CREATE TABLE IF NOT EXISTS logistic_branches (
    id text PRIMARY KEY,
    org_code text NOT NULL REFERENCES logistic_orgs(org_code) ON DELETE CASCADE ON UPDATE CASCADE,
    name text NOT NULL,
    is_hq boolean NOT NULL DEFAULT false,
    phone text, address text, subdistrict text, district text, province text, postcode text,
    lat double precision, lng double precision,
    status text NOT NULL,
    admin_user_id text,
    reject_reason text,
    history jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at text NOT NULL, decided_at text, decided_by text
  )`;
  await sql`CREATE INDEX IF NOT EXISTS logistic_branches_org ON logistic_branches (org_code)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS branch_id text`;
  await sql`ALTER TABLE carrier_links ADD COLUMN IF NOT EXISTS branch_id text`;
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS carrier_branch_id text`;

  const now = new Date().toISOString();
  let n = Number((await sql`SELECT coalesce(max(substring(id from 5)::int), 0) AS n FROM logistic_branches`)[0].n);
  const nextId = () => `LBR-${String(++n).padStart(4, "0")}`;
  const ev = (text: string) => JSON.stringify([{ at: now, text }]);

  // every logistic company that has an account
  const users = await sql`SELECT id, org_code, company, branch, created_at FROM users WHERE role = 'logistic' AND org_code IS NOT NULL ORDER BY created_at`;
  const links = await sql`SELECT org_code, carrier_key FROM carrier_links ORDER BY created_at`;
  for (const org of [...new Set(users.map((u) => u.org_code as string))]) {
    if ((await sql`SELECT 1 FROM logistic_orgs WHERE org_code = ${org}`).length) continue;
    const mine = users.filter((u) => u.org_code === org);
    const first = mine[0];
    const company = String(first.company ?? org);
    const type = /ไปรษณีย์|ไทยโพสต์|thai ?post/i.test(company) ? "thaipost" : (links.find((l) => l.org_code === org)?.carrier_key as string) ?? "private";
    const demo = org === "CID-0005";
    await sql`INSERT INTO logistic_orgs (org_code, company, provider_type, address, subdistrict, district, province, postcode, lat, lng, status, created_at, decided_at, decided_by)
      VALUES (${org}, ${company}, ${type},
        ${demo ? "111 ถนนแจ้งวัฒนะ" : null}, ${demo ? "ทุ่งสองห้อง" : null}, ${demo ? "หลักสี่" : null}, ${demo ? "กรุงเทพมหานคร" : null}, ${demo ? "10210" : null},
        ${demo ? 13.8873 : null}, ${demo ? 100.5789 : null}, 'active', ${String(first.created_at)}, ${now}, 'migration')`;
    // head office: the company's first account runs it
    const hq = nextId();
    await sql`INSERT INTO logistic_branches (id, org_code, name, is_hq, address, subdistrict, district, province, postcode, lat, lng, status, admin_user_id, history, created_at, decided_at, decided_by)
      VALUES (${hq}, ${org}, 'สำนักงานใหญ่', true,
        ${demo ? "111 ถนนแจ้งวัฒนะ" : null}, ${demo ? "ทุ่งสองห้อง" : null}, ${demo ? "หลักสี่" : null}, ${demo ? "กรุงเทพมหานคร" : null}, ${demo ? "10210" : null},
        ${demo ? 13.8873 : null}, ${demo ? 100.5789 : null}, 'active', ${String(first.id)}, ${ev("สร้างสำนักงานใหญ่")}::jsonb, ${String(first.created_at)}, ${now}, 'migration')`;
    if (demo) {
      for (const [name, province, lat, lng] of DEMO_BRANCHES) {
        await sql`INSERT INTO logistic_branches (id, org_code, name, province, lat, lng, status, history, created_at, decided_at, decided_by)
          VALUES (${nextId()}, ${org}, ${name}, ${province}, ${lat}, ${lng}, 'active', ${ev("ย้ายจากรายชื่อสาขาเดิม")}::jsonb, ${now}, ${now}, 'migration')`;
      }
    }
    for (const u of mine) {
      await sql`UPDATE users SET branch_id = ${hq}, branch = 'สำนักงานใหญ่' WHERE id = ${String(u.id)}`;
      // team invites / members were keyed by the inviting account — now by its branch
      await sql`UPDATE invites SET supplier_id = ${hq} WHERE supplier_id = ${String(u.id)}`;
      await sql`UPDATE members SET supplier_id = ${hq} WHERE supplier_id = ${String(u.id)}`;
    }
    console.log(`${org} ${company} (${type}) → HQ ${hq}${demo ? ` + ${DEMO_BRANCHES.length} branches` : ""}; users ${mine.map((u) => u.id).join(", ")}`);
  }

  // lots without a branch record: a bound lot goes to its carrier; the rest is the demo company's history
  const lots = await sql`SELECT id, branch, carrier_org FROM batches WHERE branch_id IS NULL`;
  for (const l of lots) {
    const org = (l.carrier_org as string | null) ?? "CID-0005";
    const named = l.branch ? await sql`SELECT id FROM logistic_branches WHERE org_code = ${org} AND name = ${String(l.branch)} LIMIT 1` : [];
    const hq = await sql`SELECT id FROM logistic_branches WHERE org_code = ${org} AND is_hq LIMIT 1`;
    const to = (named[0]?.id ?? hq[0]?.id) as string | undefined;
    if (to) await sql`UPDATE batches SET branch_id = ${to} WHERE id = ${String(l.id)}`;
  }
  // links and bound farms: their branch by name
  await sql`UPDATE carrier_links c SET branch_id = b.id FROM logistic_branches b WHERE c.branch_id IS NULL AND b.org_code = c.org_code AND b.name = c.branch`;
  await sql`UPDATE suppliers s SET carrier_branch_id = b.id FROM logistic_branches b WHERE s.carrier_branch_id IS NULL AND b.org_code = s.carrier_org AND b.name = s.carrier_branch`;

  console.log(await sql`SELECT org_code, company, provider_type, status FROM logistic_orgs ORDER BY org_code`);
  console.log(await sql`SELECT b.org_code, b.id, b.name, b.is_hq, b.status, count(l.id)::int AS lots FROM logistic_branches b LEFT JOIN batches l ON l.branch_id = b.id GROUP BY 1,2,3,4,5 ORDER BY b.id`);
  console.log(await sql`SELECT id, org_code, branch, branch_id FROM users WHERE role = 'logistic'`);
  console.log("lots without a branch:", (await sql`SELECT count(*)::int AS n FROM batches WHERE branch_id IS NULL`)[0].n);
})();

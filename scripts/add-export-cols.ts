// One-off migration (22 Sep 2026): what the carrier records on /logistic/new (ship type, date,
// airline/flight for exports, who/when) so the round shows up as "บันทึกการจัดส่งแล้ว".
//   npx tsx --env-file=.env.local scripts/add-export-cols.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  for (const c of ["ship_type", "ship_date", "airline", "flight_no", "export_recorded_at", "export_recorded_by"]) {
    await sql.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS ${c} text`);
  }
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'batches' AND column_name IN ('ship_type','ship_date','airline','flight_no','export_recorded_at','export_recorded_by') ORDER BY 1`;
  console.log("batches cols:", cols.map((c) => c.column_name).join(", "));
})();

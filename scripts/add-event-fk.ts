// One-off migration (9 Oct 2026, QA pass): batch_events.batch_id → batches.id with ON DELETE / ON UPDATE
// CASCADE, so deleting a lot (test clean-ups, admin fixes) never leaves orphaned history behind and a lot
// rename (BAT → LOT) carries its history along. Idempotent.
//   npx tsx --env-file=.env.local scripts/add-event-fk.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  const gone = await sql`DELETE FROM batch_events WHERE batch_id NOT IN (SELECT id FROM batches) RETURNING id`;
  const [has] = await sql`SELECT 1 AS x FROM pg_constraint WHERE conname = 'batch_events_batch_fk'`;
  if (!has) await sql`ALTER TABLE batch_events ADD CONSTRAINT batch_events_batch_fk FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE ON UPDATE CASCADE`;
  console.log(`orphans removed: ${gone.length} · foreign key ${has ? "already there" : "added"}`);
})();

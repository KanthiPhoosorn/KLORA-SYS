// Recompute every already-computed batch so stored CO2e uses the CURRENT factors in carbon.ts.
// Run after changing FACTORS:  npx tsx scripts/recompute-batches.ts
// NOTE: store/db is imported dynamically so dotenv runs before db/index.ts reads DATABASE_URL.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { getBatches, computeBatch } = await import("../src/lib/store");
  const all = await getBatches();
  const computed = all.filter((b) => b.status === "computed");
  console.log(`recomputing ${computed.length} of ${all.length} batches...`);
  for (const b of computed) {
    const before = b.co2ePerFlower;
    const after = await computeBatch(b.id);
    console.log(`  ${b.id}: ${before.toFixed(4)} -> ${after?.co2ePerFlower.toFixed(4)}`);
  }
  console.log("done.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

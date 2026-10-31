// Try the Thai Post Track & Trace API with real tracking numbers and print exactly what comes back, so the
// field names, the "delivered" status code and the date format can be confirmed before any screen uses them.
// Each number counts against the account's daily quota (about 1,000).
//   npx tsx --env-file=.env.local scripts/thaipost-track-probe.ts EF123456789TH [more numbers]
import { thaipostTrackOn, trackBarcodes, isThaipostBarcode } from "../src/lib/thaipost-track";

(async () => {
  const numbers = process.argv.slice(2);
  if (!thaipostTrackOn()) { console.log("THAIPOST_TRACK_TOKEN is not set in .env.local (token from the dashboard on track.thailandpost.co.th)"); process.exit(1); }
  if (!numbers.length) { console.log("give one or more Thai Post tracking numbers, e.g. EF123456789TH"); process.exit(1); }
  const skipped = numbers.filter((n) => !isThaipostBarcode(n));
  if (skipped.length) console.log("not Thai Post numbers, skipped:", skipped.join(", "));
  const r = await trackBarcodes(numbers);
  console.log(JSON.stringify(r.raw, null, 2));
  for (const [barcode, events] of Object.entries(r.items)) {
    console.log(`\n${barcode}: ${events.length} events`);
    for (const e of events) console.log(`  ${e.status}  ${e.status_date ?? ""}  ${e.status_description ?? ""}  ${e.location ?? ""}`);
  }
  if (r.count) console.log(`\nquota today: ${r.count.used ?? "?"} / ${r.count.limit ?? "?"} (${r.count.date ?? ""})`);
})().catch((e) => { console.error(String(e)); process.exit(1); });

import { FUEL_EF, VEHICLE_PROFILE, deriveTransportEF } from "../src/lib/transport-ef";
let pass = 0, fail = 0;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
function check(name: string, got: number, want: number) {
  if (near(got, want)) { pass++; console.log(`  PASS  ${name}: ${got.toFixed(6)}`); }
  else { fail++; console.log(`  FAIL  ${name}: got ${got}, want ${want}`); }
}
const d = deriveTransportEF("6_wheeler", "B7")!;
check("6-wheeler B7 EF_vkm = 0.20 L/km * 2.5504", d.efVkm, 0.2 * 2.5504);
check("6-wheeler B7 EF_tkm = vkm / 6 t", d.efTkm, (0.2 * 2.5504) / 6);
const ev = deriveTransportEF("motorcycle_ev", "EV")!;
check("EV motorcycle uses grid 0.475", ev.efVkm, 0.035 * 0.475);
console.log(`  official fuel EFs: ${Object.values(FUEL_EF).filter((f) => f.official).length}/${Object.keys(FUEL_EF).length}`);
console.log(`  vehicle profiles (all assumptions): ${Object.keys(VEHICLE_PROFILE).length}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

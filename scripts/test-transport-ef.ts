import { FUEL_EF, VEHICLE_PROFILE, deriveTransportEF } from "../src/lib/transport-ef";
let pass = 0, fail = 0;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
function check(name: string, got: number, want: number) {
  if (near(got, want)) { pass++; console.log(`  PASS  ${name}: ${got.toFixed(6)}`); }
  else { fail++; console.log(`  FAIL  ${name}: got ${got}, want ${want}`); }
}
const d = deriveTransportEF("6_wheeler", "B7")!;
check("6-wheeler B7 EF_vkm = 16.6667/100 L/km * 2.5504 [KYN fleet]", d.efVkm, (16.6667/100) * 2.5504);
check("6-wheeler B7 EF_tkm = vkm / 4.75 t [KYN payload]", d.efTkm, ((16.6667/100) * 2.5504) / 4.75);
const ev = deriveTransportEF("ev_passenger", "EV")!;
check("EV car 6 km/kWh -> 16.6667 kWh/100km * 0.475", ev.efVkm, (16.6667/100) * 0.475);
console.log("  sourced (TGO fuel + KYN fleet):", ev.sourced, "| 10-wheeler basis:", deriveTransportEF("10_wheeler","B7")!.basis);
console.log(`  official fuel EFs: ${Object.values(FUEL_EF).filter((f) => f.official).length}/${Object.keys(FUEL_EF).length}`);
const kyn = Object.values(VEHICLE_PROFILE).filter((v) => v.source === "kyn").length;
console.log(`  vehicle profiles: ${kyn} from KYN fleet data, ${Object.keys(VEHICLE_PROFILE).length - kyn} still assumptions`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

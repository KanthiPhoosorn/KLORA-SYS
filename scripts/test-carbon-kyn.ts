// Verifies src/lib/carbon-kyn.ts against hand-computed values from the KYN spec.
//   npx tsx scripts/test-carbon-kyn.ts
import {
  packagingAreaSqm, packagingItemCarbon, packagingTotals, netFlowerWeight,
  farmMonthlyCarbon, dynamicFlowerEF, flowerCarbon, transportCarbon,
  computeOrderCarbon, FLOWER_EF_DEFAULT,
} from "../src/lib/carbon-kyn";

let pass = 0, fail = 0;
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
function check(name: string, got: number, want: number) {
  if (near(got, want)) { pass++; console.log(`  PASS  ${name}: ${got}`); }
  else { fail++; console.log(`  FAIL  ${name}: got ${got}, want ${want}`); }
}

console.log("packaging — corrugated box 40x30x20cm x2");
const box = { type: "corrugated_box" as const, width: 40, length: 30, height: 20, quantity: 2 };
check("area m2  = 2[(40*30)+(40*20)+(30*20)]/10000", packagingAreaSqm(box), 0.52);
check("weight kg = 0.52*1.2*0.55*2", packagingItemCarbon(box).weightKg, 0.6864);
check("carbon    = weight*0.86", packagingItemCarbon(box).carbon, 0.6864 * 0.86);

console.log("packaging — plastic film 50x70cm x5 (2-D, height ignored)");
const film = { type: "plastic_film" as const, width: 50, length: 70, height: 0, quantity: 5 };
check("area m2  = (50*70)/10000", packagingAreaSqm(film), 0.35);
check("weight kg = 0.35*1.0*0.04*5", packagingItemCarbon(film).weightKg, 0.07);
check("carbon    = weight*2.75", packagingItemCarbon(film).carbon, 0.1925);

console.log("packaging — box entered with height 0 degrades to flat sheet (KYN H=0 rule)");
check("flat area", packagingAreaSqm({ ...box, height: 0 }), (40 * 30) / 10000);

console.log("order rollup");
const items = [box, film];
const totals = packagingTotals(items);
check("total packaging weight", totals.weightKg, 0.6864 + 0.07);
check("net flower weight = 12 - packaging", netFlowerWeight(12, totals.weightKg), 12 - 0.7564);
check("farm carbon @ fallback 0.65", flowerCarbon(12 - 0.7564, FLOWER_EF_DEFAULT), (12 - 0.7564) * 0.65);

console.log("dynamic farm EF");
const monthly = { dieselLitres: 100, electricityKwh: 500, fertilizerKg: 50, agrochemicalKg: 5, waterM3: 20, organicWasteKg: 30, totalFlowerYieldKg: 800 };
check("Total_Farm_Carbon", farmMonthlyCarbon(monthly), 268 + 249.95 + 175 + 50 + 3.2 + 16.5);
check("Dynamic_Flower_EF = carbon/yield", dynamicFlowerEF(monthly), 762.65 / 800);
check("fallback when no record", dynamicFlowerEF(null), 0.65);
check("fallback when yield = 0", dynamicFlowerEF({ ...monthly, totalFlowerYieldKg: 0 }), 0.65);

console.log("transport");
check("t.km: 0.012t * 785km * 0.12", transportCarbon({ method: "tkm", grossWeightKg: 12, distanceKm: 785, efTkm: 0.12 }), 0.012 * 785 * 0.12);
check("reefer adds 15%", transportCarbon({ method: "tkm", grossWeightKg: 12, distanceKm: 785, efTkm: 0.12, isReeferUsed: true }), 0.012 * 785 * 0.12 * 1.15);
check("v.km: 785km * 0.35", transportCarbon({ method: "vkm", distanceKm: 785, efVkm: 0.35 }), 785 * 0.35);

console.log("full order");
const r = computeOrderCarbon({
  packagingItems: items, shippedWeightKg: 12, flowerCount: 1000,
  farmMonthly: monthly,
  transport: { method: "tkm", grossWeightKg: 12, distanceKm: 785, efTkm: 0.12 },
});
const expFarm = (12 - 0.7564) * (762.65 / 800);
const expPack = 0.6864 * 0.86 + 0.1925;
const expTrans = 0.012 * 785 * 0.12;
check("CO2e_Farm", r.farm, expFarm);
check("CO2e_Packaging", r.packaging, expPack);
check("CO2e_Transport", r.transport, expTrans);
check("Total_Order_Carbon", r.total, expFarm + expPack + expTrans);
check("Carbon_Per_Stem", r.perStem, (expFarm + expPack + expTrans) / 1000);
check("guards divide-by-zero flowerCount", computeOrderCarbon({ packagingItems: [], shippedWeightKg: 1, flowerCount: 0 }).perStem, 1 * 0.65);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

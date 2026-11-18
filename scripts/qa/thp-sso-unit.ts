// Challenge vectors from the Thai Post SSO guide (no server needed).
//   npx tsx --tsconfig tsconfig.json scripts/qa/thp-sso-unit.ts
import { computeChallenge, isHandoff } from "../../src/lib/thp-sso";
let fails = 0;
const log = (n: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}`); };
log("vector 1", computeChallenge("what do ya want for nothing?", "Jefe") === "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
log("vector 2", computeChallenge("3f8a".repeat(16), "example-secret-1234567890") === "cdae2abbcb241455a4da0abafa57d483cacf512f0883b3f3c4776be9c6215f62");
log("isHandoff", isHandoff("3f8a".repeat(16)) && isHandoff("ABCD".repeat(16)) && !isHandoff("xyz") && !isHandoff("3f8a".repeat(15)) && !isHandoff(5));
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);

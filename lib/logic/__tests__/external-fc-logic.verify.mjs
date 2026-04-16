// lib/logic/__tests__/external-fc-logic.verify.mjs
// Source: _planning/external.xlsx, sheet "FC관리", rows 6-7 (data_only computed values).
// Node 스크립트로 엑셀 row 6~7 의 계산 결과가 일치하는지 확인.
// Run: node lib/logic/__tests__/external-fc-logic.verify.mjs

// tsx 없이 실행하기 위해 필요 함수를 JS 로 직접 포팅 (external-fc-logic.ts 와 로직 동일)

const CONFIG = {
  rpm_obi_ratio: 0.34,
  server_cost_rate: 0.047,
  apc_rate: 0.017,
  fn_media_weight: 0.75,
  fn_ad_weight: 0.25,
  ad_revenue_rate: 0.95,
  pb_server_discount: 0.1,
};
const S = 1300; // 데이블 단가
const T = 1200; // 업체 단가

function safeDiv(n, d) { return d === 0 ? 0 : n / d; }

// NOTE: This is a plain-JS mirror of lib/logic/external-fc-logic.ts::deriveFcRow.
// If the TS source changes, update this file to match.
function deriveFcRow(input) {
  const { D, E, G_raw, I, J, M, O, date } = input;
  const F = safeDiv(E, D);
  const G = G_raw; // 엑셀은 G 를 직접 입력; 본 코드에서는 D-E 로 계산할 예정이나
                   // 엑셀 원본과 비교하려면 G 를 직접 주입해서 후속 계산 일치 확인
  const H = safeDiv(G, D);
  const K = G - J - I;
  const L = safeDiv(M, CONFIG.rpm_obi_ratio);

  const AB = O;
  const AA = O === 0 ? 0 : safeDiv(S, AB);
  const Y = (E / 1000) * AA;
  const Z = Y * CONFIG.ad_revenue_rate;
  const X = Y * CONFIG.server_cost_rate;
  const W = Z * CONFIG.apc_rate;
  const V = (E / 1000) * S;
  const U = Y * CONFIG.fn_media_weight + Z * CONFIG.fn_ad_weight;
  const R = U - (V + W + X);

  const AF = (G / 1000) * T;
  const AG = AF;
  const AE = AF * CONFIG.server_cost_rate * CONFIG.pb_server_discount;
  const AD = (G / 1000) * S;
  const AC = AF * CONFIG.fn_media_weight + AG * CONFIG.fn_ad_weight;
  const Smargin = AC - (AD + AE);

  const Q = R + Smargin;
  const Tmargin = safeDiv(Q, D) * 1000;

  return { date, F, G, H, K, L, Q, R, Smargin, Tmargin, U, V, W, X, Y, Z, AA, AB, AC, AD, AE, AF, AG };
}

// Excel row 6 (2026-03-24)
// Inputs: D=126822, E=85779, G=41043, I=0, J=39317, M=1179, O=0.35
// Expected computed values (from data_only xlsx load):
const FIXTURES = [
  {
    name: "row6 (2026-03-24)",
    input: { D: 126822, E: 85779, G_raw: 41043, I: 0, J: 39317, M: 1179, O: 0.35, date: "2026-03-24" },
    expect: {
      K: 1726, L: 3467.6470588235293,
      Q: 178656.55818, R: 182992.3407, Smargin: -4335.782520000001, Tmargin: 1408.7189776221792,
      U: 314625.1178571429, V: 111512.7, W: 5145.514585714287, X: 14974.562571428572,
      Y: 318607.7142857143, Z: 302677.3285714286, AA: 3714.2857142857147, AB: 0.35,
      AC: 49251.6, AD: 53355.9, AE: 231.48252, AF: 49251.6, AG: 49251.6,
    },
  },
  {
    name: "row7 (2026-03-23)",
    input: { D: 127994, E: 84544, G_raw: 43450, I: 0, J: 41951, M: 1505, O: 0.27, date: "2026-03-23" },
    expect: {
      K: 1499, L: 4426.470588235294,
      Q: 261772.07651851844, R: 266362.13451851846, Smargin: -4590.0580000000045, Tmargin: 2045.1902160923048,
      U: 401975.40740740736, V: 109907.2, W: 6574.078814814815, X: 19131.994074074075,
      Y: 407063.7037037037, Z: 386710.5185185185, AA: 4814.814814814815, AB: 0.27,
      AC: 52140, AD: 56485.00000000001, AE: 245.058, AF: 52140, AG: 52140,
    },
  },
  // row8 (2026-03-22) — Excel data_only 값 생략 없이 필요 시 추가
];

const EPS = 0.01; // 소수점 2자리 오차 허용

let failed = 0;
for (const fx of FIXTURES) {
  const G_computed = Math.max(fx.input.D - fx.input.E, 0);
  if (G_computed !== fx.input.G_raw) {
    console.error(`FAIL ${fx.name} G-step: D-E = ${G_computed}, expected G_raw = ${fx.input.G_raw}`);
    failed++;
  }
  const got = deriveFcRow(fx.input);
  for (const [k, v] of Object.entries(fx.expect)) {
    const diff = Math.abs(got[k] - v);
    if (diff > EPS) {
      console.error(`FAIL ${fx.name} ${k}: expected ${v}, got ${got[k]} (diff ${diff})`);
      failed++;
    }
  }
}

if (failed === 0) {
  console.log(`✅ All ${FIXTURES.length} fixtures passed (tolerance ${EPS}).`);
  process.exit(0);
} else {
  console.error(`❌ ${failed} assertion(s) failed.`);
  process.exit(1);
}

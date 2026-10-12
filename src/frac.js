// 數學小教室（分數比大小：先約分、再通分）的計算與判題核心。畫面在 src/math.html，只呼叫這裡的函式。
// 2026-10-12 律師：習作 p.38 第 6 題②（28/42 □ 27/45）她不懂，「請建立教學機制」「教會她」。
// 這題比①③④難的地方：42 和 45 的最小公倍數是 630，直接通分數字太大；先約分成 2/3、3/5，再用 15 通分。
// 執行測試：node --test tests/frac.test.js
(function (root) {
  "use strict";

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
  function lcm(a, b) { return a / gcd(a, b) * b; }
  function simplest(f) { var g = gcd(f.n, f.d); return { n: f.n / g, d: f.d / g, g: g }; }
  function isSimplest(f) { return gcd(f.n, f.d) === 1; }
  function same(a, b) { return a.n * b.d === b.n * a.d; }
  function cmp(a, b) { var x = a.n * b.d, y = b.n * a.d; return x > y ? ">" : x < y ? "<" : "="; }
  function txt(f) { return f.n + "/" + f.d; }
  function okNum(x) { return typeof x === "number" && isFinite(x) && x > 0 && Math.floor(x) === x; }
  function okFrac(f) { return !!f && okNum(f.n) && okNum(f.d); }
  function filled(f) { return !!f && typeof f.n === "number" && typeof f.d === "number" && !isNaN(f.n) && !isNaN(f.d); }
  // 有填、但不是正整數（例如 0）：算一次答錯，訊息講清楚錯在哪（Codex 2026-10-12 第 1 輪必修 3）
  function invalid(f) {
    var msg = f.d === 0 ? "分母不能是 0。" : f.n === 0 ? "分子是 0 的話，分數就變成 0，大小跟原來不一樣。" : "這裡要填正整數。";
    return { ok: false, code: "invalid", msg: msg };
  }

  // 整題的標準解：約分 → 通分（用最小公倍數）→ 比分子
  function solve(a, b) {
    var sa = simplest(a), sb = simplest(b), L = lcm(sa.d, sb.d);
    return {
      a: a, b: b, sa: { n: sa.n, d: sa.d }, sb: { n: sb.n, d: sb.d }, ga: sa.g, gb: sb.g,
      lcm: L, mulA: L / sa.d, mulB: L / sb.d,
      ea: { n: sa.n * L / sa.d, d: L }, eb: { n: sb.n * L / sb.d, d: L },
      rawLcm: lcm(a.d, b.d), sign: cmp(a, b)
    };
  }

  // x 能不能被 k 整除，用乘法表講給五年級聽
  function divText(k, x) {
    if (x % k === 0) return x + " = " + k + " × " + (x / k);
    var q = Math.floor(x / k);
    return k + " × " + q + " = " + (k * q) + "、" + k + " × " + (q + 1) + " = " + (k * (q + 1)) + "，中間沒有 " + x + "，所以 " + x + " 不能被 " + k + " 整除";
  }
  function smallestCommon(f) { var g = gcd(f.n, f.d); for (var p = 2; p <= g; p++) if (g % p === 0) return p; return 0; }

  // 教學步驟：她選「一起除以 k」
  function pickDivisor(f, k) {
    if (k === "none") {
      if (isSimplest(f)) return { ok: true, done: true, msg: f.n + " 和 " + f.d + " 只剩 1 能一起除，" + txt(f) + " 已經是最簡分數。" };
      var p = smallestCommon(f);
      return { ok: false, msg: "還能再約喔：" + divText(p, f.n) + "、" + divText(p, f.d) + "，都在 " + p + " 的乘法表裡。" };
    }
    var bad = f.n % k !== 0 ? f.n : f.d % k !== 0 ? f.d : 0;
    if (bad) return { ok: false, msg: divText(k, bad) + "。換一個數試試。" };
    return { ok: true, done: false, next: { n: f.n / k, d: f.d / k }, msg: divText(k, f.n) + "、" + divText(k, f.d) + "，兩個都能被 " + k + " 整除。" };
  }

  // 練習題第①列：她把 orig 約分後寫成 inp
  function checkReduce(orig, inp) {
    if (!filled(inp)) return { ok: false, code: "empty", msg: "分子和分母都要填數字喔。" };
    if (!okFrac(inp)) return invalid(inp);
    if (!same(orig, inp)) {
      if (orig.n % inp.n === 0 && orig.d % inp.d === 0 && orig.n / inp.n !== orig.d / inp.d)
        return { ok: false, code: "unequal-div", msg: "分子除以了 " + (orig.n / inp.n) + "，分母卻除以了 " + (orig.d / inp.d) + "。分子和分母要除以「同一個數」，大小才不會變。" };
      return { ok: false, code: "changed", msg: inp.n + "/" + inp.d + " 和 " + txt(orig) + " 不一樣大。約分時，分子和分母要一起除以同一個數。" };
    }
    if (!isSimplest(inp)) {
      var p = smallestCommon(inp);
      return { ok: false, code: "not-simplest", msg: "大小對了！不過 " + inp.n + " 和 " + inp.d + " 還能一起除以 " + p + "，再約一次，變成最簡分數。" };
    }
    return { ok: true, code: "ok", msg: "對了：" + txt(orig) + " = " + txt(inp) + "。" };
  }

  // 練習題第②列：把約分後的 sa、sb 通分成 ia、ib
  function checkCommon(sa, sb, ia, ib) {
    if (!filled(ia) || !filled(ib)) return { ok: false, code: "empty", msg: "兩個分數的分子和分母都要填數字喔。" };
    if (!okFrac(ia)) return invalid(ia);
    if (!okFrac(ib)) return invalid(ib);
    if (ia.d !== ib.d) return { ok: false, code: "diff-den", msg: "通分以後，兩個分數的分母要變成一樣（現在是 " + ia.d + " 和 " + ib.d + "）。" };
    if (!same(sa, ia)) return { ok: false, code: "left-changed", msg: "左邊的 " + txt(sa) + " 大小變了：分母乘幾，分子也要乘幾。" };
    if (!same(sb, ib)) return { ok: false, code: "right-changed", msg: "右邊的 " + txt(sb) + " 大小變了：分母乘幾，分子也要乘幾。" };
    var L = lcm(sa.d, sb.d);
    if (ia.d !== L) return { ok: true, code: "ok-not-lcm", msg: "也對！分母用 " + ia.d + " 可以；用 " + sa.d + " 和 " + sb.d + " 的最小公倍數 " + L + "，數字會最小、最好算。" };
    return { ok: true, code: "ok", msg: "對了：分母都變成 " + L + "。" };
  }

  // 練習題第③列：ea、eb 是她通分後的分數（分母相同）
  function checkSign(a, b, ea, eb, s) {
    var want = cmp(a, b);
    if (s === want) return { ok: true, msg: want === "=" ? "約分以後一模一樣！寫法不同，也可能是一樣大的分數。" : "對了：分母一樣時，分子大的分數比較大。" };
    if (want === "=") return { ok: false, msg: "通分以後是 " + txt(ea) + " 和 " + txt(eb) + "，分子一樣，所以兩個分數一樣大。" };
    return { ok: false, msg: "分母一樣時，比分子就好：" + ea.n + " 和 " + eb.n + " 哪個大？" };
  }

  // 練習題：前 6 題固定（照習作的數字大小挑，正確答案 > < = 都有，也有「分子大、分數反而小」的陷阱），之後亂數產生
  var FIXED = [
    { a: { n: 24, d: 36 }, b: { n: 35, d: 50 } },   // 2/3 < 7/10（20/30 < 21/30）
    { a: { n: 27, d: 36 }, b: { n: 28, d: 42 } },   // 3/4 > 2/3（9/12 > 8/12）；分子 27 < 28 但分數比較大
    { a: { n: 21, d: 35 }, b: { n: 16, d: 24 } },   // 3/5 < 2/3（9/15 < 10/15）；分子 21 > 16 但分數比較小
    { a: { n: 18, d: 27 }, b: { n: 28, d: 42 } },   // 2/3 = 2/3
    { a: { n: 36, d: 54 }, b: { n: 20, d: 32 } },   // 2/3 > 5/8（16/24 > 15/24）
    { a: { n: 45, d: 63 }, b: { n: 32, d: 40 } }    // 5/7 < 4/5（25/35 < 28/35）
  ];
  var KS = [2, 3, 4, 5, 6, 7, 8, 9, 12];
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // 產生條件（tests/frac.test.js 逐條驗）：兩個都能約分、約分後分母不同且 ≤10、約分後通分的分母 ≤60、
  // 原本的數字都是兩位數、原分母的最小公倍數 ≥100（直接通分很麻煩，才看得出先約分的好處）、兩個分數不一樣大
  function genOne(r) {
    for (var t = 0; t < 5000; t++) {
      var q1 = 2 + Math.floor(r() * 9), q2 = 2 + Math.floor(r() * 9);
      if (q1 === q2) continue;
      var p1 = 1 + Math.floor(r() * (q1 - 1)), p2 = 1 + Math.floor(r() * (q2 - 1));
      if (gcd(p1, q1) !== 1 || gcd(p2, q2) !== 1 || p1 * q2 === p2 * q1 || lcm(q1, q2) > 60) continue;
      var k1 = KS[Math.floor(r() * KS.length)], k2 = KS[Math.floor(r() * KS.length)];
      var a = { n: p1 * k1, d: q1 * k1 }, b = { n: p2 * k2, d: q2 * k2 };
      if (a.n < 10 || b.n < 10 || a.d > 99 || b.d > 99 || lcm(a.d, b.d) < 100) continue;
      return { a: a, b: b };
    }
    return null;
  }
  function problem(i, seed) {
    if (i < FIXED.length) return FIXED[i];
    return genOne(rng(((seed || 0) * 1000003 + i * 7919) >>> 0)) || FIXED[i % FIXED.length];
  }

  // 「如果直接通分」：大的分母的倍數要數到第幾個，才同時是另一個分母的倍數
  function multiplesUntil(a, b) {
    var big = Math.max(a.d, b.d), L = lcm(a.d, b.d), out = [];
    for (var m = big; m <= L; m += big) out.push(m);
    return { big: big, small: Math.min(a.d, b.d), list: out, lcm: L };
  }

  var api = {
    gcd: gcd, lcm: lcm, simplest: simplest, isSimplest: isSimplest, same: same, cmp: cmp, txt: txt,
    solve: solve, divText: divText, smallestCommon: smallestCommon, pickDivisor: pickDivisor,
    checkReduce: checkReduce, checkCommon: checkCommon, checkSign: checkSign,
    FIXED: FIXED, genOne: genOne, rng: rng, problem: problem, multiplesUntil: multiplesUntil
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.G5Frac = api;
})(typeof window !== "undefined" ? window : this);

// 數學小教室（src/frac.js）：習作那一題算對、判題訊息對得上錯誤類型、亂數題都符合「要先約分才好算」的條件。
// 執行：node --test tests/frac.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../src/frac.js");

const fr = (n, d) => ({ n, d });

test("習作 p.38 第 6 題②：28/42 > 27/45，約分成 2/3、3/5，用 15 通分成 10/15、9/15", () => {
  const s = F.solve(fr(28, 42), fr(27, 45));
  assert.deepEqual(s.sa, fr(2, 3));
  assert.deepEqual(s.sb, fr(3, 5));
  assert.equal(s.ga, 14);
  assert.equal(s.gb, 9);
  assert.equal(s.lcm, 15);
  assert.deepEqual(s.ea, fr(10, 15));
  assert.deepEqual(s.eb, fr(9, 15));
  assert.equal(s.rawLcm, 630);
  assert.equal(s.sign, ">");
  // 直接通分也要得到同一個答案：420/630 > 378/630
  assert.equal(28 * (630 / 42), 420);
  assert.equal(27 * (630 / 45), 378);
});

test("同一頁她已經做對的①③④與第 7 題，用同一套比較也算得一樣（防比較函式寫反）", () => {
  assert.equal(F.cmp(fr(18, 32), fr(21, 48)), ">");
  assert.equal(F.cmp(fr(22, 15), fr(31, 20)), "<");
  assert.equal(F.cmp(fr(13, 6), fr(2 * 15 + 4, 15)), "<");      // 2又4/15
  assert.equal(F.cmp(fr(15, 8), fr(1 * 24 + 9, 24)), ">");       // 彩帶 > 棉繩 ⇒ 棉繩比較短
  assert.equal(F.cmp(fr(2 * 12 + 1, 12), fr(29, 15)), ">");      // 紅茶比較多
});

test("pickDivisor：選錯的數會用乘法表說明哪個不能整除；選對會給下一個分數；太早說不能再約會被擋", () => {
  let r = F.pickDivisor(fr(28, 42), 3);
  assert.equal(r.ok, false);
  assert.match(r.msg, /3 × 9 = 27、3 × 10 = 30，中間沒有 28/);
  r = F.pickDivisor(fr(28, 42), 2);
  assert.equal(r.ok, true);
  assert.deepEqual(r.next, fr(14, 21));
  r = F.pickDivisor(fr(14, 21), 2);
  assert.equal(r.ok, false);
  assert.match(r.msg, /21 不能被 2 整除/);
  r = F.pickDivisor(fr(14, 21), "none");
  assert.equal(r.ok, false);
  assert.match(r.msg, /7 的乘法表/);
  r = F.pickDivisor(fr(14, 21), 7);
  assert.deepEqual(r.next, fr(2, 3));
  r = F.pickDivisor(fr(2, 3), "none");
  assert.equal(r.ok, true);
  assert.equal(r.done, true);
  r = F.pickDivisor(fr(27, 45), 9);
  assert.deepEqual(r.next, fr(3, 5));
  r = F.pickDivisor(fr(27, 45), 5);
  assert.match(r.msg, /27 不能被 5 整除/);
});

test("checkReduce：分子分母除不同數、大小改變、還能再約、空白，各給不同訊息", () => {
  assert.equal(F.checkReduce(fr(28, 42), fr(2, 3)).ok, true);
  const half = F.checkReduce(fr(28, 42), fr(14, 21));
  assert.equal(half.ok, false);
  assert.equal(half.code, "not-simplest");
  assert.match(half.msg, /還能一起除以 7/);
  const uneven = F.checkReduce(fr(28, 42), fr(14, 6));
  assert.equal(uneven.code, "unequal-div");
  assert.match(uneven.msg, /分子除以了 2，分母卻除以了 7/);
  assert.equal(F.checkReduce(fr(28, 42), fr(3, 5)).code, "changed");
  assert.equal(F.checkReduce(fr(28, 42), fr(NaN, 3)).code, "empty");
  assert.equal(F.checkReduce(fr(28, 42), fr(0, 3)).code, "empty");
  assert.equal(F.checkReduce(fr(28, 42), null).code, "empty");
  assert.equal(F.checkReduce(fr(28, 42), fr(2.5, 3)).code, "empty");
});

test("checkCommon：分母不同、左右大小改變被抓；用公倍數但不是最小的也算對但提醒", () => {
  const sa = fr(2, 3), sb = fr(3, 5);
  assert.equal(F.checkCommon(sa, sb, fr(10, 15), fr(9, 15)).code, "ok");
  const big = F.checkCommon(sa, sb, fr(20, 30), fr(18, 30));
  assert.equal(big.ok, true);
  assert.equal(big.code, "ok-not-lcm");
  assert.match(big.msg, /最小公倍數 15/);
  assert.equal(F.checkCommon(sa, sb, fr(10, 15), fr(9, 16)).code, "diff-den");
  assert.equal(F.checkCommon(sa, sb, fr(2, 15), fr(9, 15)).code, "left-changed");   // 只改分母沒改分子
  assert.equal(F.checkCommon(sa, sb, fr(10, 15), fr(3, 15)).code, "right-changed");
  assert.equal(F.checkCommon(sa, sb, fr(10, 15), {}).code, "empty");
});

test("checkSign：答對、答反、該填等號，訊息都指向「分母一樣比分子」", () => {
  const a = fr(28, 42), b = fr(27, 45), ea = fr(10, 15), eb = fr(9, 15);
  assert.equal(F.checkSign(a, b, ea, eb, ">").ok, true);
  const no = F.checkSign(a, b, ea, eb, "<");
  assert.equal(no.ok, false);
  assert.match(no.msg, /10 和 9 哪個大/);
  assert.equal(F.checkSign(fr(18, 27), fr(28, 42), fr(2, 3), fr(2, 3), "=").ok, true);
  assert.match(F.checkSign(fr(18, 27), fr(28, 42), fr(2, 3), fr(2, 3), ">").msg, /一樣大/);
});

test("固定 6 題：每題兩個分數都能約分、答案和約分通分結果一致，> < = 三種都有", () => {
  const signs = new Set();
  F.FIXED.forEach(({ a, b }) => {
    const s = F.solve(a, b);
    assert.ok(s.ga > 1 && s.gb > 1, F.txt(a) + " " + F.txt(b) + " 都要能約分");
    assert.equal(F.cmp(s.ea, s.eb), s.sign);
    assert.ok(F.same(s.ea, a) && F.same(s.eb, b));
    assert.ok(s.rawLcm >= 100, "直接通分要很麻煩：" + s.rawLcm);
    signs.add(s.sign);
  });
  assert.deepEqual([...signs].sort(), ["<", "=", ">"]);
  // 至少一題「分子大、分數反而小」與一題「分子小、分數反而大」，抓「比分子就好」的迷思
  assert.ok(F.FIXED.some(({ a, b }) => a.n > b.n && F.cmp(a, b) === "<"));
  assert.ok(F.FIXED.some(({ a, b }) => a.n < b.n && F.cmp(a, b) === ">"));
});

test("亂數題 2000 題：全部符合產生條件，而且同一個 seed 每次產生的題目一樣", () => {
  const signs = { ">": 0, "<": 0, "=": 0 };
  for (let i = 6; i < 2006; i++) {
    const p = F.problem(i, 3);
    assert.deepEqual(p, F.problem(i, 3));
    const s = F.solve(p.a, p.b);
    assert.ok(s.ga > 1 && s.gb > 1);
    assert.notEqual(s.sa.d, s.sb.d);
    assert.ok(s.sa.d <= 10 && s.sb.d <= 10);
    assert.ok(s.lcm <= 60);
    assert.ok(p.a.n >= 10 && p.b.n >= 10 && p.a.d <= 99 && p.b.d <= 99);
    assert.ok(p.a.n < p.a.d && p.b.n < p.b.d, "真分數");
    assert.ok(s.rawLcm >= 100);
    assert.notEqual(s.sign, "=");
    signs[s.sign]++;
  }
  assert.ok(signs[">"] > 600 && signs["<"] > 600, JSON.stringify(signs));
});

test("multiplesUntil：45 的倍數要數到第 14 個（630）才同時是 42 的倍數", () => {
  const m = F.multiplesUntil(fr(28, 42), fr(27, 45));
  assert.equal(m.big, 45);
  assert.equal(m.list.length, 14);
  assert.equal(m.list[m.list.length - 1], 630);
  assert.ok(m.list.slice(0, -1).every((x) => x % 42 !== 0));
});

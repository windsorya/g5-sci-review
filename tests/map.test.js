// 探險地圖＋成長植物（#1725）：站點計算、階數、全破旗標、上次看到的階數（g5sci.mapSeen）讀寫。執行：node --test tests/map.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../src/map.js");

// 與 src/app.html 的 CONCEPTS 同一個順序（程式內實際順序）
const CIDS = ["1-1", "1-3", "1-2", "2-1", "2-2", "2-3", "3-1"];
function stages(n, val) { const o = {}; CIDS.forEach((c, i) => { o[c] = i < n ? (val === undefined ? 3 : val) : 0; }); return o; }
const allOn = () => true, u3off = (cid) => !cid.startsWith("3-");
function mem(init) {
  const m = Object.assign({}, init || {}); let w = 0;
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { w++; m[k] = String(v); }, raw: m, writes: () => w };
}
const throwing = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("QuotaExceededError"); } };

test("走過 0 站：第一站是「現在在這裡」，階數 0，不是全破", () => {
  const t = M.trail({ cids: CIDS, stages: stages(0), on: allOn });
  assert.equal(t.walked, 0); assert.equal(t.total, 7); assert.equal(t.left, 7); assert.equal(t.level, 0); assert.equal(t.allDone, false);
  assert.deepEqual(t.stations.filter((s) => s.now).map((s) => s.cid), ["1-1"]);
  assert.deepEqual(t.stations.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7]);
});

test("走過 3 站：前三站打勾、第 4 站（2-1 根莖葉）是現在在這裡，階數 3", () => {
  const t = M.trail({ cids: CIDS, stages: stages(3), on: allOn });
  assert.deepEqual(t.stations.filter((s) => s.done).map((s) => s.cid), ["1-1", "1-3", "1-2"]);
  assert.deepEqual(t.stations.filter((s) => s.now).map((s) => s.cid), ["2-1"]);
  assert.equal(t.walked, 3); assert.equal(t.left, 4); assert.equal(t.level, 3); assert.equal(t.allDone, false);
  assert.equal(M.PLANT[t.level], "長出葉子");
});

test("七站全走完：沒有「現在在這裡」，階數 7＝結果，全破", () => {
  const t = M.trail({ cids: CIDS, stages: stages(7), on: allOn });
  assert.equal(t.walked, 7); assert.equal(t.left, 0); assert.equal(t.level, 7); assert.equal(t.allDone, true);
  assert.equal(t.stations.filter((s) => s.now).length, 0);
  assert.equal(M.PLANT[t.level], "結果");
});

// 2026-10-14 律師（孩子問「達成什麼條件才能放一本書」）：做完一站的題目就算走過 ⇒ 長葉了（全部題目做過一次）以上；四站同一條
test("走過＝長葉了以上（BLOOM 2）：stage 2（長葉了＝題目全部做過）、4（結果了）算走過，stage 1（發芽了）不算", () => {
  assert.equal(M.trail({ cids: CIDS, stages: stages(2, 4), on: allOn }).walked, 2);
  assert.equal(M.trail({ cids: CIDS, stages: stages(7, 2), on: allOn }).walked, 7);
  assert.equal(M.trail({ cids: CIDS, stages: stages(7, 1), on: allOn }).walked, 0);
  assert.equal(M.BLOOM, 2);
});

test("地圖寫得出長大規則：有 RULE 與 DONE，規則講「每一題都做過一次」", () => {
  assert.match(M.RULE || "", /每一題都做過一次/);
  assert.ok(typeof M.DONE === "string" && M.DONE.length >= 2 && M.DONE.length <= 6, "DONE：" + M.DONE);
});

test("「現在在這裡」是第一個沒走過的站，不是走過數＋1（中間跳著走）", () => {
  const st = stages(0); st["1-1"] = 3; st["1-2"] = 3;   // 第 1、3 站走過，第 2 站沒有
  const t = M.trail({ cids: CIDS, stages: st, on: allOn });
  assert.deepEqual(t.stations.filter((s) => s.now).map((s) => s.cid), ["1-3"]);
  assert.equal(t.walked, 2); assert.equal(t.level, 2);
});

test("第三單元未開放：溶解站鎖住、不算分母；就算舊資料是開花也不算走過", () => {
  const t = M.trail({ cids: CIDS, stages: stages(7), on: u3off });
  const last = t.stations[6];
  assert.equal(last.cid, "3-1"); assert.equal(last.on, false); assert.equal(last.done, false); assert.equal(last.now, false);
  assert.equal(t.total, 6); assert.equal(t.walked, 6); assert.equal(t.left, 0); assert.equal(t.locked, 1);
  assert.equal(t.allDone, false, "第三單元還沒開放就不能算七站全走完");
  const t0 = M.trail({ cids: CIDS, stages: stages(0), on: u3off });
  assert.equal(t0.total, 6); assert.equal(t0.left, 6);
});

test("階數＝走過站數（0–7 每一個都對）", () => {
  for (let n = 0; n <= 7; n++) assert.equal(M.trail({ cids: CIDS, stages: stages(n), on: allOn }).level, n);
  assert.equal(M.PLANT.length, 8, "0 一盆土＋律師確認的七階");
  assert.deepEqual(M.PLANT.slice(1), ["種子", "發芽", "長出葉子", "長高", "結花苞", "開花", "結果"]);
});

test("長大動畫：比上次看到的大才播；沒看過當 0；變小不播；全破那一次才放星星", () => {
  assert.deepEqual(M.growth(2, 3, false), { grow: true, celebrate: false });
  assert.deepEqual(M.growth(3, 3, false), { grow: false, celebrate: false });
  assert.deepEqual(M.growth(5, 3, false), { grow: false, celebrate: false });
  assert.deepEqual(M.growth(null, 0, false), { grow: false, celebrate: false });
  assert.deepEqual(M.growth(null, 2, false), { grow: true, celebrate: false });
  assert.deepEqual(M.growth(6, 7, true), { grow: true, celebrate: true });
  assert.deepEqual(M.growth(7, 7, true), { grow: false, celebrate: false });
});

test("mapSeen 讀寫：只寫 g5sci.mapSeen、不碰 g5sci.v3；壞值當沒有", () => {
  const s = mem({ "g5sci.v3": "原文不動" });
  assert.equal(M.readSeen(s), null);
  assert.equal(M.writeSeen(s, 3), true);
  assert.equal(M.readSeen(s), 3);
  assert.deepEqual(Object.keys(s.raw).sort(), ["g5sci.mapSeen", "g5sci.v3"]);
  assert.equal(s.raw["g5sci.v3"], "原文不動");
  assert.equal(M.SEEN_KEY, "g5sci.mapSeen");
  for (const bad of ["", "abc", "-1", "8", "2.5", "[]"]) assert.equal(M.readSeen(mem({ "g5sci.mapSeen": bad })), null, bad);
});

test("mapSeen 讀寫失敗不拋錯（無痕／滿了／根本沒有 storage）", () => {
  assert.doesNotThrow(() => M.readSeen(throwing));
  assert.equal(M.readSeen(throwing), null);
  assert.equal(M.writeSeen(throwing, 3), false);
  assert.equal(M.readSeen(null), null);
  assert.equal(M.writeSeen(null, 3), false);
  assert.equal(M.readSeen(undefined), null);
});

test("植物 SVG：八個階段畫面都不一樣、不含 emoji、剪影是灰色、新長出來的部位標 newpart", () => {
  const svgs = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => M.plantSvg(n));
  assert.equal(new Set(svgs).size, 8);
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  svgs.forEach((s) => { assert.ok(!emoji.test(s)); assert.ok(s.startsWith("<svg")); });
  const ghost = M.plantSvg(4, { ghost: true });
  assert.ok(!/var\(--(leaf|sunball|red|soil)\)/.test(ghost), "剪影不能露出下一階的顏色");
  assert.ok(M.plantSvg(4, { fresh: true }).includes('class="newpart"'));
  assert.ok(!M.plantSvg(4).includes("newpart"));
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(svgs.join("")), "顏色一律用 :root 變數（深淺色都換得到）");
});

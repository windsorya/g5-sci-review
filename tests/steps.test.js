// 答錯後「一步一步看」圖解（src/steps.js）：每一題都對得到小題型、每格都畫得出來、物理幾何是算出來的而且算對。
// 執行：node --test tests/steps.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
global.sunTimes = require("../src/sun.js").sunTimes;
const S = require("../src/steps.js");
const merged = require("../src/merge.js");

const html = fs.readFileSync(path.join(__dirname, "../src/app.html"), "utf8");
const i = html.indexOf("var BASE_CARDS = "), j = html.indexOf(";\nvar ALL_CARDS", i);
const base = Array.from(vm.runInNewContext("(" + html.slice(i + "var BASE_CARDS = ".length, j) + ")"));
const cards = base.concat(require("../src/bank_extra.js")).filter((c) => !merged[c.id]);   // 合併後真正會出題的卡

test("每一張會出題的卡都明確對到一個小題型，而且小題型和卡片是同一個觀念", () => {
  const miss = cards.filter((c) => !S.of[c.id]).map((c) => c.id);
  assert.deepEqual(miss, []);
  cards.forEach((c) => {
    const tp = S.topicOf(c);
    assert.ok(tp && S.topics[tp], c.id + " 對不到小題型");
    assert.equal(S.topics[tp].cid, c.concept, c.id + " → " + tp + " 觀念不同");
  });
});

test("對照表沒有多餘的題號（被合併或不存在的卡不該出現）", () => {
  const ids = new Set(cards.map((c) => c.id));
  assert.deepEqual(Object.keys(S.of).filter((id) => !ids.has(id)), []);
});

test("每個小題型都有用到；每個都有 2–4 格、一句話記住、給爸媽的追問", () => {
  const used = new Set(Object.values(S.of));
  Object.keys(S.topics).forEach((k) => {
    const t = S.topics[k];
    assert.ok(used.has(k), k + " 沒有任何題用到");
    assert.ok(t.steps.length >= 2 && t.steps.length <= 4, k + " 格數 " + t.steps.length);
    assert.ok(t.title && t.remember && t.ask, k + " 缺標題／記住／追問");
  });
});

test("每一格都畫得出來（沒有 NaN、undefined），而且是 svg.fig、有無障礙說明", () => {
  Object.keys(S.topics).forEach((k) => S.topics[k].steps.forEach((s, n) => {
    const out = s.fig();
    assert.ok(/^<svg class="fig" viewBox="0 0 320 200" role="img" aria-label="[^"]{4,}"/.test(out), k + "#" + n);
    assert.ok(!/NaN|undefined|Infinity/.test(out), k + "#" + n + " 有算不出來的座標");
  }));
});

test("說明白話：每格一句、不超過 95 字、沒有英文；一句話記住不超過 60 字", () => {
  Object.keys(S.topics).forEach((k) => {
    const t = S.topics[k];
    t.steps.forEach((s, n) => {
      assert.ok(s.say.length <= 95, k + "#" + n + " 太長 " + s.say.length);
      assert.ok(!/[A-Za-z]/.test(s.say), k + "#" + n + " 有英文");
    });
    assert.ok(t.remember.length <= 60, k + " 記住太長");
  });
});

test("折射（n=1.33）：水中的腳，光在水面轉彎；眼睛看到的位置比真正的高（看起來比較淺）", () => {
  const g = S.geo, r = g.refractPath(g.SHALLOW.F, g.SHALLOW.E, g.SHALLOW.wy);
  assert.ok(Math.abs(Math.sin(r.angA * Math.PI / 180) - 1.33 * Math.sin(r.angW * Math.PI / 180)) < 1e-6, "斯涅爾定律不成立");
  assert.ok(r.angA > r.angW, "從水到空氣應該偏離法線（角度變大）");
  assert.ok(r.A.y < g.SHALLOW.F.y - 20, "看起來的位置要明顯比較高");
  assert.ok(r.P.x > g.SHALLOW.F.x && r.P.x < g.SHALLOW.E.x);
});

test("碗底硬幣：沒水時直線被碗邊擋住，加水後折射光越過碗邊（圖和題目 k40 一致）", () => {
  const c = S.geo.coinGeo(), rim = S.geo.COIN.rimY;
  assert.ok(c.dryAtRim > rim, "沒水時應該被擋住");
  assert.ok(c.wetAtRim < rim, "有水時應該越過碗邊");
});

test("吸管：水裡那段看起來被抬高（尖端看起來比真正的高），所以在水面像折斷", () => {
  const c = S.geo.strawGeo(), tip = S.geo.STRAW.tip;
  assert.ok(c.g.A.y < tip.y - 10);
  const realSlope = (tip.y - c.entry.y) / (tip.x - c.entry.x), seenSlope = (c.g.A.y - c.entry.y) / (c.g.A.x - c.entry.x);
  assert.ok(seenSlope < realSlope, "看起來的那段要比較平（被抬高）");
});

test("太陽（嘉義，北回歸線上）：夏至日出東偏北、冬至東偏南、春秋分正東；中午高度角約 90／66.5／43 度", () => {
  const g = S.geo;
  assert.ok(g.riseAz(g.CHIAYI, g.TROPIC) < 70 && g.riseAz(g.CHIAYI, g.TROPIC) > 60);
  assert.ok(g.riseAz(g.CHIAYI, -g.TROPIC) > 110 && g.riseAz(g.CHIAYI, -g.TROPIC) < 120);
  assert.ok(Math.abs(g.riseAz(g.CHIAYI, 0) - 90) < 0.01);
  assert.ok(Math.abs(g.noonAlt(g.CHIAYI, g.TROPIC) - 90) < 0.1);
  assert.ok(Math.abs(g.noonAlt(g.CHIAYI, 0) - 66.5) < 0.1);
  assert.ok(Math.abs(g.noonAlt(g.CHIAYI, -g.TROPIC) - 43.1) < 0.1);
  const top = g.skyTop("summer"), cx = 160, cy = 104;
  assert.ok(top.rise.x > cx && top.rise.y < cy, "夏至日出畫在東偏北（右上）");
  const w = g.skyTop("winter");
  assert.ok(w.rise.x > cx && w.rise.y > cy, "冬至日出畫在東偏南（右下）");
});

test("影子一定畫在太陽對面：太陽在東（左）影子往右、太陽在西（右）影子往左；太陽愈高影子愈短", () => {
  const am = S.geo.poleScene(30, -1), pm = S.geo.poleScene(30, 1);
  assert.ok(am.tip > am.px && am.sun.x < am.px);
  assert.ok(pm.tip < pm.px && pm.sun.x > pm.px);
  assert.ok(S.geo.poleScene(70, -1).len < S.geo.poleScene(25, -1).len);
  [am, pm, S.geo.poleScene(22, -1, { px: 92, h: 42 })].forEach((p) => assert.ok(p.sun.x >= 20 && p.sun.x <= 300 && p.sun.y >= 15, "太陽不能出框"));
});

test("新匯入的題（不在對照表）用關鍵字對小題型；對不到就回 null（退回觀念總覽圖）", () => {
  assert.equal(S.topicOf({ id: "x1", concept: "1-2", type: "choice", q: "雨後為什麼看得到彩虹？", opts: ["折射", "反射"], a: 0 }), "lt-color");
  assert.equal(S.topicOf({ id: "x2", concept: "2-2", type: "choice", q: "蓮霧的種子靠什麼散播？", opts: ["動物"], a: 0 }), "rp-spread");
  assert.equal(S.topicOf({ id: "x3", concept: "1-2", type: "choice", q: "這是什麼？", opts: ["甲"], a: 0 }), null);
  assert.equal(S.topicOf({ id: "q1", concept: "2-1", type: "choice", q: "題號撞到但觀念不同", opts: ["甲"], a: 0 }), null, "對照表的觀念和卡片不同時不能硬套");
});

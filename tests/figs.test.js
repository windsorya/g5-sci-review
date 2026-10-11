// 自己重畫的考古卷看圖題（src/figs.js）：圖上的幾何必須和太陽模型、題目正解一致。
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../src/figs.js");
const { sunPosition } = require("../src/sun.js");
const extra = require("../src/bank_extra.js");

test("竿影紀錄圖：每條影子都在太陽的正對面（俯視、上北、右東）", () => {
  const sh = F.geo.poleDay(), P = F.geo.POLE;
  sh.forEach((s) => {
    const dx = s.x - P.x, dy = P.y - s.y;                         // 螢幕往上＝北
    const drawnAz = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    const opp = (s.sunAz + 180) % 360;
    const diff = Math.abs(((drawnAz - opp) + 540) % 360 - 180);
    assert.ok(diff < 0.5, s.h + " 點影子方位差 " + diff.toFixed(2));
  });
});

test("竿影紀錄圖：8 點影子在西偏北（左上）、12 點最短且偏北、16 點在東邊", () => {
  const sh = F.geo.poleDay(), P = F.geo.POLE, at = (h) => sh.find((s) => s.h === h);
  const len = (s) => Math.hypot(s.x - P.x, s.y - P.y);
  assert.ok(at(8).x < P.x && at(8).y < P.y, "8 點不在西偏北");
  assert.ok(at(16).x > P.x, "16 點不在東邊");
  assert.ok(at(12).y < P.y, "12 點不朝北");
  assert.equal(Math.min(...sh.map(len)), len(at(12)));
  sh.forEach((s) => assert.ok(s.x >= 0 && s.x <= 360 && s.y >= 0 && s.y <= 220, s.h + " 點超出畫布"));
});

test("正午陽光照進屋內：高度角符合 90−|緯度−赤緯|，冬至照最深、夏至最淺", () => {
  const r = Object.fromEntries(F.geo.houseRays().map((x) => [x.key, x]));
  assert.ok(Math.abs(r.summer.alt - 89.3) < 0.5 && Math.abs(r.equinox.alt - 65.6) < 0.8 && Math.abs(r.winter.alt - 42.4) < 0.5,
    [r.summer.alt, r.equinox.alt, r.winter.alt].join(","));
  assert.ok(r.winter.depth > r.equinox.depth && r.equinox.depth > r.summer.depth);
  // 光線從窗戶上緣進來，斜率＝tan(高度角)
  Object.values(r).forEach((x) => {
    const slope = (x.y1 - x.y0) / (x.x0 - x.x1);
    assert.ok(Math.abs(Math.atan(slope) * 180 / Math.PI - x.alt) < 0.1, x.key);
  });
});

test("正午陽光圖的 ①②③ 與題目正解一致（k72 冬至＝②、k73 夏至＝③）", () => {
  const order = F.geo.HOUSE_ORDER, card = (id) => extra.find((c) => c.id === id);
  assert.equal(order[card("k72").a], "winter");
  assert.equal(order[card("k73").a], "summer");
  const depth = Object.fromEntries(F.geo.houseRays().map((x) => [x.n, x.depth]));
  assert.equal(Math.max(...Object.values(depth)), depth[2], "k74 說②最深");
});

test("花的構造：胚珠在子房裡、花藥在花絲頂端、柱頭在花柱頂端；標號與題目正解一致", () => {
  const f = F.geo.FLOWER, L = F.geo.FLOWER_LABELS;
  f.ovules.forEach((o) => {
    const v = ((o.x - f.ovary.cx) / f.ovary.rx) ** 2 + ((o.y - f.ovary.cy) / f.ovary.ry) ** 2;
    assert.ok(v < 1, "胚珠不在子房裡");
  });
  assert.ok(f.stigma.y < f.styleTop + 1 && f.styleBot < f.ovary.cy, "雌蕊上下順序錯");
  f.stamens.forEach((s) => assert.ok(s.top.y < s.base.y, "花藥不在花絲上端"));
  const card = (id) => extra.find((c) => c.id === id);
  assert.equal(card("k75").opts[card("k75").a], L[1]);
  assert.equal(L[card("k76").a + 1], "花藥");
  assert.equal(L[card("k77").a + 1], "子房");
  assert.equal(L[card("k78").a + 1], "胚珠");
});

test("每種圖都畫得出來、沒有 NaN；題庫用到的圖種都已註冊", () => {
  Object.entries(F.kinds).forEach(([k, fn]) => [false, true].forEach((ann) => {
    const s = fn(ann);
    assert.ok(s.includes('data-fig="' + k + '"') && !/NaN|undefined/.test(s), k + " " + ann);
  }));
  extra.filter((c) => c.type === "figure").forEach((c) => assert.ok(F.kinds[c.fig], c.id + " 用了未註冊的圖 " + c.fig));
});

test("作答前的圖不洩題：未作答版不出現季節名稱或部位名稱", () => {
  assert.ok(!/冬至|夏至|春分/.test(F.kinds["house-noon"](false).replace(/aria-label="[^"]*"/, "").replace(/<figcaption[\s\S]*<\/figcaption>/, "")));
  assert.ok(!/柱頭|花藥|子房|胚珠/.test(F.kinds["flower-parts"](false)));
});

test("sunPosition 接得到（node 與瀏覽器共用 sun.js）", () => {
  assert.equal(typeof sunPosition, "function");
});

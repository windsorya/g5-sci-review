// 題庫完整性：從 src/app.html 抽出 BASE_CARDS、CONCEPTS、EXPLAIN 的觀念清單，逐張用核心的 validCard 驗。
// 加題（尤其依考古卷改寫的題）前後都跑：node --test tests/bank.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const C = require("../src/core.js");

const html = fs.readFileSync(path.join(__dirname, "../src/app.html"), "utf8");
function grab(startMarker, endMarker) {
  const i = html.indexOf(startMarker), j = html.indexOf(endMarker, i);
  assert.ok(i >= 0 && j > i, "找不到 " + startMarker);
  return html.slice(i + startMarker.length, j);
}
const base = vm.runInNewContext("(" + grab("var BASE_CARDS = ", ";\nvar BANK") + ")");
const extra = require("../src/bank_extra.js");                     // 加題檔（考古卷改寫 k*、安親班卷 q*/p*）
const cards = Array.from(base).concat(extra);
const concepts = vm.runInNewContext("(" + grab("var CONCEPTS = ", ";\nvar CIDS") + ")");
const figs = vm.runInNewContext("(" + grab("var FIGS = ", ";\nvar BASE_CARDS") + ")");
const bank = { cards: [], concepts: {}, figs };
Object.keys(concepts).forEach((k) => { bank.concepts[k] = { unit: concepts[k].unit }; });

test("每張卡都通過 validCard、屬於六個觀念之一", () => {
  // cards 來自 vm 沙箱，陣列原型跟這裡不同，deepEqual 會誤判；比長度
  const bad = Array.from(cards.filter((c) => !C.validCard(c, bank)), (c) => c.id);
  assert.equal(bad.length, 0, bad.join(","));
  assert.ok(cards.length >= 36, "題庫只有 " + cards.length + " 張");
});

test("卡片 id 不重複", () => {
  const seen = {}, dup = [];
  cards.forEach((c) => { if (seen[c.id]) dup.push(c.id); seen[c.id] = 1; });
  assert.deepEqual(dup, []);
});

test("每個觀念都有卡、都有出口題與兩種說法", () => {
  Object.keys(concepts).forEach((cid) => {
    assert.ok(cards.some((c) => c.concept === cid), cid + " 沒有卡");
    assert.ok(concepts[cid].exit && concepts[cid].exitAns, cid + " 缺出口題");
  });
  const explainKeys = (html.match(/^  "(\d-\d)":\[\n    \{name:/gm) || []).map((m) => m.slice(3, 6));
  assert.deepEqual(explainKeys.sort(), Object.keys(concepts).sort());
});

test("加題檔有接進 app（BANK 用 BASE_CARDS.concat(G5_EXTRA_CARDS)），且 build 有內嵌它", () => {
  assert.ok(/var BANK = \{cards:BASE_CARDS\.concat\(window\.G5_EXTRA_CARDS\|\|\[\]\)/.test(html));
  assert.ok(html.includes("<!--@INLINE src/bank_extra.js-->"));
  assert.ok(extra.length >= 150, "加題只有 " + extra.length);
});

test("安親班卷改寫的題都標出處；不收範圍外的蕨類／孢子題", () => {
  const anqin = extra.filter((c) => c.set === "anqin");
  assert.ok(anqin.length >= 140);
  anqin.forEach((c) => assert.ok(/^改寫自安親班複習卷（/.test(c.page), c.id));
  cards.forEach((c) => assert.ok(!/蕨類|孢子/.test(c.q + (c.why || "") + (c.opts || []).join("")), c.id + " 含範圍外的蕨類／孢子"));
});

test("依考古卷改寫的題（id 以 k 開頭）一定標出處，且不是示範題", () => {
  cards.filter((c) => /^k/.test(c.id)).forEach((c) => {
    assert.ok(typeof c.page === "string" && /題型參考/.test(c.page), c.id + " 沒標題型參考出處");
    assert.ok(c.why && c.why.length >= 6, c.id + " 缺解說");
  });
});

test("第二批考古卷改寫題（k21 起）：至少 45 題、七份卷都有、不收範圍外內容、不被算進安親班卷", () => {
  const k2 = extra.filter((c) => /^k\d+$/.test(c.id) && Number(c.id.slice(1)) >= 21);
  assert.ok(k2.length >= 45, "第二批只有 " + k2.length);
  const refs = new Set(k2.map((c) => c.page));
  assert.equal(refs.size, 7, "出處卷數 " + refs.size);
  k2.forEach((c) => {
    assert.ok(/^題型參考：.*（學習方舟）$/.test(c.page), c.id);
    assert.equal(c.set, undefined, c.id + " 被標成安親班卷");
    assert.ok(!/太陽能|蕨類|孢子|植物分類|能量轉換/.test(c.q + c.why + (c.opts || []).join("")), c.id + " 含範圍外內容");
  });
  assert.equal(extra.filter((c) => c.set === "anqin").length, 153);
});

test("選擇題的正解不能永遠在同一個位置（避免靠位置猜）", () => {
  const choice = cards.filter((c) => c.type === "choice" || c.type === "figure");
  const firstShare = choice.filter((c) => c.a === 0).length / choice.length;
  assert.ok(firstShare < 0.6, "正解在第一個選項的比例 " + firstShare.toFixed(2));
});

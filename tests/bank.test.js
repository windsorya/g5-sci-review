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
const base = vm.runInNewContext("(" + grab("var BASE_CARDS = ", ";\nvar ALL_CARDS") + ")");
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

test("加題檔有接進 app（ALL_CARDS＝BASE_CARDS.concat(G5_EXTRA_CARDS)，BANK 濾掉重複題），且 build 有內嵌它", () => {
  assert.ok(/var ALL_CARDS = BASE_CARDS\.concat\(window\.G5_EXTRA_CARDS\|\|\[\]\)/.test(html));
  assert.ok(/var BANK = \{cards:ALL_CARDS\.filter\(function\(c\)\{return !MERGED\[c\.id\];\}\)/.test(html));
  assert.ok(html.includes("<!--@INLINE src/merge.js-->"));
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

// ---------- 重複題只留一題（2026-10-11 律師：「是否重複部分，只留一題」） ----------
const merged = require("../src/merge.js");
const byId = {}; cards.forEach((c) => { byId[c.id] = c; });
const kept = cards.filter((c) => !merged[c.id]);

test("重複題對照表：被併的題和留下的題都存在、同一個觀念、留下的題自己沒被併掉、每筆都寫了理由", () => {
  Object.keys(merged).forEach((id) => {
    const m = merged[id], c = byId[id];
    assert.ok(c, id + " 不在題庫");
    assert.ok(Array.isArray(m.keep) && m.keep.length >= 1, id + " 沒有留下的題");
    assert.ok(typeof m.why === "string" && m.why.length >= 6, id + " 沒寫理由");
    m.keep.forEach((k) => {
      assert.ok(byId[k], id + " → " + k + " 不在題庫");
      assert.ok(!merged[k], id + " → " + k + " 自己也被併掉了（不能接龍）");
      assert.equal(byId[k].concept, c.concept, id + " → " + k + " 不同觀念");
    });
  });
});

test("看圖題一律保留（看圖是另一種考法）", () => {
  const figDropped = Object.keys(merged).filter((id) => byId[id].type === "figure");
  assert.deepEqual(figDropped, []);
});

test("合併後題數：第一單元 77、第二單元 76、第三單元 5（10-11 第一輪 108／97／5；10-18 律師新判準第二輪再併 52 題）；安親班卷每一題都還練得到（本身留下或由留下的題代表）", () => {
  const unit = (c) => c.concept[0];
  assert.deepEqual(["1", "2", "3"].map((u) => kept.filter((c) => unit(c) === u).length), [77, 76, 5]);
  const anqinAll = cards.filter((c) => c.set === "anqin");
  anqinAll.forEach((c) => {
    if (!merged[c.id]) return;
    assert.ok(merged[c.id].keep.every((k) => kept.some((x) => x.id === k)), c.id + " 的代表題不在合併後題庫");
  });
  const also = new Set(); anqinAll.forEach((c) => { if (merged[c.id]) merged[c.id].keep.forEach((k) => also.add(k)); });
  const anqinSet = kept.filter((c) => c.set === "anqin" || also.has(c.id));
  assert.ok(anqinSet.length < anqinAll.length, "合併後安親班卷應該變少");
  assert.equal(new Set(anqinSet.map((c) => c.id)).size, anqinSet.length);
});

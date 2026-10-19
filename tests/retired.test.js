// 範圍稽核停出名單（src/retired.js，2026-10-19）：每題都在題庫、都有理由、不和「重複題合併」混在一起。
// 執行：node --test tests/retired.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "../src/app.html"), "utf8");
const i = html.indexOf("var BASE_CARDS = "), j = html.indexOf(";\nvar ALL_CARDS", i);
const base = vm.runInNewContext("(" + html.slice(i + "var BASE_CARDS = ".length, j) + ")");
const cards = Array.from(base).concat(require("../src/bank_extra.js"));
const merged = require("../src/merge.js");
const retired = require("../src/retired.js");

test("停出名單：每一題都在題庫裡、分類是 out 或 challenge、都寫了理由", () => {
  const ids = new Set(cards.map((c) => c.id));
  assert.deepEqual(Object.keys(retired).filter((id) => !ids.has(id)), [], "名單裡有題庫沒有的 id");
  assert.deepEqual(Object.keys(retired).filter((id) => !["out", "challenge"].includes(retired[id].kind)), [], "分類不對");
  assert.deepEqual(Object.keys(retired).filter((id) => !String(retired[id].why || "").trim()), [], "沒寫理由");
});

test("考卷可能出的難題歸 challenge（之後以挑戰模式加回），不是永久停出", () => {
  ["h1", "h7", "h3", "h11", "k43", "k44", "s37", "q36"].forEach((id) => assert.equal(retired[id].kind, "challenge", id));
});

test("停出名單不和 merge.js 重疊（停出不是重複題合併，沒有代表題）", () => {
  assert.deepEqual(Object.keys(retired).filter((id) => merged[id]), []);
});

test("10-19 孩子當晚 review 回合排到的超範圍／過難題都在名單裡", () => {
  ["k43", "k44", "k58", "h1", "h7"].forEach((id) => assert.ok(retired[id], id + " 沒停出"));
});

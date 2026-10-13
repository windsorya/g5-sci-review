// /v3/ 是正式版的同一份副本（同網域共用 localStorage，舊書籤還在用）。
// Codex 審 2e70601：只 build 了 index.html、沒複製到 v3 ⇒ /v3/ 還是舊的存檔邏輯，兩個網址同時開就互相蓋掉。
// build 後一律 `cp index.html v3/index.html`。執行：node --test tests/v3copy.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

test("v3/index.html 與 index.html 逐字相同", () => {
  const root = path.join(__dirname, "..");
  const a = fs.readFileSync(path.join(root, "index.html"), "utf8"), b = fs.readFileSync(path.join(root, "v3", "index.html"), "utf8");
  assert.ok(a === b, "v3/index.html 沒有跟著更新：build 後請 cp index.html v3/index.html");
});

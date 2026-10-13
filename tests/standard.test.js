// ⛔ 律師對「孩子用的教學網站」的固定標準——不屬於任何科目，複製這個網站去做新站時這支要一起帶走、不可刪除、不可改成跳過。
// 由來（#1339）：2026-10-13 數學站複製本站時，影片的強制檢查寫在自然科專用的 steps.test.js 裡，被當成「自然專用」整支刪掉，
// 數學站就在沒有影片的狀態宣稱上線（律師：「數學複習似乎都沒有加上影片」「為何會漏做」）。
// 標準來源：律師 2026-10-11（本站）「白話易懂、圖多一些、有影片就附上」；2026-10-13（難題站）每步一圖、每篇有影片；
//           2026-10-13 白話：小五每句 ≤40 字（#1319）；2026-10-13 三站要能互相切換（#1333）；網站不被搜尋引擎收錄。
// 三站各有一支同名檔（g5-sci-review、g5-help、g5-math-review），清單相同、取資料的方式各自不同。
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const S = require("../src/steps.js");
const V = require("../src/videos.js");
const ROOT = path.join(__dirname, "..");
const MAX_SENTENCE = 40;   // 小五每句上限，與難題站 src/hard.js READING[5] 相同
const topics = Object.keys(S.topics);   // 答錯補救的每個小題型

test("標準①影片：每個補救小題型至少一段驗證過的影片", () => {
  const missing = topics.filter((k) => !(Array.isArray(V[k]) && V[k].length));
  assert.deepEqual(missing, [], "沒有影片：" + missing.join("、"));
});

test("標準②圖：每個小題型的每一步都有圖", () => {
  topics.forEach((k) => S.topics[k].steps.forEach((st, i) => {
    const fig = typeof st.fig === "function" ? st.fig() : st.fig;
    assert.ok(/<svg[^>]*role="img"[^>]*aria-label="[^"]{4,}"/.test(String(fig)), k + " 第 " + (i + 1) + " 步沒有圖或缺 aria-label");
  }));
});

test("標準③白話：補救每一句不超過小五句長上限", () => {
  const long = [];
  topics.forEach((k) => S.topics[k].steps.map((st) => st.say).concat([S.topics[k].remember]).forEach((t) =>
    String(t).replace(/<[^>]*>/g, "").split(/[。！？]/).forEach((s) => { if (s.trim().length > MAX_SENTENCE) long.push(k + "：" + s.trim()); })));
  assert.deepEqual(long, []);
});

test("標準④三站切換列、⑤不被搜尋引擎收錄", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(/id="siteNav"/.test(html) && (html.match(/windsorya\.github\.io\/g5-(math-review|help)\//g) || []).length >= 2, "缺三站切換列");
  assert.ok(/<meta name="robots" content="noindex/.test(html), "缺 noindex");
  assert.ok(/Disallow: \//.test(fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8")), "robots.txt 沒有 Disallow");
});

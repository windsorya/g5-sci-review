// 錯題站讀的 weak-export.js（交辦 #4027；規格＝g5-wrong-review/docs/app-weak-entry-design-20261019.md 第 2 節）。
// 對照組不是另寫一份判定：用 app.html 自己那幾行組 BANK、自己的 unitCards，再真的跑 core.js reduce 開「練待加強的」那一輪，
// 拿回合的題目（session.queue）跟 export 的題數逐題比。存檔全是合成資料。
// 執行：node --test tests/weak_export.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");
const C = require("../src/core.js");
const RETIRED = require("../src/retired.js");
const MERGED = require("../src/merge.js");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "weak-export.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "src/app.html"), "utf8");
function grab(a, b) { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "找不到 " + a); return html.slice(i + a.length, j); }

// ── 對照組：網頁的 BANK、UNITS、unitCards（app.html 原文照跑）──
const app = vm.createContext({ window: { G5_EXTRA_CARDS: require("../src/bank_extra.js"), G5_MERGED: MERGED, G5_RETIRED: RETIRED }, C });
vm.runInContext("var UNITS = " + grab("var UNITS = ", "\n\nvar ERRS") + "\n" +
  "var _s=null,_now=0; function S(){return _s;} function V(){return {today:C.dayKey(_now)};}\n" +
  "function conceptOn" + grab("function conceptOn", "\n") + "\n" +
  "function unitCards" + grab("function unitCards", "\n") + "\n" +
  "this.at=function(s,now){_s=s;_now=now;};", app);
const BANK = app.BANK, UNITS = Object.keys(app.UNITS);
const OUT_IDS = Object.keys(RETIRED).filter((id) => RETIRED[id].kind === "out");
const CH_IDS = Object.keys(RETIRED).filter((id) => RETIRED[id].kind === "challenge" && !MERGED[id]);

// 「練待加強的」實際出的題：每個單元按一次（startReview(u,"weak") 不給 size＝整輪，app 只是每段切 20 題），合起來
function practiced(state, now) {
  app.at(state, now);
  const ids = new Set();
  UNITS.forEach((u, i) => {
    const r = C.reduce(state, { type: "sessionStart", id: "t-" + i, kind: "review", pick: "weak", ids: app.unitCards(u) }, { now, bank: BANK });
    if (r.error) { assert.equal(r.error, "REVIEW_EMPTY"); return; }
    r.state.session.queue.forEach((id) => ids.add(id));
  });
  return ids;
}
const isCh = (id) => !!RETIRED[id] && RETIRED[id].kind === "challenge";
function oracle(state, now) {
  const today = practiced(state, now), all = practiced(state, now + 86400000);   // 「不管今天練過沒」＝明天按會出的（卡片狀態不隨日子變）
  const part = (set) => ({ weak: [...set].filter((id) => !isCh(id)), challenge: [...set].filter(isCh) });
  return { all: part(all), today: part(today) };
}

// ── 載入 export：替身全域，記下註冊、全域變動、localStorage 與網路 ──
function load(extra) {
  const calls = [], touched = [];
  const g = vm.createContext({});
  g.window = g;
  g.G5WeakExportRegister = function (x) { calls.push(x); };
  g.localStorage = { getItem(k) { touched.push(["get", k]); return null; }, setItem(k) { touched.push(["set", k]); }, removeItem(k) { touched.push(["rm", k]); } };
  g.fetch = function () { touched.push(["fetch"]); };
  g.XMLHttpRequest = function () { touched.push(["xhr"]); };
  Object.assign(g, extra || {});
  const before = Object.getOwnPropertyNames(g).sort();
  const vals = before.map((k) => g[k]);
  vm.runInContext(SRC, g);
  return { g, calls, touched, before, vals, after: Object.getOwnPropertyNames(g).sort() };
}
const L = load();
const EXP = L.calls[0];
const J = (x) => JSON.parse(JSON.stringify(x));   // vm 另一個 realm 的物件原型不同，deepEqual 前先轉成本 realm

// ── 合成存檔 ──
const NOW = Date.parse("2026-10-24T15:00:00+08:00"), TODAY = C.dayKey(NOW);
function card(kind) {
  if (kind === "weak") return { seen: 2, goodDays: [], blockedDay: TODAY, due: "2026-10-25" };
  if (kind === "recheck") return { seen: 3, goodDays: ["2026-10-20"], blockedDay: null, due: "2026-10-25", needsRecheck: true };
  if (kind === "half") return { seen: 1, goodDays: ["2026-10-21"], blockedDay: null, due: "2026-10-27" };
  return { seen: 4, goodDays: ["2026-10-18", "2026-10-21"], blockedDay: null, due: null };   // 學會了
}
function save(cards, opt) {
  opt = opt || {};
  const s = C.blankState();
  Object.keys(cards).forEach((id) => { s.cards[id] = card(cards[id]); });
  s.settings.unit3 = !!opt.unit3;
  if (opt.touched) s.days[TODAY] = { planIds: [], doneIds: [], touched: opt.touched.slice(), extraDone: false, labRuns: 0, teach: 0, mood: null };
  s.log = (opt.log || []).map((id, i) => ({ op: "o" + i, d: TODAY, card: id, c: "x", ok: i % 2 === 0, hint: false, unsure: false, variation: false, first: false }));
  assert.deepEqual(C.checkState(s, BANK), [], "合成存檔本身要合法");
  return s;
}
function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
function randomSave(seed) {
  const r = rng(seed), cards = {}, touched = [], log = [];
  BANK.cards.forEach((c) => {
    const p = r();
    if (p < 0.35) return;
    cards[c.id] = p < 0.55 ? "weak" : p < 0.65 ? "recheck" : p < 0.75 ? "half" : "learned";
    if (r() < 0.3) touched.push(c.id);
    if (r() < 0.5) log.push(c.id);
  });
  return save(cards, { unit3: r() < 0.5, touched, log });
}
function check(s, now) {
  const got = EXP.summarize(JSON.stringify(s), now), o = oracle(s, now);
  assert.equal(got.ok, true);
  assert.equal(got.weak, o.all.weak.length, "weak");
  assert.equal(got.weakToday, o.today.weak.length, "weakToday");
  assert.equal(got.challenge, o.all.challenge.length, "challenge");
  assert.equal(got.challengeToday, o.today.challenge.length, "challengeToday");
  return { got, o };
}
const FIELDS = ["answers", "seen", "weak", "weakToday", "challenge", "challengeToday", "out"];
function shape(x) {
  assert.equal(x.ok, true);
  FIELDS.forEach((f) => assert.ok(Number.isInteger(x[f]) && x[f] >= 0, f + " 要是非負整數：" + x[f]));
  assert.ok(x.weakToday <= x.weak && x.challengeToday <= x.challenge);
}

test("W1 介面：執行期間同步註冊一次、api 1、key g5sci.v3、links 都是 null（本站沒有直接開練的網址）", () => {
  assert.equal(L.calls.length, 1);
  assert.equal(EXP.api, 1);
  assert.equal(EXP.key, "g5sci.v3");
  assert.equal(typeof EXP.summarize, "function");
  assert.deepEqual(Object.keys(EXP).sort(), ["api", "key", "links", "summarize"]);
  assert.deepEqual(J(EXP.links), { weak: null, challenge: null });
  assert.ok(!/type\s*=\s*["']?module|^\s*(import|export)\s/m.test(SRC), "要是 classic script");
});

test("W2 唯讀：不新增、不改任何全域；不碰 localStorage、不連網（設計書 I1），連 summarize 跑過之後也一樣", () => {
  EXP.summarize(JSON.stringify(randomSave(7)), NOW);
  EXP.summarize("{bad", NOW);
  assert.deepEqual(L.after, L.before, "多了或少了全域");
  assert.deepEqual(Object.getOwnPropertyNames(L.g).sort(), L.before);
  L.before.forEach((k, i) => assert.ok(L.g[k] === L.vals[i], "全域 " + k + " 被換掉"));
  assert.deepEqual(L.touched, []);
  // 頁面上剛好有全域 module／MB 也不會被寫進去或讀進來
  const sentinel = { exports: {} }, L2 = load({ module: sentinel, MB: { RETIRED: { s1: { kind: "out" } } } });
  assert.equal(L2.calls.length, 1);
  assert.deepEqual(sentinel, { exports: {} });
  const s = save({ s1: "weak" });
  assert.equal(L2.calls[0].summarize(JSON.stringify(s), NOW).weak, 1, "s1 不在本站停出名單，不能被頁面的 MB 改成考不到");
});

test("W3 沒有註冊函式就什麼都不做（直接開這個檔）", () => {
  const g = vm.createContext({}); g.window = g;
  const before = Object.getOwnPropertyNames(g).sort();
  vm.runInContext(SRC, g);
  assert.deepEqual(Object.getOwnPropertyNames(g).sort(), before);
  vm.runInNewContext(SRC, {});   // 連 window 都沒有也不丟例外
});

test("W4 ①逐題：每一張卡單獨待加強時，export 的題數＝「練待加強的」那一輪有沒有出它（今天練過／沒練過、單元三開／關）", () => {
  let n = 0;
  BANK.cards.forEach((c) => {
    [false, true].forEach((unit3) => [false, true].forEach((done) => {
      const { got, o } = check(save({ [c.id]: "weak" }, { unit3, touched: done ? [c.id] : [] }), NOW);
      const served = o.all.weak.concat(o.all.challenge);
      assert.ok(served.length <= 1 && (served.length === 0 || served[0] === c.id));
      assert.equal(got.weak + got.challenge, served.length, c.id);
      n++;
    }));
  });
  assert.ok(n >= 4 * 200, "題庫要整份跑過：" + n);
});

test("W5 ①整份：40 份亂數合成存檔，weak／weakToday／challenge／challengeToday 都等於真的開那一輪的題數", () => {
  let nonzero = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { got } = check(randomSave(seed * 7919), NOW);
    shape(got);
    if (got.weak && got.weakToday < got.weak && got.challenge) nonzero++;
  }
  assert.ok(nonzero >= 20, "亂數存檔要真的有今天練過的與挑戰題（否則這組比不出東西）：" + nonzero);
});

test("W6 ②考不到（out）不進 weak、另計 out；考古挑戰（challenge）不進 weak、進 challenge", () => {
  assert.ok(OUT_IDS.length >= 3 && CH_IDS.length >= 5);
  const cards = {};
  OUT_IDS.forEach((id) => { cards[id] = "weak"; });
  CH_IDS.forEach((id) => { cards[id] = "weak"; });
  cards.s1 = "weak"; cards.s2 = "learned";
  const { got } = check(save(cards), NOW);
  assert.equal(got.weak, 1);
  assert.equal(got.out, OUT_IDS.length);
  assert.equal(got.challenge, CH_IDS.filter((id) => app.unitCards(BANK.concepts[C.cardById(C.blankState(), BANK, id).concept].unit).indexOf(id) >= 0).length);
  assert.ok(got.challenge >= 5);
  // 學會了的 out 不算
  const g2 = EXP.summarize(JSON.stringify(save({ [OUT_IDS[0]]: "learned" })), NOW);
  assert.equal(g2.out, 0);
});

test("W7 ③今天練過的不算今天能練（weakToday／challengeToday），weak／challenge 照算；隔天又算", () => {
  const s = save({ s1: "weak", s2: "recheck", s3: "weak", s37: "weak", k3: "weak" }, { touched: ["s1", "s37"] });
  const { got } = check(s, NOW);
  assert.equal(got.weak, 3); assert.equal(got.weakToday, 2);
  assert.equal(got.challenge, 2); assert.equal(got.challengeToday, 1);
  const tm = EXP.summarize(JSON.stringify(s), NOW + 86400000);
  assert.equal(tm.weakToday, 3); assert.equal(tm.challengeToday, 2);
  // nowMs 換日以台北時間：台北 10-24 23:59 仍是今天、10-25 00:01 是明天
  assert.equal(EXP.summarize(JSON.stringify(s), Date.parse("2026-10-24T23:59:00+08:00")).weakToday, 2);
  assert.equal(EXP.summarize(JSON.stringify(s), Date.parse("2026-10-25T00:01:00+08:00")).weakToday, 3);
});

test("W8 單元三沒開時，單元三的待加強題「練待加強的」不出，export 也不算", () => {
  const u3 = BANK.cards.filter((c) => BANK.concepts[c.concept].unit === "3" && !RETIRED[c.id] && !MERGED[c.id]).slice(0, 3).map((c) => c.id);
  const cards = {}; u3.forEach((id) => { cards[id] = "weak"; });
  assert.equal(check(save(cards, { unit3: false }), NOW).got.weak, 0);
  assert.equal(check(save(cards, { unit3: true }), NOW).got.weak, 3);
});

test("W9 ④讀不懂回 {ok:false}：壞 JSON、不是物件、舊版 v1、未來版本、欄位型別錯、非字串", () => {
  const good = save({ s1: "weak" });
  const bad = ["", "{bad", "null", "[]", "42", "\"x\"", JSON.stringify({ v: 1, cards: {} }), JSON.stringify(Object.assign({}, good, { v: 5 })),
    JSON.stringify(Object.assign({}, good, { cards: { s1: { seen: -1, goodDays: [], blockedDay: null, due: null } } })),
    JSON.stringify(Object.assign({}, good, { log: "x" }))];
  bad.forEach((raw) => assert.deepEqual(J(EXP.summarize(raw, NOW)), { ok: false }, raw.slice(0, 40)));
  [null, undefined, 3, {}].forEach((raw) => assert.deepEqual(J(EXP.summarize(raw, NOW)), { ok: false }));
  // v3（舊版號、同形狀）本站讀得懂，export 也讀得懂
  assert.equal(EXP.summarize(JSON.stringify(Object.assign({}, good, { v: 3 })), NOW).ok, true);
  // nowMs 壞掉不丟例外
  shape(EXP.summarize(JSON.stringify(good), NaN));
});

test("W10 ⑤欄位：answers＝log 筆數、seen＝cards[*].seen 加總（同 g5-help sync.js practiceScore）、全部非負整數、不等式成立", () => {
  const s = save({ s1: "weak", s2: "learned", s3: "half" }, { log: ["s1", "s1", "s2", "s3", "s1"] });
  const got = EXP.summarize(JSON.stringify(s), NOW);
  shape(got);
  assert.equal(got.answers, 5);
  assert.equal(got.seen, 2 + 4 + 1);
  const blank = EXP.summarize(JSON.stringify(C.blankState()), NOW);
  assert.deepEqual(J(blank), { ok: true, answers: 0, seen: 0, weak: 0, weakToday: 0, challenge: 0, challengeToday: 0, out: 0 });
  // 和 sync.js 的 practiceScore 原文比（有同層 g5-help 時；e2e 也要這個 symlink）
  const sp = path.join(ROOT, "..", "g5-help", "sync.js");
  if (!fs.existsSync(sp)) return;
  const js = fs.readFileSync(sp, "utf8"), i = js.indexOf("function practiceScore("), j = js.indexOf("\n  }\n", i);
  assert.ok(i > 0 && j > i);
  const ps = vm.runInNewContext("(" + js.slice(i, j + 4) + ")");
  for (let seed = 1; seed <= 10; seed++) {
    const raw = JSON.stringify(randomSave(seed * 31)), g = EXP.summarize(raw, NOW);
    assert.deepEqual(Array.from(ps(raw)), [g.answers, g.seen], "seed " + seed);
  }
});

test("W11 存檔原文不被改動（summarize 只讀）", () => {
  const s = save({ s1: "weak" }, { touched: ["s1"] }), raw = JSON.stringify(s), copy = raw.slice();
  EXP.summarize(raw, NOW);
  assert.equal(raw, copy);
});

test("W12 檔案是 build 產生的最新版（改了 core.js／停出名單／題庫忘了重 build 就紅）", () => {
  const py = "import sys; sys.path.insert(0, sys.argv[1]); import build; sys.stdout.write(build.build_weak_export((build.ROOT / 'src' / 'app.html').read_text(encoding='utf-8')))";
  const out = execFileSync("python3", ["-c", py, ROOT], { encoding: "utf8", maxBuffer: 1 << 26 });
  assert.ok(out === SRC, "weak-export.js 不是最新：請跑 python3 build.py");
  // 內嵌的是同一份 core.js、停出名單
  ["src/core.js", "src/retired.js", "src/merge.js", "src/bank_extra.js"].forEach((f) => assert.ok(SRC.indexOf(fs.readFileSync(path.join(ROOT, f), "utf8")) >= 0, f));
});

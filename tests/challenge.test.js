// 考古挑戰（2026-10-23 交辦 #3006）接線與內容：用 app.html 自己那幾行組出和網頁一樣的 BANK（不是另寫一份），
// 再拿真實題庫算「開放前後每日計畫放不放挑戰題」。核心規則本身在 tests/core.test.js CH01–CH12；畫面在 tests/e2e_challenge.py。
// 執行：node --test tests/challenge.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const C = require("../src/core.js");
const RETIRED = require("../src/retired.js");
const MERGED = require("../src/merge.js");
const SOLVE = require("../src/solve.js");

const html = fs.readFileSync(path.join(__dirname, "../src/app.html"), "utf8");
function grab(a, b) { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "找不到 " + a); return html.slice(i + a.length, j); }
// app.html 從 ALL_CARDS 到 BANK.concepts 那一段原文照跑（window 換成這裡的題庫檔）
const ctx = vm.createContext({
  BASE_CARDS: vm.runInNewContext("(" + grab("var BASE_CARDS = ", ";\nvar ALL_CARDS") + ")"),
  CONCEPTS: vm.runInNewContext("(" + grab("var CONCEPTS = ", ";\nvar CIDS") + ")"),
  FIGS: vm.runInNewContext("(" + grab("var FIGS = ", ";\nvar BASE_CARDS") + ")"),
  window: { G5_EXTRA_CARDS: require("../src/bank_extra.js"), G5_MERGED: MERGED, G5_RETIRED: RETIRED }
});
vm.runInContext("var CIDS = Object.keys(CONCEPTS);\nvar ALL_CARDS = " + grab("var ALL_CARDS = ", "\n\nvar ERRS") + "\nthis.BANK = BANK; this.CHALLENGE = CHALLENGE;", ctx);
const BANK = JSON.parse(JSON.stringify(ctx.BANK)), CHALLENGE = ctx.CHALLENGE;
const chIds = Object.keys(RETIRED).filter((id) => RETIRED[id].kind === "challenge").sort();
const D = "2026-10-24", NOON = Date.parse(D + "T12:00:00+08:00");

test("網頁的 BANK.challenge＝停出名單裡 kind:challenge 的 23 題；不在 active（不當一般新卡）、不在 out", () => {
  assert.deepEqual(Object.keys(BANK.challenge).sort(), chIds);
  assert.equal(chIds.length, 23);
  assert.deepEqual(chIds.filter((id) => BANK.active[id] || BANK.out[id]), []);
});

test("每一題考古挑戰都有自己的分步驟解法：2～4 步、每步有字、沒有英文；解法檔沒有多出來的題", () => {
  assert.deepEqual(Object.keys(SOLVE).sort(), chIds);
  chIds.forEach((id) => {
    const s = SOLVE[id];
    assert.ok(Array.isArray(s) && s.length >= 2 && s.length <= 4, id + " 步數 " + (s && s.length));
    s.forEach((t, i) => {
      assert.ok(typeof t === "string" && t.trim().length >= 6, id + "#" + i + " 沒寫內容");
      assert.ok(!/[A-Za-z]/.test(t), id + "#" + i + " 有英文");
    });
  });
});

test("有挑戰題的觀念都有基本題（不然永遠開不了）；題數和停出名單一致", () => {
  const s = C.blankState(), per = {};
  chIds.forEach((id) => { const c = C.cardById(s, BANK, id); per[c.concept] = (per[c.concept] || 0) + 1; });
  Object.keys(per).forEach((cid) => {
    const st = C.challengeStatus(s, BANK, cid);
    assert.ok(st.basics > 0, cid + " 沒有基本題");
    assert.equal(st.total, per[cid], cid);
    assert.equal(st.open, false, cid + " 一題都沒做過就開放了");
  });
});

// 她的基本題做到什麼程度 ⇒ 計畫放幾題挑戰題（真實題庫）
function stateWith(fn) {
  const s = C.blankState();
  C.poolCards(s, BANK, D).forEach((c) => { const r = fn(c); if (r) s.cards[c.id] = r; });
  return s;
}
const planCh = (s) => C.view(s, { bank: BANK, now: NOON }).planIds.filter((id) => BANK.challenge[id]);

test("真實題庫：基本題都沒做過 ⇒ 計畫 0 題挑戰題；1-3 基本題都做過、全對、到期 ⇒ 放 3 題，都是 1-3 的", () => {
  assert.deepEqual(planCh(C.blankState()), []);
  const s = stateWith((c) => c.concept === "1-3" ? { seen: 1, goodDays: ["2026-10-21"], blockedDay: null, due: D } : null);
  assert.equal(C.challengeStatus(s, BANK, "1-3").open, true);
  const got = planCh(s);
  assert.equal(got.length, 3, got.join());
  got.forEach((id) => assert.equal(C.cardById(s, BANK, id).concept, "1-3", id));
  // 回合裡：第一題不是挑戰題、挑戰題不相鄰
  const r = C.reduce(s, { type: "sessionStart", id: "ch-op1" }, { bank: BANK, now: NOON });
  assert.ok(!r.error, r.error);
  const q = r.state.session.queue;
  assert.ok(!BANK.challenge[q[0]], q.slice(0, 3).join());
  for (let i = 1; i < q.length; i++) assert.ok(!(BANK.challenge[q[i]] && BANK.challenge[q[i - 1]]), "相鄰：" + q[i - 1] + "," + q[i]);
});

test("真實題庫：1-3 基本題 22 題有 5 題待加強（答對 17 題，不到八成）⇒ 不開放；練對 1 題（18 題）⇒ 開放", () => {
  let k = 0;
  const s = stateWith((c) => c.concept !== "1-3" ? null : (k++ < 5 ? { seen: 1, goodDays: [], blockedDay: "2026-10-22", due: "2026-10-23" } : { seen: 1, goodDays: ["2026-10-21"], blockedDay: null, due: "2026-10-26" }));
  const st = C.challengeStatus(s, BANK, "1-3");
  assert.deepEqual([st.basics, st.basicOk, st.need, st.open], [22, 17, 18, false]);
  assert.deepEqual(planCh(s), []);
  const weak = Object.keys(s.cards).find((id) => !s.cards[id].goodDays.length);
  s.cards[weak] = { seen: 2, goodDays: ["2026-10-23"], blockedDay: "2026-10-22", due: "2026-10-26" };
  assert.equal(C.challengeStatus(s, BANK, "1-3").open, true);
  assert.ok(planCh(s).length >= 2);
});

test("真實題庫：1-3 基本題都答對但今天沒到期、1-1 基本題到期，按「先練季節」（focus 1-3）：挑戰題不排第一、不相鄰（Codex 審 7ca947e 重現情境）", () => {
  const s = stateWith((c) => c.concept === "1-3" ? { seen: 1, goodDays: ["2026-10-21"], blockedDay: null, due: "2026-10-27" }
    : c.concept === "1-1" ? { seen: 1, goodDays: ["2026-10-21"], blockedDay: null, due: D } : null);
  const plan = C.view(s, { bank: BANK, now: NOON }).planIds;
  assert.deepEqual(plan.filter((id) => !BANK.challenge[id]).every((id) => C.cardById(s, BANK, id).concept !== "1-3"), true, "前置：1-3 今天只有挑戰題");
  assert.equal(plan.filter((id) => BANK.challenge[id]).length, 3);
  const r = C.reduce(s, { type: "sessionStart", id: "ch-op2", focus: "1-3" }, { bank: BANK, now: NOON });
  assert.ok(!r.error, r.error);
  const q = r.state.session.queue;
  assert.ok(!BANK.challenge[q[0]], q.slice(0, 4).join());
  for (let i = 1; i < q.length; i++) assert.ok(!(BANK.challenge[q[i]] && BANK.challenge[q[i - 1]]), "相鄰：" + q[i - 1] + "," + q[i]);
});

test("畫面接線：練習畫面看 CHALLENGE 標「考古挑戰」、答錯與停輪畫面都接 solveBlock、觀念頁接 chLine、build 會內嵌 solve.js", () => {
  assert.ok(/CHALLENGE\[id\]\?'<span class="tag" id="chTag">考古挑戰<\/span>'/.test(html));
  assert.ok(/box\.insertAdjacentHTML\("beforeend",solveBlock\(c\)\)/.test(html));
  assert.ok(/solveBlock\(c\)\?'<div style="text-align:left;justify-self:stretch">'\+solveBlock\(c\)/.test(html), "停輪畫面");
  assert.ok(/chLine\(cid,v\)\+/.test(html));
  assert.ok(html.includes("<!--@INLINE src/solve.js-->"));
  assert.equal(CHALLENGE.s37, 1);
});

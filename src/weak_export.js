// 錯題站讀「自然 app 待加強題數」的介面（交辦 #4027；規格＝g5-wrong-review/docs/app-weak-entry-design-20261019.md 第 2 節）。
// 這是樣板：python3 build.py 把下面的 @INLINE／@BANK 換成本站同一份 core.js、停出名單、題庫，產生網站根目錄的 weak-export.js。
// 為什麼由 build 產生、不另寫：錯題站顯示的「待加強 N 題」必須就是本站「練待加強的」會出的那一群（設計書 I2）；
// 判定一律呼叫 core.js 的 reviewPick／weakCard（和 reduce 開「練待加強的」那一輪同一個函式），題庫是 app.html 組 BANK 那一段原文。
// 規則：classic script、包在 IIFE 裡、執行期間同步註冊一次；不新增或改任何全域、不讀寫 localStorage、不連網（設計書 I1）。
(function (W) {
  "use strict";
  if (!W || typeof W.G5WeakExportRegister !== "function") return;   // 不是被錯題站載入（例如直接開這個檔）就什麼都不做
  var register = W.G5WeakExportRegister;
  var M = (function () {
    // 下面內嵌的模組照網頁的寫法把 G5Core、G5_RETIRED…掛到 window；這裡用區域變數 window 接住，真正的全域一個都不碰。
    // module 也宣告成區域的 undefined：頁面上就算有全域 module，模組也不會把自己寫進去。MB 同理（app.html 組 OUT 時會看 MB）。
    var window = {}, module, MB;
/*@INLINE src/retired.js*/
/*@INLINE src/merge.js*/
/*@INLINE src/bank_extra.js*/
/*@INLINE src/core.js*/
/*@BANK*/
    return { C: window.G5Core, BANK: BANK, UNITS: UNITS, CONCEPTS: CONCEPTS };
  })();
  var C = M.C, BANK = M.BANK;

  // 本站「練待加強的」：首頁「小考前想全部練一次」每個單元一顆（app.html startReview(key,"weak")，ids＝unitCards(u)），
  // reduce 用 reviewPick(state, BANK, ids, "weak", today) 出題。全部單元合起來＝這裡的母體；
  // 安親班卷（a1–a3）是單元的子集，不另算。day 給 null＝不扣今天練過的（weak），給今天＝今天還能練的（weakToday）。
  function unitIds(s, today) {
    var pool = C.poolCards(s, BANK, today), ids = [];
    Object.keys(M.UNITS).forEach(function (u) {
      pool.forEach(function (c) { if (M.CONCEPTS[c.concept].unit === u && C.conceptOn(s, BANK, c.concept)) ids.push(c.id); });
    });
    return ids;
  }
  function split(ids) {
    var n = { weak: 0, challenge: 0 }, once = {};
    ids.forEach(function (id) { if (once[id]) return; once[id] = 1; if (C.isChallenge(BANK, id)) n.challenge++; else n.weak++; });
    return n;
  }
  function summarize(raw, nowMs) {
    try {
      if (typeof raw !== "string") return { ok: false };
      var r = C.decode(raw, BANK);   // 和本站開頁讀檔同一個判準：讀不懂的存檔本站也不用
      if (!r.accepted) return { ok: false };
      var s = r.state;
      var today = C.dayKey(typeof nowMs === "number" && isFinite(nowMs) ? nowMs : Date.now());
      var ids = unitIds(s, today);
      var all = split(C.reviewPick(s, BANK, ids, "weak", null)), now = split(C.reviewPick(s, BANK, ids, "weak", today));
      var seen = 0, out = 0;
      Object.keys(s.cards).forEach(function (id) { seen += s.cards[id].seen; });
      // out＝考不到（kind:"out"）而且待加強的：本站任何一輪都不出，錯題站不顯示，只給家長對帳
      C.allCards(s, BANK).forEach(function (c) { if (C.isOut(BANK, c.id) && C.weakCard(C.cardState(s, c.id))) out++; });
      return { ok: true, answers: s.log.length, seen: seen, weak: all.weak, weakToday: now.weak,
               challenge: all.challenge, challengeToday: now.challenge, out: out };
    } catch (e) {
      return { ok: false };
    }
  }
  register({
    api: 1,
    key: "g5sci.v3",
    // 本站沒有「直接開練」的網址參數（只讀 #sync=）：填 null，錯題站連首頁並說明怎麼按（設計書第 3 節）
    links: { weak: null, challenge: null },
    summarize: summarize
  });
})(typeof window !== "undefined" ? window : undefined);

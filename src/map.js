/* 探險地圖＋成長植物（交辦 #1725，2026-10-13 律師：「我確認設計了，請完成它」「每一關破關就讓某種物件成長」）
 * 純函式：只讀畫面已經算好的觀念階段（core.js view().stages），不讀不寫作答存檔 g5sci.v3。
 * 「上次看到第幾階」是每台裝置的觀看紀錄，存在獨立 key g5sci.mapSeen；讀寫失敗一律當沒有，不拋錯。
 * node 測試：tests/map.test.js
 */
(function (root) {
  "use strict";
  var SEEN_KEY = "g5sci.mapSeen";
  // 走過一站＝觀念卡到「長葉了」以上：core.js stageOf() 的 2（這一站的題目每題都做過一次）、3（出口題通過）或 4（結果了）。
  // 2026-10-14 律師轉述孩子問「達成什麼條件才能放一本書」，要「直接完成關卡題目，就過那一關」：原本要開花（爸媽考出口題通過）才算 ⇒ 3 → 2（四站同一條）
  var BLOOM = 2;
  // 地圖上寫給孩子看的規則、走過的站標的字（數學／國語／社會站的 map.js 也有同名的 RULE／DONE）
  var RULE = "怎麼讓植物長大：一站的題目，每一題都做過一次，植物就長大一階。", DONE = "長大一階";
  // 階數＝走過站數；0 是還沒種的一盆土，1–7 是律師確認的七階
  var PLANT = ["一盆土", "種子", "發芽", "長出葉子", "長高", "結花苞", "開花", "結果"];
  var MAX = PLANT.length - 1;

  // o.cids：觀念依程式順序；o.stages：{cid: 0–4}；o.on(cid)：這個觀念開放了沒（未開放＝鎖頭、不算分母）
  function trail(o) {
    var stations = o.cids.map(function (cid, i) {
      var on = !!o.on(cid), st = (o.stages && o.stages[cid]) || 0;
      return { cid: cid, n: i + 1, on: on, done: on && st >= BLOOM, now: false };
    });
    var first = stations.filter(function (s) { return s.on && !s.done; })[0];
    if (first) first.now = true;
    var total = stations.filter(function (s) { return s.on; }).length;
    var walked = stations.filter(function (s) { return s.done; }).length;
    var locked = stations.length - total;
    return {
      stations: stations, walked: walked, total: total, left: total - walked, locked: locked,
      level: Math.min(walked, MAX),
      allDone: stations.length > 0 && locked === 0 && walked === stations.length
    };
  }

  function readSeen(storage) {
    try {
      var v = storage.getItem(SEEN_KEY);
      if (typeof v !== "string" || !/^(0|[1-9][0-9]?)$/.test(v)) return null;   // 只認自己寫的整數（0–99，不帶前導零）；空字串、小數、負數都當沒有（2026-10-14 Codex：數學 11 階、國語 10 階，一位數判準讀不回第 10、11 階）
      var n = Number(v);
      return n <= MAX ? n : null;
    } catch (e) { return null; }
  }
  function writeSeen(storage, n) {
    try { storage.setItem(SEEN_KEY, String(n)); return true; } catch (e) { return false; }
  }
  // 本次比上次看到的大才長大；沒看過當 0（第一次打開也看得到它長出來）；變小（重新開始）不動畫
  function growth(seen, level, allDone) {
    var prev = seen === null || seen === undefined ? 0 : seen;
    var grow = level > prev;
    return { grow: grow, celebrate: !!allDone && grow };
  }

  // 植物 SVG（不用 emoji）。ghost＝下一階的灰色剪影；fresh＝這一階新長出來的部位加 class="newpart"（給長大動畫）
  function plantSvg(level, opts) {
    opts = opts || {};
    var ghost = !!opts.ghost, fresh = !!opts.fresh;
    function col(c) { return ghost ? "var(--muted)" : c; }
    function part(from, to, svg) {
      if (level < from || level > to) return "";
      return fresh && level === from && !ghost ? '<g class="newpart">' + svg + "</g>" : svg;
    }
    var stemTop = level >= 5 ? 36 : level === 4 ? 42 : 84;
    var s = "";
    // 盆與土
    s += '<path d="M34 116 L86 116 L80 146 L40 146 Z" fill="' + col("var(--soil)") + '"/>' +
         '<rect x="28" y="108" width="64" height="10" rx="4" fill="' + col("var(--soil)") + '"/>' +
         '<path d="M32 109 Q60 103 88 109" stroke="' + col("var(--ink)") + '" stroke-width="2" fill="none" opacity=".35"/>';
    // 1–2 種子
    s += part(1, 2, '<ellipse cx="60" cy="104" rx="8" ry="5" fill="' + col("var(--sun-deep)") + '"/>');
    // 2 發芽：小彎莖＋兩片子葉
    s += part(2, 2, '<path d="M60 104 Q57 94 61 86" stroke="' + col("var(--leaf)") + '" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
                    '<path d="M61 86 Q50 78 46 84 Q52 90 61 86Z M61 86 Q72 78 76 84 Q70 90 61 86Z" fill="' + col("var(--leaf)") + '"/>');
    // 3 以後：莖（4 起長高）
    s += part(3, MAX, '<path d="M60 108 L60 ' + stemTop + '" stroke="' + col("var(--leaf)") + '" stroke-width="4" stroke-linecap="round"/>');
    // 3 長出葉子：第一對大葉
    s += part(3, MAX, '<path d="M60 94 Q42 78 30 88 Q44 102 60 94Z M60 94 Q78 78 90 88 Q76 102 60 94Z" fill="' + col("var(--leaf)") + '"/>');
    // 4 長高：再兩對葉
    s += part(4, MAX, '<path d="M60 72 Q46 58 36 66 Q47 78 60 72Z M60 66 Q74 52 84 60 Q73 72 60 66Z M60 52 Q50 42 43 48 Q51 56 60 52Z" fill="' + col("var(--leaf)") + '"/>');
    // 5 結花苞
    s += part(5, 5, '<ellipse cx="60" cy="28" rx="7" ry="11" fill="' + col("var(--leaf)") + '"/><path d="M55 22 Q60 12 65 22Z" fill="' + col("var(--sunball)") + '"/>');
    // 6 開花
    s += part(6, 6, '<g fill="' + col("var(--sunball)") + '"><circle cx="60" cy="18" r="8"/><circle cx="71" cy="26" r="8"/><circle cx="67" cy="38" r="8"/><circle cx="53" cy="38" r="8"/><circle cx="49" cy="26" r="8"/></g>' +
                    '<circle cx="60" cy="29" r="6" fill="' + col("var(--sun-deep)") + '"/>');
    // 7 結果：三顆果實
    s += part(7, 7, '<path d="M60 36 Q50 40 44 50 M60 36 Q72 40 78 52" stroke="' + col("var(--leaf)") + '" stroke-width="3" fill="none"/>' +
                    '<g fill="' + col("var(--red)") + '"><circle cx="60" cy="28" r="10"/><circle cx="43" cy="56" r="9"/><circle cx="78" cy="58" r="9"/></g>');
    var name = PLANT[Math.max(0, Math.min(MAX, level))];
    return '<svg class="' + (ghost ? "ghost" : "pl") + '" viewBox="0 0 120 150" role="img" aria-label="' + (ghost ? "下一階還看不出來" : "植物：" + name) + '"' +
      (ghost ? ' opacity=".4"' : "") + ">" + s + "</svg>";
  }

  var api = { SEEN_KEY: SEEN_KEY, BLOOM: BLOOM, RULE: RULE, DONE: DONE, TITLE: "植物", PLANT: PLANT, trail: trail, readSeen: readSeen, writeSeen: writeSeen, growth: growth, plantSvg: plantSvg };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.G5Map = api;
})(typeof window !== "undefined" ? window : this);

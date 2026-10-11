// 看圖題的圖（2026-10-11）：照考古卷題型「自己重畫」，不用原卷圖片（著作權屬原學校，網站是公開的）。
// 規則：凡是跟太陽有關的座標，一律由 sun.js 的 sunPosition 算出來，不憑手感畫（五個科學圖錯的教訓）。
// 匯出 G5_FIGS = { kinds: {名稱: 繪圖函式(annotated)}, geo: {…可測的幾何…} }；app.html 的 figureSvg 遇到這裡的圖種就交給它畫。
(function (root) {
  "use strict";
  var TC = { lat: 24.15, lon: 120.68, tz: 8 };
  function sunAt(date, hour) {
    var f = root.sunPosition || (typeof require === "function" ? require("./sun.js").sunPosition : null);
    return f(date, hour, TC.lat, TC.lon, TC.tz);
  }
  function r1(x) { return Math.round(x * 10) / 10; }
  function wrap(kind, label, inner, cap) {
    return '<figure style="margin:0"><svg class="fig" data-fig="' + kind + '" viewBox="0 0 360 220" role="img" aria-label="' + label + '">' +
      '<rect width="360" height="220" rx="12" fill="var(--sky1)"/>' + inner + '</svg>' + (cap ? '<figcaption class="small">' + cap + '</figcaption>' : '') + '</figure>';
  }
  function txt(x, y, s, size, anchor, fill) {
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" font-size="' + (size || 14) + '" text-anchor="' + (anchor || "middle") + '" fill="' + (fill || "var(--ink)") + '">' + s + '</text>';
  }

  /* ---------- 1. 竿影一天紀錄（俯視圖，上方是北） ---------- */
  var POLE_DATE = new Date(2026, 9, 15);           // 台中 10 月 15 日（期中考前）
  var POLE_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];
  var POLE = { x: 180, y: 190 };
  function poleDay() {
    var raw = POLE_HOURS.map(function (h) {
      var p = sunAt(POLE_DATE, h), dir = (p.az + 180) % 360, len = 1 / Math.tan(p.alt * Math.PI / 180);
      return { h: h, sunAz: p.az, alt: p.alt, dir: dir, len: len };
    });
    // 俯視、上北下南、左西右東：x＝東西、y 往上＝北。整體縮放到最長影子 170（螢幕座標）。
    var maxDx = Math.max.apply(null, raw.map(function (s) { return Math.abs(Math.sin(s.dir * Math.PI / 180) * s.len); }));
    var maxDy = Math.max.apply(null, raw.map(function (s) { return Math.max(0, Math.cos(s.dir * Math.PI / 180) * s.len); }));
    var k = Math.min(165 / maxDx, 165 / maxDy);
    raw.forEach(function (s) {
      s.x = POLE.x + Math.sin(s.dir * Math.PI / 180) * s.len * k;
      s.y = POLE.y - Math.cos(s.dir * Math.PI / 180) * s.len * k;
    });
    return raw;
  }
  function drawPoleDay(annotated) {
    var sh = poleDay(), s = '';
    sh.forEach(function (p) {
      var mark = annotated && (p.h === 8 || p.h === 12);
      s += '<line x1="' + POLE.x + '" y1="' + POLE.y + '" x2="' + r1(p.x) + '" y2="' + r1(p.y) + '" stroke="var(--ink)" stroke-width="' + (mark ? 4 : 2) + '" opacity="' + (mark ? 0.9 : 0.55) + '"/>' +
        txt(p.x, p.y - 6, p.h + "點", 11);
    });
    s += '<circle cx="' + POLE.x + '" cy="' + POLE.y + '" r="5" fill="var(--ink)"/>' + txt(POLE.x, POLE.y + 20 > 216 ? 214 : POLE.y + 20, "竿子", 12, "middle", "var(--muted)") +
      txt(16, 60, "西", 16, "start") + txt(344, 60, "東", 16, "end") + txt(180, 20, "北", 16) + txt(350, 212, "俯視圖（從上往下看）", 11, "end", "var(--muted)");
    return wrap("pole-day", "台中十月某天每小時的竿影紀錄，從上往下看，上方是北", s,
      annotated ? "影子永遠在太陽的對面。早上太陽在東南東，8 點的影子指向西北西；中午太陽在南方最高，12 點的影子朝北而且最短。" : "台中 10 月某天，每小時記一次竿影（從上往下看，上方是北）。");
  }

  /* ---------- 2. 正午陽光從朝南窗戶照進屋內（三個季節比較） ---------- */
  var NOON_DAYS = { equinox: new Date(2026, 2, 20), winter: new Date(2026, 11, 22), summer: new Date(2026, 5, 21) };
  var HOUSE = { floorY: 190, wallX: 300, winTop: 90, winBot: 150 };   // 南牆在右邊；左邊是屋內（北）
  var HOUSE_ORDER = ["equinox", "winter", "summer"];                   // 圖上 ①②③ 的順序（故意不按季節排）
  function noonAlt(key) {
    var best = -90;
    for (var m = 660; m <= 780; m++) { var a = sunAt(NOON_DAYS[key], m / 60).alt; if (a > best) best = a; }
    return best;
  }
  function houseRays() {
    return HOUSE_ORDER.map(function (key, i) {
      var alt = noonAlt(key), t = Math.tan(alt * Math.PI / 180);
      // 從窗戶上緣進來的光往屋內（左下）走，落到地板的位置＝陽光照進最深的地方
      var depth = (HOUSE.floorY - HOUSE.winTop) / t;
      // 光太陡（夏至）時，到窗台高度還沒離開牆邊 6 以上＝被窗台擋住、照不進屋內：光線畫到窗台為止
      var atSill = (HOUSE.winBot - HOUSE.winTop) / t;
      if (atSill < 6) return { key: key, n: i + 1, alt: alt, depth: depth, blocked: true, x0: HOUSE.wallX, y0: HOUSE.winTop, x1: HOUSE.wallX - atSill, y1: HOUSE.winBot };
      return { key: key, n: i + 1, alt: alt, depth: depth, blocked: false, x0: HOUSE.wallX, y0: HOUSE.winTop, x1: HOUSE.wallX - depth, y1: HOUSE.floorY };
    });
  }
  var SEASON_NAME = { equinox: "春分／秋分", winter: "冬至", summer: "夏至" };
  function drawHouseNoon(annotated) {
    var rays = houseRays(), s = '';
    s += '<line x1="10" y1="' + HOUSE.floorY + '" x2="350" y2="' + HOUSE.floorY + '" stroke="var(--muted)" stroke-width="2"/>' +
      '<line x1="' + HOUSE.wallX + '" y1="40" x2="' + HOUSE.wallX + '" y2="' + HOUSE.winTop + '" stroke="var(--ink)" stroke-width="5"/>' +
      '<line x1="' + HOUSE.wallX + '" y1="' + HOUSE.winBot + '" x2="' + HOUSE.wallX + '" y2="' + HOUSE.floorY + '" stroke="var(--ink)" stroke-width="5"/>' +
      '<line x1="20" y1="40" x2="' + HOUSE.wallX + '" y2="40" stroke="var(--ink)" stroke-width="5"/>' +
      txt(HOUSE.wallX + 8, (HOUSE.winTop + HOUSE.winBot) / 2 + 5, "窗", 13, "start", "var(--muted)");
    rays.forEach(function (r) {
      // 光線畫到牆外一段，看得出入射角
      var tn = Math.tan(r.alt * Math.PI / 180), ext = Math.min(50, (r.y0 - 6) / tn), ox = r.x0 + ext, oy = r.y0 - ext * tn;   // 不截斜率
      var lx = r.blocked ? r.x1 - 10 : r.x1, ly = r.blocked ? r.y1 + 4 : r.y1 + 18, anchor = r.blocked ? "end" : "middle";
      s += '<line x1="' + r1(ox) + '" y1="' + r1(oy) + '" x2="' + r1(r.x1) + '" y2="' + r.y1 + '" stroke="var(--sun)" stroke-width="2.5" stroke-dasharray="6 4"/>' +
        '<circle cx="' + r1(r.x1) + '" cy="' + r.y1 + '" r="4" fill="var(--sun)"/>' +
        txt(lx, ly, (annotated ? SEASON_NAME[r.key] : "①②③".charAt(r.n - 1)), annotated ? 11 : 15, anchor);
    });
    s += txt(28, 212, "北（屋內）", 11, "start", "var(--muted)") + txt(352, 212, "南（屋外）→", 11, "end", "var(--muted)");
    return wrap("house-noon", "台中一間房子，三條虛線是三個不同日子中午從朝南窗戶照進來的陽光", s,
      annotated ? "冬至中午太陽最低（約 42 度），光最斜，照得最深；夏至中午太陽幾乎在頭頂（約 89 度），光被窗台擋住，照不進屋內；春分、秋分在中間（約 65 度）。" : "台中一間房子的側面圖，窗戶朝南。①②③是三個不同日子的中午，陽光照進屋內的情形。");
  }

  /* ---------- 3. 花的構造（標號） ---------- */
  var FLOWER = {
    stigma: { x: 180, y: 46 }, styleTop: 54, styleBot: 132,
    ovary: { cx: 180, cy: 158, rx: 20, ry: 26 },
    ovules: [{ x: 174, y: 150 }, { x: 186, y: 150 }, { x: 174, y: 166 }, { x: 186, y: 166 }],
    stamens: [{ base: { x: 160, y: 176 }, top: { x: 132, y: 70 } }, { base: { x: 200, y: 176 }, top: { x: 228, y: 70 } }]
  };
  // 標號 → 構造（題目的正解依這張表）
  var FLOWER_LABELS = { 1: "柱頭", 2: "花藥", 3: "子房", 4: "胚珠", 5: "花絲" };
  function flowerPoints() {
    var f = FLOWER;
    return { 1: f.stigma, 2: f.stamens[1].top, 3: { x: f.ovary.cx - f.ovary.rx, y: f.ovary.cy + 10 }, 4: f.ovules[3],
      5: { x: (f.stamens[0].base.x + f.stamens[0].top.x) / 2, y: (f.stamens[0].base.y + f.stamens[0].top.y) / 2 } };
  }
  function drawFlower(annotated) {
    var f = FLOWER, s = '';
    s += '<path d="M120 190 Q180 150 240 190 Q180 205 120 190Z" fill="var(--c3s, #cde8c4)" stroke="var(--muted)"/>';            // 花萼／花托
    s += '<path d="M150 180 Q70 120 110 90 Q150 120 168 176Z" fill="#f6c6d4" opacity=".75"/><path d="M210 180 Q290 120 250 90 Q210 120 192 176Z" fill="#f6c6d4" opacity=".75"/>'; // 花瓣
    f.stamens.forEach(function (st) {
      s += '<line x1="' + st.base.x + '" y1="' + st.base.y + '" x2="' + st.top.x + '" y2="' + st.top.y + '" stroke="#8a7a3a" stroke-width="3"/>' +
        '<ellipse cx="' + st.top.x + '" cy="' + st.top.y + '" rx="9" ry="6" fill="#e2b33c" stroke="#8a7a3a"/>';
    });
    s += '<rect x="176" y="' + f.styleTop + '" width="8" height="' + (f.styleBot - f.styleTop) + '" fill="#9fcf8f" stroke="var(--muted)"/>' +
      '<ellipse cx="' + f.stigma.x + '" cy="' + f.stigma.y + '" rx="12" ry="8" fill="#9fcf8f" stroke="var(--muted)"/>' +
      '<ellipse cx="' + f.ovary.cx + '" cy="' + f.ovary.cy + '" rx="' + f.ovary.rx + '" ry="' + f.ovary.ry + '" fill="#9fcf8f" stroke="var(--muted)"/>';
    f.ovules.forEach(function (o) { s += '<circle cx="' + o.x + '" cy="' + o.y + '" r="4" fill="#fff8e0" stroke="var(--muted)"/>'; });
    var pts = flowerPoints(), lab = { 1: [300, 40], 2: [300, 80], 3: [60, 175], 4: [300, 175], 5: [60, 120] };
    Object.keys(pts).forEach(function (n) {
      var p = pts[n], L = lab[n], name = annotated ? n + " " + FLOWER_LABELS[n] : "①②③④⑤".charAt(n - 1);
      s += '<line x1="' + L[0] + '" y1="' + L[1] + '" x2="' + p.x + '" y2="' + p.y + '" stroke="var(--ink)" stroke-width="1.2"/>' +
        txt(L[0] + (L[0] > 180 ? 4 : -4), L[1] + 5, name, annotated ? 12 : 16, L[0] > 180 ? "start" : "end");
    });
    return wrap("flower-parts", "一朵花的構造示意圖，五個部位標著號碼", s,
      annotated ? "雌蕊由上到下是柱頭、花柱、子房，子房裡的小顆粒是胚珠；雄蕊是花絲頂著花藥。" : "");
  }

  var api = {
    kinds: { "pole-day": drawPoleDay, "house-noon": drawHouseNoon, "flower-parts": drawFlower },
    geo: { poleDay: poleDay, houseRays: houseRays, noonAlt: noonAlt, flowerPoints: flowerPoints, FLOWER: FLOWER, FLOWER_LABELS: FLOWER_LABELS, HOUSE_ORDER: HOUSE_ORDER, POLE: POLE }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.G5_FIGS = api;
})(typeof window !== "undefined" ? window : this);

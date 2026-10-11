// 答錯後的「一步一步看」圖解（2026-10-11 律師：「答錯時的進一步解說，請 1. 說明白話易懂 2. 圖多一些，來幫助理解」）。
// 每一題對到一個「小題型」（topic），答錯時畫這個小題型專屬的 2–4 格圖，每格一張圖配一句白話；
// 不再只給整個觀念共用的一張總覽圖（例：腳在水裡變短，卻給她看「光碰到東西的四種情形」）。
// 規則：牽涉光路、太陽位置的圖一律用公式算（折射用 n=1.33 的斯涅爾定律、太陽用 sun.js），不憑手感畫。
// 匯出 G5_STEPS = { topics, of（題號→小題型）, topicOf(card), geo（可測的幾何） }；app.html 的 remedy() 用它。
(function (root) {
  "use strict";
  var DEG = Math.PI / 180, N_WATER = 1.33;
  function r1(x) { return Math.round(x * 10) / 10; }
  function sunTimesFn() { return root.sunTimes || (typeof require === "function" ? require("./sun.js").sunTimes : null); }

  /* ---------- 畫圖小工具（全部用 CSS 變數，深色模式自動跟著換） ---------- */
  function svg(label, inner, bg) {
    return '<svg class="fig" viewBox="0 0 320 200" role="img" aria-label="' + label + '"><rect width="320" height="200" rx="12" fill="' + (bg || "var(--sky1)") + '"/>' + inner + '</svg>';
  }
  function T(x, y, s, size, anchor, fill, bold) {
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" font-size="' + (size || 14) + '" text-anchor="' + (anchor || "middle") + '" fill="' + (fill || "var(--ink)") + '"' + (bold ? ' font-weight="700"' : '') + '>' + s + '</text>';
  }
  function L(x1, y1, x2, y2, stroke, w, dash, op) {
    return '<line x1="' + r1(x1) + '" y1="' + r1(y1) + '" x2="' + r1(x2) + '" y2="' + r1(y2) + '" stroke="' + (stroke || "var(--ink)") + '" stroke-width="' + (w || 2) + '" stroke-linecap="round"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + (op ? ' opacity="' + op + '"' : '') + '/>';
  }
  function head(x1, y1, x2, y2, fill, s) {
    var a = Math.atan2(y2 - y1, x2 - x1), k = s || 9;
    var bx = x2 - k * Math.cos(a), by = y2 - k * Math.sin(a), px = -Math.sin(a) * k * 0.55, py = Math.cos(a) * k * 0.55;
    return '<polygon points="' + r1(x2) + ',' + r1(y2) + ' ' + r1(bx + px) + ',' + r1(by + py) + ' ' + r1(bx - px) + ',' + r1(by - py) + '" fill="' + (fill || "var(--ink)") + '"/>';
  }
  function A(x1, y1, x2, y2, stroke, w, dash) { return L(x1, y1, x2, y2, stroke, w, dash) + head(x1, y1, x2, y2, stroke, 8 + (w || 2)); }
  // 光線：中間放箭頭（光走的方向）
  function ray(x1, y1, x2, y2, stroke, w, dash) {
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    return L(x1, y1, x2, y2, stroke || "var(--sun)", w || 3, dash) + head(x1, y1, mx + (x2 - x1) * 0.04, my + (y2 - y1) * 0.04, stroke || "var(--sun)", 11);
  }
  function sun(x, y, r) {
    r = r || 13; var s = '';
    for (var i = 0; i < 8; i++) { var a = i * 45 * DEG; s += L(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3), x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8), "var(--sun)", 2); }
    return s + '<circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="' + r + '" fill="var(--sunball)"/>';
  }
  function ground(y) { return '<rect x="0" y="' + y + '" width="320" height="' + (200 - y) + '" fill="var(--grass)" opacity=".35"/>' + L(0, y, 320, y, "var(--muted)", 2); }
  function pole(x, yb, h) { return L(x, yb, x, yb - h, "var(--ink)", 6); }
  function shade(x1, x2, y) { return L(x1, y, x2, y, "var(--ink)", 10, null, 0.3); }
  function eye(x, y, dir) {   // dir：眼睛看的方向（弧度）
    var px = x + Math.cos(dir) * 4, py = y + Math.sin(dir) * 4;
    return '<ellipse cx="' + r1(x) + '" cy="' + r1(y) + '" rx="12" ry="7" fill="var(--card)" stroke="var(--ink)" stroke-width="2"/><circle cx="' + r1(px) + '" cy="' + r1(py) + '" r="3.5" fill="var(--ink)"/>';
  }
  function dot(x, y, r, fill) { return '<circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="' + (r || 4) + '" fill="' + (fill || "var(--ink)") + '"/>'; }
  function P(d, fill, stroke, w, extra) { return '<path d="' + d + '" fill="' + (fill || "none") + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round"' : '') + (extra || '') + '/>'; }
  function box(x, y, w, h, fill, stroke, rx) { return '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + r1(h) + '" rx="' + (rx || 0) + '" fill="' + (fill || "none") + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="2"' : '') + '/>'; }
  function leaf(cx, cy, len, ang, fill) {   // 一片葉子：從 (cx,cy) 往 ang 方向長 len
    var a = ang * DEG, ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len, nx = -Math.sin(a) * len * 0.32, ny = Math.cos(a) * len * 0.32;
    var mx = (cx + ex) / 2, my = (cy + ey) / 2;
    return P('M' + r1(cx) + ' ' + r1(cy) + ' Q' + r1(mx + nx) + ' ' + r1(my + ny) + ' ' + r1(ex) + ' ' + r1(ey) + ' Q' + r1(mx - nx) + ' ' + r1(my - ny) + ' ' + r1(cx) + ' ' + r1(cy) + 'Z', fill || "var(--leaf)");
  }
  function plant(x, gy, h, opt) {   // 簡單的植物：莖＋兩對葉＋根
    opt = opt || {}; var s = '';
    s += L(x, gy, x, gy - h, "var(--leaf)", 7);
    s += leaf(x, gy - h * 0.55, h * 0.42, 200) + leaf(x, gy - h * 0.55, h * 0.42, -20) + leaf(x, gy - h * 0.88, h * 0.36, 225) + leaf(x, gy - h * 0.88, h * 0.36, -45);
    if (!opt.noRoot) s += P('M' + x + ' ' + gy + ' l-22 26 M' + x + ' ' + gy + ' l0 32 M' + x + ' ' + gy + ' l22 26 M' + (x - 11) + ' ' + (gy + 13) + ' l-14 4 M' + (x + 11) + ' ' + (gy + 13) + ' l14 4', null, "var(--soil)", 4);
    return s;
  }
  function soil(y) { return '<rect x="0" y="' + y + '" width="320" height="' + (200 - y) + '" fill="var(--soil)" opacity=".25"/>' + L(0, y, 320, y, "var(--soil)", 2); }
  function cup(x, y, w, h, wy, opt) {   // 透明杯：(x,y) 左上、水面在 wy
    opt = opt || {};
    return box(x + 2, wy, w - 4, y + h - wy - 2, opt.fill || "var(--waterfill)") + P('M' + x + ' ' + y + ' L' + x + ' ' + (y + h) + ' L' + (x + w) + ' ' + (y + h) + ' L' + (x + w) + ' ' + y, null, "var(--ink)", 2.5);
  }
  function tag(x, y, s, fill) {   // 白底小標籤
    var w = s.length * 14 + 14;
    return box(x - w / 2, y - 16, w, 22, fill || "var(--card)", null, 8) + T(x, y, s, 14);
  }
  function scale(x, y, val) {
    return box(x, y, 92, 40, "var(--card)", "var(--line)", 8) + T(x + 46, y + 27, val, 18) + L(x + 8, y - 4, x + 84, y - 4, "var(--muted)", 4);
  }

  /* ---------- 物理：折射（斯涅爾定律）與視深 ---------- */
  // 水中一點 F 發出的光，經水面 y=wy 的某一點 P 折射後進到空氣中的眼睛 E。用二分法找 P，回傳 P 與「眼睛以為的位置」A（往回延長線和 F 的鉛垂線交點）。
  function refractPath(F, E, wy) {
    var lo = Math.min(F.x, E.x), hi = Math.max(F.x, E.x);
    function f(px) {   // sin(空氣角) − n·sin(水中角)，水平方向朝眼睛為正
      var dxw = (px - F.x) * Math.sign(E.x - F.x), dxa = (E.x - px) * Math.sign(E.x - F.x);
      var sw = dxw / Math.hypot(dxw, F.y - wy), sa = dxa / Math.hypot(dxa, wy - E.y);
      return sa - N_WATER * sw;
    }
    for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2; if (f(mid) * f(lo) <= 0) hi = mid; else lo = mid; }
    var px = (lo + hi) / 2, s = (F.x - px) / (px - E.x);
    return { P: { x: px, y: wy }, A: { x: F.x, y: wy + s * (wy - E.y) }, angW: Math.atan2(Math.abs(px - F.x), F.y - wy) / DEG, angA: Math.atan2(Math.abs(E.x - px), wy - E.y) / DEG };
  }
  function snellOut(angDeg, n1, n2) { return Math.asin(Math.min(1, n1 * Math.sin(angDeg * DEG) / n2)) / DEG; }

  /* ---------- 太陽幾何（嘉義，北回歸線上；日出方位、中午高度角） ---------- */
  var TROPIC = 23.44, CHIAYI = 23.48;
  function altaz(lat, dec, hDeg) {
    var la = lat * DEG, de = dec * DEG, h = hDeg * DEG;
    var sinAlt = Math.sin(la) * Math.sin(de) + Math.cos(la) * Math.cos(de) * Math.cos(h), alt = Math.asin(sinAlt);
    var az = Math.atan2(-Math.cos(de) * Math.sin(h), Math.sin(de) * Math.cos(la) - Math.cos(de) * Math.cos(h) * Math.sin(la));
    return { alt: alt / DEG, az: (az / DEG + 360) % 360 };
  }
  function riseAz(lat, dec) { return Math.acos(Math.sin(dec * DEG) / Math.cos(lat * DEG)) / DEG; }
  function noonAlt(lat, dec) { return 90 - Math.abs(lat - dec); }
  var SEASON = { summer: { name: "夏至", dec: TROPIC, color: "var(--sun)" }, equinox: { name: "春分、秋分", dec: 0, color: "var(--pri)" }, winter: { name: "冬至", dec: -TROPIC, color: "var(--leaf)" } };

  /* ---------- 共用場景 ---------- */
  // 面向南方看的竿影側視圖：東在左、西在右。side=-1 太陽在東（左），+1 在西（右）；alt＝高度角
  function poleScene(alt, side, opt) {
    opt = opt || {};
    var gy = 158, h = opt.h || 46, px = opt.px || (side < 0 ? 110 : 210), top = gy - h;
    var len = h / Math.tan(alt * DEG), tip = px - side * len;
    var dist = Math.min(opt.dist || 96, (top - 22) / Math.sin(alt * DEG), (side < 0 ? px - 24 : 296 - px) / Math.cos(alt * DEG));   // 太陽不出框
    var sx = px + side * dist * Math.cos(alt * DEG), sy = top - dist * Math.sin(alt * DEG);
    var s = ground(gy) + L(sx, sy, tip, gy, "var(--sun)", 2, "7 5") + shade(px, tip, gy) + pole(px, gy, h) + sun(sx, sy);
    if (opt.labels !== false) s += T(16, 186, "東", 15, "start") + T(304, 186, "西", 15, "end") + T(306, 20, "面向南方看", 11, "end", "var(--muted)");
    return { svg: s, tip: tip, sun: { x: sx, y: sy }, px: px, gy: gy, len: len };
  }
  // 南北剖面（北在左、南在右，和看圖題「陽光照進屋內」同方向）：中午太陽在南方
  function noonScene(alt, label) {
    var gy = 160, h = 50, px = 140, top = gy - h, len = h / Math.tan(alt * DEG);
    var dist = Math.min(110, (top - 24) / Math.sin(alt * DEG));
    var sx = px + dist * Math.cos(alt * DEG), sy = top - dist * Math.sin(alt * DEG);
    var s = ground(gy) + L(sx, sy, px - len, gy, "var(--sun)", 2, "7 5") + (len > 3 ? shade(px, px - len, gy) : '<ellipse cx="' + px + '" cy="' + gy + '" rx="7" ry="3" fill="var(--ink)" opacity=".35"/>') + pole(px, gy, h) + sun(sx, sy);
    // 高度角弧
    var R = 26, a = alt * DEG;
    s += P('M' + (px + R) + ' ' + gy + ' A' + R + ' ' + R + ' 0 0 0 ' + r1(px + R * Math.cos(a)) + ' ' + r1(gy - R * Math.sin(a)), null, "var(--pri)", 2) + L(px, gy, px + 70, gy, "var(--pri)", 1.5, "3 3");
    s += T(px + 34, gy - 8, Math.round(alt) + "°", 13, "start", "var(--pri)", true);
    s += T(14, 188, "北", 15, "start") + T(306, 188, "南", 15, "end") + T(14, 24, label, 15, "start", "var(--ink)", true);
    return s;
  }
  // 俯視圖（上方是北）：地平圈＋某季節太陽的路線，標日出、日落
  function skyTop(key, opt) {
    opt = opt || {};
    var cx = 160, cy = 104, R = 78, se = SEASON[key], s = '';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="var(--grass)" opacity=".3" stroke="var(--muted)" stroke-width="1.5"/>';
    s += T(cx, cy - R - 6, "北", 14) + T(cx, cy + R + 16, "南", 14) + T(cx - R - 8, cy + 5, "西", 14, "end") + T(cx + R + 8, cy + 5, "東", 14, "start");
    function pt(alt, az) { var r = R * (90 - Math.max(alt, 0)) / 90; return { x: cx + r * Math.sin(az * DEG), y: cy - r * Math.cos(az * DEG) }; }
    var pts = [];
    for (var hd = -180; hd <= 180; hd += 2) { var p = altaz(CHIAYI, se.dec, hd); if (p.alt >= 0) pts.push(pt(p.alt, p.az)); }
    var ra = riseAz(CHIAYI, se.dec), rise = pt(0, ra), set = pt(0, 360 - ra);
    pts.unshift(rise); pts.push(set);   // 由東（日出）到西（日落）
    s += P('M' + pts.map(function (q) { return r1(q.x) + ' ' + r1(q.y); }).join(' L'), null, se.color, 3.5);
    s += head(pts[pts.length - 3].x, pts[pts.length - 3].y, pts[pts.length - 1].x, pts[pts.length - 1].y, se.color, 12);
    s += sun(rise.x, rise.y, 10) + dot(set.x, set.y, 5, se.color) + dot(cx, cy, 3, "var(--ink)");
    if (opt.shadowAtRise) s += A(cx, cy, cx + (cx - rise.x) * 0.75, cy + (cy - rise.y) * 0.75, "var(--ink)", 4);
    s += T(312, 20, "從上往下看", 11, "end", "var(--muted)") + T(10, 20, se.name, 15, "start", se.color, true);
    return { svg: s, rise: rise, set: set, riseAz: ra };
  }
  function earth(rays) {   // 地球三條線＋（可選）直射光
    var cx = 118, cy = 100, R = 78, s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="var(--card)" stroke="var(--ink)" stroke-width="2"/>';
    var lines = [[TROPIC, "北回歸線", "var(--sun)"], [0, "赤道", "var(--pri)"], [-TROPIC, "南回歸線", "var(--leaf)"]];
    lines.forEach(function (l) {
      var y = cy - R * Math.sin(l[0] * DEG), hw = R * Math.cos(l[0] * DEG);
      s += L(cx - hw, y, cx + hw, y, l[2], 3);
      if (!rays) s += T(cx + hw + 8, y + 5, l[1], 13, "start");
    });
    if (rays) rays.forEach(function (k) {
      var lat = k === "summer" ? TROPIC : k === "winter" ? -TROPIC : 0, se = SEASON[k];
      var ex = cx + R * Math.cos(lat * DEG), ey = cy - R * Math.sin(lat * DEG), sx = cx + 150 * Math.cos(lat * DEG), sy = cy - 150 * Math.sin(lat * DEG);
      s += sun(Math.min(sx, 296), sy, 9) + A(Math.min(sx, 296) - 12 * Math.cos(lat * DEG), sy + 12 * Math.sin(lat * DEG), ex + 3 * Math.cos(lat * DEG), ey - 3 * Math.sin(lat * DEG), se.color, 2.5) + T(Math.min(sx, 296) - 16, sy + (lat < 0 ? 22 : lat > 0 ? -10 : -12), se.name, 12, "end", se.color, true);
    });
    return s;
  }
  function flowerSide(opt) {   // 花的剖面（簡化）：花萼、花瓣、雄蕊（花藥＋花絲）、雌蕊（柱頭、花柱、子房、胚珠）
    opt = opt || {}; var cx = 160, base = 160, s = '';
    s += L(cx, 196, cx, base, "var(--leaf)", 7);
    s += P('M' + (cx - 34) + ' ' + (base - 6) + ' Q' + (cx - 30) + ' ' + (base + 8) + ' ' + cx + ' ' + (base + 6) + ' Q' + (cx + 30) + ' ' + (base + 8) + ' ' + (cx + 34) + ' ' + (base - 6), "var(--leaf)", null, 0, opt.hl === "sepal" ? '' : ' opacity=".85"');
    var pet = opt.hl && opt.hl !== "petal" ? ' opacity=".35"' : '';
    s += P('M' + (cx - 28) + ' ' + (base - 4) + ' Q' + (cx - 96) + ' ' + (base - 70) + ' ' + (cx - 62) + ' ' + (base - 118) + ' Q' + (cx - 30) + ' ' + (base - 60) + ' ' + (cx - 12) + ' ' + (base - 8) + 'Z', "var(--bad)", null, 0, pet);
    s += P('M' + (cx + 28) + ' ' + (base - 4) + ' Q' + (cx + 96) + ' ' + (base - 70) + ' ' + (cx + 62) + ' ' + (base - 118) + ' Q' + (cx + 30) + ' ' + (base - 60) + ' ' + (cx + 12) + ' ' + (base - 8) + 'Z', "var(--bad)", null, 0, pet);
    var sta = opt.hl && opt.hl !== "stamen" ? ' opacity=".35"' : '';
    [-1, 1].forEach(function (k) {
      s += '<g' + sta + '>' + P('M' + (cx + k * 16) + ' ' + (base - 6) + ' Q' + (cx + k * 26) + ' ' + (base - 50) + ' ' + (cx + k * 30) + ' ' + (base - 82), null, "var(--sun-deep)", 2.5) +
        '<ellipse cx="' + (cx + k * 30) + '" cy="' + (base - 88) + '" rx="6" ry="9" fill="var(--sunball)" stroke="var(--sun-deep)" stroke-width="1.5"/></g>';
    });
    var pis = opt.hl && opt.hl !== "pistil" ? ' opacity=".35"' : '';
    s += '<g' + pis + '><ellipse cx="' + cx + '" cy="' + (base - 18) + '" rx="15" ry="17" fill="var(--leaf-soft)" stroke="var(--leaf)" stroke-width="2.5"/>' +
      dot(cx - 5, base - 20, 3.5, "var(--sun-deep)") + dot(cx + 5, base - 14, 3.5, "var(--sun-deep)") + dot(cx + 3, base - 25, 3.5, "var(--sun-deep)") +
      L(cx, base - 35, cx, base - 96, "var(--leaf)", 4) + '<ellipse cx="' + cx + '" cy="' + (base - 100) + '" rx="10" ry="5" fill="var(--leaf)"/></g>';
    return s;
  }
  function labelTo(x, y, tx, ty, s, anchor) { return L(x, y, tx, ty, "var(--muted)", 1.5) + T(tx + (anchor === "end" ? -4 : 4), ty + 5, s, 13, anchor || "start"); }
  function tomato(cx, cy, r, cut) {
    var s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="var(--bad)"/>' + leaf(cx, cy - r + 2, 12, -60, "var(--leaf)") + leaf(cx, cy - r + 2, 12, -120, "var(--leaf)");
    if (cut) { s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 7) + '" fill="#f6a38f"/>'; for (var i = 0; i < 7; i++) { var a = i * 51 * DEG; s += '<ellipse cx="' + r1(cx + Math.cos(a) * r * 0.45) + '" cy="' + r1(cy + Math.sin(a) * r * 0.45) + '" rx="3.5" ry="2.4" fill="#fff6d6" stroke="var(--sun-deep)" stroke-width="1"/>'; } }
    return s;
  }
  function particles(x, y, w, h, n, r) { var s = ''; for (var i = 0; i < n; i++) s += dot(x + 6 + (i * 37) % (w - 12), y + 6 + (i * 23) % (h - 12), r || 1.8, "var(--ink)"); return '<g opacity=".55">' + s + '</g>'; }
  function cube(x, y, s) { return box(x, y, s, s, "#ffffff", "var(--muted)", 2); }

  /* ---------- 小題型 ---------- */
  var TOPICS = {
    /* ===== 1-1 太陽與影子 ===== */
    "sun-path": { cid: "1-1", title: "太陽一天怎麼走？",
      steps: [
        { say: "先面向南方站好：左手邊是東，右手邊是西。", fig: function () {
          var s = ground(160) + '<circle cx="160" cy="70" r="13" fill="var(--card)" stroke="var(--ink)" stroke-width="2.5"/>' + L(160, 83, 160, 130, "var(--ink)", 4) + L(160, 130, 146, 158, "var(--ink)", 4) + L(160, 130, 174, 158, "var(--ink)", 4) +
            A(160, 96, 92, 96, "var(--ink)", 4) + A(160, 96, 228, 96, "var(--ink)", 4) + T(70, 101, "東", 22, "middle", "var(--ink)", true) + T(250, 101, "西", 22, "middle", "var(--ink)", true) +
            T(160, 34, "我面向南方（看著前面）", 14) + T(70, 128, "左手", 13, "middle", "var(--muted)") + T(250, 128, "右手", 13, "middle", "var(--muted)");
          return svg("一個人面向南方站著，左手指向東，右手指向西", s); } },
        { say: "太陽從東邊升起，畫一道圓弧，經過南方的天空，從西邊落下（其實是地球在自轉，太陽看起來才會這樣走）。", fig: function () {
          var s = ground(160) + P("M22 160 Q160 -40 298 160", null, "var(--sun)", 3, ' stroke-dasharray="8 6"') + sun(48, 116, 11) + sun(160, 60, 13) + sun(272, 116, 11) +
            T(70, 150, "早上", 13, "start") + T(160, 92, "中午（南方）", 13) + T(250, 150, "傍晚", 13, "end") + head(280, 126, 292, 146, "var(--sun)", 12) +
            T(16, 186, "東", 15, "start") + T(304, 186, "西", 15, "end") + T(306, 20, "面向南方看", 11, "end", "var(--muted)");
          return svg("面向南方看，太陽早上在東邊低處，中午在南方最高，傍晚在西邊低處，路線是一道圓弧", s); } },
        { say: "說太陽在哪裡要講兩件事：在哪一方（方位），離地面多高（高度角）。中午以前高度角愈來愈大，中午最大。", fig: function () {
          var s = ground(160), px = 70, gy = 160, a = 50 * DEG, sx = px + 150 * Math.cos(a), sy = gy - 150 * Math.sin(a);
          s += L(px, gy, sx, sy, "var(--sun)", 2, "6 5") + sun(sx, sy, 13) + eye(px - 6, gy - 8, -0.6);
          s += P('M' + (px + 46) + ' ' + gy + ' A46 46 0 0 0 ' + r1(px + 46 * Math.cos(a)) + ' ' + r1(gy - 46 * Math.sin(a)), null, "var(--pri)", 3) + T(px + 54, gy - 14, "高度角", 14, "start", "var(--pri)", true);
          s += T(220, 186, "方位：東南方", 14, "middle", "var(--ink)", true) + T(160, 22, "太陽在哪裡？＝方位＋高度角", 14);
          return svg("從地面看太陽，太陽和地面之間的夾角叫高度角；太陽在哪一個方向叫方位", s); } },
        { say: "方位改變，影子的方向就改變；高度角改變，影子的長短就改變。", fig: function () {
          var a = poleScene(28, -1, { px: 92, h: 40, labels: false }), b = poleScene(62, 1, { px: 236, h: 40, labels: false });
          return svg("早上太陽低在東邊、影子長在西邊；下午太陽比較高在西邊、影子短在東邊", a.svg + b.svg + T(16, 186, "東", 15, "start") + T(304, 186, "西", 15, "end") + T(150, 24, "方向、長短都跟著太陽變", 14)); } }
      ],
      remember: "太陽東升西落、走一道圓弧；說位置要講方位和高度角。",
      ask: "面向南方站好，太陽早上在你哪一隻手那邊？中午在哪裡？" },
    "sh-dir": { cid: "1-1", title: "影子在哪一邊？",
      steps: [
        { say: "光直直照過來，被竿子擋住，竿子後面照不到光，那一塊就是影子。", fig: function () {
          var s = ground(158) + sun(40, 70, 15);
          s += ray(58, 66, 316, 110, "var(--sun)", 2) + ray(58, 92, 150, 116, "var(--sun)", 2) + ray(58, 116, 150, 144, "var(--sun)", 2);   // 上面那條從竿頂上方過去；下面兩條被竿子擋住
          s += '<polygon points="164,98 320,125 320,158 164,158" fill="var(--ink)" opacity=".18"/>' + box(150, 96, 14, 62, "var(--soil)") + T(240, 184, "照不到光＝影子", 14) + T(104, 172, "光被擋住", 12, "middle", "var(--muted)");
          return svg("太陽的光直直照過來，被竿子擋住，竿子後面照不到光的地方就是影子", s); } },
        { say: "所以影子一定在太陽的對面：早上太陽在東邊，影子就在西邊。", fig: function () {
          var p = poleScene(30, -1, { px: 120 });
          return svg("早上太陽在東邊，竿子的影子在西邊", p.svg + tag(60, 140, "太陽在東") + tag(p.tip - 10, 140, "影子在西")); } },
        { say: "下午太陽跑到西邊，影子就換到東邊。", fig: function () {
          var p = poleScene(30, 1, { px: 200 });
          return svg("下午太陽在西邊，竿子的影子在東邊", p.svg + tag(262, 140, "太陽在西") + tag(p.tip + 10, 140, "影子在東")); } },
        { say: "斜的方向也一樣，找正對面：太陽在東南，影子就在西北。", fig: function () {
          var cx = 160, cy = 102, s = '<circle cx="160" cy="102" r="74" fill="var(--grass)" opacity=".3" stroke="var(--muted)"/>';
          s += T(160, 22, "北", 14) + T(160, 194, "南", 14) + T(76, 107, "西", 14, "end") + T(244, 107, "東", 14, "start");
          s += T(96, 42, "影子在西北", 13) + T(236, 186, "太陽在東南", 13, "start");
          s += sun(cx + 50, cy + 50, 12) + L(cx + 40, cy + 40, cx - 52, cy - 52, "var(--sun)", 2, "6 5") + L(cx, cy, cx - 46, cy - 46, "var(--ink)", 9, null, 0.35) + dot(cx, cy, 6);
          s += T(312, 20, "從上往下看", 11, "end", "var(--muted)");
          return svg("從上往下看：太陽在東南方，竿子的影子在正對面的西北方", s); } }
      ],
      remember: "影子永遠在太陽的正對面。",
      ask: "如果影子在西北邊，太陽在哪一邊？" },
    "sh-len": { cid: "1-1", title: "影子為什麼會變長、變短？",
      steps: [
        { say: "太陽低低的（高度角小），光斜斜照，影子被拉得很長。", fig: function () { var p = poleScene(22, -1, { px: 92, h: 42 }); return svg("太陽低的時候，竿子的影子很長", p.svg + tag(p.px + p.len / 2, 140, "影子長")); } },
        { say: "太陽高高的（高度角大），光幾乎從頭頂照下來，影子很短。", fig: function () { var p = poleScene(68, -1, { px: 170, h: 42 }); return svg("太陽高的時候，竿子的影子很短", p.svg + tag(p.px + 30, 140, "影子短")); } },
        { say: "所以一天裡：早上長 → 中午最短 → 下午又變長。", fig: function () {
          var s = ground(150), xs = [56, 160, 264], alts = [24, 62, 24], sides = [-1, 0, 1], names = ["早上", "中午", "下午"];
          xs.forEach(function (x, i) {
            var len = 34 / Math.tan(alts[i] * DEG), dir = sides[i] === 0 ? 0 : -sides[i];
            s += (sides[i] === 0 ? '<ellipse cx="' + x + '" cy="150" rx="9" ry="3.5" fill="var(--ink)" opacity=".35"/>' : shade(x, x + dir * Math.min(len, 46), 150)) + pole(x, 150, 34) + sun(x + (sides[i] === 0 ? 0 : sides[i] * 30), sides[i] === 0 ? 46 : 92, 10) + T(x, 178, names[i], 14, "middle", "var(--ink)", true);
          });
          s += T(160, 196, "長 → 最短 → 長", 13, "middle", "var(--muted)");
          return svg("早上影子長、中午最短、下午又變長", s); } }
      ],
      remember: "太陽愈高，影子愈短；中午太陽最高，影子最短。",
      ask: "下午 5 點和下午 3 點，哪一個影子比較長？為什麼？" },
    "sh-move": { cid: "1-1", title: "影子一天怎麼移動？",
      steps: [
        { say: "早上太陽在東邊（左），影子在西邊（右）。", fig: function () { var p = poleScene(30, -1, { px: 120 }); return svg("早上太陽在東，影子在西", p.svg + T(160, 30, "早上", 15, "middle", "var(--ink)", true)); } },
        { say: "下午太陽走到西邊（右），影子轉到東邊（左）。", fig: function () { var p = poleScene(30, 1, { px: 200 }); return svg("下午太陽在西，影子在東", p.svg + T(160, 30, "下午", 15, "middle", "var(--ink)", true)); } },
        { say: "太陽由東往西走，影子在對面，所以反過來：由西往東轉。影子的方向一整天都在變。", fig: function () {
          var s = ground(150) + pole(160, 150, 40);
          s += A(40, 50, 280, 50, "var(--sun)", 4) + T(160, 40, "太陽：東 → 西", 15, "middle", "var(--sun-deep)", true) + sun(30, 50, 10);
          s += A(280, 168, 40, 168, "var(--ink)", 4) + T(160, 192, "影子：西 → 東", 15, "middle", "var(--ink)", true);
          s += T(16, 140, "東", 15, "start") + T(304, 140, "西", 15, "end");
          return svg("太陽由東往西移動，影子由西往東移動，方向相反", s); } }
      ],
      remember: "太陽由東往西走，影子由西往東轉。",
      ask: "早上影子在哪一邊？下午會轉到哪一邊？" },
    "fair-test": { cid: "1-1", title: "公平的實驗：一次只改一個條件",
      steps: [
        { say: "想知道「光的高低」會不會改變影子長短，就只改手電筒的高低。", fig: function () {
          var s = '', gy = 160;
          [[80, 50], [240, 110]].forEach(function (c, i) {
            var px = c[0], fy = c[1], fx = px - 60, top = gy - 36, tip = px + (px - fx) * (gy - top) / (top - fy);
            s += L(px - 70, gy, px + 70, gy, "var(--muted)", 2) + L(fx, fy, Math.min(tip, px + 70), gy - (gy - top) * (Math.min(tip, px + 70) - tip) / (px - tip || 1), "var(--sun)", 2, "6 5") + shade(px, Math.min(tip, px + 70), gy) + pole(px, gy, 36) + box(fx - 14, fy - 7, 22, 14, "var(--muted)", null, 3) + dot(fx + 8, fy, 6, "var(--sunball)");
            s += T(px, 186, i ? "手電筒低" : "手電筒高", 14, "middle", "var(--ink)", true);
          });
          return svg("同一根竿子，手電筒一次舉高、一次放低，比較影子長短", s); } },
        { say: "其他條件都保持一樣：同一根竿子、同一個位置、同一支手電筒。這些保持不變的條件叫「控制變因」。", fig: function () {
          var s = '', rows = ["竿子一樣高", "竿子放同一個位置", "同一支手電筒、一樣亮"];
          rows.forEach(function (r, i) { s += '<circle cx="46" cy="' + (52 + i * 44) + '" r="13" fill="var(--leaf)"/>' + P('M39 ' + (52 + i * 44) + ' l5 5 l9 -10', null, "#fff", 3) + T(70, 58 + i * 44, r, 17, "start"); });
          s += T(160, 192, "只改「光的高低」，比出來的差別才是它造成的", 12, "middle", "var(--muted)");
          return svg("保持一樣的條件：竿子高度、位置、手電筒", s, "var(--sun-soft)"); } }
      ],
      remember: "一次只改一個條件；保持不變的那些叫控制變因。",
      ask: "如果兩次用的竿子一高一矮，還能比較光的高低嗎？" },

    /* ===== 1-3 季節與回歸線 ===== */
    "ss-rise": { cid: "1-3", title: "太陽從哪裡升起，會隨季節改變",
      steps: [
        { say: "春分、秋分：太陽從正東方升起，從正西方落下。", fig: function () { return svg("從上往下看：春分秋分太陽從正東升起、正西落下", skyTop("equinox").svg); } },
        { say: "夏至（夏天）：太陽從東偏北升起，從西偏北落下。", fig: function () { return svg("從上往下看：夏至太陽從東偏北升起、西偏北落下", skyTop("summer").svg); } },
        { say: "冬至（冬天）：太陽從東偏南升起，從西偏南落下。", fig: function () { return svg("從上往下看：冬至太陽從東偏南升起、西偏南落下", skyTop("winter").svg); } },
        { say: "日出時影子在太陽對面：冬至太陽從東偏南出來，影子就指向西偏北。", fig: function () { return svg("從上往下看：冬至日出在東偏南，竿影指向西偏北", skyTop("winter", { shadowAtRise: true }).svg + T(70, 186, "箭頭＝日出時的影子", 12, "middle", "var(--muted)")); } }
      ],
      remember: "夏天偏北、冬天偏南、春分秋分正東；春分和秋分走的路線差不多一樣。",
      ask: "冬天的早上，太陽從哪個方向升起？影子在哪一邊？" },
    "ss-noon": { cid: "1-3", title: "季節不同，中午太陽的高度不同",
      steps: [
        { say: "夏至中午：太陽幾乎在頭頂上，竿子幾乎沒有影子（北回歸線上的嘉義，約 90 度）。", fig: function () { return svg("夏至中午太陽約 90 度，幾乎沒有影子", noonScene(noonAlt(CHIAYI, TROPIC), "夏至中午")); } },
        { say: "春分、秋分中午：太陽低一點（約 67 度），影子短短的、朝北。", fig: function () { return svg("春分秋分中午太陽約 67 度，影子短、朝北", noonScene(noonAlt(CHIAYI, 0), "春分、秋分中午")); } },
        { say: "冬至中午：太陽最低（約 43 度），影子最長。太陽低、光斜，地面也比較不熱。", fig: function () { return svg("冬至中午太陽約 43 度，影子最長", noonScene(noonAlt(CHIAYI, -TROPIC), "冬至中午")); } }
      ],
      remember: "中午的太陽：夏至最高、冬至最低；太陽愈低，影子愈長。",
      ask: "冬至中午的影子，跟夏至中午比，比較長還是比較短？" },
    "ss-day": { cid: "1-3", title: "夏天白天長、冬天白天短",
      steps: [
        { say: "夏天太陽走的圓弧又高又長，在天空待得久，白天就長；冬天的圓弧又低又短。", fig: function () {
          var s = ground(160) + P("M30 168 Q160 -60 290 168", null, "var(--sun)", 3.5) + P("M70 152 Q160 70 250 152", null, "var(--leaf)", 3.5, ' stroke-dasharray="4 5"');
          s += T(160, 34, "夏至：路線長", 14, "middle", "var(--sun-deep)", true) + T(160, 128, "冬至：路線短", 14, "middle", "var(--leaf)", true) + T(16, 186, "東", 15, "start") + T(304, 186, "西", 15, "end") + T(306, 20, "面向南方看", 11, "end", "var(--muted)");
          return svg("面向南方看：夏至太陽路線又高又長，冬至又低又短", s); } },
        { say: "所以夏至白天最長、冬至白天最短；夏天日出比較早、日落比較晚，冬天相反（下面是台中的時間）。", fig: function () {
          var st = sunTimesFn(), rows = [["夏至", new Date(2026, 5, 21), "var(--sun)"], ["春分", new Date(2026, 2, 20), "var(--pri)"], ["冬至", new Date(2026, 11, 22), "var(--leaf)"]], s = '';
          function X(h) { return 60 + (h - 4) * 15.5; }
          rows.forEach(function (r, i) {
            var t = st(r[1], 24.15, 120.68, 8), y = 46 + i * 50, hh = function (h) { var m = Math.round(h * 60); return Math.floor(m / 60) + ":" + ("0" + m % 60).slice(-2); };
            var len = t.set - t.rise, hm = Math.floor(len) + " 小時 " + Math.round((len % 1) * 60) + " 分";
            s += box(X(4), y - 12, X(20) - X(4), 20, "var(--ink)", null, 5).replace('fill="var(--ink)"', 'fill="var(--ink)" opacity=".15"') + box(X(t.rise), y - 12, X(t.set) - X(t.rise), 20, r[2], null, 5);
            s += T(52, y + 4, r[0], 14, "end", "var(--ink)", true) + T(X(t.rise), y + 24, hh(t.rise), 11, "middle", "var(--muted)") + T(X(t.set), y + 24, hh(t.set), 11, "middle", "var(--muted)") + T(X(12), y + 4, "白天約 " + hm, 12, "middle", "#fff", true);
          });
          return svg("台中夏至、春分、冬至的日出日落時間和白天長短", s, "var(--pri-soft)"); } },
        { say: "春分、秋分白天和晚上差不多一樣長（太陽直射赤道）。", fig: function () {
          var s = '<circle cx="160" cy="104" r="70" fill="var(--sunball)" opacity=".85"/><path d="M160 34 A70 70 0 0 1 160 174 Z" fill="var(--ink)" opacity=".75"/>';
          s += T(122, 110, "白天", 16, "middle", "var(--ink)", true) + T(198, 110, "晚上", 16, "middle", "#fff", true) + T(160, 24, "春分、秋分：各約 12 小時", 14);
          return svg("春分秋分白天和晚上差不多各 12 小時", s, "var(--pri-soft)"); } }
      ],
      remember: "夏至白天最長、冬至白天最短；春分秋分白天和晚上差不多一樣長。",
      ask: "哪個季節放學時天就快黑了？為什麼？" },
    "ss-trop": { cid: "1-3", title: "回歸線和「直射」",
      steps: [
        { say: "地球上有三條重要的線：北回歸線（北緯約 23.5 度）、赤道、南回歸線。台灣有北回歸線經過。", fig: function () { return svg("地球上的北回歸線、赤道、南回歸線", earth(null)); } },
        { say: "直射＝陽光從正上方垂直照下來。夏至直射北回歸線，春分秋分直射赤道，冬至直射南回歸線。", fig: function () { return svg("夏至直射北回歸線、春分秋分直射赤道、冬至直射南回歸線", earth(["summer", "equinox", "winter"])); } },
        { say: "太陽在頭頂正上方時，竿子沒有影子，叫「立竿不見影」。", fig: function () {
          var s = ground(160) + L(160, 46, 160, 112, "var(--sun)", 2, "6 5") + sun(160, 34, 14) + pole(160, 160, 48) + '<ellipse cx="160" cy="160" rx="7" ry="3" fill="var(--ink)" opacity=".35"/>';
          s += tag(240, 136, "沒有影子") + T(160, 190, "太陽在頭頂正上方", 14);
          return svg("太陽在頭頂正上方，竿子沒有影子", s); } },
        { say: "台灣只有北回歸線上和它南邊的地方，夏至前後的中午才看得到。台北、台中在北邊，一年都看不到；剛好在線上的地方，一年只有夏至前後一次。", fig: function () {
          var s = '<ellipse cx="160" cy="104" rx="40" ry="86" fill="var(--grass)" opacity=".55" stroke="var(--leaf)" stroke-width="2" transform="rotate(14 160 104)"/>';
          function y(lat) { return 104 - (lat - 23.6) * 46; }
          s += L(40, y(TROPIC), 300, y(TROPIC), "var(--sun)", 3) + T(300, y(TROPIC) - 6, "北回歸線", 13, "end", "var(--sun-deep)", true);
          [["台北", 25.05, 184], ["台中", 24.15, 166], ["嘉義", 23.48, 140], ["高雄", 22.63, 128]].forEach(function (c) { s += dot(c[2], y(c[1]), 5, "var(--bad)") + T(c[2] - 10, y(c[1]) + 5, c[0], 14, "end"); });
          s += T(256, y(TROPIC) - 30, "看不到", 13, "middle", "var(--muted)") + T(256, y(TROPIC) + 32, "夏至前後可以", 13, "middle", "var(--leaf)");
          return svg("台灣的北回歸線經過嘉義；台北台中在北邊，高雄在南邊", s, "var(--pri-soft)"); } }
      ],
      remember: "夏至北回歸線、冬至南回歸線、春秋分赤道；太陽在頭頂時立竿不見影。",
      ask: "住在台北，夏至中午竿子有沒有影子？" },
    "ss-window": { cid: "1-3", title: "冬天陽光照進屋子比較深",
      steps: [
        { say: "夏天中午太陽很高，光幾乎直直照下來，照不太進屋子裡。", fig: function () { return svg("夏天中午太陽高，光很陡，只照到窗邊", houseScene(noonAlt(24.15, TROPIC), "夏至中午")); } },
        { say: "冬天中午太陽低，光斜斜的，可以照到屋子很裡面。", fig: function () { return svg("冬天中午太陽低，光斜，照到屋子很深的地方", houseScene(noonAlt(24.15, -TROPIC), "冬至中午")); } }
      ],
      remember: "太陽愈低，光愈斜，照進屋子愈深；所以台灣朝南的窗戶冬天比較曬得到太陽。",
      ask: "冬天想讓房間曬到太陽，窗戶開在哪一面最好？" },

    /* ===== 1-2 光的現象 ===== */
    "lt-straight": { cid: "1-2", title: "光直直走，被擋住就有影子",
      steps: [
        { say: "光是走直線的，不會自己轉彎。", fig: function () {
          var s = box(28, 86, 52, 28, "var(--muted)", null, 6) + '<polygon points="80,84 96,74 96,126 80,116" fill="var(--muted)"/>';
          [-30, -10, 10, 30].forEach(function (d) { s += ray(98, 100 + d * 0.5, 300, 100 + d * 2.2, "var(--sun)", 2.5); });
          return svg("手電筒的光直直往前照", s + T(200, 28, "光直線前進", 15, "middle", "var(--ink)", true), "var(--pri-soft)"); } },
        { say: "東西擋住光，後面照不到，就變成影子。所以影子的形狀跟東西差不多。", fig: function () {
          var s = sun(36, 100, 14) + ray(54, 70, 300, 30, "var(--sun)", 2) + ray(54, 130, 300, 170, "var(--sun)", 2);
          s += '<circle cx="150" cy="100" r="22" fill="var(--soil)"/>' + '<polygon points="160,80 300,62 300,138 160,120" fill="var(--ink)" opacity=".2"/>' + T(250, 104, "影子", 15, "middle", "var(--ink)", true);
          return svg("球擋住光，後面照不到光的地方就是影子", s, "var(--pri-soft)"); } }
      ],
      remember: "光直線前進；被擋住、照不到光的地方就是影子。",
      ask: "為什麼影子的形狀會跟東西的樣子差不多？" },
    "lt-reflect": { cid: "1-2", title: "光彈回來：反射",
      steps: [
        { say: "光碰到鏡子這種光滑的面，會「彈回來」，這叫反射。", fig: function () {
          var s = box(40, 150, 240, 10, "var(--pri)") + L(160, 150, 160, 40, "var(--muted)", 1.5, "4 4") + ray(60, 50, 160, 150) + ray(160, 150, 260, 50);
          s += T(160, 186, "鏡子", 14) + T(160, 30, "光彈回來", 15, "middle", "var(--ink)", true);
          return svg("光斜斜照到鏡子，從另一邊彈回來", s, "var(--pri-soft)"); } },
        { say: "照鏡子：你身上的光跑到鏡子，彈回你的眼睛，所以看到自己。", fig: function () {
          // 鏡面在 x=270：眼睛 (92,72) 對鏡子的像在 (448,72)，身上一點 (80,130) 連到像，和鏡面交在 (270,100)＝入射角等於反射角
          var s = box(270, 30, 12, 140, "var(--pri)") + '<circle cx="84" cy="74" r="20" fill="var(--card)" stroke="var(--ink)" stroke-width="2.5"/>' + L(80, 94, 80, 160, "var(--ink)", 4) + eye(92, 72, 0);
          s += ray(80, 130, 270, 100) + ray(270, 100, 104, 72) + L(270, 100, 230, 100, "var(--muted)", 1.5, "3 4") + T(276, 190, "鏡子", 14);
          return svg("身上的光照到鏡子，彈回眼睛", s, "var(--pri-soft)"); } },
        { say: "平靜的水面也像鏡子：湖面上的倒影也是反射，不是折射。", fig: function () {
          var s = box(0, 120, 320, 80, "var(--waterfill)") + L(0, 120, 320, 120, "var(--pri)", 2);
          s += L(160, 120, 160, 80, "var(--soil)", 7) + '<circle cx="160" cy="64" r="28" fill="var(--leaf)"/>';
          s += '<g opacity=".4">' + L(160, 120, 160, 160, "var(--soil)", 7) + '<circle cx="160" cy="176" r="28" fill="var(--leaf)"/></g>' + T(258, 160, "倒影", 15, "middle", "var(--ink)", true);
          return svg("樹在湖面上的倒影，上下顛倒", s); } },
        { say: "潛望鏡裡有兩面鏡子，光彈兩次，就能從牆後面看到牆另一邊的東西。", fig: function () {
          var s = box(96, 70, 16, 130, "var(--soil)") + T(104, 64, "牆", 13);
          s += P("M140 26 L188 26 L188 136 L246 136 L246 176 L140 176 Z", "var(--card)", "var(--ink)", 2.5) + box(138, 40, 4, 34, "var(--pri-soft)") + box(244, 140, 4, 32, "var(--pri-soft)");
          s += L(146, 34, 182, 70, "var(--pri)", 5) + L(146, 140, 182, 176, "var(--pri)", 5);
          s += '<polygon points="22,56 34,40 46,56" fill="var(--leaf)"/>' + ray(46, 52, 164, 52) + ray(164, 52, 164, 158) + ray(164, 158, 282, 158) + eye(294, 158, Math.PI);
          s += T(34, 76, "東西", 13) + T(214, 22, "兩面鏡子", 13, "start");
          return svg("人在牆的右邊，潛望鏡越過牆，裡面兩面斜放的鏡子把牆左邊東西的光轉兩次彎送到眼睛", s, "var(--pri-soft)"); } }
      ],
      remember: "光彈回來＝反射（鏡子、倒影、潛望鏡）；光穿過去轉彎＝折射。",
      ask: "湖面的倒影，是反射還是折射？" },
    "lt-bend": { cid: "1-2", title: "光穿過水面會轉彎：折射",
      steps: [
        { say: "光斜斜從空氣跑進水裡，在水面那一點轉了一個彎，這叫折射。在空氣裡、水裡都還是走直線。", fig: function () { return svg("光斜斜從空氣進入水中，在水面轉彎，變得比較陡", bendScene("in")); } },
        { say: "反過來，光從水裡斜斜跑到空氣中，也會在水面轉彎。", fig: function () { return svg("光斜斜從水中進入空氣，在水面轉彎", bendScene("out")); } },
        { say: "如果光是垂直照下去，就不會轉彎。要「斜斜的」穿過交界才會轉彎。", fig: function () {
          var s = box(0, 100, 320, 100, "var(--waterfill)") + L(0, 100, 320, 100, "var(--pri)", 2) + ray(160, 14, 160, 100) + ray(160, 100, 160, 190) + T(60, 80, "空氣", 15) + T(60, 140, "水", 15) + tag(236, 70, "垂直：不轉彎");
          return svg("光垂直照進水裡，直直往下，不轉彎", s); } }
      ],
      remember: "斜斜穿過水面（或玻璃）光才會轉彎，叫折射；垂直穿過不轉彎。轉彎不是反射。",
      ask: "光垂直照進水裡，會不會轉彎？" },
    "lt-shallow": { cid: "1-2", title: "水裡的東西，為什麼看起來比較淺？",
      steps: [
        { say: "光照到腳上再彈出來（腳反射的光），從水裡斜斜跑到空氣中，在水面轉了彎，才進到你的眼睛。", fig: function () { return svg("水中腳的光，在水面轉彎後進入岸上的眼睛", shallowScene(false)); } },
        { say: "可是眼睛以為光是一直線來的，順著線往回找，就把腳看在比較高的地方。", fig: function () { return svg("眼睛順著直線往回看，以為腳在比較高的位置", shallowScene(true)); } },
        { say: "所以水裡的腳看起來變短，池底看起來變淺。池水其實比看起來深，下水前要小心。", fig: function () {
          var s = box(0, 70, 320, 130, "var(--waterfill)") + L(0, 70, 320, 70, "var(--pri)", 2);
          function kid(x, legBottom, dash) {
            return '<circle cx="' + x + '" cy="26" r="11" fill="var(--card)" stroke="var(--ink)" stroke-width="2.5"/>' + L(x, 37, x, 84, "var(--ink)", 4) + L(x, 84, x - 10, legBottom, "var(--ink)", 4, dash) + L(x, 84, x + 10, legBottom, "var(--ink)", 4, dash);
          }
          s += kid(90, 186) + T(106, 194, "真正的腳", 12, "start") + kid(230, 140) + L(200, 186, 260, 186, "var(--muted)", 2, "4 4") + T(230, 160, "看起來變短", 13, "middle", "var(--ink)", true);
          return svg("左邊是真正的腳，右邊是從岸上看起來的樣子：腳變短", s); } },
        { say: "空碗底的硬幣本來看不到，加水以後光在水面轉彎越過碗邊，硬幣就「浮」出來被看到了。", fig: function () { return svg("加水後，硬幣的光在水面轉彎越過碗邊進入眼睛", coinScene()); } }
      ],
      remember: "水裡的東西看起來比較淺、比較高；原因是折射，不是反射。",
      ask: "從池邊看，池水看起來比實際深，還是比較淺？" },
    "lt-straw": { cid: "1-2", title: "吸管在水面為什麼像折斷？",
      steps: [
        { say: "吸管其實是直的（虛線是它在水裡真正的位置）。", fig: function () { return svg("杯子裡斜插一根直的吸管，水裡的部分用虛線表示真正位置", strawScene(1)); } },
        { say: "水裡那一段的光，跑出水面時轉了彎，眼睛往回找，就覺得那一段被抬高了。", fig: function () { return svg("吸管尖端的光在水面轉彎進入眼睛，看起來尖端被抬高", strawScene(2)); } },
        { say: "上面一段是直的、下面一段被抬高，連起來就像在水面折斷了。這是折射。", fig: function () { return svg("看起來吸管在水面折了一下", strawScene(3)); } }
      ],
      remember: "吸管像折斷＝折射（光穿過水面轉彎），不是反射。",
      ask: "照鏡子和吸管像折斷，哪一個的光有穿過水面？" },
    "lt-lens": { cid: "1-2", title: "放大鏡怎麼讓東西變大？",
      steps: [
        { say: "放大鏡是中間厚、邊緣薄的透鏡（凸透鏡）。", fig: function () {
          var s = P("M160 30 Q196 100 160 170 Q124 100 160 30 Z", "var(--waterfill)", "var(--pri)", 3) + A(210, 100, 178, 100, "var(--ink)", 2) + T(214, 105, "中間厚", 14, "start") + A(214, 40, 168, 36, "var(--ink)", 2) + T(218, 45, "邊緣薄", 14, "start");
          return svg("放大鏡側面：中間厚、邊緣薄", s, "var(--pri-soft)"); } },
        { say: "陽光穿過放大鏡會轉彎（折射），集中到一個很亮、很燙的點。不可以對著人，也不能用它看太陽。", fig: function () {
          var s = P("M150 30 Q178 100 150 170 Q122 100 150 30 Z", "var(--waterfill)", "var(--pri)", 3);
          [52, 76, 100, 124, 148].forEach(function (y) { s += L(20, y, 150, y, "var(--sun)", 2.5) + L(150, y, 252, 100, "var(--sun)", 2.5); });
          s += '<circle cx="252" cy="100" r="10" fill="var(--sunball)"/><circle cx="252" cy="100" r="18" fill="var(--sunball)" opacity=".35"/>' + T(252, 140, "很亮很燙", 14, "middle", "var(--bad)", true);
          return svg("平行的陽光穿過放大鏡後集中到一點", s, "var(--pri-soft)"); } },
        { say: "東西靠近放大鏡：看到的是放大、正立的樣子。", fig: function () {
          var s = P("M200 40 Q222 100 200 160 Q178 100 200 40 Z", "var(--waterfill)", "var(--pri)", 3) + eye(286, 100, Math.PI);
          s += A(150, 130, 150, 104, "var(--leaf)", 4) + T(150, 150, "東西", 13) + '<g opacity=".5">' + A(90, 150, 90, 66, "var(--leaf)", 6, "6 4") + '</g>' + T(90, 176, "看到：放大、正立", 13, "middle", "var(--ink)", true);
          return svg("東西靠近放大鏡時，從另一邊看到放大、正立的樣子", s, "var(--pri-soft)"); } },
        { say: "東西離遠一點：會看到倒立的影像，也能投在紙上。用放大鏡看不到「縮小又正立」的樣子。", fig: function () {
          // 薄透鏡：光心 (160,100)、焦距 50；燭火在 x=47（物距 113＞2 倍焦距）⇒ 像在 x≈249.7、倒立、放大率 −0.79
          var g = lensImage(), s = L(14, 100, 306, 100, "var(--muted)", 1, "3 4") + P("M160 40 Q182 100 160 160 Q138 100 160 40 Z", "var(--waterfill)", "var(--pri)", 3) + dot(110, 100, 3, "var(--pri)") + dot(210, 100, 3, "var(--pri)") + T(210, 116, "焦點", 11, "middle", "var(--pri)");
          s += box(41, g.oy + 14, 12, 100 - g.oy - 14, "var(--card)", "var(--ink)") + P('M47 ' + (g.oy + 14) + ' Q40 ' + (g.oy + 7) + ' 47 ' + g.oy + ' Q54 ' + (g.oy + 7) + ' 47 ' + (g.oy + 14) + ' Z', "var(--sunball)", "var(--sun)", 1.5) + T(47, 156, "燭火", 13);
          s += box(g.ix + 6, 46, 7, 118, "var(--card)", "var(--ink)");
          var k = (g.iy - 100) / (100 - g.oy);   // 像的縮放（正數＝往下）
          s += box(g.ix - 6, 100, 12, (100 - g.oy - 14) * k, "var(--card)", "var(--ink)") + P('M' + g.ix + ' ' + r1(100 + (100 - g.oy - 14) * k) + ' Q' + (g.ix - 7) + ' ' + r1(100 + (100 - g.oy - 7) * k) + ' ' + g.ix + ' ' + r1(g.iy) + ' Q' + (g.ix + 7) + ' ' + r1(100 + (100 - g.oy - 7) * k) + ' ' + g.ix + ' ' + r1(100 + (100 - g.oy - 14) * k) + ' Z', "var(--sunball)", "var(--sun)", 1.5);
          s += L(47, g.oy, 160, g.oy, "var(--sun)", 2) + L(160, g.oy, g.ix, g.iy, "var(--sun)", 2) + L(47, g.oy, g.ix, g.iy, "var(--sun)", 2, "5 4");
          s += T(276, 182, "紙板：倒立", 13);
          return svg("燭火在放大鏡兩倍焦距外：平行光經放大鏡折射通過焦點、通過鏡心的光直走，兩條光在紙板上交會成倒立的燭火", s, "var(--pri-soft)"); } }
      ],
      remember: "放大鏡靠折射：靠近看放大正立，遠一點變倒立；沒有縮小又正立。",
      ask: "用放大鏡把燭火投到紙上，燭火是正的還是倒的？" },
    "lt-color": { cid: "1-2", title: "陽光有很多顏色、彩虹怎麼來？",
      steps: [
        { say: "陽光看起來白白的，其實是很多種顏色的光混在一起。", fig: function () {
          var c = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"], s = sun(48, 100, 18) + box(74, 92, 90, 16, "#fffbe8", "var(--line)", 8) + T(196, 106, "＝", 22);
          c.forEach(function (k, i) { s += box(220, 64 + i * 13, 70, 10, k, null, 3); });
          return svg("白白的陽光等於很多顏色的光加在一起", s + T(160, 30, "陽光＝很多顏色的光", 15, "middle", "var(--ink)", true), "var(--pri-soft)"); } },
        { say: "穿過三稜鏡時，每種顏色轉彎的程度不一樣，就分開成一條彩色的光帶。", fig: function () {
          var s = '<polygon points="160,36 214,150 106,150" fill="var(--card)" stroke="var(--ink)" stroke-width="2"/>' + L(20, 104, 134, 96, "#fffbe8", 6) + L(20, 104, 134, 96, "var(--line)", 1) + L(134, 96, 188, 104, "var(--sunball)", 3, null, 0.6);
          ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"].forEach(function (k, i) { var a = (14 + i * 5) * DEG; s += L(188, 104, 188 + 120 * Math.cos(a), 104 + 120 * Math.sin(a), k, 4); });
          return svg("白光穿過三稜鏡，分成紅橙黃綠藍紫", s + T(60, 90, "陽光", 13), "var(--pri-soft)"); } },
        { say: "雨後空中有很多小水滴，像很多個小三稜鏡。背對太陽，就看得到彩虹。", fig: function () {
          var s = box(0, 160, 320, 40, "var(--grass)").replace('fill="var(--grass)"', 'fill="var(--grass)" opacity=".35"') + sun(30, 46, 14);
          ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"].forEach(function (k, i) { var r = 96 - i * 6; s += P('M' + (236 - r) + ' 160 A' + r + ' ' + r + ' 0 0 1 ' + (236 + r) + ' 160', null, k, 5); });
          for (var i = 0; i < 18; i++) s += P('M' + (170 + (i * 29) % 140) + ' ' + (40 + (i * 17) % 90) + ' l-3 8', null, "var(--pri)", 2);
          s += '<circle cx="96" cy="118" r="9" fill="var(--card)" stroke="var(--ink)" stroke-width="2"/>' + L(96, 127, 96, 160, "var(--ink)", 3) + A(58, 76, 82, 110, "var(--sun)", 2);
          return svg("太陽在背後，前方有雨滴，看到彩虹", s + T(96, 186, "背對太陽", 13)); } },
        { say: "噴水池、瀑布的水花也能看到彩虹，不一定要下雨；但是沒有光，就不會有彩虹。", fig: function () {
          var s = box(0, 0, 160, 200, "var(--sky1)") + box(160, 0, 160, 200, "#1d2731") + sun(28, 30, 11) + P("M60 180 Q80 80 120 60", null, "var(--pri)", 3) + P("M64 180 Q96 90 140 76", null, "var(--pri)", 2, ' stroke-dasharray="2 5"');
          ["#e53935", "#fdd835", "#43a047", "#1e88e5"].forEach(function (k, i) { s += P('M' + (78 + i * 3) + ' 150 A40 40 0 0 1 ' + (148 - i * 3) + ' 150', null, k, 3); });
          s += T(80, 194, "有陽光＋水花", 13, "middle", "var(--ink)", true) + T(240, 100, "沒有光", 16, "middle", "#fff", true) + T(240, 124, "看不到彩虹", 13, "middle", "#fff");
          return svg("左邊有陽光照著水花，看到彩虹；右邊沒有光，看不到彩虹", s); } }
      ],
      remember: "彩虹要有陽光＋小水滴，背對太陽看；它和光的折射有關。",
      ask: "晚上停電的時候，用水管噴水，看得到彩虹嗎？為什麼？" },

    /* ===== 2-1 根莖葉 ===== */
    "pl-root": { cid: "2-1", title: "根的工作",
      steps: [
        { say: "根在土裡吸水，再把水往上送。", fig: function () {
          var s = soil(110) + plant(160, 110, 80);
          [[110, 170], [210, 170], [130, 190], [190, 190]].forEach(function (p) { s += A(p[0], p[1], p[0] + (160 - p[0]) * 0.35, p[1] - 22, "var(--pri)", 2.5); });
          return svg("根在土裡吸收水分", s + T(60, 150, "吸水", 16, "middle", "var(--pri)", true), "var(--leaf-soft)"); } },
        { say: "根也像抓住地面的手，讓植物站穩、不容易被風吹倒（固定）。", fig: function () {
          var s = soil(120) + plant(170, 120, 80);
          for (var i = 0; i < 4; i++) s += A(16, 40 + i * 18, 80, 40 + i * 18, "var(--muted)", 2);
          return svg("風吹過來，根抓住土，植物站得穩", s + T(48, 30, "風", 15) + T(250, 170, "抓住土", 15, "middle", "var(--soil)", true), "var(--leaf-soft)"); } },
        { say: "有些根長得很特別：榕樹的氣生根從樹枝垂下來，能吸空氣中的水分，伸進土裡會變成像樹幹的支柱根；銀葉樹的板根突出地面，像三角形的翅膀，讓樹站穩。", fig: function () {
          var s = soil(150) + L(80, 150, 80, 60, "var(--soil)", 12) + '<ellipse cx="80" cy="50" rx="58" ry="26" fill="var(--leaf)"/>';
          [44, 60, 100, 116].forEach(function (x, i) { s += L(x, 60, x, i % 2 ? 150 : 118, "var(--soil)", i % 2 ? 6 : 2); });
          s += T(80, 176, "榕樹：氣生根、支柱根", 12);
          s += L(240, 150, 240, 50, "var(--soil)", 12) + '<polygon points="240,150 200,150 236,112" fill="var(--soil)"/><polygon points="240,150 282,150 244,108" fill="var(--soil)"/>' + T(240, 176, "銀葉樹：板根", 12);
          return svg("榕樹的氣生根和支柱根；銀葉樹像三角形翅膀的板根", s, "var(--leaf-soft)"); } }
      ],
      remember: "多數根長在土裡，負責吸水、固定植物；一般土裡的根不做光合作用。",
      ask: "颱風天，大樹為什麼不容易被吹倒？" },
    "pl-stem": { cid: "2-1", title: "莖的工作",
      steps: [
        { say: "莖像柱子，撐住整棵植物，讓葉子曬到太陽；莖還會往有陽光的方向長。", fig: function () {
          var s = soil(170) + P("M150 170 Q150 110 196 60", null, "var(--leaf)", 8) + leaf(170, 110, 34, -20) + leaf(196, 60, 30, -40) + leaf(160, 130, 30, 200) + sun(278, 40, 16) + A(240, 56, 214, 64, "var(--sun)", 2);
          return svg("莖撐住植物，往有陽光的方向彎", s + T(90, 120, "撐住", 15, "middle", "var(--ink)", true), "var(--leaf-soft)"); } },
        { say: "莖像水管：枝條插在紅色的水裡，莖會先變紅。直的切開看到紅色細線；橫的切開（像右圖）看到一圈紅點。", fig: function () {
          var s = cup(60, 110, 70, 80, 130, { fill: "#f4a3a3" }) + L(95, 186, 95, 50, "var(--bad)", 8) + leaf(95, 70, 34, 210) + leaf(95, 56, 30, -30);
          s += '<ellipse cx="236" cy="100" rx="42" ry="42" fill="var(--leaf-soft)" stroke="var(--leaf)" stroke-width="3"/>';
          for (var i = 0; i < 8; i++) { var a = i * 45 * DEG; s += dot(236 + Math.cos(a) * 26, 100 + Math.sin(a) * 26, 5, "var(--bad)"); }
          s += T(236, 168, "切開的莖：紅色細點", 13) + T(95, 30, "紅色的水往上走", 13);
          return svg("枝條插在紅色的水裡，莖變紅；切開看到一圈紅點", s, "var(--leaf-soft)"); } },
        { say: "有的莖軟軟的站不直：絲瓜用捲鬚攀爬，牽牛花的莖纏繞著往上長。榕樹、樟樹的莖又粗又直，不用攀爬。", fig: function () {
          var s = L(60, 190, 60, 20, "var(--soil)", 5) + L(260, 190, 260, 20, "var(--soil)", 5);
          s += P("M110 190 Q100 150 120 130 Q140 110 120 90 Q100 70 120 50", null, "var(--leaf)", 4) + P("M120 130 q-30 -6 -56 4 q-6 -10 2 -16", null, "var(--leaf)", 2) + P("M120 50 q-30 -4 -56 6 q-6 -10 2 -14", null, "var(--leaf)", 2) + T(110, 22, "絲瓜：捲鬚", 13);
          var d = "M260 190"; for (var y = 190; y > 30; y -= 20) d += " q" + (y % 40 ? 16 : -16) + " -10 0 -20";
          s += P(d, null, "var(--leaf)", 4) + T(210, 22, "牽牛花：纏繞", 13);
          return svg("絲瓜用捲鬚攀爬，牽牛花的莖纏繞往上", s, "var(--leaf-soft)"); } },
        { say: "馬鈴薯是長在土裡的莖（塊莖），用來存養分，不會結種子；草莓、吊蘭的走莖會在前端長出小苗。", fig: function () {
          var s = soil(80) + '<ellipse cx="88" cy="140" rx="46" ry="30" fill="#c99a62"/>' + dot(70, 130, 3.5) + dot(100, 150, 3.5) + dot(110, 126, 3.5) + T(88, 190, "馬鈴薯：塊莖", 13);
          s += plant(196, 80, 34, { noRoot: true }) + P("M196 80 Q240 64 286 80", null, "var(--leaf)", 3) + leaf(286, 80, 18, -60) + leaf(286, 80, 18, -120) + T(242, 112, "走莖長小苗", 13);
          return svg("馬鈴薯是長在土裡的塊莖；走莖前端長出小苗", s, "var(--leaf-soft)"); } }
      ],
      remember: "莖：撐住植物＋運送水分和養分；特別的莖會攀爬、存養分、長小苗。",
      ask: "紅色的水實驗，為什麼莖會先變紅？" },
    "pl-leaf": { cid: "2-1", title: "葉子的工作",
      steps: [
        { say: "葉子像廚房：用陽光、水和空氣（二氧化碳）做出植物需要的養分，同時放出氧氣。這叫光合作用。", fig: function () {
          var s = leaf(100, 120, 120, -10, "var(--leaf)") + sun(40, 40, 14) + A(56, 52, 108, 96, "var(--sun)", 2) + T(60, 180, "水（從根來）", 13) + A(90, 166, 120, 128, "var(--pri)", 2) + T(140, 60, "二氧化碳", 13, "start") + A(160, 66, 150, 98, "var(--muted)", 2);
          s += A(230, 96, 284, 70, "var(--ink)", 2) + T(290, 64, "養分", 14, "end", "var(--ink)", true) + A(230, 116, 284, 140, "var(--ink)", 2) + T(290, 158, "氧氣", 14, "end", "var(--ink)", true) + T(176, 30, "葉子＝廚房", 15, "middle", "var(--leaf)", true);
          return svg("葉子用陽光、水和空氣中的二氧化碳做出養分，放出氧氣", s, "var(--leaf-soft)"); } },
        { say: "葉子還會讓水變成水蒸氣跑到空氣中，這叫蒸散作用。", fig: function () {
          var s = leaf(70, 130, 170, -12, "var(--leaf)");
          for (var i = 0; i < 4; i++) s += P('M' + (110 + i * 34) + ' 100 q-8 -12 0 -24 q8 -12 0 -24', null, "var(--pri)", 2.5, ' stroke-dasharray="4 4"');
          return svg("葉子上方冒出水蒸氣", s + T(160, 30, "水蒸氣跑出去", 15, "middle", "var(--pri)", true), "var(--leaf-soft)"); } },
        { say: "用夾鏈袋包住陽光下的葉子，袋子裡出現小水珠——那是葉子「散出來」的水，不是葉子把水吸進去。吸水是根的工作。", fig: function () {
          var s = L(40, 190, 120, 110, "var(--leaf)", 6) + P("M110 120 Q200 30 290 70 Q260 170 140 160 Z", "var(--card)", "var(--muted)", 2, ' opacity=".9"') + leaf(130, 116, 120, -16);
          for (var i = 0; i < 12; i++) s += '<circle cx="' + (150 + (i * 31) % 120) + '" cy="' + (78 + (i * 19) % 70) + '" r="4" fill="var(--waterfill)" stroke="var(--pri)" stroke-width="1"/>';
          return svg("夾鏈袋包住葉子，袋子內側出現很多小水珠", s + T(80, 30, "小水珠＝葉子散出來的水", 13, "start", "var(--ink)", true), "var(--leaf-soft)"); } }
      ],
      remember: "葉：做養分（光合作用）、散水分（蒸散作用）；吸水是根、運送是莖。",
      ask: "夾鏈袋裡的小水珠是從哪裡來的？" },
    "pl-flow": { cid: "2-1", title: "水在植物身體裡怎麼走？",
      steps: [
        { say: "根吸水 → 莖往上送 → 葉子把水散到空氣中。", fig: function () {
          var s = soil(130) + plant(130, 130, 90) + A(160, 168, 160, 140, "var(--pri)", 3) + A(160, 124, 160, 60, "var(--pri)", 3) + P("M170 46 q-6 -10 0 -20", null, "var(--pri)", 2.5, ' stroke-dasharray="3 3"');
          s += T(186, 166, "① 根吸水", 15, "start", "var(--ink)", true) + T(186, 100, "② 莖運送", 15, "start", "var(--ink)", true) + T(186, 34, "③ 葉蒸散", 15, "start", "var(--ink)", true);
          return svg("水從根吸收，經過莖往上送，從葉子散出去", s, "var(--leaf-soft)"); } },
        { say: "所以把帶根的蔥泡在水裡，根會吸水，再把水送到上面，蔥就能繼續長。", fig: function () {
          var s = cup(110, 100, 100, 90, 130) + L(150, 186, 150, 30, "var(--leaf)", 6) + L(170, 186, 170, 40, "var(--leaf)", 6) + P("M150 170 l-14 14 M150 170 l-2 18 M150 170 l10 16 M170 172 l-8 16 M170 172 l4 16 M170 172 l14 12", null, "var(--muted)", 2.5);
          return svg("帶根的蔥泡在水裡繼續長", s + T(250, 170, "根吸水", 14, "middle", "var(--pri)", true), "var(--leaf-soft)"); } }
      ],
      remember: "水的路線：根 → 莖 → 葉。",
      ask: "如果把根剪掉，水還能送到葉子嗎？" },
    "pl-adapt": { cid: "2-1", title: "特別的植物，特別的本領",
      steps: [
        { say: "仙人掌住在很乾的地方：葉子變成細細的刺，水比較不會散掉；胖胖的綠色莖可以存水、做養分。", fig: function () {
          var s = soil(170) + P("M140 170 L140 60 Q160 34 180 60 L180 170 Z", "var(--leaf)") + P("M140 120 L110 120 L110 90", null, "var(--leaf)", 14) + P("M180 100 L210 100 L210 76", null, "var(--leaf)", 14);
          for (var i = 0; i < 14; i++) { var y = 60 + i * 8; s += L(i % 2 ? 180 : 140, y, i % 2 ? 190 : 130, y - 4, "var(--ink)", 1.5); }
          return svg("仙人掌的刺是葉子變的，綠色的莖很胖", s + T(250, 60, "刺＝葉", 14, "middle", "var(--ink)", true) + T(250, 130, "胖胖的莖：存水", 13), "var(--sun-soft)"); } },
        { say: "捕蠅草、毛氈苔長在養分少的土裡，葉子會抓小蟲來補充養分。", fig: function () {
          var s = P("M80 120 Q60 70 100 50 Q100 100 80 120 Z", "var(--leaf)") + P("M80 120 Q120 80 140 110 Q100 120 80 120 Z", "var(--leaf)", "var(--bad)", 2);
          for (var i = 0; i < 6; i++) s += L(96 + i * 7, 52 + i * 9, 104 + i * 7, 46 + i * 9, "var(--bad)", 2);
          s += dot(118, 98, 4) + T(100, 160, "捕蠅草：葉像夾子", 13);
          s += '<ellipse cx="240" cy="100" rx="30" ry="22" fill="var(--leaf)"/>';
          for (var j = 0; j < 10; j++) { var a = j * 36 * DEG; s += L(240 + Math.cos(a) * 24, 100 + Math.sin(a) * 18, 240 + Math.cos(a) * 38, 100 + Math.sin(a) * 30, "var(--bad)", 2) + dot(240 + Math.cos(a) * 40, 100 + Math.sin(a) * 32, 3, "var(--bad)"); }
          s += T(240, 160, "毛氈苔：黏黏的觸毛", 13);
          return svg("捕蠅草的葉子像夾子，毛氈苔的葉子有黏黏的觸毛", s, "var(--leaf-soft)"); } },
        { say: "含羞草被碰到，小葉片會合起來，葉柄會垂下去。", fig: function () {
          var s = L(80, 180, 80, 70, "var(--leaf)", 4) + L(80, 80, 140, 60, "var(--leaf)", 3);
          for (var i = 0; i < 5; i++) s += leaf(92 + i * 10, 76 - i * 3.5, 12, -110) + leaf(92 + i * 10, 76 - i * 3.5, 12, 70);
          s += A(150, 100, 190, 100, "var(--ink)", 3) + T(170, 90, "碰一下", 12);
          s += L(250, 180, 250, 70, "var(--leaf)", 4) + L(250, 80, 290, 130, "var(--leaf)", 3);
          for (var j = 0; j < 5; j++) s += L(256 + j * 7, 87 + j * 8.5, 262 + j * 7, 87 + j * 8.5, "var(--leaf)", 4);
          return svg("含羞草被碰到後，葉片合起來，葉柄垂下", s + T(80, 196, "張開", 13) + T(260, 196, "合起來、垂下", 13), "var(--leaf-soft)"); } },
        { say: "石蓮肥肥厚厚的是「葉」，不是根，它把水存在葉子裡。環境不同，根、莖、葉就長得不一樣。", fig: function () {
          var s = soil(150);
          for (var i = 0; i < 8; i++) { var a = (i * 45) * DEG; s += '<ellipse cx="' + r1(160 + Math.cos(a) * 30) + '" cy="' + r1(112 + Math.sin(a) * 16) + '" rx="26" ry="13" fill="#8fb9a0" stroke="var(--leaf)" stroke-width="2" transform="rotate(' + (i * 45) + ' ' + r1(160 + Math.cos(a) * 30) + ' ' + r1(112 + Math.sin(a) * 16) + ')"/>'; }
          s += '<circle cx="160" cy="112" r="14" fill="#a7cdb5"/>' + T(160, 186, "肥厚的是葉子：存水", 14, "middle", "var(--ink)", true);
          return svg("石蓮肥厚的葉子用來存水", s, "var(--sun-soft)"); } }
      ],
      remember: "住的地方不一樣，根、莖、葉就長得不一樣，用來活下去。",
      ask: "仙人掌的刺是什麼部位變成的？" },

    /* ===== 2-2 植物的繁殖 ===== */
    "rp-flower": { cid: "2-2", title: "花的構造",
      steps: [
        { say: "外面一圈：花瓣（顏色鮮豔，吸引昆蟲）、花萼（綠綠的，保護花苞）。", fig: function () { return svg("花的外圈：紅色花瓣和綠色花萼", flowerSide({ hl: "petal" }) + labelTo(110, 80, 40, 40, "花瓣", "start") + labelTo(132, 160, 60, 186, "花萼", "start"), "var(--leaf-soft)"); } },
        { say: "雄蕊＝花藥＋花絲。花粉就在花藥裡。", fig: function () { return svg("雄蕊：上面的花藥和下面的花絲", flowerSide({ hl: "stamen" }) + labelTo(196, 72, 222, 40, "花藥（花粉）", "start") + labelTo(184, 120, 250, 120, "花絲", "start"), "var(--leaf-soft)"); } },
        { say: "雌蕊由上到下是柱頭、花柱、子房；子房裡面有胚珠。", fig: function () { return svg("雌蕊：柱頭、花柱、子房，子房裡有胚珠", flowerSide({ hl: "pistil" }) + labelTo(170, 60, 250, 36, "柱頭", "start") + labelTo(162, 96, 250, 80, "花柱", "start") + labelTo(174, 142, 250, 132, "子房", "start") + labelTo(158, 140, 70, 160, "胚珠", "end"), "var(--leaf-soft)"); } }
      ],
      remember: "雄蕊＝花藥＋花絲（做花粉）；雌蕊＝柱頭＋花柱＋子房（裡面有胚珠）。",
      ask: "花粉要落到雌蕊的哪一個地方？" },
    "rp-fruit": { cid: "2-2", title: "花怎麼變成果實和種子？",
      steps: [
        { say: "花粉從雄蕊跑到雌蕊的柱頭上，叫做授粉。昆蟲、風都會幫忙（玉米靠風；聖誕紅紅色的葉子能吸引昆蟲）。", fig: function () {
          var s = flowerSide() + '<ellipse cx="236" cy="54" rx="14" ry="9" fill="var(--sunball)" stroke="var(--ink)" stroke-width="2"/>' + '<ellipse cx="232" cy="44" rx="8" ry="5" fill="var(--card)" opacity=".8"/>' + L(229, 54, 229, 64, "var(--ink)", 2);
          s += P("M190 72 Q176 46 168 60", null, "var(--sun-deep)", 2, ' stroke-dasharray="3 4"') + head(176, 50, 166, 58, "var(--sun-deep)", 8) + T(262, 30, "昆蟲帶花粉", 13);
          return svg("昆蟲把花藥的花粉帶到柱頭上，叫授粉", s, "var(--leaf-soft)"); } },
        { say: "授粉以後，花裡面還要完成「受精」；接著花瓣慢慢掉了，子房一天一天變大。", fig: function () {
          var s = L(80, 190, 80, 140, "var(--leaf)", 6) + '<ellipse cx="80" cy="124" rx="14" ry="16" fill="var(--leaf-soft)" stroke="var(--leaf)" stroke-width="2.5"/>' + T(80, 92, "花瓣掉了", 13);
          s += A(116, 130, 156, 130, "var(--ink)", 3) + L(220, 190, 220, 150, "var(--leaf)", 6) + tomato(220, 116, 32, false) + T(220, 70, "子房變大", 13);
          return svg("花瓣掉落後，子房慢慢長大成果實", s, "var(--leaf-soft)"); } },
        { say: "最後：子房通常會長成果實，子房裡的胚珠長成種子。果實把種子包起來保護。", fig: function () {
          var s = '<ellipse cx="70" cy="110" rx="26" ry="30" fill="var(--leaf-soft)" stroke="var(--leaf)" stroke-width="2.5"/>' + dot(62, 104, 4, "var(--sun-deep)") + dot(76, 116, 4, "var(--sun-deep)") + T(70, 166, "子房（胚珠）", 13);
          s += A(108, 110, 158, 110, "var(--ink)", 3) + tomato(226, 110, 52, true) + T(226, 184, "果實（種子）", 13);
          return svg("子房變成果實，胚珠變成種子", s, "var(--leaf-soft)"); } }
      ],
      remember: "子房 → 果實；胚珠 → 種子。",
      ask: "番茄切開，裡面一顆一顆的種子，原本是花的哪裡？" },
    "rp-spread": { cid: "2-2", title: "種子怎麼去遠方？",
      steps: [
        { say: "靠風：蒲公英的果實有像小傘一樣的細毛，有些果實有薄薄的翅膀，被風吹走。", fig: function () {
          var s = '';
          for (var i = 0; i < 3; i++) { var x = 80 + i * 70, y = 60 + i * 30; s += L(x, y, x, y + 30, "var(--muted)", 1.5) + '<ellipse cx="' + x + '" cy="' + (y + 34) + '" rx="3" ry="5" fill="var(--soil)"/>'; for (var j = -3; j <= 3; j++) s += L(x, y, x + j * 6, y - 12, "var(--muted)", 1.2); }
          for (var k = 0; k < 4; k++) s += A(10, 40 + k * 30, 50, 40 + k * 30, "var(--pri)", 2);
          return svg("蒲公英的果實像小傘，被風吹走", s + T(260, 186, "風力", 16, "middle", "var(--ink)", true), "var(--pri-soft)"); } },
        { say: "靠水：椰子、林投的果實能浮在水上，漂到很遠的地方。", fig: function () {
          var s = box(0, 120, 320, 80, "var(--waterfill)") + P("M0 120 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0", null, "var(--pri)", 2) + '<ellipse cx="150" cy="118" rx="30" ry="22" fill="#8a6a3b"/>' + A(190, 150, 250, 150, "var(--pri)", 3);
          return svg("椰子的果實浮在水上漂走", s + T(160, 186, "水力", 16, "middle", "var(--ink)", true)); } },
        { say: "靠動物：鬼針草有倒鉤，黏在衣服、動物毛上被帶走；鳥吃了甜甜的果實（木瓜、芭樂），種子隨著便便排出去。", fig: function () {
          var s = P("M40 40 L100 40 L100 150 Q70 170 40 150 Z", "var(--card)", "var(--muted)", 2);
          for (var i = 0; i < 4; i++) s += L(56 + i * 12, 70 + i * 16, 64 + i * 12, 84 + i * 16, "var(--ink)", 3) + P('M' + (64 + i * 12) + ' ' + (84 + i * 16) + ' l3 4 M' + (64 + i * 12) + ' ' + (84 + i * 16) + ' l-4 2', null, "var(--ink)", 1.5);
          s += T(70, 186, "黏在衣服上", 13);
          s += '<ellipse cx="236" cy="90" rx="34" ry="22" fill="var(--soil)"/><circle cx="262" cy="74" r="13" fill="var(--soil)"/>' + '<polygon points="274,74 288,78 274,82" fill="var(--sun)"/>' + dot(266, 71, 2.2, "#fff") + '<ellipse cx="236" cy="140" rx="22" ry="16" fill="#f4a261"/>' + T(236, 186, "鳥吃果實", 13);
          return svg("鬼針草黏在衣服上；鳥吃果實把種子帶走", s, "var(--leaf-soft)"); } },
        { say: "靠彈力：鳳仙花、酢漿草的果實成熟後裂開，把種子彈出去。", fig: function () {
          var s = L(160, 190, 160, 120, "var(--leaf)", 4) + P("M160 120 Q120 90 104 50", null, "var(--leaf)", 4) + P("M160 120 Q200 90 216 50", null, "var(--leaf)", 4);
          [[90, 40], [70, 90], [240, 36], [262, 84], [130, 30]].forEach(function (p) { s += A(160, 110, p[0], p[1], "var(--muted)", 1.5, "3 4") + '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="4" ry="3" fill="var(--soil)"/>'; });
          return svg("果實裂開，把種子彈到四周", s + T(270, 186, "彈力", 16, "middle", "var(--ink)", true), "var(--leaf-soft)"); } }
      ],
      remember: "風、水、動物、彈力：看果實長什麼樣子，就猜得到它靠什麼。",
      ask: "身上黏著小刺刺的果實，是靠什麼散播種子的？" },
    "rp-veg": { cid: "2-2", title: "不用種子，也能長出新植物",
      steps: [
        { say: "用葉：落地生根的葉子邊緣會長出小芽；石蓮掉下來的葉子也會長出新植物。", fig: function () {
          var s = soil(160) + leaf(60, 120, 200, 0, "var(--leaf)");
          for (var i = 0; i < 6; i++) { var x = 90 + i * 28, y = 120 - Math.sin((i + 1) / 7 * Math.PI) * 30; s += L(x, y, x, y - 14, "var(--leaf)", 2) + leaf(x, y - 14, 10, -60) + leaf(x, y - 14, 10, -120); }
          return svg("落地生根的葉子邊緣長出許多小芽", s + T(160, 186, "葉子邊緣長小芽", 14, "middle", "var(--ink)", true), "var(--leaf-soft)"); } },
        { say: "用莖：馬鈴薯的芽眼、黃金葛莖上的節、竹子的地下莖，都會長出新芽。", fig: function () {
          var s = soil(120) + '<ellipse cx="80" cy="150" rx="44" ry="28" fill="#c99a62"/>' + dot(62, 140, 3.5) + P("M62 138 Q58 110 70 92", null, "var(--leaf)", 3) + T(80, 194, "馬鈴薯", 13);
          s += P("M180 160 L300 160", null, "#c4a26a", 8) + L(210, 160, 210, 60, "var(--leaf)", 6) + L(270, 160, 270, 80, "var(--leaf)", 6) + L(210, 100, 216, 100, "var(--leaf)", 8) + T(240, 194, "竹子：地下莖", 13);
          return svg("馬鈴薯的芽眼和竹子的地下莖都長出新芽", s, "var(--leaf-soft)"); } },
        { say: "用根：地瓜是變胖的根，埋在土裡也會發芽。", fig: function () {
          var s = soil(90) + P("M100 130 Q160 100 230 130 Q170 170 100 130 Z", "#b0517a") + P("M150 116 Q146 80 160 50", null, "var(--leaf)", 3) + leaf(160, 50, 20, -50) + leaf(160, 56, 18, -140);
          return svg("地瓜（根）在土裡發芽", s + T(160, 186, "地瓜＝根", 14, "middle", "var(--ink)", true), "var(--leaf-soft)"); } },
        { say: "大部分開花的植物還是用種子繁殖；一種植物也可能有好幾種方法。看新芽從哪裡長出來，就知道它用哪個部位。", fig: function () {
          var s = soil(130);
          [70, 160, 250].forEach(function (x, i) { s += '<ellipse cx="' + x + '" cy="142" rx="14" ry="9" fill="var(--soil)"/>' + (i ? P('M' + x + ' 136 Q' + (x - 4) + ' ' + (120 - i * 20) + ' ' + (x + 6) + ' ' + (110 - i * 26), null, "var(--leaf)", 3) : ''); });
          return svg("種子發芽長成新植物", s + T(160, 186, "種子發芽", 14, "middle", "var(--ink)", true), "var(--leaf-soft)"); } }
      ],
      remember: "新芽從哪裡長出來，那就是它用來繁殖的部位。",
      ask: "馬鈴薯和地瓜，哪一個是莖、哪一個是根？" },
    "rp-organ": { cid: "2-2", title: "營養器官和繁殖器官",
      steps: [
        { say: "根、莖、葉讓植物活下去（吸水、運送、做養分），叫做營養器官。", fig: function () {
          var s = soil(140) + plant(160, 140, 96);
          return svg("根莖葉是營養器官", s + T(260, 80, "根、莖、葉", 15, "middle", "var(--leaf)", true) + T(260, 104, "＝營養器官", 14), "var(--leaf-soft)"); } },
        { say: "花、果實、種子用來生出下一代，叫做繁殖器官。", fig: function () {
          var s = '<g transform="translate(-60 0) scale(.8)">' + flowerSide() + '</g>' + tomato(200, 120, 26, false) + '<ellipse cx="270" cy="124" rx="10" ry="7" fill="var(--soil)"/>';
          return svg("花、果實、種子是繁殖器官", s + T(200, 188, "花、果實、種子＝繁殖器官", 14, "middle", "var(--bad)", true), "var(--leaf-soft)"); } }
      ],
      remember: "活下去靠根莖葉（營養器官）；生下一代靠花、果實、種子（繁殖器官）。",
      ask: "葉子是營養器官還是繁殖器官？" },

    /* ===== 2-3 植物與生活 ===== */
    "us-part": { cid: "2-3", title: "我們吃的是植物的哪個部位？",
      steps: [
        { say: "長在土裡的不一定是根：有芽眼、有一節一節的是莖（馬鈴薯、薑、蓮藕）；沒有的是根（蘿蔔、地瓜）。", fig: function () {
          var s = soil(60) + '<ellipse cx="80" cy="120" rx="40" ry="26" fill="#c99a62"/>' + dot(66, 112, 3.5) + dot(96, 128, 3.5) + T(80, 176, "馬鈴薯：莖", 14, "middle", "var(--ink)", true);
          s += P("M210 76 L250 76 L232 170 Z", "#f1ede2", "var(--muted)", 2) + leaf(230, 76, 26, -70) + leaf(230, 76, 26, -110) + T(232, 190, "蘿蔔：根", 14, "middle", "var(--ink)", true);
          return svg("馬鈴薯有芽眼是莖；蘿蔔是根", s, "var(--leaf-soft)"); } },
        { say: "一層一層的是葉（高麗菜）；花椰菜吃的是還沒開的花；包著種子的是果實（番茄）；紅豆、花生仁是種子。", fig: function () {
          var s = '<circle cx="50" cy="90" r="30" fill="#b9d98b"/>' + P("M28 90 Q50 66 72 90", null, "var(--leaf)", 2) + T(50, 150, "葉", 15, "middle", "var(--ink)", true);
          s += '<circle cx="125" cy="84" r="24" fill="#e8e2c4"/>' + dot(115, 78, 7, "#f4efd9") + dot(132, 76, 7, "#f4efd9") + dot(124, 92, 7, "#f4efd9") + L(125, 108, 125, 124, "var(--leaf)", 8) + T(125, 150, "花", 15, "middle", "var(--ink)", true);
          s += tomato(200, 90, 26, true) + T(200, 150, "果實", 15, "middle", "var(--ink)", true);
          s += '<ellipse cx="268" cy="86" rx="9" ry="6" fill="#9b2c2c"/><ellipse cx="286" cy="96" rx="9" ry="6" fill="#9b2c2c"/><ellipse cx="270" cy="102" rx="9" ry="6" fill="#9b2c2c"/>' + T(276, 150, "種子", 15, "middle", "var(--ink)", true);
          return svg("高麗菜是葉、花椰菜是花、番茄是果實、紅豆是種子", s, "var(--leaf-soft)"); } },
        { say: "木頭桌椅的木材來自樹幹，樹幹就是莖。", fig: function () {
          var s = soil(170) + box(60, 70, 30, 100, "var(--soil)") + '<ellipse cx="75" cy="56" rx="50" ry="34" fill="var(--leaf)"/>' + A(110, 130, 170, 130, "var(--ink)", 3);
          s += box(190, 100, 100, 12, "#c89b6d") + box(200, 112, 10, 50, "#c89b6d") + box(270, 112, 10, 50, "#c89b6d");
          return svg("樹幹（莖）做成木頭桌子", s + T(75, 194, "樹幹＝莖", 14, "middle", "var(--ink)", true), "var(--leaf-soft)"); } }
      ],
      remember: "先問自己：它是根、莖、葉、花、果實，還是種子？",
      ask: "薑有一節一節的，它是根還是莖？" },
    "us-econ": { cid: "2-3", title: "經濟植物是什麼？",
      steps: [
        { say: "經濟植物＝人們拿來吃、用、觀賞，可以帶來收入的植物；不是指「很貴的植物」，而且大多容易種、生活中常見。", fig: function () {
          var s = tomato(60, 90, 26, false) + T(60, 150, "吃：芒果、茶", 13) + box(130, 70, 60, 14, "#c89b6d") + box(130, 92, 60, 14, "#c89b6d") + T(160, 150, "用：木材", 13);
          s += P("M260 120 Q240 80 262 64 Q284 80 262 120 Z", "#b07cc6") + P("M262 100 Q230 70 250 52", null, "#b07cc6", 6) + L(262, 120, 262, 140, "var(--leaf)", 4) + T(262, 150, "看：蘭花", 13);
          return svg("經濟植物可以吃、可以用、可以觀賞", s + T(160, 30, "吃、用、看，都能帶來收入", 14, "middle", "var(--ink)", true), "var(--sun-soft)"); } },
        { say: "人們會做品種改良，讓它更甜、更大、更好種，更有價值。台灣的蘭花、茶葉、芒果、鳳梨釋迦都賣到世界各地。", fig: function () {
          var s = '<circle cx="80" cy="100" r="18" fill="#f2b632"/>' + A(118, 100, 190, 100, "var(--ink)", 3) + T(154, 90, "品種改良", 13) + '<circle cx="240" cy="100" r="36" fill="#f2b632"/>' + T(240, 160, "更大、更甜", 14, "middle", "var(--ink)", true);
          return svg("品種改良讓水果變大變甜", s, "var(--sun-soft)"); } },
        { say: "可是不能為了賺錢把山坡都開發來種，要保護環境、水土。", fig: function () {
          var s = P("M0 170 L110 70 L220 170 Z", "var(--leaf)") + P("M150 170 L240 90 L320 170 Z", "#c9b37e");
          for (var i = 0; i < 4; i++) s += L(170 + i * 22, 160 - i * 18, 220 + i * 22, 160 - i * 18, "var(--leaf)", 3);
          return svg("左邊是森林山坡，右邊是被開發成茶園的山坡", s + T(80, 190, "森林保護水土", 13) + T(250, 190, "全部開發：要小心", 13)); } }
      ],
      remember: "經濟植物能帶來收入；不等於很貴，也要兼顧環境。",
      ask: "蘭花是吃的、用的，還是觀賞的經濟植物？" },
    "us-bio": { cid: "2-3", title: "向植物學發明（仿生）",
      steps: [
        { say: "大花咸豐草的果實有小倒鉤，走過草叢就會黏在褲子上。", fig: function () {
          var s = box(120, 20, 80, 170, "#5b7ca8", null, 6);
          for (var i = 0; i < 5; i++) { var x = 140 + (i * 17) % 50, y = 60 + i * 24; s += L(x, y, x + 10, y + 14, "var(--ink)", 3) + P('M' + x + ' ' + y + ' l-3 -5 M' + x + ' ' + y + ' l4 -4', null, "var(--ink)", 1.5); }
          return svg("褲子上黏著許多有倒鉤的果實", s + T(260, 100, "倒鉤", 15, "middle", "var(--ink)", true), "var(--leaf-soft)"); } },
        { say: "人們學它做出魔鬼氈：一面是小倒鉤，一面是小圈圈，壓在一起就黏住。這叫仿生。", fig: function () {
          var s = box(40, 50, 240, 30, "#7aa0c4", null, 4) + box(40, 120, 240, 30, "#c4d4e4", null, 4);
          for (var i = 0; i < 10; i++) { var x = 56 + i * 23; s += P('M' + x + ' 80 l0 18 q0 6 6 4', null, "var(--ink)", 2) + P('M' + (x + 4) + ' 120 q-8 -14 6 -14 q8 0 4 14', null, "var(--ink)", 1.5); }
          return svg("魔鬼氈上面是倒鉤、下面是圈圈", s + T(160, 40, "小倒鉤", 13) + T(160, 176, "小圈圈", 13), "var(--leaf-soft)"); } },
        { say: "蓮葉不沾水，水珠滾下去會把灰塵帶走；人們學它做出不容易髒的材料。", fig: function () {
          var s = '<ellipse cx="160" cy="130" rx="130" ry="34" fill="var(--leaf)"/>' + '<circle cx="120" cy="92" r="16" fill="var(--waterfill)" stroke="var(--pri)" stroke-width="2"/><circle cx="200" cy="96" r="11" fill="var(--waterfill)" stroke="var(--pri)" stroke-width="2"/>' + A(140, 82, 180, 82, "var(--ink)", 2);
          return svg("蓮葉上的水珠滾來滾去，不沾濕葉子", s + T(160, 40, "水珠滾走，帶走灰塵", 14, "middle", "var(--ink)", true), "var(--leaf-soft)"); } }
      ],
      remember: "學生物的構造來發明東西，叫仿生（魔鬼氈學大花咸豐草的果實）。",
      ask: "魔鬼氈是學大花咸豐草的哪個部位？" },

    /* ===== 3-1 溶解 ===== */
    "ds-stay": { cid: "3-1", title: "糖溶解以後跑去哪裡？",
      steps: [
        { say: "糖放進水裡，攪一攪就看不見了。", fig: function () { return svg("方糖放進水杯", cup(110, 50, 100, 130, 80) + cube(146, 140, 26) + A(200, 30, 172, 70, "var(--ink)", 2), "var(--pri-soft)"); } },
        { say: "其實糖變成很小很小、眼睛看不到的顆粒，散在水裡，還在。", fig: function () {
          var s = cup(40, 50, 100, 130, 80) + '<circle cx="230" cy="110" r="56" fill="var(--waterfill)" stroke="var(--ink)" stroke-width="3"/>' + particles(180, 60, 100, 100, 30, 3) + L(140, 110, 174, 110, "var(--ink)", 2, "4 4");
          return svg("放大來看，糖變成很小的顆粒散在水中", s + T(230, 190, "放大看：還在", 14, "middle", "var(--ink)", true), "var(--pri-soft)"); } },
        { say: "溶解前後一起秤（沒有灑出來），重量一樣，證明糖沒有消失。實驗用的溶液不可以嚐。", fig: function () {
          var s = cup(40, 40, 70, 90, 70) + cube(110, 110, 20) + scale(40, 140, "220 g") + A(146, 120, 176, 120, "var(--ink)", 3) + cup(200, 40, 70, 90, 70) + scale(190, 140, "220 g");
          return svg("溶解前後一起秤，都是 220 克", s + T(160, 30, "一樣重", 15, "middle", "var(--ink)", true), "var(--pri-soft)"); } }
      ],
      remember: "溶解＝看不見，但還在水裡；總重量不變。",
      ask: "糖溶解後看不見了，怎麼證明它還在？" },
    "ds-fast": { cid: "3-1", title: "怎麼讓糖溶解得快一點？",
      steps: [
        { say: "攪拌：讓水一直流動，糖溶得比較快。", fig: function () { return svg("用湯匙攪拌糖水", cup(110, 50, 100, 130, 80) + L(190, 20, 150, 160, "var(--muted)", 5) + P("M130 130 q30 20 60 0", null, "var(--pri)", 2) + head(160, 140, 190, 130, "var(--pri)", 9), "var(--pri-soft)"); } },
        { say: "用熱水：水溫比較高，糖通常溶得比較快。", fig: function () {
          var s = cup(40, 60, 90, 120, 90, { fill: "#f3b7a5" }) + P("M66 50 q-6 -10 0 -20 q6 -10 0 -20 M100 50 q-6 -10 0 -20 q6 -10 0 -20", null, "var(--muted)", 2) + T(85, 196, "熱水：快", 14, "middle", "var(--ink)", true);
          s += cup(190, 60, 90, 120, 90) + T(235, 196, "冷水：慢", 14, "middle", "var(--ink)", true);
          return svg("熱水的糖溶得比冷水快", s, "var(--pri-soft)"); } },
        { say: "把方糖弄碎：小顆的溶得比較快。", fig: function () { return svg("整顆方糖和弄碎的糖", cube(70, 90, 46) + A(136, 112, 176, 112, "var(--ink)", 3) + cube(200, 100, 14) + cube(222, 116, 12) + cube(240, 98, 14) + cube(214, 92, 10) + T(93, 170, "整顆：慢", 14) + T(230, 170, "弄碎：快", 14), "var(--pri-soft)"); } }
      ],
      remember: "攪拌、用熱水、弄碎，都能讓溶解變快。",
      ask: "冰水和熱水，哪一杯的糖溶得比較快？" },
    "ds-limit": { cid: "3-1", title: "能溶解的量有限度",
      steps: [
        { say: "一匙一匙加鹽，一開始都溶得掉，看不見。", fig: function () { return svg("加入的鹽都溶解了，水看起來還是透明的", cup(110, 50, 100, 130, 80) + P("M180 26 L230 6 L236 18 L186 36 Z", "var(--muted)") + T(160, 196, "溶掉了：看不見", 13), "var(--pri-soft)"); } },
        { say: "加到某一個量，再怎麼攪，杯底都會留下鹽，溶不下了。", fig: function () { return svg("鹽加太多，杯底留下溶不掉的鹽", cup(110, 50, 100, 130, 80) + P("M114 176 Q160 160 206 176 Z", "#ffffff", "var(--muted)", 1.5) + T(160, 30, "杯底留下鹽", 14, "middle", "var(--ink)", true), "var(--pri-soft)"); } },
        { say: "同樣多的水、同樣的溫度，能溶解的量是有限的。", fig: function () { return svg("同樣多的水能溶解的鹽有上限", cup(60, 60, 80, 110, 84) + cup(180, 60, 80, 110, 84) + T(160, 196, "水一樣多、溫度一樣：能溶的量一樣", 13) + T(100, 40, "100 毫升", 13) + T(220, 40, "100 毫升", 13), "var(--pri-soft)"); } }
      ],
      remember: "水能溶解的量有上限，多的會沉在杯底。",
      ask: "杯底一直有鹽溶不掉，表示什麼？" }
  };

  /* ---------- 需要大量計算的場景 ---------- */
  function houseScene(alt, label) {
    var floor = 176, wallX = 250, winTop = 86, winBot = 136, s = '';
    s += box(20, 40, wallX - 20, floor - 40, "var(--card)", "var(--ink)") + P('M10 44 L' + (wallX + 14) + ' 44', null, "var(--ink)", 4) + box(wallX - 3, winTop, 6, winBot - winTop, "var(--waterfill)");
    s += L(wallX, 40, wallX, winTop, "var(--ink)", 4) + L(wallX, winBot, wallX, floor, "var(--ink)", 4) + L(20, floor, 310, floor, "var(--muted)", 2);
    var t = Math.tan(alt * DEG), xTop = wallX - (floor - winTop) / t, xBot = wallX - (floor - winBot) / t;
    var hit = Math.max(xTop, 20);
    s += '<polygon points="' + wallX + ',' + winTop + ' ' + wallX + ',' + winBot + ' ' + r1(Math.max(xBot, 20)) + ',' + floor + ' ' + r1(hit) + ',' + floor + '" fill="var(--sunball)" opacity=".45"/>';
    // 太陽沿「同一個高度角」往窗外延伸：只縮短距離、不分別截 x、y（Codex 審查 A-02：分別截限會讓光線在窗口轉彎）
    var d = Math.min((304 - wallX) / Math.cos(alt * DEG), (winTop - 22) / Math.sin(alt * DEG)), sx = wallX + d * Math.cos(alt * DEG), sy = winTop - d * Math.sin(alt * DEG);
    s += sun(sx, sy, 12) + L(sx, sy, wallX, winTop, "var(--sun)", 2, "6 5");
    if (alt > 80) s += tag(150, 120, "只照到窗邊");
    s += T(28, 196, "北（屋內）", 11, "start", "var(--muted)") + T(312, 196, "南", 11, "end", "var(--muted)") + T(130, 30, label + "（約 " + Math.round(alt) + " 度）", 14, "middle", "var(--ink)", true);
    return s;
  }
  // 薄透鏡成像（1/u + 1/v = 1/f）：給 lt-lens 第 4 格用，也給測試核對
  function lensImage() {
    var f = 50, cx = 160, ox = 47, oy = 60, u = cx - ox, v = u * f / (u - f), m = -v / u;
    return { ix: r1(cx + v), iy: r1(100 - (100 - oy) * m), oy: oy, u: u, v: v, m: m, f: f };
  }
  function bendScene(dir) {
    var wy = 100, s = box(0, wy, 320, 100, "var(--waterfill)") + L(0, wy, 320, wy, "var(--pri)", 2) + L(160, 14, 160, 190, "var(--muted)", 1.5, "4 4");
    var inAir = 50, inWater = snellOut(inAir, 1, N_WATER), R = 108;
    var ax = 160 - R * Math.sin(inAir * DEG), ay = wy - R * Math.cos(inAir * DEG), wx = 160 + R * Math.sin(inWater * DEG), wyy = wy + R * Math.cos(inWater * DEG);
    if (dir === "in") s += ray(ax, ay, 160, wy) + ray(160, wy, wx, wyy) + L(160, wy, 160 + R * Math.sin(inAir * DEG), wy + R * Math.cos(inAir * DEG), "var(--muted)", 1.5, "2 5");
    else { var bx = 160 - R * Math.sin(inWater * DEG), by = wy + R * Math.cos(inWater * DEG), ox = 160 + R * Math.sin(inAir * DEG), oy = wy - R * Math.cos(inAir * DEG); s += ray(bx, by, 160, wy) + ray(160, wy, ox, oy); }
    s += '<circle cx="160" cy="' + wy + '" r="9" fill="none" stroke="var(--bad)" stroke-width="2.5"/>' + T(300, 88, "空氣", 15, "end") + T(300, 128, "水", 15, "end") + T(dir === "in" ? 60 : 250, dir === "in" ? 128 : 60, "在這裡轉彎", 13, "middle", "var(--bad)", true);
    return s;
  }
  var SHALLOW = { wy: 70, F: { x: 110, y: 176 }, E: { x: 290, y: 22 } };
  function shallowScene(showImage) {
    var g = refractPath(SHALLOW.F, SHALLOW.E, SHALLOW.wy), s = box(0, SHALLOW.wy, 320, 130, "var(--waterfill)") + L(0, SHALLOW.wy, 320, SHALLOW.wy, "var(--pri)", 2) + box(0, 190, 320, 10, "var(--soil)").replace('fill="var(--soil)"', 'fill="var(--soil)" opacity=".4"');
    function foot(x, y, op, dash) { return '<g' + (op ? ' opacity="' + op + '"' : '') + '>' + L(x, y - 60, x, y, "var(--ink)", 6, dash) + P('M' + (x - 2) + ' ' + y + ' l16 0', null, "var(--ink)", 6) + '</g>'; }
    s += foot(SHALLOW.F.x, SHALLOW.F.y) + ray(SHALLOW.F.x + 6, SHALLOW.F.y - 4, g.P.x, g.P.y) + ray(g.P.x, g.P.y, SHALLOW.E.x - 8, SHALLOW.E.y + 4) + eye(SHALLOW.E.x, SHALLOW.E.y, Math.atan2(g.P.y - SHALLOW.E.y, g.P.x - SHALLOW.E.x));
    s += '<circle cx="' + r1(g.P.x) + '" cy="' + SHALLOW.wy + '" r="7" fill="none" stroke="var(--bad)" stroke-width="2"/>';
    if (showImage) s += L(g.P.x, g.P.y, g.A.x, g.A.y, "var(--ink)", 2, "5 5") + foot(g.A.x, g.A.y, 0.45, "4 3") + tag(g.A.x - 2, g.A.y - 68, "眼睛以為腳在這裡");
    else s += tag(SHALLOW.F.x + 10, SHALLOW.F.y - 76, "真正的腳") + T(g.P.x - 12, SHALLOW.wy - 10, "在這裡轉彎", 13, "end", "var(--bad)", true);
    return s;
  }
  var COIN = { rimY: 86, leftX: 70, rightX: 250, botY: 176, wy: 104, coin: { x: 116, y: 172 }, E: { x: 304, y: 58 } };
  function coinGeo() {
    var g = refractPath(COIN.coin, COIN.E, COIN.wy);
    var dry = COIN.coin.y + (COIN.E.y - COIN.coin.y) * (COIN.rightX - COIN.coin.x) / (COIN.E.x - COIN.coin.x);   // 沒水時，硬幣到眼睛的直線在碗邊的高度
    var wet = g.P.y + (COIN.E.y - g.P.y) * (COIN.rightX - g.P.x) / (COIN.E.x - g.P.x);                        // 有水時，折射後那段在碗邊的高度
    return { g: g, dryAtRim: dry, wetAtRim: wet };
  }
  function coinScene() {
    var c = coinGeo(), s = box(COIN.leftX + 2, COIN.wy, COIN.rightX - COIN.leftX - 4, COIN.botY - COIN.wy, "var(--waterfill)");
    s += P('M' + COIN.leftX + ' ' + COIN.rimY + ' L' + COIN.leftX + ' ' + COIN.botY + ' L' + COIN.rightX + ' ' + COIN.botY + ' L' + COIN.rightX + ' ' + COIN.rimY, null, "var(--ink)", 4);
    s += '<ellipse cx="' + COIN.coin.x + '" cy="' + (COIN.coin.y + 1) + '" rx="12" ry="4" fill="var(--sunball)" stroke="var(--sun-deep)" stroke-width="1.5"/>';
    s += L(COIN.coin.x, COIN.coin.y, COIN.rightX, c.dryAtRim, "var(--muted)", 1.5, "3 5") + T(16, 70, "虛線：沒水時被碗邊擋住", 11, "start", "var(--muted)");
    s += ray(COIN.coin.x, COIN.coin.y, c.g.P.x, c.g.P.y) + ray(c.g.P.x, c.g.P.y, COIN.E.x - 8, COIN.E.y + 3) + eye(COIN.E.x, COIN.E.y, Math.PI * 0.9);
    s += T(160, 30, "加了水：光轉彎越過碗邊", 14, "middle", "var(--ink)", true);
    return s;
  }
  var STRAW = { cupX: 80, cupW: 170, cupY: 50, cupH: 140, wy: 96, top: { x: 66, y: 22 }, tip: { x: 206, y: 178 }, E: { x: 302, y: 30 } };
  function strawGeo() {
    var t = (STRAW.wy - STRAW.top.y) / (STRAW.tip.y - STRAW.top.y), entry = { x: STRAW.top.x + t * (STRAW.tip.x - STRAW.top.x), y: STRAW.wy };
    var g = refractPath(STRAW.tip, STRAW.E, STRAW.wy);
    return { entry: entry, g: g };
  }
  function strawScene(stage) {
    var c = strawGeo(), s = cup(STRAW.cupX, STRAW.cupY, STRAW.cupW, STRAW.cupH, STRAW.wy);
    s += L(STRAW.top.x, STRAW.top.y, c.entry.x, c.entry.y, "var(--bad)", 8);
    s += L(c.entry.x, c.entry.y, STRAW.tip.x, STRAW.tip.y, "var(--bad)", stage === 3 ? 3 : 8, "6 6", stage === 3 ? 0.35 : 0.6);
    if (stage >= 2) s += ray(STRAW.tip.x, STRAW.tip.y, c.g.P.x, c.g.P.y) + ray(c.g.P.x, c.g.P.y, STRAW.E.x - 8, STRAW.E.y + 4) + eye(STRAW.E.x, STRAW.E.y, Math.atan2(c.g.P.y - STRAW.E.y, c.g.P.x - STRAW.E.x));
    if (stage === 2) s += L(c.g.P.x, c.g.P.y, c.g.A.x, c.g.A.y, "var(--ink)", 2, "4 4") + dot(c.g.A.x, c.g.A.y, 5, "var(--bad)") + tag(c.g.A.x - 54, c.g.A.y - 12, "以為在這裡");
    if (stage === 3) s += L(c.entry.x, c.entry.y, c.g.A.x, c.g.A.y, "var(--bad)", 8) + tag(c.entry.x + 4, c.entry.y - 36, "看起來折斷了");
    if (stage === 1) s += tag(STRAW.tip.x - 30, STRAW.tip.y - 54, "真正的位置");
    return s;
  }

  /* ---------- 題號 → 小題型（2026-10-11 逐題核對；新匯入的題走 RULES，對不到就用觀念總覽圖） ---------- */
  var OF = {
    s1: "sun-path", s2: "sun-path", s5: "sun-path", k21: "sun-path", k49: "sun-path", q9: "sun-path", q29: "sun-path", q63: "sun-path",
    s3: "sh-dir", s23: "sh-dir", k24: "sh-dir", k33: "sh-dir", k41: "sh-dir", k42: "sh-dir", k52: "sh-dir", k65: "sh-dir", k69: "sh-dir", q10: "sh-dir", q28: "sh-dir", q55: "sh-dir", q59: "sh-dir",
    k25: "sh-len", q25: "sh-len", q61: "sh-len", k60: "sh-len", k70: "sh-len", q24: "sh-len", q56: "sh-len", q57: "sh-len", q58: "sh-len",
    k26: "sh-move", q62: "sh-move", k71: "sh-move", q11: "sh-move",
    k47: "fair-test",
    k5: "ss-rise", q65: "ss-rise", s43: "ss-rise", k50: "ss-rise", k53: "ss-rise", q14: "ss-rise", q15: "ss-rise", q37: "ss-rise", q50: "ss-rise", q52: "ss-rise", q67: "ss-rise", q70: "ss-rise", q72: "ss-rise",
    k43: "ss-noon", k58: "ss-noon", q16: "ss-noon", q30: "ss-noon", q33: "ss-noon", q34: "ss-noon", q35: "ss-noon", q36: "ss-noon", q48: "ss-noon", q69: "ss-noon", s41: "ss-noon", s42: "ss-noon", s45: "ss-noon",
    k22: "ss-day", q51: "ss-day", q64: "ss-day", s44: "ss-day",
    k3: "ss-trop", s40: "ss-trop", k4: "ss-trop", k32: "ss-trop", k44: "ss-trop", k48: "ss-trop", s37: "ss-trop", s38: "ss-trop", s39: "ss-trop",
    k57: "ss-window", k72: "ss-window", k73: "ss-window", k74: "ss-window", q32: "ss-window",
    s27: "lt-straight", s6: "lt-straight",
    s8: "lt-reflect", s25: "lt-reflect", k55: "lt-reflect",
    k23: "lt-bend", k30: "lt-bend", k45: "lt-bend", q5: "lt-bend", q6: "lt-bend",
    k40: "lt-shallow", q1: "lt-shallow", q2: "lt-shallow", q3: "lt-shallow", q4: "lt-shallow",
    s7: "lt-straw", k27: "lt-straw", q44: "lt-straw",
    s26: "lt-lens", k34: "lt-lens", k59: "lt-lens", q41: "lt-lens", q42: "lt-lens", q43: "lt-lens",
    s9: "lt-color", q7: "lt-color", q39: "lt-color", q40: "lt-color", q73: "lt-color",
    s12: "pl-root", k68: "pl-root", p7: "pl-root", p10: "pl-root", p36: "pl-root", p49: "pl-root", p77: "pl-root",
    s11: "pl-stem", k46: "pl-stem", k66: "pl-stem", k67: "pl-stem", p5: "pl-stem", p6: "pl-stem", p11: "pl-stem", p38: "pl-stem", p65: "pl-stem", p72: "pl-stem", p76: "pl-stem",
    s28: "pl-leaf", s30: "pl-leaf", p2: "pl-leaf", p23: "pl-leaf", p26: "pl-leaf", p28: "pl-leaf", p57: "pl-leaf", p75: "pl-leaf",
    s10: "pl-flow", k54: "pl-flow", k62: "pl-flow",
    k16: "pl-adapt", k36: "pl-adapt", k61: "pl-adapt", p39: "pl-adapt", p50: "pl-adapt", p58: "pl-adapt", p73: "pl-adapt",
    k28: "rp-flower", k75: "rp-flower", k76: "rp-flower", p21: "rp-flower", p22: "rp-flower", p29: "rp-flower",
    k6: "rp-fruit", k7: "rp-fruit", k8: "rp-fruit", k56: "rp-fruit", k77: "rp-fruit", k78: "rp-fruit", p42: "rp-fruit", p63: "rp-fruit", p74: "rp-fruit",
    k9: "rp-spread", k10: "rp-spread", k11: "rp-spread", k12: "rp-spread", k37: "rp-spread", k38: "rp-spread", p31: "rp-spread", p40: "rp-spread", p43: "rp-spread", p54: "rp-spread", p64: "rp-spread",
    s13: "rp-veg", s14: "rp-veg", s15: "rp-veg", s31: "rp-veg", s32: "rp-veg", k29: "rp-veg", k39: "rp-veg", k63: "rp-veg", p1: "rp-veg",
    p47: "rp-organ", p69: "rp-organ", p70: "rp-organ", p71: "rp-organ",
    s16: "us-part", s17: "us-part", s18: "us-part", s33: "us-part", s34: "us-part",
    k51: "us-econ", p52: "us-econ", p12: "us-econ", p13: "us-econ", p14: "us-econ", p15: "us-econ", p16: "us-econ", p51: "us-econ", p78: "us-econ", p79: "us-econ", p82: "us-econ", p83: "us-econ",
    k35: "us-bio", p18: "us-bio", p19: "us-bio", p80: "us-bio", p81: "us-bio",
    s19: "ds-stay", s22: "ds-stay", s20: "ds-fast", s35: "ds-fast", s21: "ds-limit"
  };
  // 新匯入的題（設定頁貼 JSON）：同一個觀念裡，依題目與正確答案的關鍵字對小題型；對不到就回 null（用觀念總覽圖）
  var RULES = {
    "1-1": [["fair-test", /控制變因/], ["sh-move", /移動的方向|移到|尖端/], ["sh-len", /長短|愈短|愈長|最短|最長|變長|變短/], ["sh-dir", /影子|竿影/], ["sun-path", /升起|落下|高度角|方位/]],
    "1-3": [["ss-window", /窗|屋|教室/], ["ss-trop", /回歸線上|直射|立竿不見影|緯|赤道/], ["ss-day", /白天|日出的時間|日落的時間|晝|夜/], ["ss-rise", /升起|日出|落下|路線/], ["ss-noon", /中午|高度角/]],
    "1-2": [["lt-color", /彩虹|三稜鏡|色光/], ["lt-lens", /放大鏡|透鏡/], ["lt-shallow", /池|深|腳|腿|硬幣/], ["lt-straw", /吸管|筷子/], ["lt-reflect", /反射|鏡子|潛望鏡|倒影/], ["lt-bend", /偏折|折射/], ["lt-straight", /直線|影子/]],
    "2-1": [["pl-adapt", /仙人掌|捕蠅草|毛氈苔|含羞草|石蓮/], ["pl-flow", /水分怎麼運送/], ["pl-root", /根/], ["pl-leaf", /葉|光合作用|蒸散/], ["pl-stem", /莖/]],
    "2-2": [["rp-organ", /器官/], ["rp-spread", /散播|傳播種子|漂|彈|飄/], ["rp-veg", /繁殖|新植物|芽/], ["rp-flower", /雌蕊|雄蕊|花萼|花瓣/], ["rp-fruit", /授粉|子房|胚珠|果實|種子/]],
    "2-3": [["us-bio", /魔鬼氈|仿生|不沾水/], ["us-econ", /經濟植物|品種/], ["us-part", /部位|吃/]],
    "3-1": [["ds-limit", /有限|無限|一直加/], ["ds-fast", /快/], ["ds-stay", /溶解|重量|秤/]]
  };
  function answerOf(c) { return c.type === "recall" ? (c.ans || "") : c.opts && c.opts[c.a] !== undefined ? c.opts[c.a] : ""; }
  function topicOf(card) {
    if (!card) return null;
    var id = OF[card.id];
    if (id && TOPICS[id] && TOPICS[id].cid === card.concept) return id;
    var rules = RULES[card.concept] || [], txt = (card.q || "") + " " + answerOf(card);
    for (var i = 0; i < rules.length; i++) if (rules[i][1].test(txt)) return rules[i][0];
    return null;
  }
  var api = { topics: TOPICS, of: OF, rules: RULES, topicOf: topicOf,
    geo: { refractPath: refractPath, snellOut: snellOut, riseAz: riseAz, noonAlt: noonAlt, altaz: altaz, skyTop: skyTop, coinGeo: coinGeo, strawGeo: strawGeo, lensImage: lensImage, poleScene: poleScene, SHALLOW: SHALLOW, COIN: COIN, STRAW: STRAW, CHIAYI: CHIAYI, TROPIC: TROPIC } };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.G5_STEPS = api;
})(typeof window !== "undefined" ? window : this);

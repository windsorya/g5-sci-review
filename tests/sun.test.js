// src/sun.js（NOAA 簡化公式）的替代契約（矩陣第 24 條：影子實驗室改用台中實際太陽位置）。
// 參考值＝球面天文的獨立公式：正午高度＝90°−|緯度−赤緯|；地平線日出方位＝acos(sin赤緯÷cos緯度)。
// 比較時刻：正午取 11–13 時每分鐘的最高點；日出取 sunTimes 求得的高度角過 0 那一分鐘＋1.2 分。
// 容差：夏至、冬至赤緯取 ±23.44°（當天變化 <0.01°）→ 高度 0.3°；春分 3/20、秋分 9/23 當天赤緯不是 0 → 高度 0.5°；日出方位 0.6°。
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/sun.js");
const T = { lat: 24.15, lon: 120.68, tz: 8 };
function noonAlt(d) { let best = -99; for (let h = 11; h <= 13; h += 1 / 60) best = Math.max(best, S.sunPosition(d, h, T.lat, T.lon, T.tz).alt); return best; }
function riseAz(d) { const t = S.sunTimes(d, T.lat, T.lon, T.tz); return S.sunPosition(d, t.rise + 0.02, T.lat, T.lon, T.tz).az; }
const expectAz = (dec) => Math.acos(Math.sin(dec * Math.PI / 180) / Math.cos(T.lat * Math.PI / 180)) * 180 / Math.PI;

test("夏至、冬至正午高度角與 90°−|緯度−赤緯| 相差 0.3° 內", () => {
  assert.ok(Math.abs(noonAlt(new Date(2026, 5, 21)) - (90 - Math.abs(T.lat - 23.44))) < 0.3);
  assert.ok(Math.abs(noonAlt(new Date(2026, 11, 21)) - (90 - Math.abs(T.lat + 23.44))) < 0.3);
});

test("春分、秋分正午高度角與 90°−緯度相差 0.5° 內", () => {
  assert.ok(Math.abs(noonAlt(new Date(2026, 2, 20)) - (90 - T.lat)) < 0.5);
  assert.ok(Math.abs(noonAlt(new Date(2026, 8, 23)) - (90 - T.lat)) < 0.5);
});

test("日出方位：夏至、冬至對 acos(sin赤緯÷cos緯度) 0.6° 內；春分、秋分距正東 1.0° 內", () => {
  // 春分 3/20 台中日出時（UTC 3/19 22 時）赤緯約 −0.3°，對應方位偏南約 0.3°；再加上取樣在高度角略大於 0 的那一刻，
  // 實測 90.8°。所以春秋分用 1.0°；二至點赤緯當天幾乎不變，維持 0.6°（方位整體偏 1° 的錯誤會被二至點抓到）。
  assert.ok(Math.abs(riseAz(new Date(2026, 5, 21)) - expectAz(23.44)) < 0.6);
  assert.ok(Math.abs(riseAz(new Date(2026, 11, 21)) - expectAz(-23.44)) < 0.6);
  assert.ok(Math.abs(riseAz(new Date(2026, 2, 20)) - 90) < 1.0);
  assert.ok(Math.abs(riseAz(new Date(2026, 8, 23)) - 90) < 1.0);
});

test("台中 10/11：正午約 59°、日出約 5:56、日落約 17:32（app 首頁天空與影子實驗室用的值）", () => {
  const d = new Date(2026, 9, 11), t = S.sunTimes(d, T.lat, T.lon, T.tz);
  assert.ok(Math.abs(noonAlt(d) - 59.1) < 0.5);
  assert.ok(Math.abs(t.rise - (5 + 56 / 60)) < 3 / 60 && Math.abs(t.set - (17 + 32 / 60)) < 3 / 60);
});

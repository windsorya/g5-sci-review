// src/sun.js（NOAA 簡化公式）的替代契約：台中（北緯 24.15°）正午太陽高度角與日出方位，對照「90°−緯度±赤緯」的天文關係。
// 矩陣第 24 條原本要求影子實驗室只做示意；律師版改用台中今天的實際太陽位置（畫面註明約略計算），這裡鎖住它的精度。
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/sun.js");
const T = { lat: 24.15, lon: 120.68, tz: 8 };
function noonAlt(d) { let best = -99; for (let h = 11; h <= 13; h += 1 / 60) best = Math.max(best, S.sunPosition(d, h, T.lat, T.lon, T.tz).alt); return best; }

test("夏至、冬至正午高度角與 90°−(緯度∓23.44°) 相差 0.5° 內", () => {
  assert.ok(Math.abs(noonAlt(new Date(2026, 5, 21)) - (90 - (T.lat - 23.44))) < 0.5);
  assert.ok(Math.abs(noonAlt(new Date(2026, 11, 21)) - (90 - (T.lat + 23.44))) < 0.5);
});

test("春分、秋分正午高度角與 90°−緯度相差 0.6° 內（當天赤緯不完全是 0）", () => {
  assert.ok(Math.abs(noonAlt(new Date(2026, 2, 20)) - (90 - T.lat)) < 0.6);
  assert.ok(Math.abs(noonAlt(new Date(2026, 8, 23)) - (90 - T.lat)) < 0.6);
});

test("日出方位：夏至東偏北、冬至東偏南、春秋分接近正東", () => {
  const az = (d) => { const t = S.sunTimes(d, T.lat, T.lon, T.tz); return S.sunPosition(d, t.rise + 0.02, T.lat, T.lon, T.tz).az; };
  const expect = (dec) => Math.acos(Math.sin(dec * Math.PI / 180) / Math.cos(T.lat * Math.PI / 180)) * 180 / Math.PI;
  assert.ok(Math.abs(az(new Date(2026, 5, 21)) - expect(23.44)) < 2);
  assert.ok(Math.abs(az(new Date(2026, 11, 21)) - expect(-23.44)) < 2);
  assert.ok(Math.abs(az(new Date(2026, 2, 20)) - 90) < 2);
});

test("台中 10/11：正午約 59°、日出約 5:56、日落約 17:32（app 首頁天空與影子實驗室用的值）", () => {
  const d = new Date(2026, 9, 11), t = S.sunTimes(d, T.lat, T.lon, T.tz);
  assert.ok(Math.abs(noonAlt(d) - 59.1) < 0.5);
  assert.ok(Math.abs(t.rise - (5 + 56 / 60)) < 3 / 60 && Math.abs(t.set - (17 + 32 / 60)) < 3 / 60);
});

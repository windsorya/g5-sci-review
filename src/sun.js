// 太陽位置（NOAA 簡化公式）：給日期、當地時間（小時，可帶小數）、緯度、經度、時區，
// 回傳 {alt: 高度角°, az: 方位角°（正北為 0，順時針）}。影子實驗室用台中（24.15N, 120.68E, UTC+8）。
// 精度契約（M31，不宣稱一般星曆精度）：只保證 tests/sun.test.js 的取樣點——台中夏至／春分／秋分／冬至正午高度
// 與參考值差 <0.3°／0.5°／0.5°／0.3°、日出方位差 <0.6°／1°／1°／0.6°；這對五年級的「方位＋高度角」教學足夠。日出日落用 alt=0 求。
function sunPosition(date, hour, lat, lon, tz) {
  var rad = Math.PI / 180;
  var start = Date.UTC(date.getFullYear(), 0, 1);
  var today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  var n = Math.round((today - start) / 86400000) + 1;
  var g = 2 * Math.PI / 365 * (n - 1 + (hour - 12) / 24);
  var eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  var tst = hour * 60 + eqt + 4 * lon - 60 * tz;
  var ha = (tst / 4 - 180) * rad;
  var phi = lat * rad;
  var cosZ = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  var zen = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  var az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) / rad + 180;
  return { alt: 90 - zen / rad, az: (az + 360) % 360 };
}
// 日出、日落（當地時間，小時）：以 1 分鐘步進找高度角過 0 的時刻
function sunTimes(date, lat, lon, tz) {
  var rise = null, set = null, prev = sunPosition(date, 4, lat, lon, tz).alt;
  for (var m = 4 * 60 + 1; m <= 20 * 60; m++) {
    var a = sunPosition(date, m / 60, lat, lon, tz).alt;
    if (prev <= 0 && a > 0 && rise === null) rise = m / 60;
    if (prev > 0 && a <= 0) set = m / 60;
    prev = a;
  }
  return { rise: rise, set: set };
}
if (typeof module !== "undefined") module.exports = { sunPosition: sunPosition, sunTimes: sunTimes };

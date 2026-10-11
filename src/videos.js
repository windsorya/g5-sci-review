// 答錯後「看影片，老師講一次」（2026-10-11 律師：「如果 youtube 或任何網站有影片教學，請提供幫助理解」）。
// 每一支都經過實際驗證（yt-dlp 讀 metadata、讀字幕原句、抽畫面看過），內容與小題型相符才放；沒找到合格的小題型就不放，不硬湊。
// 格式：{ 小題型: [{ id: YouTube 影片 ID, title, channel, start: 秒, end: 秒或 null, note: 這一段在講什麼 }] }
(function (root) {
  "use strict";
  var V = {};
  if (typeof module !== "undefined" && module.exports) module.exports = V; else root.G5_VIDEOS = V;
})(typeof window !== "undefined" ? window : this);

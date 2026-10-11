// 答錯後「看影片，老師講一次」（2026-10-11 律師：「如果 youtube 或任何網站有影片教學，請提供幫助理解」）。
// 每一支都經過實際驗證（yt-dlp 讀 metadata、讀字幕原句、抽畫面看過），內容與小題型相符才放；沒找到合格的小題型就不放，不硬湊。
// 格式：{ 小題型: [{ id: YouTube 影片 ID, title, channel, start: 秒, end: 秒或 null, note: 這一段在講什麼 }] }
(function (root) {
  "use strict";
  // 2026-10-11 子代理逐支驗證 46 支（yt-dlp metadata、字幕或 whisper 轉錄原句、段落內抽 3–6 格看過；全部公開、可嵌入），
  // 每個小題型取前 2 支；不用「小豬玉的每日知識」（2026-10 新頻道、合成語音量產，可信度沒把握）。長片一律帶起訖秒數，播到 end 停。
  var V = {
    "ds-fast": [
      {"id": "_Ue6kD-ynD4", "title": "看見自然EP8：影響溶解的因素", "channel": "看見系列", "start": 163, "end": 352, "note": ""}
    ],
    "ds-limit": [
      {"id": "97qRRojeh7g", "title": "小四自然", "channel": "臺北酷課雲", "start": 19, "end": 216, "note": ""},
      {"id": "spFv2wNrxPw", "title": "108新課綱", "channel": "臺北酷課雲", "start": 45, "end": 192, "note": ""}
    ],
    "ds-stay": [
      {"id": "tcIWiY-Eh8I", "title": "2025食鹽水溶液溶解前後的重量比較（磅秤精準到0.1gw）", "channel": "文湖國小胡玉瑩", "start": 44, "end": null, "note": ""},
      {"id": "2BVsO6f6_0U", "title": "16 動手做：取回水中的食鹽", "channel": "均一教育平台", "start": 0, "end": 145, "note": ""}
    ],
    "fair-test": [
      {"id": "E7Lz4nmY8-4", "title": "47 認識實驗設計方法", "channel": "均一教育平台", "start": 0, "end": null, "note": ""},
      {"id": "-uICo4NUXF0", "title": "01觀察光源高度角與影子長度的關係", "channel": "文湖國小胡玉瑩", "start": 29, "end": 215, "note": "只講到一部分"}
    ],
    "lt-bend": [
      {"id": "1GbsFBcW-HI", "title": "01光經過玻璃磚後折射", "channel": "文湖國小胡玉瑩", "start": 0, "end": 98, "note": ""},
      {"id": "y_YVLsbAcw8", "title": "68 動手做：光的折射實驗", "channel": "均一教育平台", "start": 98, "end": 150, "note": ""}
    ],
    "lt-color": [
      {"id": "7rx9gAFbT2k", "title": "72 霓與虹", "channel": "均一教育平台", "start": 13, "end": null, "note": ""},
      {"id": "kO2swEZSMzM", "title": "彩虹怎麼做 FOLLOW ME, BANG! 【下課花路米 精選】", "channel": "小公視", "start": 0, "end": 90, "note": ""}
    ],
    "lt-lens": [
      {"id": "NpV2dmA5Y_U", "title": "五上南一版太陽單元總複習(折射與能量)", "channel": "文湖國小胡玉瑩", "start": 769, "end": 866, "note": ""},
      {"id": "m4tCm_5zwgQ", "title": "04-放大鏡實驗02-實驗結果", "channel": "文湖國小胡玉瑩", "start": 28, "end": 195, "note": ""}
    ],
    "lt-reflect": [
      {"id": "xh5UqD-SEx8", "title": "67 光的反射現象", "channel": "均一教育平台", "start": 0, "end": null, "note": ""},
      {"id": "4WOZTy0Cu5g", "title": "66 補充─製作潛望鏡", "channel": "均一教育平台", "start": 12, "end": 130, "note": ""}
    ],
    "lt-shallow": [
      {"id": "Ooo-68jSaQs", "title": "【自然科學_光的世界】難道魚真的會瞬間移動嗎？", "channel": "問寶懂科學", "start": 41, "end": 120, "note": ""},
      {"id": "O7wj08OAWSc", "title": "70 動手做：硬幣魔術", "channel": "均一教育平台", "start": 0, "end": null, "note": ""}
    ],
    "lt-straight": [
      {"id": "efaO_fQFLxc", "title": "108新課綱", "channel": "臺北酷課雲", "start": 89, "end": 184, "note": ""},
      {"id": "ghBzjhSFwOQ", "title": "64 動手做：光的行進實驗", "channel": "均一教育平台", "start": 0, "end": null, "note": ""}
    ],
    "lt-straw": [
      {"id": "yVB0fWLYnRw", "title": "69 光的折射現象", "channel": "均一教育平台", "start": 28, "end": 125, "note": ""},
      {"id": "WTnCaBYxDws", "title": "09 折射應用1", "channel": "文湖國小胡玉瑩", "start": 0, "end": null, "note": ""}
    ],
    "pl-adapt": [
      {"id": "deL0CYqs9Xg", "title": "五上南一版植物單元總整理", "channel": "文湖國小胡玉瑩", "start": 760, "end": 812, "note": ""},
      {"id": "-Asdw1dW1I4", "title": "高速攝影：含羞草的觸發運動", "channel": "翰林出版", "start": 54, "end": 125, "note": ""}
    ],
    "pl-flow": [
      {"id": "deL0CYqs9Xg", "title": "五上南一版植物單元總整理", "channel": "文湖國小胡玉瑩", "start": 24, "end": 139, "note": ""}
    ],
    "pl-leaf": [
      {"id": "deL0CYqs9Xg", "title": "五上南一版植物單元總整理", "channel": "文湖國小胡玉瑩", "start": 92, "end": 139, "note": ""}
    ],
    "pl-root": [
      {"id": "deL0CYqs9Xg", "title": "五上南一版植物單元總整理", "channel": "文湖國小胡玉瑩", "start": 622, "end": 686, "note": ""},
      {"id": "EP-6Dt7SEHA", "title": "108新課綱", "channel": "臺北酷課雲", "start": 197, "end": 272, "note": "只講到一部分"}
    ],
    "pl-stem": [
      {"id": "deL0CYqs9Xg", "title": "五上南一版植物單元總整理", "channel": "文湖國小胡玉瑩", "start": 686, "end": 737, "note": ""},
      {"id": "tGLnI5L-xzo", "title": "108新課綱", "channel": "臺北酷課雲", "start": 302, "end": 400, "note": "只講到一部分"}
    ],
    "rp-flower": [
      {"id": "deL0CYqs9Xg", "title": "五上南一版植物單元總整理", "channel": "文湖國小胡玉瑩", "start": 881, "end": 917, "note": ""},
      {"id": "9uZGfPyUkb8", "title": "活動1 3 花的觀察", "channel": "翰林出版", "start": 45, "end": 98, "note": ""}
    ],
    "rp-fruit": [
      {"id": "deL0CYqs9Xg", "title": "五上南一版植物單元總整理", "channel": "文湖國小胡玉瑩", "start": 1043, "end": 1075, "note": ""},
      {"id": "DVg-mGhnEWw", "title": "小五自然", "channel": "臺北酷課雲", "start": 241, "end": 276, "note": ""}
    ],
    "rp-organ": [
      {"id": "deL0CYqs9Xg", "title": "五上南一版植物單元總整理", "channel": "文湖國小胡玉瑩", "start": 520, "end": 617, "note": ""}
    ],
    "rp-spread": [
      {"id": "DVg-mGhnEWw", "title": "小五自然", "channel": "臺北酷課雲", "start": 309, "end": 453, "note": ""},
      {"id": "sZ8h8qjyn_A", "title": "108新課綱", "channel": "臺北酷課雲", "start": 184, "end": 377, "note": "只講到一部分"}
    ],
    "rp-veg": [
      {"id": "deL0CYqs9Xg", "title": "五上南一版植物單元總整理", "channel": "文湖國小胡玉瑩", "start": 1283, "end": 1373, "note": ""},
      {"id": "wx6k_g3YEVA", "title": "縮時攝影：落地生根", "channel": "翰林出版", "start": 29, "end": 137, "note": ""}
    ],
    "sh-dir": [
      {"id": "wt-9jQWlpjs", "title": "108新課綱", "channel": "臺北酷課雲", "start": 59, "end": 135, "note": ""},
      {"id": "DvWoqmDzYvc", "title": "五上南一版太陽單元總複習(不含折射與能量)", "channel": "文湖國小胡玉瑩", "start": 11, "end": 40, "note": ""}
    ],
    "sh-len": [
      {"id": "DvWoqmDzYvc", "title": "五上南一版太陽單元總複習(不含折射與能量)", "channel": "文湖國小胡玉瑩", "start": 50, "end": 100, "note": ""},
      {"id": "-uICo4NUXF0", "title": "01觀察光源高度角與影子長度的關係", "channel": "文湖國小胡玉瑩", "start": 100, "end": 215, "note": ""}
    ],
    "sh-move": [
      {"id": "DvWoqmDzYvc", "title": "五上南一版太陽單元總複習(不含折射與能量)", "channel": "文湖國小胡玉瑩", "start": 447, "end": 535, "note": ""},
      {"id": "EjW9epMz-q8", "title": "《新科學探險隊》「光與影的時間之謎」太陽系列EP1：竿影觀測", "channel": "LIS 情境科學教材", "start": 599, "end": 664, "note": ""}
    ],
    "ss-day": [
      {"id": "vsTt5HS8b2c", "title": "晝夜交替與四季變化", "channel": "臺灣南區氣象中心", "start": 88, "end": 175, "note": ""},
      {"id": "GCijm4xycm4", "title": "四季怎麼看？太陽直射點與季節判斷教學", "channel": "晟自然玩科學", "start": 140, "end": 303, "note": ""}
    ],
    "ss-noon": [
      {"id": "DvWoqmDzYvc", "title": "五上南一版太陽單元總複習(不含折射與能量)", "channel": "文湖國小胡玉瑩", "start": 892, "end": 925, "note": ""},
      {"id": "mp69LYaeTK8", "title": "為什麼太陽不是直上直下？超直觀「太陽運行路徑」模擬，破解國小自然最難", "channel": "晟自然玩科學", "start": 10, "end": 213, "note": ""}
    ],
    "ss-rise": [
      {"id": "DvWoqmDzYvc", "title": "五上南一版太陽單元總複習(不含折射與能量)", "channel": "文湖國小胡玉瑩", "start": 1046, "end": 1180, "note": ""},
      {"id": "mp69LYaeTK8", "title": "為什麼太陽不是直上直下？超直觀「太陽運行路徑」模擬，破解國小自然最難", "channel": "晟自然玩科學", "start": 221, "end": 333, "note": ""}
    ],
    "ss-trop": [
      {"id": "vsTt5HS8b2c", "title": "晝夜交替與四季變化", "channel": "臺灣南區氣象中心", "start": 88, "end": 175, "note": ""},
      {"id": "DvWoqmDzYvc", "title": "五上南一版太陽單元總複習(不含折射與能量)", "channel": "文湖國小胡玉瑩", "start": 1183, "end": 1375, "note": ""}
    ],
    "ss-window": [
      {"id": "y5ZyUv_bWhU", "title": "夏至冬至中午太陽位置", "channel": "台南松鼠", "start": 0, "end": null, "note": "實拍冬至、夏至中午的陽光，沒有旁白講原因"}
    ],
    "sun-path": [
      {"id": "N106-kP8KBg", "title": "《新科學探險隊》「追尋太陽的考驗」太陽系列EP2：太陽高度角的觀測", "channel": "LIS 情境科學教材", "start": 154, "end": 330, "note": ""}
    ],
    "us-bio": [
      {"id": "aD5LAFFMUKk", "title": "108新課綱", "channel": "臺北酷課雲", "start": 200, "end": 317, "note": ""},
      {"id": "deL0CYqs9Xg", "title": "五上南一版植物單元總整理", "channel": "文湖國小胡玉瑩", "start": 1646, "end": 1677, "note": ""}
    ],
    "us-econ": [
      {"id": "deL0CYqs9Xg", "title": "五上南一版植物單元總整理", "channel": "文湖國小胡玉瑩", "start": 1626, "end": 1646, "note": ""},
      {"id": "GVvZntoDar0", "title": "農業改良 台灣茶葉", "channel": "僑務委員會", "start": 0, "end": 48, "note": "只講到一部分"}
    ],
    "us-part": [
      {"id": "LJYbJaUv7Ak", "title": "3 蔬菜的食用部位", "channel": "均一教育平台", "start": 40, "end": 242, "note": ""},
      {"id": "deL0CYqs9Xg", "title": "五上南一版植物單元總整理", "channel": "文湖國小胡玉瑩", "start": 539, "end": 617, "note": "只講到一部分"}
    ]
  };
  if (typeof module !== "undefined" && module.exports) module.exports = V; else root.G5_VIDEOS = V;
})(typeof window !== "undefined" ? window : this);

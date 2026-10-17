#!/opt/homebrew/opt/python@3.12/bin/python3.12
"""v3 端到端驗收：Chromium 桌機＋WebKit iPad，用 Playwright 假時鐘固定日期。

跑法：python3.12 tests/e2e_v3.py [--shots DIR] [--page v3/index.html]
涵蓋：補救三分支（第一次求助→圖解＋觀察任務→換題確認→仍錯就停本輪、標待協助）、預測前鎖實驗、
短回合≠當日完成（矩陣 8）、考考爸媽題圖（25）、寫入失敗不宣告（27）、壞存檔不覆蓋（19）、
舊資料遷移（28）、跨午夜換任務（16/17）、不碰 window.claude（18）、溶解帳本與減少動態效果（21–23）。
預設測 v3/index.html（預覽版）；換到正式網址後改 --page index.html。
"""
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PAGE = sys.argv[sys.argv.index("--page") + 1] if "--page" in sys.argv else "v3/index.html"
URL = (ROOT / PAGE).as_uri()
SHOTS = Path(sys.argv[sys.argv.index("--shots") + 1]) if "--shots" in sys.argv else None
RESULTS = []


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  ← {detail}"))


def shot(page, name):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)


def new_page(browser, when, device=None, init=None, reduced=False, **kw):
    ctx = browser.new_context(**(device or {}), reduced_motion="reduce" if reduced else "no-preference", **kw)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.clock.install(time=when)
    if init:
        page.add_init_script(init)
    page.goto(URL, wait_until="domcontentloaded")   # 外部字型（Google Fonts）慢時不拖垮測試
    page.wait_for_selector("#main")
    try:
        page.wait_for_load_state("load", timeout=15000)
    except Exception:
        pass
    return ctx, page, errors


def btn(page, name):
    return page.get_by_role("button", name=name, exact=False).first


def state(page):
    return json.loads(page.evaluate("localStorage.getItem('g5sci.v3')") or "null")


# ===== 三站共通「標準 DOM」判準（主閘）：自然站 tests/e2e_v3.py 與數學站 tests/e2e.py 這一段逐字相同 =====
# 由來：tests/standard.test.js 的②④⑤用正規表達式讀 HTML，Codex 連 3 輪找到假通過與誤判（title=' href="網址"'、
# <meta name="robots" title=" content='noindex'">、data-href／data-content、<path d="M0 0"/>、<path d="M10 10"/>、
# <rect width="0.0">、<circle r="0.0"/> 判有圖、合法 <line x1="50" y1="50" x2="0" y2="50"> 判沒圖）。
# 根因是用文字猜瀏覽器怎麼解析、怎麼畫；這裡直接問瀏覽器：a.href、meta.content 是解析後的真屬性，
# 圖用 getBBox／getBoundingClientRect／getComputedStyle／getTotalLength／isPointInFill 量「真的畫出了東西」。
# 每條判準在 std_selftest() 都有自檢：把頁面 DOM 改成報告的反例，斷言抓得到（合法線段不誤判）。
STD_SITES = {"sci": ("https://windsorya.github.io/g5-sci-review/", "五上自然複習"),
             "math": ("https://windsorya.github.io/g5-math-review/", "五上數學複習"),
             "help": ("https://windsorya.github.io/g5-help/", "難題解說"),
             "chi": ("https://windsorya.github.io/g5-chinese-review/", "五上國語複習"),
             "soc": ("https://windsorya.github.io/g5-social-review/", "五上社會複習"),
             "wrong": ("https://windsorya.github.io/g5-wrong-review/", "錯題複習")}
# ④切換列：#siteNav 恰一個；裡面每個 <a> 的 a.href（瀏覽器解析後）恰為另外兩站、看得見；恰一個 aria-current="page" 且字是本站名。
STD_NAV_JS = """() => { const navs = document.querySelectorAll('#siteNav'), nav = navs[0];
  if (navs.length !== 1) return {navs: navs.length};
  // 看得見＝有大小、visibility 是 visible，而且一路往上每一層都沒 display:none、透明度相乘 >0（Codex 審 f0422ce／b1ae271：上層 opacity:0 假通過）
  const seen = (e) => { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0) || getComputedStyle(e).visibility !== 'visible') return false;
    let op = 1; for (let n = e; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none') return false; op *= parseFloat(cs.opacity); } return op > 0; };
  const as = [...nav.querySelectorAll('a')];
  return {navs: 1, hrefs: as.map((a) => a.href), hidden: as.filter((a) => !seen(a)).map((a) => a.href || a.outerHTML.slice(0, 80)),
          current: [...nav.querySelectorAll('[aria-current="page"]')].map((e) => (seen(e) ? '' : '（看不見）') + (e.textContent || '').trim())}; }   // 每個標記都算數量；看不見的直接不等於本站名（Codex 審 4d8b1e0／f26e093：先濾掉再數，藏起來的重複標記會假通過）"""
# ⑤收錄：<head> 裡的 meta[name=robots]，用真屬性 meta.content，逗號／空白切開後有 noindex。
STD_ROBOTS_JS = """() => [...document.querySelectorAll('meta[name="robots" i]')].map((m) => ({content: m.content, inHead: !!document.head && document.head.contains(m)}))"""
# ②圖：sel 選到的每個容器（一步／一種說法）至少一張 svg[role=img]；每張都要有 aria-label（去空白後 ≥4 字）、本身看得見，
# 而且裡面至少一個繪圖元素真的畫出東西：不在 defs 等不畫的區塊、沒被 display／visibility／opacity 藏起來、getBBox 與畫面上的框
# 有大小且落在圖框內；描邊要 stroke 不是 none、寬度 >0、路徑長度 >0；填色要 fill 不是 none、寬高都 >0、內部取樣點真的在填色區。
# 蓋滿整張圖的 <rect> 是底色，不算「畫了東西」。
STD_FIG_JS = """(sel) => {
  const SKIP = 'defs,clipPath,mask,marker,pattern,symbol,linearGradient,radialGradient,filter';
  const GEO = new Set(['path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse']), AREA = new Set(['rect', 'circle', 'ellipse']);
  const num = (x) => { const v = parseFloat(x); return Number.isFinite(v) ? v : 0; };
  const noPaint = (c) => !c || c === 'none' || c === 'transparent' || /^rgba\\(.*,\\s*0(\\.0*)?\\)$/.test(c);
  const shown = (el, svg) => { let op = 1;
    for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none') return false; op *= num(cs.opacity); }   // 一路查到最外層：圖的容器被設成透明也算看不見
    return getComputedStyle(el).visibility === 'visible' && op > 0; };
  function drawn(el, svg, vb, box) {
    const tag = el.tagName.toLowerCase(), cs = getComputedStyle(el);
    if (el.closest(SKIP) || !shown(el, svg)) return '';
    let bb; try { bb = el.getBBox(); } catch (e) { return ''; }
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 || r.height > 0)) return '';
    if (r.right < box.left - 1 || r.left > box.right + 1 || r.bottom < box.top - 1 || r.top > box.bottom + 1) return '';
    if (tag === 'rect' && vb.width > 0 && vb.height > 0 && bb.x <= vb.x + vb.width * 0.02 && bb.y <= vb.y + vb.height * 0.02 &&
        bb.x + bb.width >= vb.x + vb.width * 0.98 && bb.y + bb.height >= vb.y + vb.height * 0.98) return '';
    const fillOn = !noPaint(cs.fill) && num(cs.fillOpacity) > 0, strokeOn = !noPaint(cs.stroke) && num(cs.strokeWidth) > 0 && num(cs.strokeOpacity) > 0;
    if (tag === 'text') return (el.textContent || '').trim() && bb.width > 0 && bb.height > 0 && (fillOn || strokeOn) ? 'text' : '';
    // <image>／<use> 不算：量得到寬高，量不到它真的畫了什麼——<use href="#r" fill="none" stroke="none"> 什麼都沒畫也有寬高
    // （Codex 審 g5-help 5d3cf6f2），<image> 圖檔讀不到也一樣。三站內容 0 處用到（2026-10-18 實查），畫圖一律用基本圖形或 <text>。
    if (!GEO.has(tag) || (AREA.has(tag) && !(bb.width > 0 && bb.height > 0))) return '';
    if (strokeOn && typeof el.getTotalLength === 'function' && el.getTotalLength() > 0) return tag + '描邊';
    if (fillOn && tag !== 'line' && bb.width > 0 && bb.height > 0)
      for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++)
        if (el.isPointInFill({x: bb.x + bb.width * (i + 0.5) / 9, y: bb.y + bb.height * (j + 0.5) / 9})) return tag + '填色';
    return '';
  }
  return [...document.querySelectorAll(sel)].map((c) => ({
    where: (c.innerText || c.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 30),
    figs: [...c.querySelectorAll('svg[role="img"]')].map((svg) => {
      const box = svg.getBoundingClientRect(), v = svg.viewBox && svg.viewBox.baseVal;
      const vb = v && v.width > 0 ? v : {x: 0, y: 0, width: svg.width.baseVal.value, height: svg.height.baseVal.value};
      const kinds = box.width > 0 && box.height > 0 && shown(svg, svg) ? [...svg.querySelectorAll('*')].map((el) => drawn(el, svg, vb, box)).filter(Boolean) : [];
      return {label: (svg.getAttribute('aria-label') || '').replace(/\\s/g, ''), seen: box.width > 0 && box.height > 0, n: kinds.length, kinds: [...new Set(kinds)].slice(0, 4)};
    })}));
}"""


def std_nav_problems(st, self_key):
    if not isinstance(st, dict) or st.get("navs") != 1:
        return [f"#siteNav 應恰一個，實際：{st.get('navs') if isinstance(st, dict) else st!r}"]
    want, bad = sorted(u for k, (u, _) in STD_SITES.items() if k != self_key), []
    if sorted(st["hrefs"]) != want:
        bad.append(f"siteNav 連結應恰為 {want}，瀏覽器讀到 {st['hrefs']}")
    if st["hidden"]:
        bad.append(f"siteNav 有看不見的連結：{st['hidden']}")
    if st["current"] != [STD_SITES[self_key][1]]:
        bad.append(f"siteNav 應恰一個 aria-current=\"page\" 寫「{STD_SITES[self_key][1]}」，實際：{st['current']}")
    return bad


def std_robots_ok(metas):
    return any(m.get("inHead") and "noindex" in re.split(r"[\s,]+", str(m.get("content") or "").lower()) for m in (metas or []))


def std_fig_problems(conts, min_conts=1):
    """STD_FIG_JS 的結果 → 問題清單。容器數不足、某容器沒有 svg[role=img]、某張圖缺 aria-label／看不見／沒有畫出東西都算。"""
    bad = [] if len(conts) >= min_conts else [f"只找到 {len(conts)} 個容器（至少要 {min_conts}）"]
    for i, c in enumerate(conts):
        if not c["figs"]:
            bad.append(f"第 {i + 1} 格「{c['where']}」沒有 svg[role=img]")
        for f in c["figs"]:
            if len(f["label"]) < 4 or not f["seen"] or f["n"] < 1:
                bad.append(f"第 {i + 1} 格「{c['where']}」的圖：aria-label「{f['label']}」、看得見={f['seen']}、畫出 {f['n']} 個元素")
    return bad


def std_page_check(page, label, self_key):
    """④⑤：在真頁面上量切換列與 noindex。"""
    nav = std_nav_problems(page.evaluate(STD_NAV_JS), self_key)
    check(f"{label} 標準DOM④ 切換列：a.href 恰為另外兩站、看得見、恰一個 aria-current 是本站名", not nav, nav)
    metas = page.evaluate(STD_ROBOTS_JS)
    check(f"{label} 標準DOM⑤ <head> 的 meta[name=robots] 真屬性 content 含 noindex", std_robots_ok(metas), metas)


# 自檢反例（出自 Codex 報告 g5-sci-review-4b559c4a／63b048db、g5-math-review-9545348b）：True＝判準應判「有圖」。
STD_FIG_CASES = [
    ("空圖", "", False), ("只有註解", "<!-- <rect width='10' height='10'/> -->", False), ("<path/>", "<path/>", False),
    ('<path d="M0 0"/>', '<path d="M0 0" stroke="black" stroke-width="4"/>', False),
    ('<path d="M10 10"/>', '<path d="M10 10" stroke="black" stroke-width="4"/>', False),
    ('<rect width="0.0" height="10">', '<rect x="10" y="10" width="0.0" height="10" fill="black"/>', False),
    ('<circle r="0.0"/>', '<circle cx="50" cy="50" r="0.0" fill="black" stroke="black" stroke-width="2"/>', False),
    ("只有底色（蓋滿整張的 rect）", '<rect width="100%" height="100%" fill="black"/>', False),
    ("fill、stroke 都是 none", '<rect x="10" y="10" width="50" height="50" fill="none" stroke="none"/>', False),
    ("opacity=0", '<rect x="10" y="10" width="50" height="50" fill="black" opacity="0"/>', False),
    ("只在 <defs> 裡", '<defs><rect x="10" y="10" width="50" height="50" fill="black"/></defs>', False),
    ("畫在圖框外", '<rect x="-5000" y="-5000" width="50" height="50" fill="black"/>', False),
    ("只有填色的斜直線（沒有面積）", '<path d="M10 10 L60 60" fill="black"/>', False),
    ("transform=scale(0)", '<rect x="10" y="10" width="50" height="50" fill="black" transform="scale(0)"/>', False),
    ("<use> 參照的圖形沒填色也沒描邊", '<defs><rect id="stdUseR" x="10" y="10" width="40" height="30"/></defs><use href="#stdUseR" fill="none" stroke="none"/>', False),
    ("<image> 圖檔讀不到", '<image href="data:image/png;base64,AAAA" x="10" y="10" width="40" height="30"/>', False),
    ('合法線段 <line x1="50" y1="50" x2="0" y2="50">', '<line x1="50" y1="50" x2="0" y2="50" stroke="black" stroke-width="4"/>', True),
    ("合法小方塊", '<rect x="10" y="10" width="40" height="30" fill="black"/>', True),
    ("合法圓", '<circle cx="50" cy="50" r="10" fill="black"/>', True),
    ("合法文字", '<text x="20" y="40" font-size="20" fill="black">字</text>', True),
]
STD_MUTATE_JS = """([mode, sel, html]) => {
  window.__stdSaved = window.__stdSaved || {};
  if (mode === 'fig') { const svg = document.querySelector(sel); window.__stdSaved.fig = [svg, svg.innerHTML, svg.getAttribute('aria-label')];
    if (html === null) svg.removeAttribute('aria-label'); else svg.innerHTML = html; return; }
  if (mode === 'figback') { const [svg, inner, lab] = window.__stdSaved.fig; svg.innerHTML = inner; svg.setAttribute('aria-label', lab); return; }
  if (mode === 'nav') { const nav = document.getElementById('siteNav'); window.__stdSaved.nav = nav.innerHTML; (new Function('nav', html))(nav); return; }
  if (mode === 'navback') { const nv = document.getElementById('siteNav'); nv.style.opacity = ''; if (nv.parentElement) nv.parentElement.style.opacity = '';
    nv.innerHTML = window.__stdSaved.nav; document.querySelectorAll('[data-std-extra]').forEach((e) => e.remove()); return; }
  if (mode === 'robots') { const ms = [...document.querySelectorAll('meta[name="robots" i]')]; window.__stdSaved.robots = ms.map((m) => m.cloneNode());
    ms.forEach((m) => m.remove());
    if (html.startsWith('<!--')) window.__stdSaved.cmt = document.head.appendChild(document.createComment(html.slice(4, -3)));
    else document.head.insertAdjacentHTML('beforeend', html.replace('<meta', '<meta data-std-extra'));
    return; }
  if (mode === 'robotsback') { document.querySelectorAll('meta[data-std-extra]').forEach((e) => e.remove());
    if (window.__stdSaved.cmt) { window.__stdSaved.cmt.remove(); window.__stdSaved.cmt = null; }
    window.__stdSaved.robots.forEach((m) => document.head.appendChild(m)); return; }
}"""


def std_selftest(page, label, self_key, fig_sel):
    """自檢：在真頁面上把 DOM 改成報告的反例，斷言主閘判準抓得到；改完立刻復原。fig_sel＝要拿來改的那張 svg（第一張），其容器也要給。"""
    svg_sel, cont_sel = fig_sel
    # ②
    wrong = []
    for name, html, want in STD_FIG_CASES + [("拿掉 aria-label", None, False)]:
        page.evaluate(STD_MUTATE_JS, ["fig", svg_sel, html])
        got = not std_fig_problems(page.evaluate(STD_FIG_JS, cont_sel)[:1])
        page.evaluate(STD_MUTATE_JS, ["figback", svg_sel, ""])
        if got != want:
            wrong.append(f"{name}：應判{'有' if want else '沒有'}圖，判成{'有' if got else '沒有'}")
    check(f"{label} 標準DOM自檢② {len(STD_FIG_CASES) + 1} 個圖的反例／正例都判對（含 <path d=\"M0 0\"/>、<rect width=\"0.0\">、<circle r=\"0.0\"/>、合法 <line x2=\"0\">）", not wrong, wrong)
    # 圖的容器（例如 .sfig）設成透明：圖本身完好也要判看不見（Codex 審 f0422ce／b1ae271）
    page.evaluate("(sel) => { const s = document.querySelector(sel + ' svg[role=img]'); s.parentElement.dataset.stdOp = s.parentElement.style.opacity; s.parentElement.style.opacity = '0'; }", cont_sel)
    outer_hidden = bool(std_fig_problems(page.evaluate(STD_FIG_JS, cont_sel)[:1]))
    page.evaluate("(sel) => { const s = document.querySelector(sel + ' svg[role=img]'); s.parentElement.style.opacity = s.parentElement.dataset.stdOp || ''; }", cont_sel)
    check(f"{label} 標準DOM自檢② 圖的外層透明要判成看不見", outer_hidden)
    check(f"{label} 標準DOM自檢② 改完復原後真圖仍判有圖", not std_fig_problems(page.evaluate(STD_FIG_JS, cont_sel)[:1]))
    # ④（JS 片段：參數 nav＝#siteNav 元素）
    other = [u for k, (u, _) in STD_SITES.items() if k != self_key]
    nav_cases = [
        ("href 移進 title（title=' href=\"網址\"'）", "nav.querySelectorAll('a').forEach((a) => { a.setAttribute('title', ' href=\"' + a.getAttribute('href') + '\"'); a.removeAttribute('href'); });"),
        ("href 改成 data-href", "nav.querySelectorAll('a').forEach((a) => { a.setAttribute('data-href', a.getAttribute('href')); a.removeAttribute('href'); });"),
        ("一個連結改指本站", f"nav.querySelector('a').setAttribute('href', {json.dumps(STD_SITES[self_key][0])});"),
        ("移除兩個 <a>、網址留在別處", "nav.querySelectorAll('a').forEach((a) => a.remove()); const s = document.createElement('script'); s.type = 'text/plain'; s.dataset.stdExtra = 1; s.textContent = " + json.dumps(" ".join(other)) + "; document.body.appendChild(s);"),
        ("連結藏起來（display:none）", "nav.querySelectorAll('a').forEach((a) => { a.style.display = 'none'; });"),
        ("連結透明（opacity:0）", "nav.querySelectorAll('a').forEach((a) => { a.style.opacity = '0'; });"),
        ("整個切換列的外層透明", "nav.parentElement.style.opacity = '0';"),
        ("本站標記藏起來（display:none）", "nav.querySelector('[aria-current]').style.display = 'none';"),
        ("多一個藏起來的本站標記", "const x = document.createElement('span'); x.setAttribute('aria-current', 'page'); x.hidden = true; x.textContent = '重複'; nav.appendChild(x);"),
        ("拿掉 aria-current", "nav.querySelectorAll('[aria-current]').forEach((e) => e.removeAttribute('aria-current'));"),
        ("aria-current 字不是本站名", "nav.querySelector('[aria-current]').textContent = '別站';"),
        ("多一個 #siteNav", "const d = nav.cloneNode(true); d.dataset.stdExtra = 1; document.body.appendChild(d);"),
        ("相對網址 href=\"g5-help/\"（解析後不是那個站）", "nav.querySelector('a').setAttribute('href', 'g5-help/');"),
    ]
    wrong = []
    for name, js in nav_cases:
        page.evaluate(STD_MUTATE_JS, ["nav", "", js])
        if not std_nav_problems(page.evaluate(STD_NAV_JS), self_key):
            wrong.append(name)
        page.evaluate(STD_MUTATE_JS, ["navback", "", ""])
    check(f"{label} 標準DOM自檢④ {len(nav_cases)} 個切換列反例都抓得到", not wrong, wrong)
    check(f"{label} 標準DOM自檢④ 復原後真切換列通過", not std_nav_problems(page.evaluate(STD_NAV_JS), self_key))
    # ⑤
    rb_cases = [
        ("<meta name=\"robots\" title=\" content='noindex'\">", "<meta name=\"robots\" title=\" content='noindex'\">", False),
        ("<meta name=\"robots\" data-content=\"noindex\">", '<meta name="robots" data-content="noindex,nofollow">', False),
        ("robots meta 包在註解裡", '<!--<meta name="robots" content="noindex,nofollow">-->', False),
        ("content=\"index,follow\"", '<meta name="robots" content="index,follow">', False),
        ("content=\"noindexer\"（不是 noindex 這個字）", '<meta name="robots" content="noindexer">', False),
        ("合法：大寫 NAME=ROBOTS CONTENT=NOINDEX", '<meta name="ROBOTS" content="NOINDEX, NOFOLLOW">', True),
    ]
    wrong = []
    for name, html, want in rb_cases:
        page.evaluate(STD_MUTATE_JS, ["robots", "", html])
        got = std_robots_ok(page.evaluate(STD_ROBOTS_JS))
        page.evaluate(STD_MUTATE_JS, ["robotsback", "", ""])
        if got != want:
            wrong.append(f"{name}：應判{want}，判成{got}")
    check(f"{label} 標準DOM自檢⑤ {len(rb_cases)} 個 robots meta 反例／正例都判對", not wrong, wrong)
    check(f"{label} 標準DOM自檢⑤ 復原後真 meta 通過", std_robots_ok(page.evaluate(STD_ROBOTS_JS)))
# ===== 共通「標準 DOM」判準到此 =====


def flow_standard_dom(browser):
    """三站共通標準的主閘（真瀏覽器 DOM，Chromium 390 寬）：④切換列 ⑤noindex ②每步有圖，每條附自檢（std_selftest）。
    tests/standard.test.js 的②④⑤靜態判準只是輔助。預覽版（--page，預設 v3/index.html）與 index.html 兩份都量。
    ②走過：真畫面答錯→「還不懂這個觀念」的 4 格圖解（並核對畫面上的圖＝G5_STEPS 的 fig() 輸出）、
    每個小題型的每一步（把 G5_STEPS 的 fig() 放進頁面、用本站 CSS 畫）、打開單元 3 後每個觀念頁的兩種說法（真畫面點）。"""
    dev = {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True}
    for pg_path in dict.fromkeys([PAGE, "index.html"]):
        tag = f"chromium390[{pg_path}]"
        ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00", dev)
        if pg_path != PAGE:
            page.goto((ROOT / pg_path).as_uri(), wait_until="domcontentloaded"); page.wait_for_selector("#main")
        std_page_check(page, tag, "sci")
        # ② 真畫面的補救圖解
        btn(page, "開始今天的練習").click(); btn(page, "東邊升起、西邊落下").click(); btn(page, "下一題").click()
        btn(page, "清晨").click(); btn(page, "還不懂這個觀念").click()
        ui = std_fig_problems(page.evaluate(STD_FIG_JS, "#remedy li.step"), 4)
        same = page.evaluate("""() => { const a = [...document.querySelectorAll('#remedy li.step svg[role="img"]')].map((s) => s.outerHTML);
          const t = document.createElement('div'); t.innerHTML = G5_STEPS.topics['sun-path'].steps.map((s) => s.fig()).join('');
          const b = [...t.querySelectorAll('svg[role="img"]')].map((s) => s.outerHTML); return a.length > 0 && JSON.stringify(a) === JSON.stringify(b); }""")
        check(f"{tag} 標準DOM② 真畫面答錯補救（sun-path）每格都有看得見、畫出東西的圖，且就是 G5_STEPS 的 fig() 輸出", not ui and same, ui or "畫面上的圖和 fig() 不同")
        # ② 每個小題型的每一步
        n = page.evaluate("""() => { const d = document.createElement('div'); d.id = 'stdProbe'; d.className = 'remedy';
          d.innerHTML = Object.keys(G5_STEPS.topics).map((tp) => '<ol class="steps">' + G5_STEPS.topics[tp].steps.map((s, i) =>
            '<li class="step"><div class="sfig">' + s.fig() + '</div><div class="say"><b class="n">' + tp + ' 第 ' + (i + 1) + ' 步</b></div></li>').join('') + '</ol>').join('');
          document.querySelector('#main').appendChild(d); return [Object.keys(G5_STEPS.topics).length, d.querySelectorAll('li.step').length]; }""")
        bad = std_fig_problems(page.evaluate(STD_FIG_JS, "#stdProbe li.step"), max(1, n[1]))
        check(f"{tag} 標準DOM② {n[0]} 個小題型共 {n[1]} 步，每一步都有看得見、畫出東西的圖", n[0] > 0 and not bad, bad)
        std_selftest(page, tag, "sci", ('#stdProbe li.step svg[role="img"]', "#stdProbe li.step"))
        page.evaluate("document.getElementById('stdProbe').remove()")
        # ② 觀念頁兩種說法（單元 3 預設關，打開才點得進去）
        page.reload(); page.wait_for_selector("#concepts .ccard")
        page.locator("#setBox summary").click(); page.locator("#u3").check()
        cids = page.evaluate("[...document.querySelectorAll('#concepts .ccard')].map((b) => b.dataset.cid)")
        bad, seen = [], 0
        for cid in cids:
            page.locator(f'#concepts .ccard[data-cid="{cid}"]').click(); page.wait_for_selector("#main .remedy")
            for way in (1, 2):
                if way == 2:
                    page.locator("#cMore").click()
                bad += [f"{cid} 第 {way} 種說法：{p}" for p in std_fig_problems(page.evaluate(STD_FIG_JS, "#main .remedy"), 1)]
                seen += 1
            page.locator("#cBack").click(); page.wait_for_selector("#concepts .ccard")
        off = page.locator("#concepts .ccard.off").count()
        check(f"{tag} 標準DOM② {len(cids)} 個觀念頁 × 兩種說法（{seen} 張）都有看得見、畫出東西的圖", cids and not off and not bad, bad or f"還有 {off} 個觀念沒開放")
        check(f"{tag} 標準DOM 沒有 JS 錯誤", not errors, errors)
        ctx.close()


def flow_remedy(browser, label, device=None):
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00", device)
    check(f"{label} 首頁今天要練 10 張", "今天要練 10 張" in page.inner_text("#main"), page.inner_text("#main")[:120])
    shot(page, f"{label}_01_home")
    check(f"{label} 六站切換列（#1333＋#1351＋錯題複習）：六項、目前站是「五上自然複習」", page.locator("#siteNav a, #siteNav [aria-current]").count() == 6 and page.locator('#siteNav [aria-current="page"]').inner_text() == "五上自然複習")
    btn(page, "開始今天的練習").click()
    check(f"{label} 第一題 1 / 10", "1 / 10" in page.inner_text("#main"))
    btn(page, "東邊升起、西邊落下").click()
    check(f"{label} 答對回饋", "答對了" in page.inner_text("#ansBox"))
    btn(page, "下一題").click()
    btn(page, "清晨").click()
    check(f"{label} 答錯顯示正解", "正確答案是「中午前後」" in page.inner_text("#ansBox"))
    shot(page, f"{label}_02_wrong")
    btn(page, "還不懂這個觀念").click()
    txt = page.inner_text("#remedy")
    # 2026-10-11 律師：答錯後的解說要白話、圖多、有影片——第一次求助＝這一題所屬小題型的逐格圖解（s2→太陽一天怎麼走）
    check(f"{label} 第一次求助＝小題型逐格圖解＋回到這一題＋觀察任務", "一步一步看：太陽一天怎麼走？" in txt and "回到這一題" in txt and "一句話記住" in txt and "觀察任務" in txt and "上次" not in txt, txt[:120])
    check(f"{label} 一起弄懂＋給爸媽追問（不直接報答案）", "一起弄懂" in txt and "給爸媽" in txt and "不直接報答案" in txt, txt[:200])
    check(f"{label} 圖解有 4 格圖、每格有編號和一句話", page.locator("#remedy .step svg.fig").count() == 4 and page.locator("#remedy .step .n").count() == 4, page.locator("#remedy svg.fig").count())
    check(f"{label} 有影片區（看影片，聽老師講一次）", "看影片，聽老師講一次" in txt and page.locator("#remedy button[data-play]").count() >= 1, txt[-300:])
    page.locator("#remedy button[data-play]").first.click()
    src = page.locator("#remedy .vframe iframe").first.get_attribute("src") or ""
    check(f"{label} 按影片才在原地插入播放器，帶起訖秒數（sun-path：LIS 154–330 秒）", "youtube-nocookie.com/embed/N106-kP8KBg" in src and "start=154" in src and "end=330" in src, src)
    rp = page.locator("#remedy .vframe iframe").first.get_attribute("referrerpolicy")
    check(f"{label} 播放器帶來源網址（沒有會出現 YouTube 錯誤 153）", rp == "strict-origin-when-cross-origin", rp)
    shot(page, f"{label}_03_remedy")
    btn(page, "做觀察任務，再換一題確認").click()
    check(f"{label} 預測前實驗區隱藏", page.locator("#labBody").is_hidden())
    check(f"{label} 預測前不能完成", page.locator("#labDone").is_disabled())
    shot(page, f"{label}_04_lab_predict")
    page.locator("#labPredict button[data-g='0']").click()
    check(f"{label} 預測後實驗區打開", page.locator("#labBody").is_visible())
    for t in ("8", "12", "16"):
        page.evaluate("v => { const r = document.querySelector('#shT'); r.value = v; r.dispatchEvent(new Event('input')); }", t)
    check(f"{label} 三個任務完成", page.locator("#labTask .ck.got").count() == 3, page.inner_text("#labTask"))
    ro = page.inner_text("#shRo")
    # 台中 10/11 16:00 實算：方位約 250°、高度約 20°（src/sun.js，NOAA 簡化公式）；八方位取整＝西、影子＝東
    check(f"{label} 影子實驗用真實太陽（下午 4 點太陽在西、影子朝東、很長）", "太陽在西方" in ro and "影子朝東方" in ro and "很長" in ro and "約 20°" in ro, ro)
    shot(page, f"{label}_05_lab_done")
    btn(page, "我看懂了，換一題確認").click()
    main = page.inner_text("#main")
    check(f"{label} 換題確認＝同觀念變式", "同觀念換一題確認" in main and "太陽從哪個方向升起" in main, main[:120])
    btn(page, "西邊升起、東邊落下").click()
    main = page.inner_text("#main")
    check(f"{label} 變式仍錯＝停本輪", "這一輪先停在這裡" in main and "東邊升起、西邊落下" in main, main[:160])
    check(f"{label} 標待協助", "需要爸媽陪著看的觀念：太陽與影子" in page.inner_text("#banners"))
    shot(page, f"{label}_06_halted")
    page.locator(".ccard[data-cid='1-1']").click()
    cm = page.inner_text("#main")
    check(f"{label} 待協助的觀念頁先請爸媽陪著看、不給先練", "先和爸媽一起看圖解" in cm and "先練這個觀念" not in cm and "練這個觀念的全部" not in cm, cm[:160])
    btn(page, "回首頁").click()
    page.locator("#parentBox summary").click()
    summ = page.inner_text("#summary")
    check(f"{label} 家長摘要三數", "2 / 10" in summ and "出口題待辦" in summ and "還沒" in summ and "需要爸媽陪著看" in summ, summ[:200])
    shot(page, f"{label}_07_parent")
    s = state(page)
    check(f"{label} 求助與實驗不增加掌握度", s["cards"]["s2"]["goodDays"] == [] and s["cards"]["s1"]["goodDays"] == [], json.dumps(s["cards"]))
    page.reload(); page.wait_for_selector("#main")
    main = page.inner_text("#main")
    check(f"{label} 重載後進度還在", "今天還有 8 張" in main, main[:120])
    btn(page, "開始今天的練習").click()
    head = page.inner_text("#main .qhead")
    check(f"{label} 新一輪把卡住的觀念排到最後", "太陽在天空中的位置變化" not in head, head)
    check(f"{label} 沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_second_help(browser):
    ctx, page, errors = new_page(browser, "2026-10-12T19:00:00+08:00",
                                 init="""if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');
      localStorage.setItem('g5sci.v3', JSON.stringify({v:3,cards:{s1:{seen:1,goodDays:['2026-10-11'],blockedDay:null,due:'2026-10-12'}},
        exits:{'1-1':{status:'pending',due:'2026-10-12',opened:'2026-10-11',last:null}},days:{},labRuns:{},session:null,log:[],ops:[],
        help:{'1-1':{count:1,last:'2026-10-11',way:0,needsHelp:false}},extra:[],settings:{unit3:false,sound:false}}));}""")
    btn(page, "開始今天的練習").click()
    btn(page, "南邊升起、北邊落下").click()
    btn(page, "還不懂這個觀念").click()
    txt = page.inner_text("#remedy")
    check("再次求助＝帶出前次紀錄、換說法", "上次 10/11" in txt and "手電筒照鉛筆" in txt, txt[:120])
    check("再次求助先請她指出卡在哪", "哪一步想不通" in txt, txt[:160])
    check("再次求助沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_review(browser, device=None):
    ctx, page, errors = new_page(browser, "2026-10-11T20:30:00+08:00", device)
    main = page.inner_text("#main")
    check("首頁有小考複習兩個單元、溶解未開放不出現", "第一單元 太陽與光" in main and "第二單元 植物世界" in main and "第三單元" not in main, main[-200:])
    n1 = int(main.split("第一單元 太陽與光（")[1].split(" 題")[0])
    check("重複題只留一題：第一單元 108 題、含安親班卷 59 題；被併掉的 q8 不在題庫", n1 == 108 and "含安親班卷 59 題" in main and page.evaluate("!!(window.G5_MERGED && G5_MERGED.q8)") is True, main[-300:])
    page.locator("button[data-rv='u1']").click()
    m = page.inner_text("#main")
    check("小考複習一段＝20 題（不是從第 1 題排到最後一題）", "小考複習" in m and "1 / 20" in m, m[:160])
    btn(page, "東邊升起、西邊落下").click()
    s = state(page)
    check("複習作答照規則記分、不改今天計畫", s["session"]["kind"] == "review" and s["cards"]["s1"]["goodDays"] == ["2026-10-11"] and len(s["days"]["2026-10-11"]["planIds"]) == 10, json.dumps(s["session"])[:200])
    shot(page, "review_round")
    btn(page, "下一題").click()
    page.evaluate("document.dispatchEvent(new Event('visibilitychange')); 0")
    page.reload(); page.wait_for_selector("#main")
    home = page.inner_text("#main")
    # R1／M20（4agent 2026-10-11）：小考複習做到一半，首頁仍要有「開始今天的練習」，複習另有續接鈕
    check("小考複習中首頁仍有「開始今天的練習」（M20）", "開始今天的練習" in home and "繼續小考複習（還有" in home and "繼續這一輪" not in home, home[:240])
    check("小考複習中首頁仍顯示今天要練幾張", "今天還有" in home or "今天要練" in home, home[:120])
    check("首頁顯示練過幾題（隔天接著練，不會從頭來）", "練過 1／108 題" in home, home[-400:])
    btn(page, "開始今天的練習").click()
    check("從首頁開今天的練習＝計畫回合", state(page)["session"]["kind"] == "plan" and "小考複習" not in page.inner_text("#main")[:40], json.dumps(state(page)["session"])[:160])
    page.reload(); page.wait_for_selector("#main")
    home = page.inner_text("#main")
    check("首頁有安親班複習卷兩組", "安親班複習卷：太陽與光" in home and "安親班複習卷：植物世界" in home, home[-260:])
    n2 = int(home.split("安親班複習卷：植物世界（")[1].split(" 題")[0])
    page.locator("button[data-rvall='a2']").click()
    m = page.inner_text("#main")
    check("安親班卷一次做完全部＝整份植物世界（重複題只留一題）", f"1 / {n2}" in m and n2 == 69, m[:160])
    # 測試自己用公開的題庫檔＋合併表重算一次「安親班卷」的範圍，當獨立對照
    ok_set = page.evaluate("""(() => { const M = window.G5_MERGED, X = window.G5_EXTRA_CARDS, ok = new Set();
      X.forEach(c => { if (c.set !== 'anqin') return; if (M[c.id]) M[c.id].keep.forEach(k => ok.add(k)); else ok.add(c.id); });
      const s = JSON.parse(localStorage.getItem('g5sci.v3')).session; return s.queue.length > 0 && s.queue.every(id => ok.has(id)); })()""")
    check("安親班卷回合只出安親班卷的題（或代表被併掉那題的題）", ok_set is True)
    check("小考複習沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_review_segments(browser):
    """2026-10-11 律師：「每段 20 題、跨天接續——如果當天時間夠，想要全部做完，可以嗎？」一段做完可以馬上再練一段，不重複已答對的題。"""
    ctx, page, errors = new_page(browser, "2026-10-11T20:30:00+08:00")
    page.locator("button[data-rv='a1']").click()
    first = state(page)["session"]["queue"][:]
    check("安親班卷：太陽與光 一段 20 題", len(first) == 20, len(first))
    for _ in range(20):
        page.locator("#main .opt").nth(0).click() if page.locator("#main .opt").count() else btn(page, "想好了，看答案").click()
        if page.locator("#selfGrade").count():
            page.locator("#selfGrade button").first.click()
        if page.locator("#errq").count():
            page.locator("#errq button[data-k='']").click()
        if page.locator("#next").count():
            page.locator("#next").click()
        else:
            break
    main = page.inner_text("#main")
    check("一段做完：結束畫面有「再練一段」，並說還有幾題沒練過", "再練一段" in main and "還有" in main and "題沒練過" in main, main[:300])
    shot(page, "review_segment_end")
    page.locator("#goSeg").click()
    second = state(page)["session"]["queue"][:]
    right = [e["card"] for e in state(page)["log"] if e["ok"]]
    check("再練一段：沒有重複已經答對的題", not (set(second) & set(right)) and len(second) == 20, (len(set(second) & set(right)), len(second)))
    check("分段流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_comeback(browser):
    ctx, page, errors = new_page(browser, "2026-10-12T19:00:00+08:00",
                                 init="""if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');
      localStorage.setItem('g5sci.v3', JSON.stringify({v:3,cards:{s1:{seen:1,goodDays:[],blockedDay:'2026-10-11',due:'2026-10-12'}},
        exits:{'1-1':{status:'pending',due:'2026-10-12',opened:'2026-10-11',last:null}},days:{},labRuns:{},session:null,
        log:[{op:'x1',d:'2026-10-11',card:'s1',c:'1-1',ok:false,hint:false,unsure:false,variation:false,first:true}],ops:['x1'],
        help:{},extra:[],settings:{unit3:false,sound:false}}));}""")
    btn(page, "開始今天的練習").click()
    btn(page, "東邊升起、西邊落下").click()
    check("上次卡住、這次獨立答對有專屬回饋", "上次卡住的這題，這次你自己答對了" in page.inner_text("#ansBox"), page.inner_text("#ansBox")[:120])
    check("回饋流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_short_round_and_teach(browser, device):
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00", device,
                                 init="Math.random = () => 0.99;")
    btn(page, "只做 3 張").click()
    btn(page, "東邊升起、西邊落下").click(); btn(page, "下一題").click()
    btn(page, "中午前後").click(); btn(page, "下一題").click()
    btn(page, "西邊").click(); btn(page, "下一題").click()
    main = page.inner_text("#main")
    check("短回合完成≠當日完成（矩陣 8）", "這一輪完成了" in main and "3 / 10" in main and "今天的卡片都做完了" not in main, main[:200])
    btn(page, "考考爸媽").click()
    figs = page.locator("#main svg[data-fig]")
    vis = [f for f in figs.all() if f.is_visible()]
    box = vis[0].bounding_box() if vis else None
    check("考考爸媽題圖 1 張且有尺寸（矩陣 25）", len(vis) == 1 and box and box["width"] > 0 and box["height"] > 0, f"{len(vis)} {box}")
    check("考考爸媽題圖就是抽中的 s3（sun-am）", bool(vis) and vis[0].get_attribute("data-fig") == "sun-am", vis[0].get_attribute("data-fig") if vis else None)
    marks = [m for m in page.locator("#main .ans-mark").all() if m.is_visible()]
    check("揭答前沒有答案影子標註", len(marks) == 0)
    shot(page, "ipad768_teach")
    check("短回合／考考爸媽沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_save_fail(browser):
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00")
    btn(page, "開始今天的練習").click()
    page.evaluate("window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); }; 0")
    btn(page, "東邊升起、西邊落下").click()
    box = page.inner_text("#ansBox")
    check("寫入失敗不宣告答對（矩陣 27）", "還沒存到" in box and "答對了" not in box, box)
    page.evaluate("Storage.prototype.setItem = window.__realSet; 0")
    btn(page, "再存一次").first.click()
    check("恢復後重試才公布", "答對了" in page.inner_text("#ansBox"))
    s = state(page)
    check("重試只算一次", s["cards"]["s1"]["seen"] == 1, s["cards"].get("s1"))
    check("寫入失敗流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_save_fail_then_tick(browser):
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00")
    btn(page, "開始今天的練習").click()
    page.evaluate("window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); }; 0")
    btn(page, "東邊升起、西邊落下").click()
    page.evaluate("Storage.prototype.setItem = window.__realSet; 0")
    page.evaluate("document.dispatchEvent(new Event('visibilitychange')); 0")   # 切回頁面：tick 先補寫待重試的答案
    page.locator("#saveAgain").click()
    check("存檔失敗→切回頁面→再存一次：仍顯示這一題的回饋（以操作 ID 判斷）", "答對了" in page.inner_text("#ansBox"), page.inner_text("#ansBox")[:120])
    s = state(page)
    check("該答案只寫入一次", s["cards"]["s1"]["seen"] == 1 and s["ops"].count(s["log"][0]["op"]) == 1, s["cards"].get("s1"))
    check("切回頁面流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_redo_after_external_clear(browser):
    """Codex 審 4d8b1e0：做完含答錯題的一輪 → 存檔被別處清掉 → 切回頁面（只重畫側欄，結束畫面還在）→ 按「再練答錯的」，
    舊版 V().session.wrong 讀 null 拋 TypeError、按鈕沒反應。"""
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00", init="Math.random = () => 0.99;")
    btn(page, "只做 3 張").click()
    btn(page, "東邊升起、西邊落下").click(); btn(page, "下一題").click()
    btn(page, "清晨").click(); btn(page, "知道但選錯了").click(); btn(page, "下一題").click()
    btn(page, "西邊").click(); btn(page, "下一題").click()
    check("清檔前：一輪結束畫面有「再練答錯的 1 張」", "再練答錯的 1 張" in page.inner_text("#main"), page.inner_text("#main")[:160])
    page.evaluate("localStorage.removeItem('g5sci.v3'); document.dispatchEvent(new Event('visibilitychange')); 0")
    page.locator("#goRedo").click()
    check("存檔被別處清掉後按舊畫面的「再練答錯的」：不拋錯、回到首頁", not errors and page.get_by_role("button", name="開始今天的練習").count() == 1,
          errors or page.inner_text("#main")[:160])
    ctx.close()


def flow_lab_after_external_clear(browser):
    """Codex 審 g5-chinese-review c28888ed（#1541，四站同型）：實驗做到一半存檔被別處清掉（別的分頁清除、同步換檔）→ 切回頁面
    → 再按實驗頁的按鈕，核心回 NO_RUN；舊版留在實驗頁、按了沒反應也沒有任何提示。新版照磁碟現況回首頁。
    光的實驗按「擋住」會先 check 再重畫：驗回首頁不會因為接著重畫已不在的畫面而拋錯。另驗正常完成仍到「實驗完成」。"""
    clear = "localStorage.removeItem('g5sci.v3'); document.dispatchEvent(new Event('visibilitychange')); 0"
    when = "2026-10-11T19:00:00+08:00"

    def open_lab(page, cid):
        page.locator(f".ccard[data-cid='{cid}']").click(); page.locator("#cLab").click()
        page.wait_for_selector("#labPredict button[data-g]")

    def open_lab_wrong(page, _cid):   # 答錯後補救進來（完成鈕是「我看懂了，換一題確認」）
        btn(page, "只做 3 張").click()
        btn(page, "東邊升起、西邊落下").click(); btn(page, "下一題").click()
        btn(page, "清晨").click(); btn(page, "還不懂這個觀念").click()
        btn(page, "做觀察任務，再換一題確認").click(); page.wait_for_selector("#labPredict button[data-g]")

    def predict(page):
        page.locator("#labPredict button[data-g='0']").click()

    def shadow_all(page):
        predict(page)
        for t in ("8", "12", "16"):
            page.evaluate("v => { const r = document.querySelector('#shT'); r.value = v; r.dispatchEvent(new Event('input')); }", t)

    ctx, page, errors = new_page(browser, when)
    open_lab(page, "1-1"); shadow_all(page); page.locator("#labDone").click()
    check("實驗（觀念頁進來）：正常完成到「實驗完成」", "實驗完成" in page.inner_text("#main"), page.inner_text("#main")[:120])
    ctx.close()
    bg = "localStorage.removeItem('g5sci.v3'); 0"   # 沒切換頁面（同步在背景換檔）：記憶體還有這次實驗，存檔時核心才回 NO_RUN
    for name, cid, opener, before, js, press in [("三個任務做完後按「完成實驗」", "1-1", open_lab, shadow_all, clear, "#labDone"),
                                                 ("（答錯補救進來）任務做完後按「我看懂了，換一題確認」", "1-1", open_lab_wrong, shadow_all, clear, "#labDone"),
                                                 ("光的實驗猜完後按「擋住」（任務後面接著重畫）", "1-2", open_lab, predict, clear, "#lgB"),
                                                 ("（沒切換頁面）光的實驗猜完後按「擋住」", "1-2", open_lab, predict, bg, "#lgB"),
                                                 ("還沒猜就點猜測選項", "1-1", open_lab, lambda p: None, clear, "#labPredict button[data-g] >> nth=0")]:
        ctx, page, errors = new_page(browser, when, init="Math.random = () => 0.99;")
        opener(page, cid); before(page)
        page.evaluate(js); page.locator(press).click()
        try:   # 回首頁排在這次事件跑完之後
            page.get_by_role("button", name="開始今天的練習").wait_for(timeout=3000)
        except Exception:
            pass
        page.wait_for_timeout(300)   # 動畫若沒停、重畫打到已不在的畫面，錯誤會在這段時間出現
        check(f"實驗中存檔被別處清掉後{name}：回到首頁、沒有 JS 錯誤",
              not errors and page.locator("#labNav").count() == 0 and page.get_by_role("button", name="開始今天的練習").count() == 1,
              errors or page.inner_text("#main")[:120])
        ctx.close()
    # 社會站 Codex 審 e195ef98 第 3 項後半（#1542，四站同型 #2231）：實驗任務存檔失敗（留下待存）→ 恢復 → 存檔被別處清掉 → 按「再存一次」。
    # 舊版核心回 NO_RUN 但留著待存、狀態仍 failed：按了沒反應、提示列一直在。應該：回首頁、提示列消失。
    ctx, page, errors = new_page(browser, when, init="Math.random = () => 0.99;")
    open_lab(page, "1-1"); predict(page)
    page.evaluate("window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); }; 0")
    page.evaluate("v => { const r = document.querySelector('#shT'); r.value = v; r.dispatchEvent(new Event('input')); }", "8")
    page.evaluate("Storage.prototype.setItem = window.__realSet; 0")
    had_retry = page.locator("#retrySave").count() == 1
    page.evaluate(bg); page.locator("#retrySave").click()
    try:   # 回首頁排在這次事件跑完之後
        page.get_by_role("button", name="開始今天的練習").wait_for(timeout=3000)
    except Exception:
        pass
    page.wait_for_timeout(300)
    check("實驗存檔失敗待重試中、存檔又被別處清掉後按「再存一次」：回到首頁、提示列消失、沒有 JS 錯誤",
          had_retry and not errors and page.locator("#labNav").count() == 0
          and page.get_by_role("button", name="開始今天的練習").count() == 1 and page.locator("#retrySave").count() == 0,
          {"先出現再存一次": had_retry, "errors": errors, "main": page.inner_text("#main")[:80], "再存一次": page.locator("#retrySave").count()})
    ctx.close()
    # 四站同型（Codex 審數學 baf22229 第 2 項，#2633）：任務存檔失敗 → 回首頁 → 進觀念頁、寫入仍失敗時按「去實驗室動手做」（開不成，人還在觀念頁、screen 卻已是 lab）
    # → 存檔被別處清掉、寫入恢復 → 按「再存一次」：不得把她從觀念頁甩回首頁。
    ctx, page, errors = new_page(browser, when, init="Math.random = () => 0.99;")
    open_lab(page, "1-1"); predict(page)
    page.evaluate("window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); }; 0")
    page.evaluate("v => { const r = document.querySelector('#shT'); r.value = v; r.dispatchEvent(new Event('input')); }", "8")
    page.locator("#labHome").click()
    page.locator(".ccard[data-cid='1-1']").click(); page.locator("#cLab").click()
    on_concept = page.locator("#cLab").count() == 1 and page.locator("#labNav").count() == 0
    page.evaluate(bg); page.evaluate("Storage.prototype.setItem = window.__realSet; 0"); page.locator("#retrySave").first.click()
    page.wait_for_timeout(300)   # 回首頁排在事件之後（labLeaveSoon）：等它有機會發生
    check("實驗頁沒開成、人還在觀念頁時按「再存一次」（那一輪已被別處清掉）：留在觀念頁、提示列消失、沒有 JS 錯誤",
          on_concept and not errors and page.locator("#cLab").count() == 1
          and page.get_by_role("button", name="開始今天的練習").count() == 0 and page.locator("#retrySave").count() == 0,
          {"先在觀念頁": on_concept, "errors": errors, "main": page.inner_text("#main")[:80], "再存一次": page.locator("#retrySave").count()})
    ctx.close()


def flow_season(browser, device=None):
    ctx, page, errors = new_page(browser, "2026-10-11T20:40:00+08:00", device)
    page.locator(".ccard[data-cid='1-3']").click()
    btn(page, "去實驗室動手做").click()
    check("季節實驗室預測前隱藏", page.locator("#labBody").is_hidden())
    page.locator("#labPredict button[data-g='0']").click()
    check("季節實驗室打開後任務還沒自己打勾", page.locator("#labTask .ck.got").count() == 0)
    page.evaluate("v => { const r = document.querySelector('#seT'); r.value = v; r.dispatchEvent(new Event('input')); }", "12")
    ro_summer = page.inner_text("#seRo")
    page.locator("#seTabs button[data-k='3']").click()
    page.evaluate("v => { const r = document.querySelector('#seT'); r.value = v; r.dispatchEvent(new Event('input')); }", "12")
    ro_winter = page.inner_text("#seRo")
    check("夏至：日出東偏北、中午約 89°", "日出 5:14（東偏北）" in ro_summer and "約 89°" in ro_summer, ro_summer)
    check("冬至：日出東偏南、中午約 42°", "日出 6:40（東偏南）" in ro_winter and "約 42°" in ro_winter, ro_winter)
    check("季節實驗三個任務都完成", page.locator("#labTask .ck.got").count() == 3, page.inner_text("#labTask"))
    shot(page, "season_lab")
    btn(page, "完成實驗").click()
    check("季節實驗完成", "實驗完成" in page.inner_text("#main"))
    check("季節實驗沒有 JS 錯誤", not errors, errors)
    ctx.close()


def answer_and_next(page):
    """隨便作答一題並前進：選擇題按第一個選項；答錯就選「先跳過」錯因，再按下一題。"""
    if page.locator("#main .opt").count():
        page.locator("#main .opt").first.click()
    elif page.locator("#reveal").count():
        page.locator("#reveal").click(); page.locator("#selfGrade button").first.click()
    if page.locator("#errq").count():
        page.locator("#errq button[data-k='']").click()
    btn(page, "下一題").click()


def flow_review_after_plan_done(browser):
    """D5：做完今天計畫後開小考複習、做到一半重載，首頁要能接續，剩下的題與順序保留。"""
    seed = {"v": 3, "cards": {}, "exits": {}, "days": {"2026-10-11": {"planIds": ["s1"], "doneIds": ["s1"], "touched": ["s1"],
            "extraDone": False, "labRuns": 0, "teach": 0, "mood": None}}, "labRuns": {}, "session": None,
            "log": [], "ops": [], "help": {}, "extra": [], "settings": {"unit3": False, "sound": False}}
    seed["cards"]["s1"] = {"seen": 1, "goodDays": ["2026-10-11"], "blockedDay": None, "due": "2026-10-12"}
    ctx, page, errors = new_page(browser, "2026-10-11T20:00:00+08:00",
                                 init=f"if(!sessionStorage.getItem('seeded')){{sessionStorage.setItem('seeded','1');localStorage.setItem('g5sci.v3', {json.dumps(json.dumps(seed))});}}")
    check("當日計畫已完成", "今天的卡片都做完了" in page.inner_text("#main"))
    page.locator("button[data-rv='u1']").click()
    for _ in range(3):
        answer_and_next(page)
    before = state(page)["session"]["queue"]
    page.reload(); page.wait_for_selector("#main")
    main = page.inner_text("#main")
    check("做完計畫後的小考複習可在首頁接續（D5）", "繼續小考複習" in main, main[:200])
    btn(page, "繼續小考複習").click()
    after = state(page)["session"]["queue"]
    check("接續後剩下的題與順序不變", after == before and len(after) > 0, (before[:3], after[:3]))
    check("接續流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_makeup(browser, device=None, label="chromium"):
    """補做（2026-10-14 律師：「有辦法補做之前沒做的天數嗎」）：今天做完後，日曆下方可補做沒練的日子；補完那天變淺綠、連續天數照算。"""
    def seed(done):
        s = {"v": 3, "cards": {}, "exits": {}, "days": {"2026-10-14": {"planIds": ["s1"], "doneIds": ["s1"] if done else [], "touched": ["s1"] if done else [],
             "extraDone": False, "labRuns": 0, "teach": 0, "mood": None}}, "labRuns": {}, "session": None,
             "log": [], "ops": [], "help": {}, "extra": [], "settings": {"unit3": False, "sound": False}}
        if done:
            s["cards"]["s1"] = {"seen": 1, "goodDays": ["2026-10-14"], "blockedDay": None, "due": "2026-10-15"}
            s["log"] = [{"op": "x1", "d": "2026-10-14", "card": "s1", "c": "1-1", "ok": True, "hint": False, "unsure": False, "variation": False, "first": True}]
        return f"if(!sessionStorage.getItem('seeded')){{sessionStorage.setItem('seeded','1');localStorage.setItem('g5sci.v3', {json.dumps(json.dumps(s))});}}"
    ctx, page, errors = new_page(browser, "2026-10-14T20:00:00+08:00", device, init=seed(False))
    txt = page.inner_text("#makeup")
    check(f"{label} 補做1 今天還沒做完：只說前面 3 天沒練、做完今天可補，沒有補做按鈕", "3 天沒練" in txt and page.locator("#makeup button").count() == 0, txt)
    ctx.close()
    ctx, page, errors = new_page(browser, "2026-10-14T20:00:00+08:00", device, init=seed(True))
    bs = page.locator("#makeup button[data-mk]")
    check(f"{label} 補做2 今天做完：列出 10/11、10/12、10/13 三個補做按鈕", bs.count() == 3 and [b.inner_text() for b in bs.all()] == ["補做 10/11", "補做 10/12", "補做 10/13"], [b.inner_text() for b in bs.all()])
    check(f"{label} 補做3 補做前連續練習 1 天", page.inner_text("#streak") == "連續練習 1 天", page.inner_text("#streak"))
    page.locator("button[data-mk='2026-10-12']").click()
    check(f"{label} 補做4 進入練習、題目上方標「補做 10/12」", "補做 10/12" in page.inner_text("#main .qhead"), page.inner_text("#main")[:120])
    answer_and_next(page)
    page.reload(); page.wait_for_selector("#main")
    check(f"{label} 補做4b 做到一半重新整理：日曆下只說還沒做完、沒有別的補做按鈕；有「繼續補做 10/12」",
          page.locator("#makeup button[data-mk]").count() == 0 and "還沒做完" in page.inner_text("#makeup") and "繼續補做 10/12" in page.inner_text("#main"), (page.inner_text("#makeup"), page.inner_text("#main")[:200]))
    page.get_by_role("button", name="繼續補做 10/12").first.click()
    for _ in range(25):
        if "補做完成" in page.inner_text("#main"):
            break
        answer_and_next(page)
    check(f"{label} 補做5 做完顯示「10/12 補做完成」", "10/12 補做完成" in page.inner_text("#main"), page.inner_text("#main")[:160])
    st = state(page)
    d12 = st["days"]["2026-10-12"]
    check(f"{label} 補做6 存檔：10/12 結算成練過（madeUp＝10/14、touched＝doneIds）、今天計畫不變", len(d12["touched"]) > 0 and d12.get("madeUp") == "2026-10-14" and sorted(d12["touched"]) == sorted(d12["doneIds"]) and st["days"]["2026-10-14"]["planIds"] == ["s1"], st["days"])
    btn(page, "回首頁").click()
    cell = page.locator("#cal i").nth(1)
    check(f"{label} 補做7 日曆 12 號變成補做色（on mk），按鈕剩 10/11、10/13", "mk" in (cell.get_attribute("class") or "") and "on" in (cell.get_attribute("class") or "") and page.locator("#makeup button[data-mk]").count() == 2, cell.get_attribute("class"))
    check(f"{label} 補做8 連續天數照算（12 補了、13 沒練 ⇒ 仍是 1 天）", page.inner_text("#streak") == "連續練習 1 天", page.inner_text("#streak"))
    page.locator("button[data-mk='2026-10-13']").click()
    for _ in range(25):
        if "補做完成" in page.inner_text("#main"):
            break
        answer_and_next(page)
    btn(page, "回首頁").click()
    check(f"{label} 補做9 13 號也補了 ⇒ 連續練習 3 天（12、13、14）", page.inner_text("#streak") == "連續練習 3 天", page.inner_text("#streak"))
    page.reload(); page.wait_for_selector("#main")
    check(f"{label} 補做10 重新整理後仍是 3 天、只剩 10/11 可補", page.inner_text("#streak") == "連續練習 3 天" and page.locator("#makeup button[data-mk]").count() == 1)
    check(f"{label} 補做 沒有 JS 錯誤", not errors, errors)
    shot(page, f"makeup_{label}")
    ctx.close()


def flow_pending_blocks_new_answer(browser):
    """D1：A 存檔失敗 → 回首頁再開始 → 作答 B 不得覆蓋待存的 A；存好後可以重答 B。"""
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00")
    btn(page, "開始今天的練習").click()
    page.evaluate("window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); }; 0")
    btn(page, "東邊升起、西邊落下").click()
    check("A 沒存到", "還沒存到" in page.inner_text("#ansBox"))
    page.locator(".ccard[data-cid='1-2']").click()
    btn(page, "回首頁").click()
    btn(page, "開始今天的練習").click()                    # 存不進去：留在首頁，不進練習
    check("開始回合沒存到就不進練習（停在首頁）", page.locator("#main .opt").count() == 0, page.inner_text("#main")[:120])
    page.evaluate("Storage.prototype.setItem = window.__realSet; 0")
    page.locator("#retrySave").click()                      # 補寫 A
    s = state(page)
    check("補寫的是 A（s1 作答一次）", s and s["cards"]["s1"]["seen"] == 1, s and s["cards"].get("s1"))
    btn(page, "繼續這一輪").click()                         # A 已寫進那一輪，首頁正確地給「繼續這一輪」
    page.locator("#main .opt").first.click()
    check("存好以後可以正常作答下一題", "答對了" in page.inner_text("#ansBox") or "正確答案" in page.inner_text("#ansBox"), page.inner_text("#ansBox")[:120])
    check("待存流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_dissolve_fair_test(browser):
    """D9：冷水＋攪拌、熱水＋不攪拌 → 不能算冷熱對照；熱水也攪拌才算。"""
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00")
    page.locator("#setBox summary").click(); page.locator("#u3").check()
    page.locator(".ccard[data-cid='3-1']").click(); btn(page, "去實驗室動手做").click()
    page.locator("#labPredict button[data-g='0']").click()
    page.locator("#dsStir").check(); btn(page, "放入方糖").click(); page.clock.run_for(6000)
    btn(page, "換一杯清水").click(); page.locator("#dsStir").uncheck(); page.locator("#dsHot").check()
    btn(page, "放入方糖").click(); page.clock.run_for(6000)
    ro = page.inner_text("#dsRo")
    check("攪拌方式不同：提示不能比、任務 2 不打勾", "不能比較快慢" in ro and page.locator("#labTask .ck.got").count() == 2, (ro[-80:], page.locator("#labTask .ck.got").count()))
    btn(page, "換一杯清水").click(); page.locator("#dsStir").check()
    btn(page, "放入方糖").click(); page.clock.run_for(4000)
    check("熱水也攪拌：可以比較、任務 2 打勾", page.locator("#labTask .ck.got").count() == 3, page.inner_text("#labTask"))
    check("對照流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


# ---------- 4agent 必修（run 4B-20261011-g5app；交辦 #1182 自修 session 接手） ----------
BLOCK = "window.__s=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('QuotaExceededError')};0"


def seed_state(when_day, plan, done, queue, answered):
    s = {"v": 3, "cards": {}, "exits": {}, "days": {}, "labRuns": {}, "session": None, "log": [], "ops": [], "help": {}, "extra": [],
         "settings": {"unit3": False, "sound": False}}
    for cid in answered:
        s["cards"][cid] = {"seen": 1, "goodDays": [when_day], "blockedDay": None, "due": "2026-10-12"}
    s["days"][when_day] = {"planIds": plan, "doneIds": done, "touched": list(answered), "extraDone": False, "labRuns": 0, "teach": 0, "mood": None}
    s["session"] = {"day": when_day, "kind": "plan", "queue": queue, "answered": answered, "wrong": [], "kinds": {}}
    return "if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('g5sci.v3', %s);}" % json.dumps(json.dumps(s))


def flow_pending_timer_no_hijack(browser, device=None, label="chromium"):
    """R2（M04／D1-c）：待存時重答會排 1.6 秒重繪；她在這 1.6 秒內離開到觀念頁，重繪不得把她拉回練習。"""
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00", device,
                                 init=seed_state("2026-10-11", ["s1", "s2", "s3"], ["s1"], ["s2", "s3"], ["s1"]))
    page.locator("#goOn").click(); page.evaluate(BLOCK)
    page.locator("#main .opt").nth(1).click()                              # s2 存失敗（成為待補存）
    page.locator(".ccard[data-cid='1-2']").click(); btn(page, "回首頁").click()
    page.locator("#goOn").click(); page.locator("#main .opt").nth(1).click()  # 重答 → SAVE_PENDING
    page.locator(".ccard[data-cid='1-3']").click()                           # 立刻離開到季節觀念頁
    before = "一年中太陽走的路線" in page.inner_text("#main")
    page.clock.run_for(1700)
    after = page.inner_text("#main")
    check(f"{label} R2 離頁後 1.6 秒重繪不搶回練習（仍在季節觀念頁、沒有選項）",
          before and "一年中太陽走的路線" in after and page.locator("#main .opt").count() == 0,
          (before, after[:80], page.locator("#main .opt").count()))
    check(f"{label} R2 流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


def open_dissolve_lab(browser):
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00")
    page.locator("#setBox summary").click(); page.locator("#u3").check()
    page.locator(".ccard[data-cid='3-1']").click(); btn(page, "去實驗室動手做").click()
    page.locator("#labPredict button[data-g='0']").click()
    return ctx, page, errors


def got(page):
    return page.locator("#labTask .ck.got").count()


def flow_dissolve_fresh_cup(browser):
    """R3（M27／D9-b、D9-c、D9-d）：只有「新的一杯清水」放的第一顆糖才登記冷水／熱水結果。"""
    # D9-b：冷水做完不換杯，勾熱水再放糖 → 不是清水，不得拿到冷熱對照勾；換清水再做才拿到
    ctx, page, errors = open_dissolve_lab(browser)
    btn(page, "放入方糖").click(); page.clock.run_for(11000)
    check("R3 冷水第一杯有效（任務 2 格）", got(page) == 2, page.inner_text("#labTask"))
    page.locator("#dsHot").check(); btn(page, "放入方糖").click(); page.clock.run_for(11000)
    ro = page.inner_text("#dsRo")
    check("R3 同一杯續加糖：提示不是清水、不給冷熱對照勾", got(page) == 2 and "不是清水" in ro, (got(page), ro[-90:]))
    btn(page, "換一杯清水").click(); btn(page, "放入方糖").click(); page.clock.run_for(11000)
    check("R3 換清水後熱水那杯有效：拿到冷熱對照勾", got(page) == 3, page.inner_text("#labTask"))
    check("R3 續加糖流程沒有 JS 錯誤", not errors, errors)
    ctx.close()
    # D9-c：第二杯先加鹽再放糖 → 有鹽的杯子不是清水
    ctx, page, errors = open_dissolve_lab(browser)
    btn(page, "放入方糖").click(); page.clock.run_for(11000)
    btn(page, "換一杯清水").click(); page.locator("#dsHot").check()
    page.locator("#dsSalt").click(); btn(page, "放入方糖").click(); page.clock.run_for(11000)
    ro = page.inner_text("#dsRo")
    check("R3 含鹽杯不給冷熱對照勾", got(page) == 2 and "不是清水" in ro, (got(page), ro[-90:]))
    ctx.close()
    # D9-d：溶到一半改條件 → 這杯不算冷也不算熱
    ctx, page, errors = open_dissolve_lab(browser)
    btn(page, "放入方糖").click(); page.clock.run_for(2000)
    page.locator("#dsHot").check(); page.clock.run_for(11000)
    check("R3 溶到一半換條件：只拿到秤重那格", got(page) == 1 and "換了條件" in page.inner_text("#dsRo"), (got(page), page.inner_text("#dsRo")[-90:]))
    ctx.close()


def flow_bad_v1_banner(browser):
    """R5/R8（M08／M10）：v1 結構不合法 → 橫幅不提儲存空間、指向「設定與題庫」；略過後從頭開始、v1 原文不動。"""
    v1 = json.dumps({"v": 1, "cards": []})
    ctx, page, errors = new_page(browser, "2026-10-20T12:00:00+08:00",
                                 init=f"if(!sessionStorage.getItem('seeded')){{sessionStorage.setItem('seeded','1');localStorage.setItem('g5sci.v1', {json.dumps(v1)});}}")
    ban = page.inner_text("#banners")
    check("R5 壞 v1 橫幅：不提儲存空間、指向設定與題庫", "格式讀不懂" in ban and "儲存空間" not in ban and "設定與題庫" in ban, ban)
    check("R5 壞 v1 不寫 v3", page.evaluate("localStorage.getItem('g5sci.v3')") is None)
    page.locator("#setBox summary").click()
    has_discard = page.locator("#discard").count() == 1
    check("R5 設定與題庫有「略過舊紀錄」鈕", has_discard)
    if has_discard:
        page.locator("#discard").click(); page.locator("#discardYes").click()
        check("R5 略過後 v3 建立、v1 原文不動", state(page) is not None and page.evaluate("localStorage.getItem('g5sci.v1')") == v1)
    check("R5 流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_import_hidden(browser):
    """scope-cut（4agent）：設定頁不再顯示貼 JSON 加題卡的入口；既存 extra 照常讀取驗證。"""
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00")
    page.locator("#setBox summary").click()
    check("scope-cut 匯入框不顯示", not page.locator("#importBox").is_visible() and not page.locator("#importBtn").is_visible())
    ctx.close()


def shots_season_diagrams(browser):
    if not SHOTS:
        return
    ctx, page, _ = new_page(browser, "2026-10-11T20:00:00+08:00", {"viewport": {"width": 810, "height": 1080}, "device_scale_factor": 2})
    page.locator(".ccard[data-cid='1-3']").click()
    page.locator("#main .remedy").screenshot(path=str(SHOTS / "season_way0.png"))
    btn(page, "換另一種說法").click()
    page.locator("#main .remedy").screenshot(path=str(SHOTS / "season_way1.png"))
    ctx.close()


def flow_corrupt(browser):
    bad = json.dumps({"v": 3, "cards": {"s1": {"seen": "2"}}})
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00",
                                 init=f"if(!sessionStorage.getItem('seeded')){{sessionStorage.setItem('seeded','1');localStorage.setItem('g5sci.v3', {json.dumps(bad)});}}")
    check("壞存檔顯示提示（矩陣 19）", "存檔讀不出來" in page.inner_text("#banners"))
    btn(page, "開始今天的練習").click()
    raw = page.evaluate("localStorage.getItem('g5sci.v3')")
    check("壞存檔不被覆蓋", raw == bad, raw)
    check("壞存檔流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_migrate(browser):
    v1 = json.dumps({"v": 1, "cards": {"s1": {"box": 3, "streak": 3, "due": "2026-10-25", "seen": 8, "right": 8, "wrong": 0, "retired": True}},
                     "unit3": False, "extra": [], "prefs": {"sound": True}})
    ctx, page, errors = new_page(browser, "2026-10-20T12:00:00+08:00",
                                 init=f"if(!sessionStorage.getItem('seeded')){{sessionStorage.setItem('seeded','1');localStorage.setItem('g5sci.v1', {json.dumps(v1)});}}")
    page.locator("#setBox summary").click()
    check("遷移提示（矩陣 28）", "已把舊版紀錄搬過來" in page.inner_text("#storeMsg"), page.inner_text("#storeMsg"))
    check("舊版原文不變", page.evaluate("localStorage.getItem('g5sci.v1')") == v1)
    s = state(page)
    check("遷移後不承認畢業、明天複習", s and s["cards"]["s1"] == {"seen": 8, "goodDays": [], "blockedDay": None, "due": "2026-10-21", "needsRecheck": True}, s and s["cards"].get("s1"))
    check("遷移流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_midnight(browser):
    ctx, page, errors = new_page(browser, "2026-10-11T23:58:00+08:00")
    check("午夜前倒數 25 天", page.inner_text("#days").strip() == "25", page.inner_text("#days"))
    btn(page, "開始今天的練習").click()
    btn(page, "東邊升起、西邊落下").click()
    page.clock.set_system_time("2026-10-12T00:00:30+08:00")
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    main = page.inner_text("#main")
    check("跨午夜後倒數變 24", page.inner_text("#days").strip() == "24", page.inner_text("#days"))
    check("跨午夜任務換新（矩陣 17）", "1 / 11" in main, main[:120])
    btn(page, "東邊升起、西邊落下").click()
    s = state(page)
    check("跨午夜作答記到新日（矩陣 16）", s["log"][-1]["d"] == "2026-10-12" and s["days"]["2026-10-12"]["doneIds"] == ["s1"], s["log"][-1])
    check("跨午夜流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_no_cloud(browser):
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00",
                                 init="window.__cc=0; window.claude={use:function(){window.__cc++;return Promise.resolve(null);}};")
    btn(page, "開始今天的練習").click()
    btn(page, "東邊升起、西邊落下").click()
    check("不碰 window.claude（矩陣 18）", page.evaluate("window.__cc") == 0)
    ctx.close()


def flow_dissolve(browser, reduced):
    tag = "減少動態效果" if reduced else "一般"
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00", reduced=reduced)
    page.locator("#setBox summary").click()
    page.locator("#u3").check()
    page.locator(".ccard[data-cid='3-1']").click()
    btn(page, "去實驗室動手做").click()
    page.locator("#labPredict button[data-g='0']").click()
    check(f"溶解初始 210 g（{tag}）", "210 g" in page.text_content("#dsSvg"))
    btn(page, "放入方糖").click()
    page.clock.run_for(4000)
    check(f"溶解中秤 220 g（{tag}）", "220 g" in page.text_content("#dsSvg"))
    page.clock.run_for(6500)
    ro = page.inner_text("#dsRo")
    check(f"冷水 10.0 秒溶完、220 g（{tag}，矩陣 21/23）", "冷水：花了 10.0 秒" in ro and "220 g" in ro, ro)
    for _ in range(6):
        btn(page, "加一匙鹽").click()
    ro = page.inner_text("#dsRo")
    check(f"加 6 匙鹽留下 6 g、秤 256 g（{tag}，矩陣 22）", "留下 6 g" in ro and "256 g" in ro, ro)
    btn(page, "換一杯清水").click()
    check(f"換一杯清水回 210 g（{tag}）", "210 g" in page.text_content("#dsSvg"))
    page.locator("#dsHot").check()
    btn(page, "放入方糖").click()
    page.clock.run_for(5500)
    ro = page.inner_text("#dsRo")
    check(f"熱水 5.0 秒溶完（{tag}）", "熱水：花了 5.0 秒" in ro, ro)
    check(f"溶解流程沒有 JS 錯誤（{tag}）", not errors, errors)
    ctx.close()


# ===== 探險地圖＋成長植物（#1725）=====
MAP_ORDER = ["1-1", "1-3", "1-2", "2-1", "2-2", "2-3", "3-1"]   # 與 src/app.html CONCEPTS 的程式順序相同


def map_card_ids(cid):
    """從建好的頁面取出某觀念的全部題卡 id（主題庫 id:"s1",concept:"2-1"；加題 ch("k16", "2-1", …)）。"""
    html = (ROOT / PAGE).read_text(encoding="utf-8")
    return sorted(set(re.findall(r'id:"(\w+)",concept:"' + re.escape(cid) + '"', html)) | set(re.findall(r'\b\w+\("(\w+)", "' + re.escape(cid) + '"', html)))


def map_seed(n, unit3=True, seen=None, seen_throws=False, grown=False, pending=False):
    """前 n 個觀念出口題通過（＝觀念卡「開花了」）；grown＝第 n+1 個觀念全部題卡都見過（＝「長葉了」；2026-10-14 起也算走過）。
    pending＝第 n+1 個觀念的出口題今天要問（出口題區有「答得出來」）。
    同時記下這一頁對每個 key 的 setItem 次數（window.__mw）；seen_throws＝這一頁寫 g5sci.mapSeen 一律丟例外（種資料用原本的 setItem，不受影響）。"""
    s = {"v": 3, "cards": {}, "exits": {}, "days": {}, "labRuns": {}, "session": None, "log": [], "ops": [], "help": {}, "extra": [],
         "settings": {"unit3": unit3, "sound": False}}
    for cid in MAP_ORDER[:n]:
        s["exits"][cid] = {"status": "pass", "due": None, "opened": "2026-10-11", "last": "2026-10-11"}
    if grown:
        for k in map_card_ids(MAP_ORDER[n]):
            s["cards"][k] = {"seen": 1, "goodDays": [], "blockedDay": None, "due": "2026-10-14"}
    if pending:
        s["exits"][MAP_ORDER[n]] = {"status": "pending", "due": "2026-10-13", "opened": "2026-10-12", "last": None}
    js = ("window.__mw={};(function(){var o=window.__o=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){"
          + ("if(k==='g5sci.mapSeen')throw new Error('QuotaExceededError');" if seen_throws else "")
          + "window.__mw[k]=(window.__mw[k]||0)+1;return o.call(this,k,v);};})();"
          + "if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');window.__o.call(localStorage,'g5sci.v3', %s);" % json.dumps(json.dumps(s))
          + ("window.__o.call(localStorage,'g5sci.mapSeen','%d');" % seen if seen is not None else "localStorage.removeItem('g5sci.mapSeen');")
          + "window.__mw={};}")
    return js


MAP_INFO_JS = """() => { const box = document.querySelector('#mapBox');
  const st = [...box.querySelectorAll('button.stn')].map((b) => ({cid: b.dataset.cid, cls: b.className, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height,
    x: b.querySelector('.dot').getBoundingClientRect().x, y: b.querySelector('.dot').getBoundingClientRect().y}));
  const cards = [...document.querySelectorAll('#concepts .ccard')].map((c) => ({cid: c.dataset.cid, st: (c.querySelector('.st') || {}).textContent || '', off: c.classList.contains('off')}));
  const sizes = [...box.querySelectorAll('*')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .map((e) => parseFloat(getComputedStyle(e).fontSize));
  const pl = box.querySelector('svg.pl');
  return {hidden: box.hidden, title: (box.querySelector('h2') || {}).textContent, count: (box.querySelector('#mapCount') || {}).textContent, st, cards,
    minFont: Math.min(...sizes), grow: !!(pl && pl.classList.contains('grow')), stars: !!box.querySelector('.stars.go'), won: !!box.querySelector('.goal.won'),
    plant: pl ? pl.getAttribute('aria-label') : '', text: box.innerText, mw: window.__mw, seen: localStorage.getItem('g5sci.mapSeen'),
    sw: document.documentElement.scrollWidth, emoji: /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(box.innerText)}; }"""

# 對比度（WCAG）：文字色對它實際疊上的底色
MAP_CONTRAST_JS = """() => { const rgb = (s) => (s.match(/[\\d.]+/g) || []).slice(0, 4).map(Number);
  const lum = (c) => { const a = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
  const bg = (e) => { for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c; } return [255, 255, 255]; };
  const ratio = (e) => { const a = lum(rgb(getComputedStyle(e).color)), b = lum(bg(e)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const els = [...document.querySelectorAll('#mapBox h2, #mapCount, #mapBox .nm, #mapBox .u, #mapBox .tag, #mapBox .dot, #mapBox .stage, #mapBox .next span:last-child, #mapBox .mapwin')]
    .filter((e) => e.getClientRects().length);
  return els.map((e) => [e.className || e.tagName, Math.round(ratio(e) * 100) / 100, e.textContent.trim().slice(0, 8)]); }"""


def flow_map(browser, label, device=None):
    # 3 站開花＋第 4 站長葉（題目全部做過）＝走過 4 站（2026-10-14 律師：做完一站的題目就算走過）、第一次看到（沒有 mapSeen）→ 長大動畫一次
    ctx, page, errors = new_page(browser, "2026-10-13T19:00:00+08:00", device, init=map_seed(3, grown=True))
    page.wait_for_selector("#mapBox:not([hidden])")
    i = page.evaluate(MAP_INFO_JS)
    check(f"{label} 地圖：首頁有「探險地圖」，在天空大圖下方、今天要練上方",
          i["title"] == "探險地圖" and page.evaluate("(() => { const h = document.querySelector('#hero'), m = document.querySelector('#mapBox'), n = document.querySelector('#main');"
                                                 " return !!(h.compareDocumentPosition(m) & 4) && !!(m.compareDocumentPosition(n) & 4); })()"), i["title"])
    check(f"{label} 地圖：「走過 4 站／共 7 站・再 3 站到考試」", i["count"] == "走過 4 站／共 7 站・再 3 站到考試", i["count"])
    order = [s["cid"] for s in i["st"]]
    check(f"{label} 地圖：七站＝觀念卡同一個順序", order == [c["cid"] for c in i["cards"]] and len(order) == 7, order)
    bloom = {c["cid"]: c["st"] in ("長葉了", "開花了", "結果了") for c in i["cards"]}
    done = {s["cid"]: " done" in s["cls"] for s in i["st"]}
    check(f"{label} 地圖：打勾的站＝觀念卡顯示長葉了以上的觀念（逐一比對）", done == bloom and sum(done.values()) == 4, (done, bloom))
    grown = {c["cid"]: c["st"] for c in i["cards"]}.get("2-1")
    check(f"{label} 地圖：「長葉了」（題卡都見過、出口題還沒過）也算走過", grown == "長葉了" and done["2-1"], grown)
    nows = [s["cid"] for s in i["st"] if " now" in s["cls"]]
    check(f"{label} 地圖：「現在在這裡」＝第一個題目還沒全部做過的觀念（第 5 站）", nows == ["2-2"] and "現在在這裡" in i["text"], nows)
    check(f"{label} 地圖：植物第 4 階（長高）＋下一階剪影與提示＋長大規則", i["plant"] == "植物：長高" and "再做完一站的題目，看看它會變成什麼" in i["text"] and "每一題都做過一次" in i["text"], i["plant"])
    check(f"{label} 地圖：剛破關（上次沒看過）播長大動畫一次，記下 mapSeen=4", i["grow"] and i["seen"] == "4", (i["grow"], i["seen"]))
    check(f"{label} 地圖：觸控目標每站 ≥44px、字級 ≥15px、沒有 emoji", all(s["w"] >= 44 and s["h"] >= 44 for s in i["st"]) and i["minFont"] >= 15 and not i["emoji"],
          (min(s["h"] for s in i["st"]), i["minFont"]))
    shot(page, f"{label}_map_3")
    # 點站名＝打開那個觀念（同點觀念卡）；地圖只在首頁
    page.locator('#mapBox button.stn[data-cid="2-1"]').click()
    mtxt = page.inner_text("#main")
    check(f"{label} 地圖：點「根莖葉」打開觀念頁（植物根莖葉的功能），地圖收起來", "植物根莖葉的功能" in mtxt and page.locator("#mapBox").is_hidden(), mtxt[:60])
    btn(page, "回首頁").click()
    i2 = page.evaluate(MAP_INFO_JS)
    check(f"{label} 地圖：回首頁地圖再出現，已看過不再播動畫", not i2["hidden"] and not i2["grow"], (i2["hidden"], i2["grow"]))
    page.locator('#mapBox button.stn[data-cid="1-1"]').click()
    check(f"{label} 地圖：點走過的站（太陽與影子）也打得開", "太陽在天空中的位置變化" in page.inner_text("#main"))
    btn(page, "回首頁").click()
    mw = page.evaluate("window.__mw")
    check(f"{label} 地圖：開頁＋點站名＋回首頁，g5sci.v3 寫入 0 次（只寫 g5sci.mapSeen）", mw.get("g5sci.v3", 0) == 0 and set(mw) <= {"g5sci.mapSeen", "g5sci.probe"}, mw)
    check(f"{label} 地圖：沒有 pageerror", not errors, errors)
    ctx.close()


def flow_map_more(browser):
    label = "chromium"
    # 第三單元未開放：溶解站鎖頭、不算分母；點它不打開
    ctx, page, errors = new_page(browser, "2026-10-13T19:00:00+08:00", init=map_seed(2, unit3=False, seen=2))
    i = page.evaluate(MAP_INFO_JS)
    last = i["st"][-1]
    check(f"{label} 地圖：第三單元未開放→溶解站鎖住、還沒開放、共 6 站", last["cid"] == "3-1" and " off" in last["cls"] and "還沒開放" in i["text"] and i["count"] == "走過 2 站／共 6 站・再 4 站到考試", i["count"])
    check(f"{label} 地圖：上次已看過同一階（mapSeen=2）不播動畫", not i["grow"], i["grow"])
    page.locator('#mapBox button.stn[data-cid="3-1"]').click(force=True)   # aria-disabled：Playwright 預設不點，孩子還是點得到
    check(f"{label} 地圖：點鎖住的站只提示、不打開觀念", "老師教完溶解" in page.inner_text("#main") and not page.locator("#mapBox").is_hidden())
    check(f"{label} 地圖（未開放）：沒有 pageerror", not errors, errors)
    ctx.close()
    # 七站全走完：結果、金色獎盃、全破訊息、星星一次；重開不再放
    ctx, page, errors = new_page(browser, "2026-10-13T19:00:00+08:00", init=map_seed(7, seen=6))
    i = page.evaluate(MAP_INFO_JS)
    check(f"{label} 地圖：七站全走完→第 7 階結果、終點金色獎盃、「探險地圖全部走完了！去跟爸媽說」",
          i["plant"] == "植物：結果" and i["won"] and "探險地圖全部走完了！去跟爸媽說" in i["text"] and i["count"] == "走過 7 站／共 7 站・全部走完了", (i["plant"], i["won"], i["count"]))
    check(f"{label} 地圖：全破那一次長大＋星星動畫", i["grow"] and i["stars"], (i["grow"], i["stars"]))
    page.reload(); page.wait_for_selector("#mapBox:not([hidden])")
    i = page.evaluate(MAP_INFO_JS)
    check(f"{label} 地圖：全破後重開不再放星星", not i["stars"] and not i["grow"] and i["won"], (i["stars"], i["grow"]))
    check(f"{label} 地圖（全破）：沒有 pageerror", not errors, errors)
    ctx.close()
    # 減少動態效果：剛破關也不動畫
    ctx, page, errors = new_page(browser, "2026-10-13T19:00:00+08:00", init=map_seed(7, seen=6), reduced=True)
    i = page.evaluate(MAP_INFO_JS)
    check(f"{label} 地圖：prefers-reduced-motion 時不播長大與星星", not i["grow"] and not i["stars"] and i["seen"] == "7", (i["grow"], i["stars"], i["seen"]))
    ctx.close()
    # mapSeen 寫不進去（瀏覽器丟例外）：地圖照常、不拋錯、不影響作答存檔
    ctx, page, errors = new_page(browser, "2026-10-13T19:00:00+08:00", init=map_seed(3, seen_throws=True))
    i = page.evaluate(MAP_INFO_JS)
    btn(page, "開始今天的練習").click()
    btn(page, "東邊升起、西邊落下").click()
    check(f"{label} 地圖：mapSeen 寫入失敗也不出錯，地圖照常、練習照常存", not errors and i["count"].startswith("走過 3 站") and "答對了" in page.inner_text("#ansBox") and state(page)["session"] is not None, errors)
    ctx.close()


def flow_map_after_exit(browser, device=None, label="chromium"):
    """Codex 審 7d8b243 ①：在首頁按出口題「答得出來」＝破關，地圖要當下更新並播那一次的長大＋全破動畫；「再考一次」要退回。"""
    ctx, page, errors = new_page(browser, "2026-10-13T19:00:00+08:00", device, init=map_seed(6, seen=6, pending=True))
    i = page.evaluate(MAP_INFO_JS)
    check(f"{label} 地圖（出口題前）：走過 6 站、還沒全破", i["count"] == "走過 6 站／共 7 站・再 1 站到考試" and not i["won"], i["count"])
    page.locator("#exitBox > summary").click()
    page.locator('#exitList button[data-c="3-1"][data-r="pass"]').click()
    i = page.evaluate(MAP_INFO_JS)
    check(f"{label} 地圖：首頁按出口題「答得出來」後當下變成全破（7 站、獎盃、結果、全破訊息）",
          i["count"] == "走過 7 站／共 7 站・全部走完了" and i["won"] and i["plant"] == "植物：結果" and "探險地圖全部走完了！去跟爸媽說" in i["text"], (i["count"], i["won"], i["plant"]))
    check(f"{label} 地圖：這一次破關當下播長大＋星星", i["grow"] and i["stars"], (i["grow"], i["stars"]))
    page.locator('#exitList button[data-retest="3-1"]').click()
    i = page.evaluate(MAP_INFO_JS)
    check(f"{label} 地圖：「再考一次」後退回 6 站、不是全破、不動畫", i["count"] == "走過 6 站／共 7 站・再 1 站到考試" and not i["won"] and not i["grow"] and not i["stars"], (i["count"], i["won"]))
    page.locator('#exitList button[data-c="3-1"][data-r="fail"]').click()
    i = page.evaluate(MAP_INFO_JS)
    check(f"{label} 地圖：出口題「還不行」仍是 6 站", i["count"] == "走過 6 站／共 7 站・再 1 站到考試" and not i["won"], i["count"])
    check(f"{label} 地圖（出口題）：沒有 pageerror", not errors, errors)
    ctx.close()


def flow_map_seen_unwritable(browser):
    """Codex 審 7d8b243 ②：mapSeen 寫不進去時，同一頁回首頁不能每次重播長大／星星。"""
    label = "chromium"
    for n, seen, stars in ((3, 2, False), (7, 6, True)):
        ctx, page, errors = new_page(browser, "2026-10-13T19:00:00+08:00", init=map_seed(n, seen=seen, seen_throws=True))
        i = page.evaluate(MAP_INFO_JS)
        check(f"{label} 地圖（mapSeen 寫不進、上次 {seen}、現在 {n}）：第一次回首頁播一次", i["grow"] and i["stars"] == stars and i["seen"] == str(seen), (i["grow"], i["stars"], i["seen"]))
        replay = []
        for _ in range(2):
            page.locator('#mapBox button.stn[data-cid="1-1"]').click()
            btn(page, "回首頁").click()
            j = page.evaluate(MAP_INFO_JS)
            replay.append((j["grow"], j["stars"]))
        check(f"{label} 地圖（mapSeen 寫不進、現在 {n}）：同一頁再回首頁兩次都不重播", replay == [(False, False), (False, False)], replay)
        check(f"{label} 地圖（mapSeen 寫不進）：沒有 pageerror", not errors, errors)
        ctx.close()


def flow_map_layout(browser, label):
    # 手機 390 直排、不橫向捲動；iPad 810 橫排；深色模式文字對比 ≥4.5
    for name, dev, scheme, vertical in (("phone390", {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True}, "light", True),
                                        ("phone390_dark", {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True}, "dark", True),
                                        ("ipad810", {"viewport": {"width": 810, "height": 1080}, "is_mobile": True, "has_touch": True}, "light", False),
                                        ("ipad810_dark", {"viewport": {"width": 810, "height": 1080}, "is_mobile": True, "has_touch": True}, "dark", False)):
        for n in (3, 7):
            ctx, page, errors = new_page(browser, "2026-10-13T19:00:00+08:00", dev, init=map_seed(n, seen=n), color_scheme=scheme)
            i = page.evaluate(MAP_INFO_JS)
            xs = {round(s["x"]) for s in i["st"]}; ys = {round(s["y"]) for s in i["st"]}
            lay = (len(xs) == 1 and len(ys) == 7) if vertical else (len(ys) == 1 and len(xs) == 7)
            w = dev["viewport"]["width"]
            check(f"{label} {name} 走過{n}站：{'直排' if vertical else '橫排'}、不橫向捲動（文件寬 {i['sw']}≤{w}）", lay and i["sw"] <= w, (len(xs), len(ys), i["sw"]))
            low = [c for c in page.evaluate(MAP_CONTRAST_JS) if c[1] < 4.5]
            check(f"{label} {name} 走過{n}站：地圖文字對比都 ≥4.5", not low, low)
            check(f"{label} {name} 走過{n}站：沒有 pageerror", not errors, errors)
            shot(page, f"{label}_map_{name}_{n}")
            ctx.close()


def main():
    with sync_playwright() as p:
        ch = p.chromium.launch()
        wk = p.webkit.launch()
        ipad = p.devices["iPad (gen 7)"]
        flow_standard_dom(ch)
        flow_remedy(ch, "chromium")
        flow_remedy(wk, "webkit_ipad", ipad)
        flow_second_help(ch)
        flow_comeback(ch)
        flow_review(ch)
        flow_review(wk, ipad)
        flow_review_segments(ch)
        flow_short_round_and_teach(wk, dict(p.devices["iPad Mini"]))
        flow_save_fail(ch)
        flow_save_fail_then_tick(ch)
        flow_redo_after_external_clear(ch)
        flow_lab_after_external_clear(ch)
        flow_review_after_plan_done(ch)
        flow_makeup(ch)
        flow_makeup(wk, ipad, "webkit_ipad")
        flow_pending_blocks_new_answer(ch)
        flow_dissolve_fair_test(ch)
        flow_pending_timer_no_hijack(ch)
        flow_pending_timer_no_hijack(wk, ipad, "webkit_ipad")
        flow_dissolve_fresh_cup(ch)
        flow_bad_v1_banner(ch)
        flow_import_hidden(ch)
        shots_season_diagrams(ch)
        flow_season(ch)
        flow_season(wk, ipad)
        flow_corrupt(ch)
        flow_migrate(ch)
        flow_midnight(ch)
        flow_no_cloud(ch)
        flow_dissolve(ch, False)
        flow_dissolve(ch, True)
        flow_map(ch, "chromium")
        flow_map(wk, "webkit_ipad", ipad)
        flow_map_more(ch)
        flow_map_after_exit(ch)
        flow_map_after_exit(wk, ipad, "webkit_ipad")
        flow_map_seen_unwritable(ch)
        flow_map_layout(ch, "chromium")
        flow_map_layout(wk, "webkit")
        if SHOTS:
            for name, dev in (("phone390", {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True}),
                              ("ipad810", ipad)):
                ctx, page, _ = new_page(wk, "2026-10-11T19:00:00+08:00", dev)
                shot(page, f"{name}_home")
                btn(page, "開始今天的練習").click(); btn(page, "東邊升起、西邊落下").click(); btn(page, "下一題").click()
                btn(page, "清晨").click(); btn(page, "還不懂這個觀念").click()
                shot(page, f"{name}_remedy")
                ctx.close()
        ch.close(); wk.close()
    bad = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(bad)}/{len(RESULTS)} passed")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()

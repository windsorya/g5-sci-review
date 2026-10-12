#!/opt/homebrew/opt/python@3.12/bin/python3.12
"""數學小教室端到端驗收：Chromium（桌機、手機 390）＋WebKit iPad，照孩子會做的順序走完教學與練習。

跑法：python3.12 tests/e2e_math.py [--shots DIR]
答案用 Python fractions 獨立算（不借用頁面裡的 G5Frac），頁面算錯就會對不上。
"""
import json
import sys
from fractions import Fraction
from math import gcd
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
URL = (ROOT / "math" / "index.html").as_uri()
SHOTS = Path(sys.argv[sys.argv.index("--shots") + 1]) if "--shots" in sys.argv else None
RESULTS = []
FIXED = [((24, 36), (35, 50)), ((27, 36), (28, 42)), ((21, 35), (16, 24)),
         ((18, 27), (28, 42)), ((36, 54), (20, 32)), ((45, 63), (32, 40))]


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  ← {detail}"))


def shot(page, name, full=True):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=full)


def open_page(browser, device=None, init=None, url=URL, **kw):
    ctx = browser.new_context(**(device or {}), **kw)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    if init:
        page.add_init_script(init)
    page.goto(url, wait_until="domcontentloaded")
    try:
        page.wait_for_load_state("load", timeout=15000)
    except Exception:
        pass
    return ctx, page, errors


def last_ask(page):
    return page.locator("#lesson .ask").last


def chip(page, text):
    last_ask(page).get_by_role("button", name=text, exact=True).click()


def fb_text(page):
    return last_ask(page).locator(".fb").inner_text()


def fill_nums(page, values):
    ask = last_ask(page)
    for i, v in enumerate(values):
        ask.locator(f'input[data-i="{i}"]').fill(str(v))
    ask.get_by_role("button", name="檢查").click()


def no_overflow(page, width):
    sw = page.evaluate("document.documentElement.scrollWidth")
    return sw <= width, sw


def store(page):
    return json.loads(page.evaluate("localStorage.getItem('g5math.v1')") or "null")


def walk_lesson(page, label, mistakes=True):
    page.get_by_role("button", name="開始學").click()
    # 1 先看分母：直接比分子是錯的方法
    check(f"{label} 第1步列出 45 的倍數到 630（14 個）", page.locator("#lesson .mults span").count() == 14 and
          page.locator("#lesson .mults span.hit").inner_text() == "630")
    if mistakes:
        chip(page, "直接比分子，28 比 27 大")
        check(f"{label} 第1步選「直接比分子」被擋並說明", "分子大的不一定比較大" in fb_text(page), fb_text(page))
    chip(page, "先約分：分子分母一起除以同一個數")
    # 2 約分 28/42：先試 3（錯）→ 2 → 太早說不能再約（錯）→ 7 → 不能再約
    if mistakes:
        chip(page, "一起除以 3")
        check(f"{label} 選 3：用乘法表說明 28 不能被 3 整除", "3 × 9 = 27、3 × 10 = 30，中間沒有 28" in fb_text(page), fb_text(page))
    chip(page, "一起除以 2")
    if mistakes:
        fill_nums(page, [13, 21])
        check(f"{label} 28÷2 填 13 被擋並給提示", "2 × 多少 = 28" in fb_text(page), fb_text(page))
    fill_nums(page, [14, 21])
    if mistakes:
        chip(page, "不能再約了")
        check(f"{label} 14/21 說不能再約被擋（7 的乘法表）", "7 的乘法表" in fb_text(page), fb_text(page))
    chip(page, "一起除以 7")
    fill_nums(page, [2, 3])
    chip(page, "不能再約了")
    s2 = page.locator('#lesson section[data-step="2"]').inner_text()
    check(f"{label} 第2步出現 28/42 = 14/21 = 2/3 與「一次除以 14」", "也可以一次除以 14" in s2 and "2 × 7" in s2, s2[-300:])
    check(f"{label} 第2步長條圖：42 格、粗線 2 條、3 大塊塗 2 塊",
          page.locator('#lesson section[data-step="2"] svg.fbar').nth(0).locator("rect").count() == 43 and
          page.locator('#lesson section[data-step="2"] svg.fbar').nth(0).locator("line").count() == 2 and
          page.locator('#lesson section[data-step="2"] svg.fbar').nth(1).locator("rect").count() == 4)
    # 3 約分 27/45：一次除以 9
    chip(page, "一起除以 9")
    fill_nums(page, [3, 5])
    chip(page, "不能再約了")
    # 4 通分：先填 30（公倍數但不是最小）
    if mistakes:
        fill_nums(page, [30])
        check(f"{label} 最小公倍數填 30：說是公倍數但還有更小的", "還有更小的" in fb_text(page), fb_text(page))
    fill_nums(page, [15])
    fill_nums(page, [5])
    fill_nums(page, [10])
    fill_nums(page, [3])
    fill_nums(page, [9])
    s4 = page.locator('#lesson section[data-step="4"]').inner_text()
    check(f"{label} 第4步得到 10/15 與 9/15", "10\n15" in s4 and "9\n15" in s4, s4[-200:])
    # 5 比大小
    if mistakes:
        chip(page, "<")
        check(f"{label} 10/15 ○ 9/15 選 < 被擋", "哪個多" in fb_text(page), fb_text(page))
    chip(page, ">")
    chip(page, ">")
    check(f"{label} 題目的□填上 >", page.locator("#box").inner_text().strip() == ">")
    # 6 寫進習作
    if mistakes:
        chip(page, "先通分，再約分")
        check(f"{label} 順序選錯被擋（提到 630）", "630" in fb_text(page), fb_text(page))
    chip(page, "先約分，再通分")
    check(f"{label} 教學完成：出現「換你自己做一題」、存檔 lessonDone", page.locator("#toPractice").is_visible() and (store(page) or {}).get("lessonDone") is True)


def answers(a, b):
    sa, sb = Fraction(*a), Fraction(*b)
    L = sa.denominator * sb.denominator // gcd(sa.denominator, sb.denominator)
    sign = ">" if sa > sb else "<" if sa < sb else "="
    return (sa.numerator, sa.denominator), (sb.numerator, sb.denominator), (sa.numerator * L // sa.denominator, L), (sb.numerator * L // sb.denominator, L), sign


def solve_practice(page, a, b, hint=False, slip=False):
    P = page.locator("#practice")
    sa, sb, ea, eb, sign = answers(a, b)
    r1 = P.locator("#r1")
    if hint:
        r1.get_by_role("button", name="給我提示").click()
    if slip:   # half＝左邊只約一半（大小對、還能再約）；unequal＝分子分母除以不同的數
        k = gcd(*a)
        p = min(q for q in range(2, k + 1) if k % q == 0)
        wrong = (a[0] // p, a[1] // p) if slip == "half" else (a[0] // k, a[1] // 5)   # unequal 只用在 21/35：分子 ÷7、分母 ÷5
        assert wrong != sa, "測試資料要真的是錯的"
        r1.locator('input[data-k="a.n"]').fill(str(wrong[0]))
        r1.locator('input[data-k="a.d"]').fill(str(wrong[1]))
        r1.locator('input[data-k="b.n"]').fill(str(sb[0]))
        r1.locator('input[data-k="b.d"]').fill(str(sb[1]))
        r1.get_by_role("button", name="檢查").click()
        msg = r1.locator(".fb").inner_text()
        want = "還能一起除以" if slip == "half" else "分母卻除以了"
        check(f"練習 {a}：{slip} 錯法被抓「{want}」，且只講左邊", want in msg and msg.startswith("左邊：") and "右邊" not in msg, msg)
    for k, v in (("a.n", sa[0]), ("a.d", sa[1]), ("b.n", sb[0]), ("b.d", sb[1])):
        r1.locator(f'input[data-k="{k}"]').fill(str(v))
    r1.get_by_role("button", name="檢查").click()
    r2 = P.locator("#r2")
    r2.wait_for(state="visible")
    for k, v in (("c.n", ea[0]), ("c.d", ea[1]), ("e.n", eb[0]), ("e.d", eb[1])):
        r2.locator(f'input[data-k="{k}"]').fill(str(v))
    r2.get_by_role("button", name="檢查").click()
    r3 = P.locator("#r3")
    r3.wait_for(state="visible")
    r3.locator(f'button[data-s="{sign}"]').click()
    return sign


def flow_full(browser, label, device=None, width=None, shots=False):
    ctx, page, errors = open_page(browser, device)
    if shots:
        shot(page, f"{label}-0-開頭", full=False)
    walk_lesson(page, label, mistakes=True)
    if shots:
        shot(page, f"{label}-1-教學全程")
    page.locator("#toPractice").click()
    # 練習 6 題固定題：第 3 題分子分母除不同數、第 5 題看提示、第 6 題只約一半（都斷連續），其餘一次做對
    for i, (a, b) in enumerate(FIXED):
        shown = page.locator("#practice .prob").inner_text().split()
        check(f"{label} 練習第 {i + 1} 題是 {a[0]}/{a[1]} 和 {b[0]}/{b[1]}", shown[:2] == [str(a[0]), str(a[1])] and shown[-2:] == [str(b[0]), str(b[1])], shown)
        sign = solve_practice(page, a, b, hint=(i == 4), slip={2: "unequal", 5: "half"}.get(i))
        check(f"{label} 練習第 {i + 1} 題□顯示 {sign}", page.locator("#pbox").inner_text().strip() == {">": ">", "<": "<", "=": "="}[sign])
        st = store(page)
        if i == 2:
            check(f"{label} 第 3 題改過答案⇒連續歸零", st["streak"] == 0 and "下一題試試不看提示" in page.locator("#pend").inner_text(), st)
        if i == 4:
            check(f"{label} 第 5 題看了提示⇒連續歸零", st["streak"] == 0, st)
        if i == 5:
            check(f"{label} 第 6 題只約一半⇒連續歸零、還沒學會", st["streak"] == 0 and not st["mastered"], st)
        if shots and i == 0:
            shot(page, f"{label}-2-練習第1題完成")
        page.locator("#nextQ").click()
    # 第 7–9 題是亂數題：照 Python 算的答案一次做對 ⇒ 連續 3 題 ⇒ 學會
    for i in range(6, 9):
        t = page.locator("#practice .prob").inner_text().split()
        a, b = (int(t[0]), int(t[1])), (int(t[-2]), int(t[-1]))
        sa, sb, *_ = answers(a, b)
        check(f"{label} 亂數第 {i + 1} 題 {a}{b} 兩邊都能約分", sa != a and sb != b)
        solve_practice(page, a, b)
        if i < 8:
            page.locator("#nextQ").click()
    st = store(page)
    check(f"{label} 連續 3 題自己做對 ⇒ 顯示「這種題你會了」、存 mastered", st["mastered"] and st["streak"] == 3 and "這種題你會了" in page.locator("#pend").inner_text(), st)
    check(f"{label} 紀錄 9 題、log 9 筆", st["solved"] == 9 and len(st["log"]) == 9, st)
    if shots:
        shot(page, f"{label}-3-學會了")
    if width:
        ok, sw = no_overflow(page, width)
        check(f"{label} 寬 {width} 沒有左右捲動", ok, sw)
    # 重新整理：接著第 10 題、首頁按鈕改成繼續練習
    page.reload(wait_until="domcontentloaded")
    check(f"{label} 重新整理後顯示「繼續練習（第 9 題）」與已學會", page.get_by_role("button", name="繼續練習（第 9 題）").is_visible() and page.locator("#mastery").is_visible())
    check(f"{label} 沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_storage_blocked(browser):
    init = "Storage.prototype.setItem=function(){throw new Error('quota')};"
    ctx, page, errors = open_page(browser, init=init)
    page.get_by_role("button", name="我已經會了，直接練習").click()
    a, b = FIXED[0]
    solve_practice(page, a, b)
    check("存不了紀錄：題目照常做完並提示", "存不了紀錄" in page.locator("#pend").inner_text())
    check("存不了紀錄：沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_corrupt_store(browser):
    init = "localStorage.setItem('g5math.v1','{not json');"
    ctx, page, errors = open_page(browser, init=init)
    check("壞存檔：照常顯示「開始學」", page.get_by_role("button", name="開始學").is_visible())
    init2 = "localStorage.setItem('g5math.v1',JSON.stringify({v:1,idx:-5,streak:'x',lessonDone:'yes',log:5}));"
    ctx2, page2, errors2 = open_page(browser, init=init2)
    st = page2.evaluate("G5MathPage.state()")
    check("欄位型別錯：idx 回 0、lessonDone 回 false、log 回空陣列", st["idx"] == 0 and st["lessonDone"] is False and st["log"] == [], st)
    check("壞存檔：沒有 JS 錯誤", not errors and not errors2, errors + errors2)
    ctx.close(); ctx2.close()


def flow_entry_link(browser):
    ctx, page, errors = open_page(browser, url=(ROOT / "index.html").as_uri())
    link = page.locator("#mathLink")
    check("自然複習首頁有數學小教室入口（href=math/index.html）", link.is_visible() and link.get_attribute("href") == "math/index.html")
    link.click()
    page.wait_for_selector("#prob")
    check("點入口進得了數學小教室", "數學小教室" in page.title())
    page.get_by_role("link", name="回自然複習").click()
    page.wait_for_selector("#main")
    check("數學小教室「回自然複習」回得去", "五上自然複習" in page.title())
    ctx2, page2, _ = open_page(browser, url=(ROOT / "v3" / "index.html").as_uri())
    check("v3 預覽版的入口改指 ../math/index.html", page2.locator("#mathLink").get_attribute("href") == "../math/index.html")
    check("入口頁沒有 JS 錯誤", not errors, errors)
    ctx.close(); ctx2.close()


def flow_dark(browser):
    ctx, page, errors = open_page(browser, {"viewport": {"width": 390, "height": 844}}, color_scheme="dark")
    bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    check("深色模式背景是深色", bg in ("rgb(15, 26, 36)",), bg)
    page.get_by_role("button", name="開始學").click()
    chip(page, "先約分：分子分母一起除以同一個數")
    chip(page, "一起除以 2")
    fill_nums(page, [14, 21])
    if SHOTS:
        shot(page, "dark-390-教學")
    ctx.close()


def main():
    with sync_playwright() as p:
        cr = p.chromium.launch()
        flow_full(cr, "桌機", {"viewport": {"width": 1280, "height": 900}}, width=1280)
        flow_full(cr, "手機390", {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True, "device_scale_factor": 2}, width=390, shots=True)
        flow_storage_blocked(cr)
        flow_corrupt_store(cr)
        flow_entry_link(cr)
        flow_dark(cr)
        cr.close()
        wk = p.webkit.launch()
        ipad = p.devices["iPad (gen 7)"]
        flow_full(wk, "iPad", ipad, width=ipad["viewport"]["width"], shots=True)
        wk.close()
    bad = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(bad)}/{len(RESULTS)} PASS")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()

#!/opt/homebrew/opt/python@3.12/bin/python3.12
"""v3 端到端驗收：Chromium 桌機＋WebKit iPad，用 Playwright 假時鐘固定日期。

跑法：python3.12 tests/e2e_v3.py [--shots DIR] [--page v3/index.html]
涵蓋：補救三分支（第一次求助→圖解＋觀察任務→換題確認→仍錯就停本輪、標待協助）、預測前鎖實驗、
短回合≠當日完成（矩陣 8）、考考爸媽題圖（25）、寫入失敗不宣告（27）、壞存檔不覆蓋（19）、
舊資料遷移（28）、跨午夜換任務（16/17）、不碰 window.claude（18）、溶解帳本與減少動態效果（21–23）。
預設測 v3/index.html（預覽版）；換到正式網址後改 --page index.html。
"""
import json
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


def flow_remedy(browser, label, device=None):
    ctx, page, errors = new_page(browser, "2026-10-11T19:00:00+08:00", device)
    check(f"{label} 首頁今天要練 10 張", "今天要練 10 張" in page.inner_text("#main"), page.inner_text("#main")[:120])
    shot(page, f"{label}_01_home")
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
    check(f"{label} 第一次求助＝說法一＋觀察任務", "影子在背對太陽的那一邊" in txt and "觀察任務" in txt and "上次" not in txt, txt[:80])
    check(f"{label} 一起弄懂＋給爸媽追問（不直接報答案）", "一起弄懂" in txt and "給爸媽" in txt and "不直接報答案" in txt, txt[:200])
    check(f"{label} 圖解有圖", page.locator("#remedy svg.fig").count() == 1)
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
    check(f"{label} 新一輪把卡住的觀念排到最後", "光在空氣中是怎麼前進的" in page.inner_text("#main"), page.inner_text("#main")[:120])
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


def main():
    with sync_playwright() as p:
        ch = p.chromium.launch()
        wk = p.webkit.launch()
        ipad = p.devices["iPad (gen 7)"]
        flow_remedy(ch, "chromium")
        flow_remedy(wk, "webkit_ipad", ipad)
        flow_second_help(ch)
        flow_comeback(ch)
        flow_short_round_and_teach(wk, dict(p.devices["iPad Mini"]))
        flow_save_fail(ch)
        flow_corrupt(ch)
        flow_migrate(ch)
        flow_midnight(ch)
        flow_no_cloud(ch)
        flow_dissolve(ch, False)
        flow_dissolve(ch, True)
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

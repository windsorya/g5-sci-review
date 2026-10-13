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
    check(f"{label} 三站切換列（#1333）：三項、目前站是「五上自然複習」", page.locator("#siteNav a, #siteNav [aria-current]").count() == 3 and page.locator('#siteNav [aria-current="page"]').inner_text() == "五上自然複習")
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


def main():
    with sync_playwright() as p:
        ch = p.chromium.launch()
        wk = p.webkit.launch()
        ipad = p.devices["iPad (gen 7)"]
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
        flow_review_after_plan_done(ch)
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

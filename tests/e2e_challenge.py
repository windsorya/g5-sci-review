"""考古挑戰（2026-10-23 交辦 #3006）真瀏覽器驗收：建置後的 index.html、真實題庫、Playwright 假時鐘。

情境 A（開放）：「季節與回歸線」(1-3) 的 22 題基本題都做過、都答對、今天到期 ⇒ 今天的計畫放 3 題考古挑戰。
  ① 按「開始今天的練習」：存檔裡的回合佇列有 3 題挑戰題，第一題不是挑戰題、挑戰題不相鄰
  ② 逐題做完：挑戰題標「考古挑戰」＋說明句；基本題沒有標
  ③ 挑戰題答錯：出現「這題一步一步解」，步數與內容＝src/solve.js 那一題；基本題答對不出現
  ④ 觀念頁 1-3：顯示「考古挑戰 12 題」「已開放」
情境 B（沒開放）：一題都沒做過 ⇒ 計畫沒有挑戰題；觀念頁 1-3 說「基本題還有 22 題沒做過」
  ⑤ 頁面沒有 JS 錯誤
執行：python3.12 tests/e2e_challenge.py [--page index.html]
"""
import json
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PAGE = sys.argv[sys.argv.index("--page") + 1] if "--page" in sys.argv else "index.html"
URL = PAGE if PAGE.startswith("http") else (ROOT / PAGE).as_uri()
D = "2026-10-24"

# 題庫與存檔種子：照 app.html 組 ACTIVE／CHALLENGE（同 tests/challenge.test.js）
SEED = r"""
const fs=require('fs'),vm=require('vm'),C=require('./src/core.js');const h=fs.readFileSync('src/app.html','utf8');
const grab=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i);if(i<0||j<i)throw new Error('找不到 '+a);return h.slice(i+a.length,j);};
const base=Array.from(vm.runInNewContext('('+grab('var BASE_CARDS = ',';\nvar ALL_CARDS')+')'));
const M=require('./src/merge.js'),R=require('./src/retired.js'),SOLVE=require('./src/solve.js');
const all=base.concat(require('./src/bank_extra.js'));
const A={},CH={};all.forEach(c=>{if(!M[c.id]&&!R[c.id])A[c.id]=1;if(R[c.id]&&R[c.id].kind==='challenge'&&!M[c.id])CH[c.id]=1;});
const open=C.blankState();
all.forEach(c=>{if(c.concept==='1-3'&&A[c.id])open.cards[c.id]={seen:1,goodDays:['2026-10-21'],blockedDay:null,due:'%D%'};});
const info={};all.forEach(c=>{info[c.id]={type:c.type,a:c.a,concept:c.concept,n:c.opts?c.opts.length:0};});
console.log(JSON.stringify({key:C.LS_KEY,open:open,blank:C.blankState(),ch:CH,solve:SOLVE,info:info}));
""".replace("%D%", D)
DATA = json.loads(subprocess.check_output(["node", "-e", SEED], cwd=ROOT))
FAILS = []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  ← {detail}"))
    if not ok:
        FAILS.append(name)


def open_page(br, vp, state):
    ctx = br.new_context(viewport=vp)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.install(time=D + "T19:00:00+08:00")
    pg.add_init_script("if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.setItem(%s,%s);}"
                       % (json.dumps(DATA["key"]), json.dumps(json.dumps(state))))
    pg.goto(URL, wait_until="domcontentloaded")
    pg.wait_for_selector("#main")
    return ctx, pg, errs


def saved(pg):
    return json.loads(pg.evaluate(f"localStorage.getItem({json.dumps(DATA['key'])})"))


def answer(pg, cid, ok):
    """照題型作答；回傳作答後 #ansBox 的狀態。"""
    c = DATA["info"][cid]
    if c["type"] == "map":
        for b in pg.locator("#main .blank").all():
            b.click()
        pg.locator('#grade button[data-g="%d"]' % (1 if ok else 0)).click()
    elif c["type"] == "recall":
        pg.locator("#reveal").click()
        pg.locator('#selfGrade button[data-g="%d"]' % (1 if ok else 0)).click()
    else:
        i = c["a"] if ok else (c["a"] + 1) % c["n"]
        pg.locator('#main .opt[data-i="%d"]' % i).click()
    pg.wait_for_timeout(150)


def go_next(pg):
    if pg.locator('#errq button[data-k=""]').count():
        pg.locator('#errq button[data-k=""]').click()
    pg.locator("#next").click()
    pg.wait_for_timeout(120)


def main():
    with sync_playwright() as p:
        for eng, vp in ((p.chromium, {"width": 1280, "height": 900}), (p.webkit, {"width": 820, "height": 1180}), (p.chromium, {"width": 390, "height": 844})):
            br = eng.launch()
            tag = f"{eng.name} {vp['width']}px"
            # ── 情境 A：開放 ──
            ctx, pg, errs = open_page(br, vp, DATA["open"])
            pg.get_by_role("button", name="開始今天的練習").first.click()
            pg.wait_for_selector("#main .q")
            q = saved(pg)["session"]["queue"]
            chq = [x for x in q if x in DATA["ch"]]
            adj = [q[i] for i in range(1, len(q)) if q[i] in DATA["ch"] and q[i - 1] in DATA["ch"]]
            check(f"{tag} ① 回合有 3 題挑戰題、第一題不是、不相鄰", len(chq) == 3 and q[0] not in DATA["ch"] and not adj, (len(q), chq, q[:3], adj))
            seen_tag, wrong_tag, solve_ok, basic_clean = 0, [], [], True
            for _ in range(len(q)):
                cur = saved(pg)["session"]["queue"]
                if not cur:
                    break
                cid = cur[0]
                is_ch = cid in DATA["ch"]
                has_tag = pg.locator("#chTag").count() == 1 and pg.inner_text("#chTag") == "考古挑戰"
                has_note = pg.locator("#chNote").count() == 1
                if is_ch:
                    seen_tag += 1 if (has_tag and has_note) else 0
                    answer(pg, cid, False)
                    box = pg.locator("#solveBox")
                    want = DATA["solve"][cid]
                    lis = box.locator("li").all_inner_texts() if box.count() else []
                    solve_ok.append(cid if (box.count() == 1 and lis == want and "這題一步一步解" in box.inner_text()) else "缺:" + cid)
                else:
                    if has_tag or has_note:
                        wrong_tag.append(cid)
                    answer(pg, cid, True)
                    if pg.locator("#solveBox").count():
                        basic_clean = False
                go_next(pg)
            check(f"{tag} ② 挑戰題都有「考古挑戰」標籤＋說明（{seen_tag}/3）；基本題沒有標", seen_tag == 3 and not wrong_tag, (seen_tag, wrong_tag))
            check(f"{tag} ③ 挑戰題答錯出現這題的分步驟解法（內容＝solve.js）；基本題答對不出現",
                  len(solve_ok) == 3 and all(not s.startswith("缺") for s in solve_ok) and basic_clean, (solve_ok, basic_clean))
            st = saved(pg)
            check(f"{tag} ①b 今天的計畫做完（挑戰題答錯也算做過）", set(st["days"][D]["planIds"]) <= set(st["days"][D]["doneIds"]), st["days"][D])
            pg.evaluate("window.scrollTo(0,0)")
            pg.goto(URL, wait_until="domcontentloaded")
            pg.wait_for_selector('#concepts .ccard[data-cid="1-3"]')
            pg.locator('#concepts .ccard[data-cid="1-3"]').click()
            pg.wait_for_selector("#chStatus")
            t = pg.inner_text("#chStatus")
            check(f"{tag} ④ 觀念頁 1-3：考古挑戰 12 題、已開放、做過 3 題", "考古挑戰 12 題" in t and "已開放" in t and "已做過 3 題" in t, t)
            check(f"{tag} ⑤ 沒有 JS 錯誤（A）", not errs, errs)
            ctx.close()
            # ── 情境 B：沒開放 ──
            ctx, pg, errs = open_page(br, vp, DATA["blank"])
            plan = saved(pg) if pg.evaluate(f"localStorage.getItem({json.dumps(DATA['key'])})") else None
            pg.locator('#concepts .ccard[data-cid="1-3"]').click()
            pg.wait_for_selector("#chStatus")
            t = pg.inner_text("#chStatus")
            st = saved(pg)
            pids = st["days"].get(D, {}).get("planIds", [])
            check(f"{tag} ⑥ 沒做過基本題：計畫沒有挑戰題、觀念頁說基本題還有 22 題沒做過",
                  not [x for x in pids if x in DATA["ch"]] and "還有 22 題沒做過" in t and "已開放" not in t, (pids, t))
            check(f"{tag} ⑤ 沒有 JS 錯誤（B）", not errs, errs)
            ctx.close()
            br.close()
    print(f"\n{'ALL PASS' if not FAILS else str(len(FAILS)) + ' FAIL'}")
    return 1 if FAILS else 0


if __name__ == "__main__":
    raise SystemExit(main())

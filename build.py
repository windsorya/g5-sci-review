#!/usr/bin/env python3
"""把 src/app.html（Artifact 格式：沒有 doctype/head）包成可直接開啟的 index.html。

為什麼分兩份：同一份內容可以發成 claude.ai Artifact，也可以放 GitHub Pages
讓孩子的 iPad 不登入就能開；Pages 需要自己帶 viewport 與 noindex。
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HEAD = ('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="robots" content="noindex,nofollow">'
        '<link rel="icon" type="image/svg+xml" href="favicon.svg">'
        '<link rel="apple-touch-icon" href="apple-touch-icon.png">'
        '<meta name="theme-color" content="#1f5f8b">'
        '<meta name="apple-mobile-web-app-capable" content="yes">'
        '<meta name="apple-mobile-web-app-title" content="自然複習">'
        '</head><body>')


INLINE = re.compile(r"<!--@INLINE (src/[A-Za-z0-9_.-]+\.js)-->")


def inline(body: str) -> str:
    """把 <!--@INLINE src/x.js--> 換成 <script> 內容；核心邏輯（src/core.js）與 node 測試共用同一份檔。"""
    def sub(m: re.Match) -> str:
        js = (ROOT / m.group(1)).read_text(encoding="utf-8")
        if "</script" in js.lower():
            raise SystemExit(f"{m.group(1)} 含 </script，不能內嵌")
        return "<script>\n" + js + "\n</script>"
    out = INLINE.sub(sub, body)
    if "<!--@INLINE" in out:
        raise SystemExit("還有沒換掉的 @INLINE 標記")
    return out


# 錯題站讀「自然 app 待加強題數」用的 weak-export.js（交辦 #4027；規格＝g5-wrong-review/docs/app-weak-entry-design-20261019.md 第 2 節）。
# 題庫一律取 app.html 組 BANK 那一段原文（同 tests/challenge.test.js 的切法），判定一律是內嵌的同一份 src/core.js：
# 「練待加強的」與錯題站的題數永遠同一份程式，改了停出名單、題庫或 core.js 重 build 就跟著變。
BANK_FROM, BANK_TO = "var UNITS = ", "\n\nvar ERRS"
EXPORT_INLINE = re.compile(r"/\*@INLINE (src/[A-Za-z0-9_.-]+\.js)\*/")


def bank_segment(app_src: str) -> str:
    if app_src.count(BANK_FROM) != 1 or app_src.count(BANK_TO) != 1:
        raise SystemExit("weak-export：app.html 裡找不到唯一一段 var UNITS = … 到 var ERRS（組 BANK 那一段改了，請同步 build.py）")
    i = app_src.index(BANK_FROM)
    j = app_src.index(BANK_TO, i)
    seg = app_src[i:j]
    if "var BANK = " not in seg:
        raise SystemExit("weak-export：組 BANK 那一段裡沒有 var BANK =")
    return seg


def build_weak_export(app_src: str) -> str:
    tpl = (ROOT / "src" / "weak_export.js").read_text(encoding="utf-8")
    out = EXPORT_INLINE.sub(lambda m: (ROOT / m.group(1)).read_text(encoding="utf-8"), tpl)
    if out.count("/*@BANK*/") != 1:
        raise SystemExit("weak-export 樣板要剛好一個 /*@BANK*/")
    out = out.replace("/*@BANK*/", bank_segment(app_src))
    if "/*@INLINE" in out:
        raise SystemExit("weak-export 還有沒換掉的 @INLINE 標記")
    head = "// 自動產生，不要手改：python3 build.py 由 src/weak_export.js＋src/core.js＋src/retired.js＋src/merge.js＋src/bank_extra.js＋src/app.html（組 BANK 那一段）產生（交辦 #4027）\n"
    return head + out


def main() -> None:
    app_src = (ROOT / "src" / "app.html").read_text(encoding="utf-8")
    body = inline(app_src)
    (ROOT / "index.html").write_text(HEAD + body + "</body></html>", encoding="utf-8")
    print(f"built index.html ({len(body)} chars)")
    wx = build_weak_export(app_src)
    (ROOT / "weak-export.js").write_text(wx, encoding="utf-8")
    print(f"built weak-export.js ({len(wx)} chars)")


if __name__ == "__main__":
    main()

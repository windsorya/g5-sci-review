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


TOKENS = re.compile(r"/\*@TOKENS-BEGIN[^*]*\*/(.*?)/\*@TOKENS-END\*/", re.S)


def build_math(app_src: str) -> None:
    """數學小教室（math/index.html）：色票只維護 src/app.html 那一份，建置時複製進來。"""
    m = TOKENS.search(app_src)
    if not m:
        raise SystemExit("src/app.html 找不到 @TOKENS-BEGIN／@TOKENS-END 區段")
    src = (ROOT / "src" / "math.html").read_text(encoding="utf-8")
    if src.count("/*@TOKENS*/") != 1:
        raise SystemExit("src/math.html 要有一個 /*@TOKENS*/")
    body = inline(src.replace("/*@TOKENS*/", m.group(1).strip()))
    out = ROOT / "math" / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(HEAD.replace('content="自然複習"', 'content="數學小教室"') + body + "</body></html>", encoding="utf-8")
    print(f"built math/index.html ({len(body)} chars)")


def main() -> None:
    app_src = (ROOT / "src" / "app.html").read_text(encoding="utf-8")
    body = inline(app_src)
    (ROOT / "index.html").write_text(HEAD + body + "</body></html>", encoding="utf-8")
    print(f"built index.html ({len(body)} chars)")
    build_math(app_src)


if __name__ == "__main__":
    main()

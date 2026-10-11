#!/usr/bin/env python3
"""把 src/app.html（Artifact 格式：沒有 doctype/head）包成可直接開啟的 index.html。

為什麼分兩份：同一份內容可以發成 claude.ai Artifact，也可以放 GitHub Pages
讓孩子的 iPad 不登入就能開；Pages 需要自己帶 viewport 與 noindex。
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HEAD = ('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="robots" content="noindex,nofollow">'
        '<meta name="apple-mobile-web-app-capable" content="yes">'
        '<meta name="apple-mobile-web-app-title" content="自然複習">'
        '</head><body>')


def main() -> None:
    body = (ROOT / "src" / "app.html").read_text(encoding="utf-8")
    (ROOT / "index.html").write_text(HEAD + body + "</body></html>", encoding="utf-8")
    print(f"built index.html ({len(body)} chars)")


if __name__ == "__main__":
    main()

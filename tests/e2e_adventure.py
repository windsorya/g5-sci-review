"""Island UI regression; never use a real child's stored profile.
Run: python3 tests/e2e_adventure.py
Optional CHROMIUM_EXECUTABLE and ADVENTURE_TEST_URL support hosted previews.
Checks 390px/1280px, art, dialogue keyboard/cancel, existing quiz entry,
card-state preservation before answering, feedback, and daily-task entry.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from e2e_map_rule import seed_state

ROOT = Path(__file__).resolve().parent.parent
URL = os.getenv("ADVENTURE_TEST_URL", (ROOT / "index.html").as_uri())


def card_state(page):
    return page.evaluate("JSON.parse(localStorage.getItem(G5Core.LS_KEY)).cards")


def no_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "horizontal overflow"


def main():
    seed = seed_state()
    with sync_playwright() as p:
        launch = {"executable_path": os.environ["CHROMIUM_EXECUTABLE"]} if os.getenv("CHROMIUM_EXECUTABLE") else {}
        browser = p.chromium.launch(**launch)
        for width in (390, 1280):
            context = browser.new_context(viewport={"width": width, "height": 900}, reduced_motion="reduce")
            context.add_init_script("if(!sessionStorage.getItem('adventure-seed')){sessionStorage.setItem('adventure-seed','1');localStorage.setItem(%s,%s)}" % (json.dumps(seed["key"]), json.dumps(json.dumps(seed["s"]))))
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(URL)
            page.wait_for_selector("#mapBox button.stn")
            before = card_state(page)
            assert before == seed["s"]["cards"], "boot changed seeded card history"
            assert page.locator("#mapBox .island-art").count() == 7
            assert page.locator("#mapBox .buddy").count() >= 1
            no_overflow(page)
            station = page.locator(f'#mapBox .stn[data-cid="{seed["ids"][1]}"]')
            station.click()
            page.wait_for_selector("#questDialog[open]")
            assert page.locator("#questTitle").inner_text()
            no_overflow(page)
            page.locator("#islandBack").click()
            assert page.locator("#questDialog").count() == 0
            assert card_state(page) == before, "cancelling dialogue changed card history"
            station.click()
            page.keyboard.press("Escape")
            page.wait_for_selector("#questDialog", state="detached")
            assert card_state(page) == before, "Escape changed card history"
            station.click()
            page.locator("#islandGo").click()
            page.wait_for_selector("#cGo")
            assert card_state(page) == before, "entering island changed card history"
            page.locator("#cGo").click()
            page.wait_for_selector("#main .q")
            assert card_state(page) == before, "starting quiz changed card history before an answer"
            no_overflow(page)
            # Exercise whichever existing question format is first in the session.
            if page.locator("#main .opt").count():
                page.locator("#main .opt").first.click()
            elif page.locator("#reveal").count():
                page.locator("#reveal").click()
                page.locator('#selfGrade [data-g="1"]').click()
            else:
                for button in page.locator("#main .blank").all():
                    button.click()
                page.locator('#grade [data-g="1"]').click()
            assert page.locator("#ansBox").inner_text().strip(), "answer produced no feedback"
            no_overflow(page)
            assert not errors, errors
            # Fresh, isolated profile verifies daily-task entry independently.
            fresh = browser.new_context(viewport={"width": width, "height": 900}, reduced_motion="reduce")
            daily = fresh.new_page()
            daily.goto(URL)
            daily.wait_for_selector("#goAll")
            daily.locator("#goAll").click()
            daily.wait_for_selector("#main .q")
            no_overflow(daily)
            print(f"PASS adventure {width}px: art/dialogue/cancel/quiz/feedback/card preservation/daily entry")
            fresh.close()
            context.close()
        browser.close()


if __name__ == "__main__":
    main()

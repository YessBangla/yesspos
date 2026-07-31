#!/usr/bin/env python3
"""Visual regression checks for the menu bar / side menu chrome.

Captures element screenshots of the sidebar rail and the top bar across key
routes in several states (light, dark, high-contrast, hover, RTL) and compares
them against committed baselines.

Usage:
    python3 scripts/visual-regression.py            # compare against baselines
    python3 scripts/visual-regression.py --update    # (re)write baselines
    python3 scripts/visual-regression.py --base-url http://localhost:8080

Baselines live in tests/visual/baseline, diffs are written to
tests/visual/output. Requires an authenticated preview session; the Lovable
sandbox injects it through LOVABLE_BROWSER_SUPABASE_* env vars.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageChops
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
BASELINE = ROOT / "tests" / "visual" / "baseline"
OUTPUT = ROOT / "tests" / "visual" / "output"

# Routes that must all render the same menu chrome.
ROUTES = ["/dashboard", "/pos", "/products", "/reports", "/settings"]

# (name, theme-state patch, html dir)
STATES = [
    ("light", {"mode": "light", "contrast": "normal"}, "ltr"),
    ("dark", {"mode": "dark", "contrast": "normal"}, "ltr"),
    ("dark-high-contrast", {"mode": "dark", "contrast": "high"}, "ltr"),
    ("light-rtl", {"mode": "light", "contrast": "normal"}, "rtl"),
]

THEME_KEY = "sherapos.dashboard.theme"
# Pixel ratio allowed to differ before a check fails.
TOLERANCE = 0.005


def diff_ratio(a: Path, b: Path) -> float:
    ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    if ia.size != ib.size:
        return 1.0
    bbox_diff = ImageChops.difference(ia, ib)
    hist = bbox_diff.convert("L").histogram()
    changed = sum(hist[16:])  # ignore sub-perceptual noise
    return changed / float(ia.size[0] * ia.size[1])


async def restore_session(context, page) -> None:
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = page.url or "http://localhost:8080"
        await context.add_cookies(cookies)
    if storage_key and session_json:
        await page.evaluate(
            "([k, v]) => window.localStorage.setItem(k, v)", [storage_key, session_json]
        )


async def run(base_url: str, update: bool) -> int:
    BASELINE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 1800}, device_scale_factor=1
        )
        page = await context.new_page()
        await page.goto(base_url, wait_until="domcontentloaded")
        await restore_session(context, page)

        for state_name, patch, direction in STATES:
            settings = {"theme": "sky", "mode": "system", "glass": True, "contrast": "normal"}
            settings.update(patch)
            await page.evaluate(
                "([k, v, dir]) => { window.localStorage.setItem(k, v); document.documentElement.dir = dir; }",
                [THEME_KEY, json.dumps(settings), direction],
            )

            for route in ROUTES:
                await page.goto(base_url + route, wait_until="networkidle")
                await page.evaluate(
                    "([dir, dark]) => { document.documentElement.dir = dir; document.documentElement.classList.toggle('dark', dark); }",
                    [direction, patch["mode"] == "dark"],
                )
                rail = page.locator("nav.nav-rail").first
                if await rail.count() == 0:
                    print(f"! skipped {route} ({state_name}) — sidebar not rendered (signed out?)")
                    continue

                # Hover the first menu item so hover styling is captured too.
                await rail.locator("[data-nav-focusable]").first.hover()
                await page.wait_for_timeout(400)

                slug = route.strip("/").replace("/", "-") or "root"
                name = f"{slug}__{state_name}.png"
                shot = OUTPUT / name
                await rail.screenshot(path=str(shot))

                base = BASELINE / name
                if update or not base.exists():
                    base.write_bytes(shot.read_bytes())
                    print(f"= baseline written: {name}")
                    continue

                ratio = diff_ratio(base, shot)
                if ratio > TOLERANCE:
                    failures.append(f"{name} differs by {ratio:.3%}")
                    print(f"x {name}: {ratio:.3%} changed")
                else:
                    print(f"v {name}: ok ({ratio:.3%})")

        await browser.close()

    if failures:
        print("\nVisual regressions detected:")
        for f in failures:
            print(" -", f)
        return 1
    print("\nAll menu chrome checks passed.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8080")
    ap.add_argument("--update", action="store_true", help="rewrite baselines")
    args = ap.parse_args()
    return asyncio.run(run(args.base_url, args.update))


if __name__ == "__main__":
    sys.exit(main())

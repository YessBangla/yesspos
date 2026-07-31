# Menu chrome visual regression

Run `python3 scripts/visual-regression.py` (add `--update` to refresh
baselines) with the dev server running and an authenticated preview session.

It captures the sidebar rail on `/dashboard`, `/pos`, `/products`, `/reports`
and `/settings` in light, dark, dark + high contrast and RTL, with the first
menu item hovered, and fails when any capture drifts more than 0.5% from the
committed baseline in `baseline/`.

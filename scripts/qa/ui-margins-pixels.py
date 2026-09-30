"""Pixel check for scripts/qa/ui-margins.mjs screenshots.

For each view, scans the band just below the nav (the page header row) and returns the first and
last columns whose colour differs from the page background. Those are the real left and right
margins of the content in absolute pixels. The DOM numbers are compared with them.
Usage: python3 scripts/qa/ui-margins-pixels.py <outDir>   (reads margins.json + shots/*.png)
"""
import json
import sys
from collections import Counter

from PIL import Image

out = sys.argv[1]
rows = json.load(open(f"{out}/margins.json"))
res = []
for r in rows:
    if r.get("error") or r["role"].startswith("player") or r["role"] == "anon":
        continue
    im = Image.open(f"{out}/shots/{r['slug']}.png").convert("RGB")
    W, H = im.size
    top = int(r.get("navBottom") or 0) + 8
    band = (top, min(H, top + 240))
    bg = Counter(im.getpixel((x, band[0] + 2)) for x in range(0, 8)).most_common(1)[0][0]

    def col_has_ink(x):
        for y in range(band[0], band[1], 2):
            p = im.getpixel((x, y))
            if sum(abs(a - b) for a, b in zip(p, bg)) > 60:
                return True
        return False

    left = next((x for x in range(W) if col_has_ink(x)), None)
    right = next((x for x in range(W - 1, -1, -1) if col_has_ink(x)), None)
    res.append({"role": r["role"], "route": r["route"], "inkLeft": left, "inkRight": right, "domShellX": (r.get("shell") or {}).get("x"), "domH1X": (r.get("h1") or {}).get("x")})
json.dump(res, open(f"{out}/pixels.json", "w"), indent=1)
c = Counter((x["inkLeft"], W - 1 - x["inkRight"] if x["inkRight"] is not None else None) for x in res)
print("left ink / right margin (px):", dict(c.most_common()))

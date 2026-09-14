#!/usr/bin/env python3
"""Measure hero-loop candidate stills against the brief's rules and build a contact sheet.

Luminance = WCAG relative luminance (sRGB linearised), reported as % of white.
Brightest region = argmax of a 96x54 box-filtered luminance map; its x-centre is reported as % of width.
"""
import sys, glob, os, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

def srgb_to_linear(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def rel_lum(rgb):
    lin = srgb_to_linear(rgb.astype(np.float64))
    return 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]

def measure(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    rgb = np.asarray(im)
    Y = rel_lum(rgb)
    mean = Y.mean() * 100
    p99 = np.percentile(Y, 99) * 100
    under10 = (Y < 0.10).mean() * 100
    # box-filtered map for the brightest region
    small = np.asarray(im.resize((96, 54), Image.BOX))
    Ys = rel_lum(small)
    iy, ix = np.unravel_index(np.argmax(Ys), Ys.shape)
    bx = (ix + 0.5) / 96 * 100
    by = (iy + 0.5) / 54 * 100
    # hot region: cells above 50% of the max; report its x extent
    hot = Ys >= 0.5 * Ys.max()
    cols = np.where(hot.any(axis=0))[0]
    hot_x0 = cols.min() / 96 * 100
    hot_x1 = (cols.max() + 1) / 96 * 100
    # colour of the lit region (top 1% brightest pixels): hue/sat
    thr = np.percentile(Y, 99)
    lit = rgb[Y >= thr].astype(np.float64)
    r, g, b = lit[:, 0].mean(), lit[:, 1].mean(), lit[:, 2].mean()
    mx, mn = max(r, g, b), min(r, g, b)
    sat = (mx - mn) / mx * 100 if mx > 0 else 0
    # hue in degrees
    if mx == mn:
        hue = 0.0
    elif mx == r:
        hue = (60 * ((g - b) / (mx - mn)) + 360) % 360
    elif mx == g:
        hue = 60 * ((b - r) / (mx - mn)) + 120
    else:
        hue = 60 * ((r - g) / (mx - mn)) + 240
    # text zone: left 60% of width, vertical middle band (25%..75%)
    tz = Y[int(h * 0.25):int(h * 0.75), :int(w * 0.60)]
    tz_p99 = np.percentile(tz, 99) * 100
    tz_mean = tz.mean() * 100
    contrast = (1.0 + 0.05) / (tz.mean() + 0.05)  # #f4f4f5 has Y≈0.911; use exact below
    Yf = rel_lum(np.array([[[0xf4, 0xf4, 0xf5]]], dtype=np.uint8))[0, 0]
    contrast = (Yf + 0.05) / (tz.mean() + 0.05)
    # letterbox bars: rows whose brightest pixel is under 0.2% luminance, from each edge
    rowmax = Y.max(axis=1)
    bar_top = int(np.argmax(rowmax > 0.002)); bar_bot = int(np.argmax(rowmax[::-1] > 0.002))
    # shadow tint: mean RGB of pixels between 0.1% and 2% luminance
    sh = rgb[(Y > 0.001) & (Y < 0.02)].astype(np.float64)
    shadow_rgb = [round(v, 1) for v in sh.mean(axis=0)] if len(sh) else [0, 0, 0]
    flags = []
    if bar_top > 0.02 * h and bar_bot > 0.02 * h: flags.append(f"letterbox bars baked in ({bar_top}px top, {bar_bot}px bottom)")
    if shadow_rgb[2] - shadow_rgb[0] > 5: flags.append(f"blue-tinted shadows (rgb {shadow_rgb})")
    if under10 < 50: flags.append(f"only {under10:.0f}% of frame under 10% lum")
    if not (70 <= bx <= 85): flags.append(f"brightest region at x={bx:.0f}% (want 70-85)")
    if hot_x0 < 60: flags.append(f"hot region spills left to x={hot_x0:.0f}%")
    if sat > 35 and (hue < 45 or hue > 330): flags.append(f"light reads orange/red (hue {hue:.0f}°, sat {sat:.0f}%)")
    if sat > 25 and 190 <= hue <= 260: flags.append(f"blue tint (hue {hue:.0f}°, sat {sat:.0f}%)")
    if mean > 10: flags.append(f"mean luminance {mean:.1f}% is high")
    return dict(file=os.path.basename(path), w=w, h=h, mean=round(mean, 2), p99=round(p99, 1),
                under10=round(under10, 1), bright_x=round(bx, 1), bright_y=round(by, 1),
                hot_x=[round(hot_x0, 1), round(hot_x1, 1)], light_hue=round(hue, 0), light_sat=round(sat, 0),
                tz_mean=round(tz_mean, 2), tz_p99=round(tz_p99, 1), tz_contrast=round(contrast, 1), bars=[bar_top, bar_bot], shadow_rgb=shadow_rgb, flags=flags)

def sheet(paths, results, out):
    tw, th, pad, cap = 480, 270, 12, 40
    cols = 4
    rows = (len(paths) + cols - 1) // cols
    W = cols * (tw + pad) + pad
    H = rows * (th + cap + pad) + pad
    board = Image.new("RGB", (W, H), (24, 24, 24))
    d = ImageDraw.Draw(board)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
    except Exception:
        font = ImageFont.load_default()
    for i, (p, r) in enumerate(zip(paths, results)):
        im = Image.open(p).convert("RGB")
        im = ImageOps.fit(im, (tw, th), Image.LANCZOS)
        x = pad + (i % cols) * (tw + pad)
        y = pad + (i // cols) * (th + cap + pad)
        board.paste(im, (x, y))
        # marker for brightest region + text-zone box
        bx = x + r["bright_x"] / 100 * tw; by = y + r["bright_y"] / 100 * th
        d.ellipse([bx - 6, by - 6, bx + 6, by + 6], outline=(255, 80, 80), width=2)
        d.rectangle([x + 0.70 * tw, y, x + 0.85 * tw, y + th], outline=(90, 90, 90), width=1)
        d.rectangle([x, y + 0.25 * th, x + 0.60 * tw, y + 0.75 * th], outline=(60, 90, 160), width=1)
        ok = "OK" if not r["flags"] else "FLAG"
        d.text((x, y + th + 4), f'{r["file"]}  mean {r["mean"]}%  p99 {r["p99"]}%  light x {r["bright_x"]}%  {ok}', fill=(230, 230, 230), font=font)
        if r["flags"]:
            d.text((x, y + th + 22), "; ".join(r["flags"])[:70], fill=(255, 140, 120), font=font)
    board.save(out, "JPEG", quality=85)

if __name__ == "__main__":
    d = sys.argv[1]
    paths = sorted(glob.glob(os.path.join(d, "*.png")), key=lambda p: (os.path.basename(p)[0] != "B", os.path.basename(p)))
    results = [measure(p) for p in paths]
    for r in results:
        print(json.dumps(r))
    sheet(paths, results, os.path.join(d, "sheet.jpg"))
    json.dump(results, open(os.path.join(d, "measurements.json"), "w"), indent=1)
    print("sheet ->", os.path.join(d, "sheet.jpg"))

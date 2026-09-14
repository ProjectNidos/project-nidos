#!/usr/bin/env python3
"""Step 4 numbers for a hero loop: per-frame text-zone luminance and light position.

  measure_loop.py <loop.mp4> [--overlay 0.5]

Text zone = left 60% of width, vertical 25-75% band. Luminance = WCAG relative luminance (% of white).
Reports the worst frame for the text zone, the contrast of #f4f4f5 against that frame's text-zone mean,
the same with a flat rgba(5,5,5,overlay) layer, and whether the brightest region stays in 70-85% of width.
"""
import subprocess, sys, os, json, argparse
import numpy as np
FF = os.environ.get("FFMPEG", "ffmpeg")

def lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def Y(rgb):
    l = lin(rgb.astype(np.float64)); return 0.2126 * l[..., 0] + 0.7152 * l[..., 1] + 0.0722 * l[..., 2]
YF = float(Y(np.array([[[0xf4, 0xf4, 0xf5]]], dtype=np.uint8))[0, 0])

def frames(path, w=960, h=540):
    p = subprocess.Popen([FF, "-hide_banner", "-loglevel", "error", "-i", path, "-vf", f"scale={w}:{h}",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], stdout=subprocess.PIPE)
    n = w * h * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3)
    p.wait()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("video"); ap.add_argument("--overlay", type=float, default=0.5)
    a = ap.parse_args()
    w, h = 960, 540
    tz = (slice(int(h * .25), int(h * .75)), slice(0, int(w * .60)))
    worst = dict(tz_p99=-1, tz_mean=0, frame=0); worst_mean = dict(tz_mean=-1, frame=0, rgb=None)
    xs = []; frame_p99 = []; n = 0
    for i, f in enumerate(frames(a.video)):
        y = Y(f); n += 1
        t = y[tz]; p99 = float(np.percentile(t, 99)) * 100; m = float(t.mean())
        frame_p99.append(float(np.percentile(y, 99)) * 100)
        if p99 > worst["tz_p99"]: worst = dict(tz_p99=round(p99, 2), tz_mean=round(m * 100, 3), frame=i)
        if m > worst_mean["tz_mean"]: worst_mean = dict(tz_mean=m, frame=i, rgb=f[tz])
        # brightest region: 96x54 box filter
        small = y.reshape(54, 10, 96, 10).mean(axis=(1, 3))
        iy, ix = np.unravel_index(np.argmax(small), small.shape); xs.append((ix + .5) / 96 * 100)
    xs = np.array(xs)
    m = worst_mean["tz_mean"]
    contrast = (YF + .05) / (m + .05)
    # flat overlay rgba(5,5,5,a) composited in sRGB, then luminance
    ov = a.overlay
    comp = (worst_mean["rgb"].astype(np.float64) * (1 - ov) + 5 * ov)
    m_ov = float(Y(comp).mean()); contrast_ov = (YF + .05) / (m_ov + .05)
    rep = dict(frames=n, worst_text_zone_p99=worst, brightest_text_zone_mean_pct=round(m * 100, 3),
               contrast_f4f4f5=round(contrast, 1), contrast_with_overlay=round(contrast_ov, 1), overlay_alpha=ov,
               light_x_min=round(float(xs.min()), 1), light_x_max=round(float(xs.max()), 1),
               frames_light_outside_70_85=int(((xs < 70) | (xs > 85)).sum()),
               frame_p99_max=round(max(frame_p99), 1), frame_p99_min=round(min(frame_p99), 1))
    print(json.dumps(rep, indent=1))

if __name__ == "__main__":
    main()

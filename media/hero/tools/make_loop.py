#!/usr/bin/env python3
"""Turn a generated clip into a seamless hero loop.

  make_loop.py <src.mp4> <outdir> <name> [--xfade 1.0] [--max-len 10]

Steps: normalise to 1920x1080 @ 24 fps (cover-crop), crossfade the tail into the head with xfade so the
last frame equals the first, write a high-quality master, then encode <name>.mp4 (H.264, CRF 27, slow,
faststart) and <name>.webm (AV1, CRF 40), pick the darkest frame as <name>-poster.webp (q70) plus a
720-wide copy, concatenate three loops, and dump a seam filmstrip + a numeric seam score.
"""
import subprocess, sys, os, re, json, argparse
import numpy as np

FF = os.environ.get("FFMPEG", "ffmpeg")

def sh(args, capture=True):
    try:
        r = subprocess.run([FF, "-hide_banner", "-y", *args], capture_output=capture, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        raise SystemExit(f"ffmpeg timed out (300s): {' '.join(args[:6])} ...")
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-3000:] if r.stderr else "")
        raise SystemExit(f"ffmpeg failed: {' '.join(args[:6])} ...")
    return r

def probe(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", r.stderr)
    dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    v = re.search(r"Video: .*?, (\d+)x(\d+).*?, ([\d.]+) fps", r.stderr)
    return dur, int(v.group(1)), int(v.group(2)), float(v.group(3))

def frames(path, w=480, h=270):
    """Yield frames as uint8 arrays (h, w, 3), downscaled."""
    p = subprocess.Popen([FF, "-hide_banner", "-loglevel", "error", "-i", path, "-vf", f"scale={w}:{h}",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], stdout=subprocess.PIPE)
    n = w * h * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3)
    p.wait()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("outdir"); ap.add_argument("name")
    ap.add_argument("--xfade", type=float, default=1.0)
    ap.add_argument("--max-len", type=float, default=10.0, help="use at most this many seconds of the source")
    ap.add_argument("--av1-speed", type=int, default=6)
    a = ap.parse_args()
    os.makedirs(a.outdir, exist_ok=True)
    out = lambda s: os.path.join(a.outdir, s)

    D0, w, h, fps = probe(a.src)
    print(f"source: {w}x{h} @ {fps} fps, {D0:.3f}s")
    # 1. normalise (cover-crop to 16:9, 24 fps), high quality intermediate
    norm = out(f"{a.name}-norm.mp4")
    sh(["-i", a.src, "-t", str(a.max_len),
        "-vf", "fps=24,scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1,format=yuv420p",
        "-c:v", "libx264", "-crf", "12", "-preset", "fast", "-an", norm])
    D, _, _, _ = probe(norm)
    X = a.xfade
    L = D - X
    print(f"normalised: {D:.3f}s -> loop length {L:.3f}s with {X}s crossfade")
    # 2. loop master. The crossfade is done here in numpy on raw yuv420p frames (a linear mix, the
    #    same maths as xfade) so the seam is exact by construction and checkable frame by frame:
    #      head  = source frames [0 .. XF]            (kept in memory, XF+1 frames)
    #      out   = source [XF+1 .. N-XF-1] unchanged, then source [N-XF .. N-1] mixed into head[0..XF-1]
    #              with weight (k+1)/(XF+1), then head[XF] at 100%.
    #    Last output frame = source XF, first = source XF+1: consecutive frames, no step at the wrap.
    N = int(round(D * 24)); XF = int(round(X * 24))
    w, h = 1920, 1080; fsz = w * h * 3 // 2
    master = out(f"{a.name}-master.mp4")
    dec = subprocess.Popen([FF, "-hide_banner", "-loglevel", "error", "-i", norm, "-f", "rawvideo", "-pix_fmt", "yuv420p", "pipe:1"],
                           stdout=subprocess.PIPE)
    enc = subprocess.Popen([FF, "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "yuv420p", "-s", f"{w}x{h}",
                            "-r", "24", "-i", "pipe:0", "-c:v", "libx264", "-crf", "12", "-preset", "fast", "-an", master],
                           stdin=subprocess.PIPE)
    head = []; n_out = 0; i = 0
    while True:
        b = dec.stdout.read(fsz)
        if len(b) < fsz: break
        if i <= XF:
            head.append(np.frombuffer(b, np.uint8).astype(np.float32))
        elif i < N - XF:
            enc.stdin.write(b); n_out += 1
        else:
            k = i - (N - XF); P = (k + 1) / (XF + 1)
            fr = np.frombuffer(b, np.uint8).astype(np.float32)
            enc.stdin.write(np.clip((1 - P) * fr + P * head[k] + 0.5, 0, 255).astype(np.uint8).tobytes()); n_out += 1
        i += 1
    enc.stdin.write(head[XF].astype(np.uint8).tobytes()); n_out += 1
    enc.stdin.close(); enc.wait(); dec.wait()
    print(f"frames: N={N} XF={XF} read={i} out={n_out} -> loop {n_out / 24:.3f}s (last=src[{XF}], first=src[{XF + 1}])")
    LM, _, _, _ = probe(master)
    # 3. deliverables
    mp4 = out(f"{a.name}.mp4")
    sh(["-i", master, "-c:v", "libx264", "-crf", "27", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", "-an", mp4])
    webm = out(f"{a.name}.webm")
    sh(["-i", master, "-c:v", "libaom-av1", "-crf", "40", "-b:v", "0", "-cpu-used", str(a.av1_speed), "-row-mt", "1",
        "-pix_fmt", "yuv420p", "-an", webm])
    # 4. darkest frame -> poster (measured on the mp4 that ships)
    best_t, best_y, t = None, 1e9, 0.0
    for i, f in enumerate(frames(mp4)):
        y = f.astype(np.float32).mean()
        if y < best_y: best_y, best_t = y, i / 24.0
    poster = out(f"{a.name}-poster.webp"); poster720 = out(f"{a.name}-poster-720.webp")
    sh(["-ss", f"{best_t:.4f}", "-i", master, "-frames:v", "1", "-c:v", "libwebp", "-quality", "70", poster])
    sh(["-ss", f"{best_t:.4f}", "-i", master, "-frames:v", "1", "-vf", "scale=720:-2", "-c:v", "libwebp", "-quality", "70", poster720])
    # 5. three consecutive loops + seam filmstrip + seam score
    triple = out(f"{a.name}-x3.mp4")
    sh(["-stream_loop", "2", "-i", mp4, "-c", "copy", triple])
    seam_t = LM
    sh(["-ss", f"{seam_t - 6 / 24:.4f}", "-t", f"{12 / 24:.4f}", "-i", triple, "-vf", "scale=320:-1,tile=6x2",
        "-frames:v", "1", "-update", "1", out(f"{a.name}-seam.png")])
    fr = [f.astype(np.float32) for f in frames(master)]
    diffs = np.array([float(np.abs(fr[i + 1] - fr[i]).mean()) for i in range(len(fr) - 1)])
    seam_d = float(np.abs(fr[0] - fr[-1]).mean())   # the wrap: last frame of the loop -> first frame
    typical = float(np.median(diffs)); p95 = float(np.percentile(diffs, 95))
    sizes = {os.path.basename(p): os.path.getsize(p) for p in (mp4, webm, poster, poster720)}
    rep = dict(source=os.path.basename(a.src), loop_seconds=round(LM, 3), crossfade=X, fps=24,
               darkest_frame_t=round(best_t, 3), seam_diff=round(float(seam_d), 3),
               typical_diff=round(typical, 3), p95_diff=round(p95, 3),
               seam_ratio_vs_p95=round(float(seam_d) / p95, 2) if p95 else None, sizes=sizes)
    print(json.dumps(rep, indent=1))
    json.dump(rep, open(out(f"{a.name}-report.json"), "w"), indent=1)

if __name__ == "__main__":
    main()

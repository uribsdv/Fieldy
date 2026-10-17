#!/usr/bin/env python3
"""Cut a 3x3 sheet of reward illustrations on a flat magenta (#FF00FF) background
into the transparent PNGs the app loads from assets/rewards/.

    python3 tools/cut_reward_sheet.py sheet.png                # writes assets/rewards/*.png
    python3 tools/cut_reward_sheet.py sheet.png --out /tmp/x   # somewhere else, to look first

Needs Pillow and numpy (pip install pillow numpy).

The cells are read left to right, top to bottom, in the order the sheet was
asked for (see ORDER). Each item is keyed out of the magenta, the pink fringe
along its antialiased edge is removed (the colour is un-mixed from the
magenta, not just made transparent), it is cropped to its own outline with a
little margin and centred on a 512x512 transparent square. The file names are
the ones the app's reward table (REWARDS in index.html) points at, so dropping
the new files in replaces the placeholders with nothing else to change.
"""
import argparse, os, sys

try:
    import numpy as np
    from PIL import Image
except ImportError:
    sys.exit('needs Pillow and numpy:  pip install pillow numpy')

# cell order in the sheet -> file name in assets/rewards/
ORDER = [
    'water-lily',       # 1 open water lily on a pad
    'water-lily-bud',   # 2 closed bud on a small pad
    'dragonfly-teal',   # 3 dragonfly, wings spread
    'dragonfly-amber',  # 4 dragonfly resting, side view, amber body
    'koi',              # 5 small orange-and-cream koi
    'river-fish',       # 6 small silver-teal river fish
    'glowing-ripple',   # 7 three rings of soft aqua light
    'fireflies',        # 8 three amber firefly orbs
    'frog',             # 9 small frog on a lily pad
]
SIZE = 512          # output square
MARGIN = 0.07       # empty space kept around the item, as a share of its size
LO, HI = 70, 190    # "magenta-ness" (min(R,B) - G): <= LO is the item, >= HI is background


def key_out(rgb):
    """Alpha from how magenta each pixel is, and colours un-mixed from the magenta."""
    f = rgb.astype(np.float32)
    m = np.minimum(f[..., 0], f[..., 2]) - f[..., 1]
    a = np.clip((HI - m) / (HI - LO), 0.0, 1.0)
    # un-mix: observed = a*colour + (1-a)*magenta  ->  colour = (observed - (1-a)*magenta) / a
    mag = np.array([255.0, 0.0, 255.0], dtype=np.float32)
    safe = np.maximum(a, 1e-3)[..., None]
    col = (f - (1.0 - a)[..., None] * mag) / safe
    col = np.clip(col, 0, 255)
    col[a < 0.02] = 0
    return col, a


def cut(sheet_path, out_dir, rows=3, cols=3):
    im = Image.open(sheet_path).convert('RGB')
    rgb = np.asarray(im)
    H, W = rgb.shape[:2]
    col, a = key_out(rgb)
    os.makedirs(out_dir, exist_ok=True)
    report = []
    for i, name in enumerate(ORDER[:rows * cols]):
        r, c = divmod(i, cols)
        y0, y1 = r * H // rows, (r + 1) * H // rows
        x0, x1 = c * W // cols, (c + 1) * W // cols
        ca, cc = a[y0:y1, x0:x1], col[y0:y1, x0:x1]
        ys, xs = np.where(ca > 0.08)
        if not len(ys):
            report.append((name, 'EMPTY CELL'))
            continue
        by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        touches = by0 == 0 or bx0 == 0 or by1 == ca.shape[0] or bx1 == ca.shape[1]
        rgba = np.dstack([cc[by0:by1, bx0:bx1], ca[by0:by1, bx0:bx1] * 255]).astype(np.uint8)
        item = Image.fromarray(rgba, 'RGBA')
        side = int(max(item.size) * (1 + 2 * MARGIN))
        canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        canvas.paste(item, ((side - item.width) // 2, (side - item.height) // 2), item)
        canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
        path = os.path.join(out_dir, name + '.png')
        canvas.save(path, optimize=True)
        # left-over pink: opaque-ish pixels that are still clearly magenta
        rgbx = np.asarray(canvas).astype(np.int16)
        pink = int(((rgbx[..., 3] > 128) & ((np.minimum(rgbx[..., 0], rgbx[..., 2]) - rgbx[..., 1]) > 90)).sum())
        report.append((name, '%dx%d px%s, pink pixels left: %d' % (bx1 - bx0, by1 - by0, ' (touches the cell edge!)' if touches else '', pink)))
    return report


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('sheet')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'rewards'))
    args = ap.parse_args()
    for name, info in cut(args.sheet, args.out):
        print('%-16s %s' % (name, info))
    print('written to', os.path.normpath(args.out))


if __name__ == '__main__':
    main()

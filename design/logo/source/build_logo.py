"""Builds the Travelo logo master SVGs (symbol, small cut, wordmark, lockups) from parameters.

Run: python design/logo/source/build_logo.py  -> writes design/logo/kit/master/*.svg
The wordmark is outlined from Fraunces SemiBold (OFL) with a tiny TrueType reader, so no fonttools needed.
"""
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FONT = ROOT / "node_modules/@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf"
OUT = Path(__file__).resolve().parents[1] / "kit" / "master"

INK = "#242321"      # tokens: ink
CORAL = "#E96F51"    # tokens: brand.primary (light)
PAPER = "#F8F4EC"    # tokens: neutral.100 (light canvas)
CORAL_DARK = "#F07D5E"  # tokens: brand.primary (dark)


# ---------- symbol ----------
def t_shapes(S, H, W, gap, r, Ro, height, cx=128.0, centre_y=124.0):
    """The 't': crossbar (horizon), stem with a rounded foot, and a sun disc above.
    S stem width, H crossbar height, W crossbar half-width, Ro outer foot radius,
    height = crossbar top -> foot bottom."""
    Y = 0.0
    yb = Y + height
    top = Y - gap - 2 * r
    dy = centre_y - (top + yb) / 2  # centre the whole mark on centre_y (slightly above 128: optical centre)
    Y, yb = Y + dy, yb + dy
    x0, x1 = cx - S / 2, cx + S / 2
    Ri = Ro - S
    end = cx + W - S / 2  # foot cap ends flush with the crossbar end
    assert end >= x0 + Ro, "foot too short for its radius"
    f = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")
    stem = (f"M{f(x0)} {f(Y + H / 2)}L{f(x0)} {f(yb - Ro)}"
            f"A{f(Ro)} {f(Ro)} 0 0 0 {f(x0 + Ro)} {f(yb)}L{f(end)} {f(yb)}"
            f"A{f(S / 2)} {f(S / 2)} 0 0 0 {f(end)} {f(yb - S)}L{f(x0 + Ro)} {f(yb - S)}"
            f"A{f(Ri)} {f(Ri)} 0 0 1 {f(x1)} {f(yb - Ro)}L{f(x1)} {f(Y + H / 2)}Z")
    # Same winding as the stem, so the overlap stays filled under the nonzero rule.
    bar = (f"M{f(cx - W + H / 2)} {f(Y)}A{f(H / 2)} {f(H / 2)} 0 0 0 {f(cx - W + H / 2)} {f(Y + H)}"
           f"H{f(cx + W - H / 2)}A{f(H / 2)} {f(H / 2)} 0 0 0 {f(cx + W - H / 2)} {f(Y)}Z")
    sun = f'<circle cx="{f(cx)}" cy="{f(Y - gap - r)}" r="{f(r)}"/>'
    bbox = (cx - W, Y - gap - 2 * r, cx + W, yb)
    return bar + stem, sun, bbox


REGULAR = dict(S=36, H=30, W=60, gap=16, r=23, Ro=56, height=122)
REVERSED = dict(S=34, H=28, W=59, gap=17, r=22.5, Ro=55, height=122)  # light on dark: ~5 % thinner (irradiation)
SMALL = dict(S=52, H=44, W=84, gap=26, r=32, Ro=76, height=140)  # 16-32 px: heavier strokes, wider gap


def symbol_svg(params, body=INK, sun=CORAL, title="Travelo"):
    d, disc, _ = t_shapes(**params)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><title>{title}</title>'
            f'<path fill="{body}" d="{d}"/><g fill="{sun}">{disc}</g></svg>\n')


# ---------- font outlines ----------
class TTF:
    def __init__(self, path):
        self.b = Path(path).read_bytes()
        n = struct.unpack(">H", self.b[4:6])[0]
        self.t = {}
        for i in range(n):
            tag, _, off, ln = struct.unpack(">4sIII", self.b[12 + 16 * i:28 + 16 * i])
            self.t[tag.decode()] = (off, ln)
        h = self.t["head"][0]
        self.upm = struct.unpack(">H", self.b[h + 18:h + 20])[0]
        self.locfmt = struct.unpack(">h", self.b[h + 50:h + 52])[0]
        self.nglyphs = struct.unpack(">H", self.b[self.t["maxp"][0] + 4:self.t["maxp"][0] + 6])[0]
        hh = self.t["hhea"][0]
        self.nhm = struct.unpack(">H", self.b[hh + 34:hh + 36])[0]
        self.cmap = self._cmap()

    def _cmap(self):
        c = self.t["cmap"][0]
        n = struct.unpack(">H", self.b[c + 2:c + 4])[0]
        for i in range(n):
            pid, eid, off = struct.unpack(">HHI", self.b[c + 4 + 8 * i:c + 12 + 8 * i])
            s = c + off
            if struct.unpack(">H", self.b[s:s + 2])[0] == 4:
                seg = struct.unpack(">H", self.b[s + 6:s + 8])[0] // 2
                arr = lambda k: struct.unpack(f">{seg}H", self.b[s + 14 + k:s + 14 + k + 2 * seg])
                ends = arr(0)
                starts = arr(2 * seg + 2)
                deltas = struct.unpack(f">{seg}h", self.b[s + 16 + 4 * seg:s + 16 + 6 * seg])
                ro_at = s + 16 + 6 * seg
                ros = struct.unpack(f">{seg}H", self.b[ro_at:ro_at + 2 * seg])
                m = {}
                for k in range(seg):
                    for ch in range(starts[k], ends[k] + 1):
                        if ch == 0xFFFF:
                            continue
                        if ros[k] == 0:
                            g = (ch + deltas[k]) & 0xFFFF
                        else:
                            a = ro_at + 2 * k + ros[k] + 2 * (ch - starts[k])
                            g = struct.unpack(">H", self.b[a:a + 2])[0]
                            g = (g + deltas[k]) & 0xFFFF if g else 0
                        m[ch] = g
                return m
        raise ValueError("no format-4 cmap")

    def advance(self, g):
        h = self.t["hmtx"][0]
        i = min(g, self.nhm - 1)
        return struct.unpack(">H", self.b[h + 4 * i:h + 4 * i + 2])[0]

    def _loc(self, g):
        l = self.t["loca"][0]
        if self.locfmt == 0:
            a, b = struct.unpack(">HH", self.b[l + 2 * g:l + 2 * g + 4])
            return 2 * a, 2 * b
        return struct.unpack(">II", self.b[l + 4 * g:l + 4 * g + 8])

    def contours(self, g):
        a, b = self._loc(g)
        if a == b:
            return []
        p = self.t["glyf"][0] + a
        nc = struct.unpack(">h", self.b[p:p + 2])[0]
        if nc < 0:
            raise ValueError(f"composite glyph {g} not supported")
        ends = struct.unpack(f">{nc}H", self.b[p + 10:p + 10 + 2 * nc])
        q = p + 10 + 2 * nc
        q += 2 + struct.unpack(">H", self.b[q:q + 2])[0]
        npts = ends[-1] + 1
        flags = []
        while len(flags) < npts:
            fl = self.b[q]; q += 1
            flags.append(fl)
            if fl & 8:
                rep = self.b[q]; q += 1
                flags += [fl] * rep
        def coords(short, same):
            nonlocal q
            v, out = 0, []
            for fl in flags:
                if fl & short:
                    d = self.b[q]; q += 1
                    v += d if fl & same else -d
                elif not fl & same:
                    v += struct.unpack(">h", self.b[q:q + 2])[0]; q += 2
                out.append(v)
            return out
        xs = coords(2, 16)
        ys = coords(4, 32)
        res, s = [], 0
        for e in ends:
            res.append([(xs[i], ys[i], bool(flags[i] & 1)) for i in range(s, e + 1)])
            s = e + 1
        return res


def contour_path(pts, ox, oy, k):
    """Quadratic TrueType contour -> SVG path (y flipped, scaled by k, origin at baseline ox,oy)."""
    T = lambda x, y: f"{ox + x * k:.2f} {oy - y * k:.2f}"
    n = len(pts)
    start = next((i for i, p in enumerate(pts) if p[2]), None)
    if start is None:  # all off-curve: start at an implied midpoint
        x = (pts[0][0] + pts[1][0]) / 2; y = (pts[0][1] + pts[1][1]) / 2
        pts = [(x, y, True)] + pts[1:] + pts[:1]
        start, n = 0, len(pts)
    seq = pts[start:] + pts[:start] + [pts[start]]
    d = f"M{T(seq[0][0], seq[0][1])}"
    ctrl = None
    for x, y, on in seq[1:]:
        if on:
            d += f"Q{T(*ctrl)} {T(x, y)}" if ctrl else f"L{T(x, y)}"
            ctrl = None
        else:
            if ctrl:
                mx, my = (ctrl[0] + x) / 2, (ctrl[1] + y) / 2
                d += f"Q{T(*ctrl)} {T(mx, my)}"
            ctrl = (x, y)
    return d + "Z"


# Manual kerning in font units (the reader ignores GPOS); tuned by eye on the rendered wordmark.
KERN = {"tr": 0, "ra": -10, "av": -18, "ve": -14, "el": 0, "lo": 0}


def wordmark(font, text, size, ox, baseline):
    k = size / font.upm
    x, parts = 0.0, []
    for i, ch in enumerate(text):
        g = font.cmap[ord(ch)]
        parts += [contour_path(c, ox + x * k, baseline, k) for c in font.contours(g)]
        x += font.advance(g) + (KERN.get(text[i:i + 2], 0) if i + 1 < len(text) else 0)
    return "".join(parts), x * k


def ink_bounds(font, ch):
    ys = [p[1] for c in font.contours(font.cmap[ord(ch)]) for p in c]
    return min(ys), max(ys)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    font = TTF(FONT)
    w = lambda name, s: (OUT / name).write_text(s, encoding="utf8")

    w("travelo-symbol.svg", symbol_svg(REGULAR))
    w("travelo-symbol-small.svg", symbol_svg(SMALL))
    w("travelo-symbol-reversed.svg", symbol_svg(REVERSED, PAPER, CORAL_DARK))

    # Wordmark at 160 px: baseline at y=0 in its own frame.
    size = 160
    k = size / font.upm
    x_h = ink_bounds(font, "x")[1] * k
    asc = ink_bounds(font, "l")[1] * k
    desc_free = 0  # "travelo" has no descenders
    word_d, word_w = wordmark(font, "travelo", size, 0, 0)
    pad = 8
    word_h = asc + pad * 2
    w("travelo-wordmark.svg",
      f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {-asc - pad:.2f} {word_w + 2 * pad:.2f} {word_h:.2f}">'
      f'<title>Travelo</title><path fill="{INK}" transform="translate({pad} 0)" d="{word_d}"/></svg>\n')

    # Lockups: the symbol's foot sits on the baseline, its sun top meets the ascender line of the "l".
    d, disc, (bx0, by0, bx1, by1) = t_shapes(**REGULAR)
    s = asc / (by1 - by0)
    sym_w = (bx1 - bx0) * s
    gap = REGULAR["S"] * s * 1.25

    def sym(tx, ty, body=INK, sun=CORAL, params=REGULAR):
        pd, pdisc, (px0, py0, _, py1) = t_shapes(**params)
        return (f'<g transform="translate({tx:.2f} {ty:.2f}) scale({s:.4f}) translate({-px0:.2f} {-py1:.2f})">'
                f'<path fill="{body}" d="{pd}"/><g fill="{sun}">{pdisc}</g></g>')
    m = 24
    hw = m + sym_w + gap + word_w + m
    for name, body, sun, word, params in [("horizontal", INK, CORAL, INK, REGULAR),
                                          ("horizontal-reversed", PAPER, CORAL_DARK, PAPER, REVERSED)]:
        w(f"travelo-{name}.svg",
          f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {-asc - m:.2f} {hw:.2f} {asc + 2 * m:.2f}">'
          f'<title>Travelo</title>{sym(m, 0, body, sun, params)}'
          f'<path fill="{word}" transform="translate({m + sym_w + gap:.2f} 0)" d="{word_d}"/></svg>\n')

    # Stacked: symbol at 1.6x the ascender, centred over the wordmark.
    s2 = 1.6
    sh = asc * s2
    sw = sym_w * s2
    vgap = x_h * 0.55
    sw_total = max(sw, word_w) + 2 * m
    top = -asc - vgap - sh
    w("travelo-stacked.svg",
      f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {top - m:.2f} {sw_total:.2f} {-top + 2 * m:.2f}">'
      f'<title>Travelo</title>'
      f'<g transform="translate({(sw_total - sw) / 2:.2f} {-asc - vgap:.2f}) scale({s * s2:.4f}) translate({-bx0:.2f} {-by1:.2f})">'
      f'<path fill="{INK}" d="{d}"/><g fill="{CORAL}">{disc}</g></g>'
      f'<path fill="{INK}" transform="translate({(sw_total - word_w) / 2:.2f} 0)" d="{word_d}"/></svg>\n')
    print("wrote", sorted(p.name for p in OUT.iterdir()))
    print(f"x-height {x_h:.1f}  ascender {asc:.1f}  word width {word_w:.1f}  symbol scale {s:.3f}")


if __name__ == "__main__":
    main()

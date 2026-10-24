"""Expo-ready app icon sources (SVG) from the master geometry; rendered to PNG by render_png.py.

Run: python design/logo/source/build_icons.py  -> writes design/logo/kit/expo/*.svg and travelo.icon/
"""
import json
from build_logo import t_shapes, REGULAR, REVERSED, SMALL, INK, CORAL, PAPER, CORAL_DARK, Path

OUT = Path(__file__).resolve().parents[1] / "kit" / "expo"
DARK_CANVAS = "#171716"  # tokens: neutral.900 (dark canvas)


def mark(params, body, sun, size, scale):
    """Symbol centred on a size x size canvas; `scale` = share of the canvas the 256 symbol box takes."""
    d, disc, _ = t_shapes(**params)
    k = size * scale / 256
    o = (size - 256 * k) / 2
    return (f'<g transform="translate({o:.2f} {o:.2f}) scale({k:.4f})">'
            f'<path fill="{body}" d="{d}"/><g fill="{sun}">{disc}</g></g>')


def svg(size, inner, bg=None):
    rect = f'<rect width="{size}" height="{size}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">{rect}{inner}</svg>\n'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    w = lambda name, s: (OUT / name).write_text(s, encoding="utf8")
    # iOS / generic icon: full-bleed square (the OS rounds the corners).
    w("icon.svg", svg(1024, mark(REGULAR, INK, CORAL, 1024, 0.86), PAPER))
    w("icon-dark.svg", svg(1024, mark(REVERSED, PAPER, CORAL_DARK, 1024, 0.86), DARK_CANVAS))
    # Android adaptive: the mark stays inside the 66 % safe zone; background is a flat paper colour.
    w("android-icon-foreground.svg", svg(512, mark(REGULAR, INK, CORAL, 512, 0.62)))
    w("android-icon-background.svg", svg(512, "", PAPER))
    w("android-icon-monochrome.svg", svg(432, mark(REGULAR, "#000000", "#000000", 432, 0.62)))
    # Splash: symbol on transparent; Expo scales it to imageWidth on a paper background.
    w("splash-icon.svg", svg(512, mark(REGULAR, INK, CORAL, 512, 1.0)))
    w("splash-icon-dark.svg", svg(512, mark(REVERSED, PAPER, CORAL_DARK, 512, 1.0)))
    w("favicon.svg", svg(48, mark(SMALL, INK, CORAL, 48, 1.08)))

    # iOS 26 Icon Composer bundle: two layers (body + sun) on a solid paper fill.
    # shortcut: written by hand from the existing expo.icon; open it in Icon Composer once to confirm before use.
    icon = OUT / "travelo.icon"
    (icon / "Assets").mkdir(parents=True, exist_ok=True)
    d, disc, _ = t_shapes(**REGULAR)
    k = 1024 / 256
    (icon / "Assets" / "t-body.svg").write_text(svg(1024, f'<path transform="scale({k})" fill="{INK}" d="{d}"/>'), encoding="utf8")
    (icon / "Assets" / "t-sun.svg").write_text(svg(1024, f'<g transform="scale({k})" fill="{CORAL}">{disc}</g>'), encoding="utf8")
    srgb = lambda h: "srgb:" + ",".join(f"{int(h[i:i + 2], 16) / 255:.5f}" for i in (1, 3, 5)) + ",1.00000"
    (icon / "icon.json").write_text(json.dumps({
        "fill": {"solid": srgb(PAPER)},
        "groups": [{"layers": [
            {"image-name": "t-sun.svg", "name": "sun"},
            {"image-name": "t-body.svg", "name": "body"},
        ], "shadow": {"kind": "neutral", "opacity": 0.5}, "translucency": {"enabled": False, "value": 0.5}}],
        "supported-platforms": {"circles": ["watchOS"], "squares": "shared"},
    }, indent=2), encoding="utf8")
    print("wrote", sorted(p.name for p in OUT.iterdir()))


if __name__ == "__main__":
    main()

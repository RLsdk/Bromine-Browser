#!/usr/bin/env python3
"""Generate Bromine branding rasters.

Chrome / taskbar / window icons: assets/branding/logo.png (orange BR).
About / Settings logos & category SVGs: assets/branding/logo-mono.png (cream B&W).
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "themes" / "browser" / "branding" / "bromine"
LOGO = ROOT / "assets" / "branding" / "logo.png"
LOGO_MONO = ROOT / "assets" / "branding" / "logo-mono.png"
BG = (0, 0, 0, 255)
FG = (243, 235, 228, 255)  # cream


def load_logo(path: Path) -> Image.Image:
    if not path.exists():
        raise SystemExit(f"missing logo: {path}")
    return Image.open(path).convert("RGBA")


def fit_square(src: Image.Image, size: int, pad_ratio: float = 0.06) -> Image.Image:
    """Scale logo into a size×size canvas (transparent), keeping aspect ratio."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pad = max(0, int(size * pad_ratio))
    inner = max(1, size - 2 * pad)
    s = src.copy()
    s.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - s.width) // 2
    y = (size - s.height) // 2
    canvas.paste(s, (x, y), s)
    return canvas


def with_solid_bg(src: Image.Image, size: int, bg=BG) -> Image.Image:
    icon = fit_square(src, size)
    out = Image.new("RGBA", (size, size), bg)
    out.alpha_composite(icon)
    return out


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def magick(*args: str) -> None:
    subprocess.check_call(["magick", *args])


def wordmark_svg(path: Path, fill: str = "#f3ebe4") -> None:
    path.write_text(
        f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 64">
  <text x="8" y="48" font-family="sans-serif" font-size="44" font-weight="700" fill="{fill}">Bromine</text>
</svg>
""",
        encoding="utf-8",
    )


def logo_to_svg_embed(path: Path, src: Image.Image, size: int = 512) -> None:
    """Embed the 1:1 logo PNG inside about-logo.svg (Firefox chrome accepts data URIs)."""
    import base64
    import io

    im = fit_square(src, size, pad_ratio=0.0)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    path.write_text(
        f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 256 256" width="256" height="256">
  <image width="256" height="256" href="data:image/png;base64,{b64}" xlink:href="data:image/png;base64,{b64}"/>
</svg>
""",
        encoding="utf-8",
    )


def logo_to_svg_png_fallback(path: Path, src: Image.Image) -> None:
    logo_to_svg_embed(path, src)


def main() -> None:
    logo = load_logo(LOGO)  # orange — chrome / taskbar
    mono = load_logo(LOGO_MONO)  # cream B&W — About / Settings
    BRAND.mkdir(parents=True, exist_ok=True)
    content = BRAND / "content"
    content.mkdir(parents=True, exist_ok=True)
    msix = BRAND / "msix" / "Assets"
    msix.mkdir(parents=True, exist_ok=True)
    stub = BRAND / "stubinstaller"
    stub.mkdir(parents=True, exist_ok=True)

    # About / Settings: mono cream
    logo_to_svg_png_fallback(content / "about-logo.svg", mono)
    wordmark_svg(content / "about-wordmark.svg")
    wordmark_svg(content / "firefox-wordmark.svg")
    # Category / file-type SVGs: mono
    for name in ("file.svg", "file_bromine.svg", "file_pdf.svg"):
        logo_to_svg_png_fallback(BRAND / name, mono)

    sizes = {
        "default16.png": 16,
        "default22.png": 22,
        "default24.png": 24,
        "default32.png": 32,
        "default48.png": 48,
        "default64.png": 64,
        "default128.png": 128,
        "default256.png": 256,
        "VisualElements_70.png": 70,
        "VisualElements_150.png": 150,
        "PrivateBrowsing_70.png": 70,
        "PrivateBrowsing_150.png": 150,
    }
    for name, size in sizes.items():
        # Taskbar / window icons: orange logo
        save_png(fit_square(logo, size, pad_ratio=0.0), BRAND / name)

    # About dialog rasters: mono
    for name, size in {
        "about-logo.png": 196,
        "about-logo@2x.png": 392,
        "about-logo-private.png": 196,
        "about-logo-private@2x.png": 392,
        "about.png": 210,
    }.items():
        save_png(fit_square(mono, size, pad_ratio=0.0), content / name)

    # In-content chrome icons: orange (match window defaults)
    for name, size in {
        "icon16.png": 16,
        "icon32.png": 32,
        "icon48.png": 48,
        "icon64.png": 64,
        "icon128.png": 128,
    }.items():
        save_png(fit_square(logo, size, pad_ratio=0.0), content / name)

    save_png(fit_square(mono, 256, pad_ratio=0.0), content / "about-logo.png")
    save_png(Image.new("RGBA", (300, 64), BG), BRAND / "background.png")

    for bmp, box in {
        "wizHeader.bmp": (150, 57),
        "wizHeaderRTL.bmp": (150, 57),
        "wizWatermark.bmp": (164, 314),
    }.items():
        Image.new("RGB", box, BG[:3]).save(BRAND / bmp, "BMP")

    wide = Image.new("RGB", (620, 300), BG[:3])
    mark = fit_square(logo, 180, pad_ratio=0.0)
    wide.paste(mark, (40, 60), mark)
    draw = ImageDraw.Draw(wide)
    try:
        font = ImageFont.truetype("/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", 48)
    except OSError:
        font = ImageFont.load_default()
    draw.text((250, 120), "Bromine", fill=FG[:3], font=font)
    wide.save(BRAND / "bgstub.jpg", "JPEG", quality=90)
    wide.save(stub / "bgstub.jpg", "JPEG", quality=90)
    wide.resize((1240, 600)).save(BRAND / "bgstub_2x.jpg", "JPEG", quality=90)

    save_png(fit_square(logo, 88, pad_ratio=0.0), msix / "Square44x44Logo.scale-200.png")
    save_png(fit_square(logo, 256, pad_ratio=0.0), msix / "Square44x44Logo.targetsize-256.png")
    save_png(fit_square(logo, 256, pad_ratio=0.0), msix / "Square44x44Logo.altform-unplated_targetsize-256.png")
    save_png(fit_square(logo, 256, pad_ratio=0.0), msix / "Square44x44Logo.altform-lightunplated_targetsize-256.png")
    save_png(fit_square(logo, 300, pad_ratio=0.0), msix / "Square150x150Logo.scale-200.png")
    save_png(fit_square(logo, 284, pad_ratio=0.0), msix / "SmallTile.scale-200.png")
    save_png(fit_square(logo, 620, pad_ratio=0.0), msix / "LargeTile.scale-200.png")
    save_png(fit_square(logo, 100, pad_ratio=0.0), msix / "StoreLogo.scale-200.png")
    save_png(fit_square(logo, 88, pad_ratio=0.0), msix / "Document44x44.png")
    wide_tile = Image.new("RGBA", (620, 300), BG)
    m = fit_square(logo, 180, pad_ratio=0.0)
    wide_tile.paste(m, (40, 60), m)
    save_png(wide_tile, msix / "Wide310x150Logo.scale-200.png")

    icon_src = BRAND / "default256.png"
    for ico in (
        "firefox.ico",
        "firefox64.ico",
        "document.ico",
        "document_pdf.ico",
        "newtab.ico",
        "newwindow.ico",
        "pbmode.ico",
    ):
        magick(
            str(icon_src),
            "-define",
            "icon:auto-resize=256,128,64,48,32,16",
            str(BRAND / ico),
        )

    for icns in ("firefox.icns", "document.icns", "disk.icns"):
        try:
            magick(str(icon_src), str(BRAND / icns))
        except subprocess.CalledProcessError:
            pass

    print(f"branding written to {BRAND}")
    print(f"  chrome/icons from {LOGO}")
    print(f"  about/settings from {LOGO_MONO}")


if __name__ == "__main__":
    main()

"""Builds the site's committed images (device shots, icons, share card) from the repo's own captures.
Run `pnpm assets` from website/; the ollama.com avatar is masked because it defaults to Ollama's mascot."""

import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "docs" / "screenshots"
FRAME = ROOT / "docs" / "store" / "ios" / "device-iphone-16-pro-max-natural.png"
ICON = ROOT / "assets" / "images" / "icon-light.png"
PUBLIC = ROOT / "website" / "public"
APP = ROOT / "website" / "src" / "app"
SRC = ROOT / "website" / "src"

# The frame's transparent screen cut-out starts here and matches the 1320x2868 captures.
SCREEN_ORIGIN = (75, 66)
# Avatar orb centre and the radius of the picture inside its ring, in capture pixels.
AVATAR_CENTER = (1218, 276)
AVATAR_RADIUS = 40
# name -> whether the header sits under a blurred scrim (a sheet is open) in that capture
BLURRED_HEADER = {
    "home": False,
    "open_model": True,
    "compose": True,
    "chat": False,
    "history": False,
    "settings": True,
}

OG_SIZE = (1200, 630)
FONT_BOLD = Path("/Library/Fonts/SF-Pro-Display-Bold.otf")
FONT_REGULAR = Path("/Library/Fonts/SF-Pro-Display-Regular.otf")
# The share card's two lines under the headline; nothing else uses them.
OG_LINES = ("Chat with Ollama Cloud on iPhone.", "Independent, free and open source.")


def read_source(path: str, pattern: str) -> re.Match[str]:
    """Each value keeps one home in the site's source; the script reads it from there."""
    match = re.search(pattern, (SRC / path).read_text(), re.S)
    if not match:
        sys.exit(f"compose-assets: {pattern!r} not found in src/{path}")
    return match


def oklch_to_rgb(lightness: float, chroma: float, hue: float) -> tuple[int, int, int]:
    a, b = chroma * math.cos(math.radians(hue)), chroma * math.sin(math.radians(hue))
    l_, m_, s_ = (
        (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3,
        (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3,
        (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3,
    )
    linear = (
        4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
        -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
        -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
    )
    encode = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return tuple(round(255 * min(max(encode(x), 0), 1)) for x in linear)


def light_token(name: str) -> tuple[int, int, int]:
    value = read_source("app/globals.css", r":root,[^{]*\{(.*?)\}").group(1)
    raw = re.search(rf"--{name}:\s*([^;]+);", value).group(1).strip()
    if raw.startswith("#"):
        return tuple(int(raw[i : i + 2], 16) for i in (1, 3, 5))
    return oklch_to_rgb(*map(float, re.findall(r"[\d.]+", raw)))


SHOT_WIDTH = int(read_source("modules/home/screens.ts", r"SHOT_WIDTH = (\d+)").group(1))
SCREEN_NAMES = re.findall(r'"(\w+)"', read_source("modules/home/screens.ts", r"type ScreenName = ([^;]+);").group(1))
HEADLINE = read_source("modules/home/content.tsx", r'headline: \["([^"]+)", "([^"]+)"\]').groups()
INK, MUTED, MARKER, PAGE = (light_token(name) for name in ("foreground", "muted-foreground", "marker", "background"))


def neutral_avatar(shot: Image.Image, is_blurred: bool) -> Image.Image:
    cx, cy = AVATAR_CENTER
    r = AVATAR_RADIUS
    shot = shot.convert("RGB")
    orb_tone = shot.getpixel((cx, cy - r - 9))
    if is_blurred:
        patch_box = (cx - r - 14, cy - r - 14, cx + r + 14, cy + r + 14)
        ImageDraw.Draw(shot).ellipse((cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2), fill=orb_tone)
        shot.paste(shot.crop(patch_box).filter(ImageFilter.GaussianBlur(6)), patch_box[:2])
        return shot
    # Draw the glyph at 4x on its own tile, then paste it through a circular mask so the
    # shoulders clip to the disc and the edge stays antialiased.
    scale = 4
    size = 2 * r * scale
    c = size // 2
    tile = Image.new("RGB", (size, size), (229, 229, 234))
    draw = ImageDraw.Draw(tile)
    glyph = (174, 174, 178)
    draw.ellipse((c - 14 * scale, c - 24 * scale, c + 14 * scale, c + 4 * scale), fill=glyph)
    draw.ellipse((c - 30 * scale, c + 10 * scale, c + 30 * scale, c + 62 * scale), fill=glyph)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    shot.paste(
        tile.resize((2 * r, 2 * r), Image.LANCZOS),
        (cx - r, cy - r),
        mask.resize((2 * r, 2 * r), Image.LANCZOS),
    )
    return shot


def screen_mask(frame: Image.Image) -> Image.Image:
    # The capture is a rectangle but the display has rounded corners that reach past the
    # bezel's outer curve, so clip to the hole: flood the transparent region from its centre.
    hole = frame.split()[3].point(lambda a: 255 if a < 10 else 0)
    ImageDraw.floodfill(hole, (frame.width // 2, frame.height // 2), 128)
    mask = hole.point(lambda v: 255 if v == 128 else 0)
    # Grow a few pixels so the capture tucks under the bezel instead of leaving a seam.
    return mask.filter(ImageFilter.MaxFilter(7))


def framed(name: str, is_blurred: bool, frame: Image.Image, mask: Image.Image) -> Image.Image:
    shot = neutral_avatar(Image.open(SHOTS / f"{name}.png"), is_blurred)
    canvas = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    placed = Image.new("RGB", frame.size, (0, 0, 0))
    placed.paste(shot, SCREEN_ORIGIN)
    canvas.paste(placed, (0, 0), mask)
    canvas.alpha_composite(frame)
    return canvas


def compose_screens(frame: Image.Image) -> dict[str, Image.Image]:
    out_dir = PUBLIC / "screens"
    out_dir.mkdir(parents=True, exist_ok=True)
    devices = {}
    mask = screen_mask(frame)
    if sorted(BLURRED_HEADER) != sorted(SCREEN_NAMES):
        sys.exit("compose-assets: BLURRED_HEADER must list exactly the ScreenName captures in screens.ts")
    for name, is_blurred in BLURRED_HEADER.items():
        device = framed(name, is_blurred, frame, mask)
        devices[name] = device
        height = round(device.height * SHOT_WIDTH / device.width)
        device.resize((SHOT_WIDTH, height), Image.LANCZOS).save(
            out_dir / f"{name}-{SHOT_WIDTH}.webp", "WEBP", quality=84, method=6
        )
    return devices


def compose_icons() -> None:
    icon = Image.open(ICON).convert("RGB")
    icon.resize((512, 512), Image.LANCZOS).save(APP / "icon.png", optimize=True)
    icon.resize((180, 180), Image.LANCZOS).save(APP / "apple-icon.png", optimize=True)
    # The header shows the real app icon, so the site and the Home Screen match.
    icon.resize((144, 144), Image.LANCZOS).save(PUBLIC / "app-icon.png", optimize=True)
    icon.convert("RGBA").save(APP / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


def compose_og(devices: dict[str, Image.Image]) -> None:
    w, h = OG_SIZE
    card = Image.new("RGB", OG_SIZE, PAGE)
    # Soft top-to-bottom wash, the same white-to-blue air as the App Store screenshots.
    wash = Image.linear_gradient("L").resize(OG_SIZE)
    card = Image.composite(Image.new("RGB", OG_SIZE, (232, 240, 252)), card, wash)
    draw = ImageDraw.Draw(card)

    bold = ImageFont.truetype(str(FONT_BOLD), 92)
    small = ImageFont.truetype(str(FONT_REGULAR), 30)
    brand = ImageFont.truetype(str(FONT_BOLD), 34)

    icon = Image.open(ICON).convert("RGB").resize((64, 64), Image.LANCZOS)
    icon_mask = Image.new("L", (64, 64), 0)
    ImageDraw.Draw(icon_mask).rounded_rectangle((0, 0, 63, 63), radius=15, fill=255)
    card.paste(icon, (72, 64), icon_mask)
    draw.rounded_rectangle((72, 64, 135, 127), radius=15, outline=(220, 220, 225), width=1)
    draw.text((152, 96), "Quock", font=brand, fill=INK, anchor="lm")

    draw.text((68, 250), HEADLINE[0], font=bold, fill=INK, anchor="ls")
    # Same highlighter stroke as the site's headline: the lower half of the line, behind the words.
    left, top, right, bottom = draw.textbbox((68, 350), HEADLINE[1], font=bold, anchor="ls")
    draw.rectangle((left - 4, top + (bottom - top) * 0.52, right + 4, bottom + 6), fill=MARKER)
    draw.text((68, 350), HEADLINE[1], font=bold, fill=INK, anchor="ls")
    draw.text((74, 440), OG_LINES[0], font=small, fill=MUTED, anchor="ls")
    draw.text((74, 480), OG_LINES[1], font=small, fill=MUTED, anchor="ls")

    # Blur clamps at the image edge, so the shadow gets a margin or it renders as a hard box.
    pad = 96
    for name, x, y in (("home", 640, 70), ("chat", 890, 120)):
        device = devices[name]
        height = 650
        phone = device.resize((round(device.width * height / device.height), height), Image.LANCZOS)
        shadow = Image.new("L", (phone.width + 2 * pad, phone.height + 2 * pad), 0)
        shadow.paste(phone.split()[3].point(lambda a: 60 if a > 128 else 0), (pad, pad))
        shadow = shadow.filter(ImageFilter.GaussianBlur(36))
        card.paste((20, 30, 60), (x - pad, y + 28 - pad), shadow)
        card.paste(phone, (x, y), phone)

    card.save(PUBLIC / "og.png", optimize=True)


def main() -> int:
    frame = Image.open(FRAME).convert("RGBA")
    devices = compose_screens(frame)
    compose_icons()
    compose_og(devices)
    print("assets written to website/public and website/src/app")
    return 0


if __name__ == "__main__":
    sys.exit(main())

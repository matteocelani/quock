#!/usr/bin/env python3
"""Compose App Store marketing frames from the raw captures in docs/screenshots.

Device chrome is Apple's official iPhone 16 Pro Max frame (Natural Titanium),
vendored from Apple Design Resources via mockify — 1470x3000, screen hole
transparent, Dynamic Island on the overlay. We do not draw a second island.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Raw captures live beside the README set, two levels up; the composed frames land next to this script.
ROOT = Path(__file__).resolve().parents[2] / "screenshots"
OUT = Path(__file__).resolve().parent
FRAME_PNG = OUT / "device-iphone-16-pro-max-natural.png"

# App Store Connect 6.7" portrait. 6.9" (1320×2868) is rejected on this listing.
W, H = 1284, 2778
SCALE = 2
CW, CH = W * SCALE, H * SCALE

# Fractions from Apple's 16 Pro Max resource (1470x3000).
FRAME_SCREEN = {
    "left": 0.052381,
    "top": 0.022667,
    "width": 0.894558,
    "height": 0.954333,
    "radius": 0.133333,
}

FONTS = Path("/Library/Fonts")
SF_DISPLAY_BOLD = FONTS / "SF-Pro-Display-Bold.otf"
SF_TEXT_REGULAR = FONTS / "SF-Pro-Text-Regular.otf"
SF_TEXT_SEMIBOLD = FONTS / "SF-Pro-Text-Semibold.otf"
NY_ITALIC = Path("/System/Library/Fonts/NewYorkItalic.ttf")

BLUE = (0, 136, 255)
INK = (28, 28, 30)


@dataclass(frozen=True)
class Slide:
    source: str
    filename: str
    kicker: str
    title: str
    italic: str
    sub: str
    bg_top: tuple[int, int, int]
    bg_bottom: tuple[int, int, int]
    ink: tuple[int, int, int]
    muted: tuple[int, ...]
    accent: tuple[int, int, int]
    orbs: tuple[tuple[int, int, tuple[int, int, int], int], ...]


# 01 is the home shot — Matteo's favourite. Everything else shifts down.
SLIDES: tuple[Slide, ...] = (
    Slide(
        source="home.png",
        filename="iphone-1.png",
        kicker="FROM HOME",
        title="Open. Type.",
        italic="That's it.",
        sub="A streamed reply in three taps.",
        bg_top=(242, 242, 247),
        bg_bottom=(230, 230, 236),
        ink=INK,
        muted=(60, 60, 67, 153),
        accent=BLUE,
        orbs=((660, 1900, (255, 255, 255), 70), (1080, 2300, (0, 136, 255), 22)),
    ),
    Slide(
        source="open_model.png",
        filename="iphone-2.png",
        kicker="OPEN MODELS",
        title="Open models.",
        italic="On your phone.",
        sub="Pick any cloud model. Start typing.",
        bg_top=(244, 244, 248),
        bg_bottom=(232, 232, 238),
        ink=INK,
        muted=(60, 60, 67, 153),
        accent=BLUE,
        orbs=((220, 1680, (255, 255, 255), 90), (1100, 2200, (0, 136, 255), 28)),
    ),
    Slide(
        source="chat.png",
        filename="iphone-3.png",
        kicker="REASONING",
        title="Watch it",
        italic="think.",
        sub="Open the reasoning. Or hide it.",
        bg_top=(232, 238, 246),
        bg_bottom=(217, 228, 240),
        ink=INK,
        muted=(60, 60, 67, 153),
        accent=BLUE,
        orbs=((180, 1760, (255, 255, 255), 80), (1080, 2100, (0, 136, 255), 36)),
    ),
    Slide(
        source="compose.png",
        filename="iphone-4.png",
        kicker="ATTACH",
        title="Attach anything.",
        italic="Ask about it.",
        sub="Photos, PDFs, files — and the live web.",
        bg_top=(226, 237, 248),
        bg_bottom=(208, 224, 242),
        ink=INK,
        muted=(60, 60, 67, 153),
        accent=BLUE,
        orbs=((200, 1720, (255, 255, 255), 88), (1120, 2240, (0, 136, 255), 40)),
    ),
    Slide(
        source="history.png",
        filename="iphone-5.png",
        kicker="PRIVACY FIRST",
        title="Your chats",
        italic="stay here.",
        sub="No Quock server. History lives on this phone.",
        bg_top=(243, 238, 232),
        bg_bottom=(232, 224, 214),
        ink=INK,
        muted=(60, 60, 67, 153),
        accent=BLUE,
        orbs=((240, 1700, (255, 252, 246), 88), (1040, 2300, (172, 127, 94), 22)),
    ),
    Slide(
        source="login.png",
        filename="iphone-6.png",
        kicker="ONE ACCOUNT",
        title="Sign in once.",
        italic="In your pocket.",
        sub="Your ollama.com account.",
        bg_top=(242, 242, 247),
        bg_bottom=(234, 234, 240),
        ink=INK,
        muted=(60, 60, 67, 153),
        accent=BLUE,
        orbs=((660, 1980, (255, 255, 255), 64), (1040, 2360, (0, 136, 255), 20)),
    ),
)

OBSOLETE = (
    "01-three-taps.png",
    "02-open-models.png",
    "03-watch-it-think.png",
    "04-attach-anything.png",
    "05-chats-stay.png",
    "06-in-your-pocket.png",
    "01-open-models.png",
    "02-watch-it-think.png",
    "03-attach-anything.png",
    "04-chats-stay.png",
    "05-three-taps.png",
    "03-attach-a-photo.png",
    "05-yours-local.png",
    "06-sign-in-once.png",
)


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def lerp_rgb(
    a: tuple[int, int, int], b: tuple[int, int, int], t: float
) -> tuple[int, int, int]:
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def vertical_gradient(
    size: tuple[int, int],
    top: tuple[int, int, int],
    bottom: tuple[int, int, int],
) -> Image.Image:
    strip = Image.new("RGB", (1, size[1]))
    px = strip.load()
    last = size[1] - 1
    for y in range(size[1]):
        px[0, y] = lerp_rgb(top, bottom, y / last)
    return strip.resize(size, Image.Resampling.BILINEAR)


def orb(diameter: int, color: tuple[int, int, int], opacity: int) -> Image.Image:
    layer = Image.new("RGBA", (diameter, diameter), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(
        (0, 0, diameter - 1, diameter - 1),
        fill=(*color, opacity),
    )
    return layer.filter(ImageFilter.GaussianBlur(diameter // 5))


def grain(size: tuple[int, int], amount: int, opacity: int) -> Image.Image:
    noise = Image.effect_noise(size, amount).convert("L")
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    overlay.putalpha(noise.point(lambda p: int(p * opacity / 255)))
    return overlay


def tracked_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    typeface: ImageFont.FreeTypeFont,
    xy: tuple[int, int],
    fill: tuple[int, ...],
    tracking: float,
) -> None:
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=typeface, fill=fill)
        x += typeface.getlength(char) + tracking


def wrap_text(text: str, typeface: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if typeface.getlength(trial) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def round_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return mask


def load_capture(name: str) -> Image.Image:
    return Image.open(ROOT / name).convert("RGB")


def device_frame(capture: Image.Image, frame_w: int) -> Image.Image:
    frame = Image.open(FRAME_PNG).convert("RGBA")
    frame_h = int(frame.height * frame_w / frame.width)
    frame = frame.resize((frame_w, frame_h), Image.Resampling.LANCZOS)

    sx = int(frame_w * FRAME_SCREEN["left"])
    sy = int(frame_h * FRAME_SCREEN["top"])
    sw = int(frame_w * FRAME_SCREEN["width"])
    sh = int(frame_h * FRAME_SCREEN["height"])
    radius = int(frame_w * FRAME_SCREEN["radius"])

    screen = capture.resize((sw, sh), Image.Resampling.LANCZOS)
    clipped = Image.new("RGBA", (sw, sh))
    clipped.paste(screen, (0, 0))
    clipped.putalpha(round_mask((sw, sh), radius))

    device = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    device.paste(clipped, (sx, sy), clipped)
    # Island + bezel sit on top so we never draw a second pill.
    return Image.alpha_composite(device, frame)


def paint_shadow(field: Image.Image, box: tuple[int, int, int, int]) -> None:
    x, y, w, h = box
    ambient = Image.new("RGBA", field.size, (0, 0, 0, 0))
    ImageDraw.Draw(ambient).rounded_rectangle(
        (x + int(24 * SCALE), y + int(32 * SCALE), x + w - int(24 * SCALE), y + h + int(16 * SCALE)),
        radius=int(90 * SCALE),
        fill=(20, 20, 24, 28),
    )
    field.alpha_composite(ambient.filter(ImageFilter.GaussianBlur(int(28 * SCALE))))


def compose(slide: Slide) -> Image.Image:
    field = vertical_gradient((CW, CH), slide.bg_top, slide.bg_bottom).convert("RGBA")
    for cx, cy, color, opacity in slide.orbs:
        disc = orb(int(880 * SCALE), color, opacity)
        field.alpha_composite(
            disc, (int(cx * SCALE - disc.width / 2), int(cy * SCALE - disc.height / 2))
        )
    field = Image.alpha_composite(field, grain((CW, CH), 18, 10))

    draw = ImageDraw.Draw(field)
    pad_x = int(72 * SCALE)
    max_text = CW - pad_x * 2

    kicker_font = font(SF_TEXT_SEMIBOLD, int(24 * SCALE))
    title_font = font(SF_DISPLAY_BOLD, int(114 * SCALE))
    italic_font = font(NY_ITALIC, int(114 * SCALE))
    sub_font = font(SF_TEXT_REGULAR, int(30 * SCALE))

    y = int(136 * SCALE)
    tracked_text(draw, slide.kicker, kicker_font, (pad_x, y), slide.muted, tracking=int(4.6 * SCALE))

    y += int(54 * SCALE)
    draw.text((pad_x, y), slide.title, font=title_font, fill=slide.ink)
    title_box = draw.textbbox((pad_x, y), slide.title, font=title_font)

    y = title_box[3] - int(4 * SCALE)
    draw.text((pad_x, y), slide.italic, font=italic_font, fill=slide.accent)
    italic_box = draw.textbbox((pad_x, y), slide.italic, font=italic_font)

    y = italic_box[3] + int(22 * SCALE)
    for line in wrap_text(slide.sub, sub_font, max_text):
        draw.text((pad_x, y), line, font=sub_font, fill=slide.muted)
        y += int(40 * SCALE)

    text_bottom = y
    gap = int(28 * SCALE)
    bottom_margin = int(56 * SCALE)
    side_margin = int(64 * SCALE)
    avail_h = CH - text_bottom - gap - bottom_margin
    avail_w = CW - side_margin * 2

    # Frame aspect is 1470:3000. Height usually binds; keep the whole phone on-canvas.
    by_h = int(avail_h * 1470 / 3000)
    frame_w = min(avail_w, by_h)

    phone = device_frame(load_capture(slide.source), frame_w)
    phone_x = (CW - phone.width) // 2
    phone_y = text_bottom + gap
    phone_y = min(phone_y, CH - bottom_margin - phone.height)
    phone_y = max(phone_y, text_bottom + gap)

    paint_shadow(field, (phone_x, phone_y, phone.width, phone.height))
    field.alpha_composite(phone, (phone_x, phone_y))

    return field.convert("RGB").resize((W, H), Image.Resampling.LANCZOS)


def main() -> None:
    if not FRAME_PNG.exists():
        raise SystemExit(f"missing device frame: {FRAME_PNG}")
    OUT.mkdir(parents=True, exist_ok=True)
    for name in OBSOLETE:
        stale = OUT / name
        if stale.exists():
            stale.unlink()
            print(f"removed {name}")
    for slide in SLIDES:
        dest = OUT / slide.filename
        compose(slide).save(dest, "PNG", optimize=True)
        print(f"wrote {dest.name}")


if __name__ == "__main__":
    main()

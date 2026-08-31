#!/usr/bin/env python3
"""Compose a 16:9 three-phone hero from the screenshots in this folder.

Uses the same iPhone 16 Pro Max chrome and type as docs/store/ios/generate-iphone.py.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "0.2.png"
FRAME_PNG = HERE.parent / "store" / "ios" / "device-iphone-16-pro-max-natural.png"

# 16:9 — X in-feed native, LinkedIn landscape-safe. Render 2× then downscale.
W, H = 1920, 1080
SCALE = 2
CW, CH = W * SCALE, H * SCALE

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
MUTED = (60, 60, 67, 153)
BG_TOP = (242, 244, 248)
BG_BOTTOM = (226, 232, 240)

# Left → right. Same size. Second and third are compose then chat.
PHONES = ("home.png", "compose.png", "chat.png")


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


def round_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return mask


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
    return Image.alpha_composite(device, frame)


def paint_shadow(field: Image.Image, box: tuple[int, int, int, int], strength: int) -> None:
    x, y, w, h = box
    ambient = Image.new("RGBA", field.size, (0, 0, 0, 0))
    ImageDraw.Draw(ambient).rounded_rectangle(
        (x + int(18 * SCALE), y + int(22 * SCALE), x + w - int(18 * SCALE), y + h + int(12 * SCALE)),
        radius=int(70 * SCALE),
        fill=(20, 20, 24, strength),
    )
    field.alpha_composite(ambient.filter(ImageFilter.GaussianBlur(int(22 * SCALE))))


def compose(captures: Path, names: tuple[str, ...]) -> Image.Image:
    field = vertical_gradient((CW, CH), BG_TOP, BG_BOTTOM).convert("RGBA")
    for cx, cy, color, opacity in (
        (520, 1680, (255, 255, 255), 80),
        (2680, 1480, (0, 136, 255), 26),
        (1600, 2000, (255, 255, 255), 50),
    ):
        disc = orb(int(900 * SCALE), color, opacity)
        field.alpha_composite(
            disc, (int(cx * SCALE - disc.width / 2), int(cy * SCALE - disc.height / 2))
        )
    field = Image.alpha_composite(field, grain((CW, CH), 18, 10))

    draw = ImageDraw.Draw(field)
    pad_x = int(56 * SCALE)
    kicker_font = font(SF_TEXT_SEMIBOLD, int(15 * SCALE))
    title_font = font(SF_DISPLAY_BOLD, int(42 * SCALE))
    italic_font = font(NY_ITALIC, int(42 * SCALE))
    sub_font = font(SF_TEXT_REGULAR, int(16 * SCALE))

    y = int(36 * SCALE)
    tracked_text(draw, "QUOCK  0.2", kicker_font, (pad_x, y), MUTED, tracking=int(3.2 * SCALE))

    y += int(28 * SCALE)
    title = "Ollama Cloud."
    draw.text((pad_x, y), title, font=title_font, fill=INK)
    title_box = draw.textbbox((pad_x, y), title, font=title_font)
    italic = " In your pocket."
    draw.text((title_box[2], y), italic, font=italic_font, fill=BLUE)
    italic_box = draw.textbbox((title_box[2], y), italic, font=italic_font)

    y = italic_box[3] + int(8 * SCALE)
    draw.text(
        (pad_x, y),
        "Open. Type. Streamed replies — with thinking, excerpt actions, and every cloud model.",
        font=sub_font,
        fill=MUTED,
    )
    text_bottom = y + int(22 * SCALE)

    bottom_margin = int(36 * SCALE)
    side_margin = int(48 * SCALE)
    gap = int(22 * SCALE)
    avail_h = CH - text_bottom - bottom_margin
    avail_w = CW - side_margin * 2

    count = len(names)
    frame_w = int((avail_w - gap * (count - 1)) / count)
    frame_h = int(frame_w * 3000 / 1470)
    if frame_h > avail_h:
        frame_h = avail_h
        frame_w = int(frame_h * 1470 / 3000)

    phones = [device_frame(Image.open(captures / name).convert("RGB"), frame_w) for name in names]
    row_w = sum(phone.width for phone in phones) + gap * (count - 1)
    x = (CW - row_w) // 2
    ground = text_bottom + avail_h

    for phone in phones:
        px = x
        py = ground - phone.height
        paint_shadow(field, (px, py, phone.width, phone.height), 28)
        field.alpha_composite(phone, (px, py))
        x += phone.width + gap

    return field.convert("RGB").resize((W, H), Image.Resampling.LANCZOS)


def write(captures: Path, names: tuple[str, ...], dest: Path) -> None:
    for name in names:
        path = captures / name
        if not path.exists():
            raise SystemExit(f"missing capture: {path}")
    if not FRAME_PNG.exists():
        raise SystemExit(f"missing device frame: {FRAME_PNG}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    image = compose(captures, names)
    image.save(dest, "PNG", optimize=True)
    print(f"wrote {dest} {image.size}")


def main() -> None:
    write(HERE, PHONES, OUT)


if __name__ == "__main__":
    main()

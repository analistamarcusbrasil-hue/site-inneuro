from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
GREEN_DARK = "#03251B"
GREEN = "#087A4D"
TECH = "#21C77A"
MINT = "#DFF8EC"
WHITE = "#FFFFFF"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "seguisb.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def background(size: tuple[int, int]) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size, GREEN_DARK)
    pixels = image.load()
    for y in range(height):
        ratio = y / max(height - 1, 1)
        for x in range(width):
            glow = max(0.0, 1 - (((x - width * 0.74) / width) ** 2 + ((y - height * 0.42) / height) ** 2) * 4)
            pixels[x, y] = (
                3 + int(5 * glow),
                37 + int(55 * glow * (1 - ratio * 0.25)),
                27 + int(28 * glow),
            )
    return image


def rings(draw: ImageDraw.ImageDraw, center: tuple[int, int], radius: int) -> None:
    cx, cy = center
    for index, factor in enumerate((1, 0.8, 0.6, 0.4, 0.2)):
        r = int(radius * factor)
        color = (33, 199, 122, 75 if index == 0 else 48)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=color, width=2)
    draw.line((cx - radius, cy, cx + radius, cy), fill=(223, 248, 236, 35), width=2)
    draw.line((cx, cy - radius, cx, cy + radius), fill=(223, 248, 236, 30), width=2)
    draw.ellipse((cx - 13, cy - 13, cx + 13, cy + 13), fill=TECH)


def make_carousel() -> None:
    image = background((1920, 1080)).convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    rings(draw, (1430, 535), 420)
    draw.text((150, 270), "INNEURO", font=font(52, True), fill=WHITE, spacing=8)
    draw.text((150, 365), "Tecnologia, precisão", font=font(86, True), fill=WHITE)
    draw.text((150, 468), "e cuidado.", font=font(86, True), fill=TECH)
    draw.text((155, 610), "Instituto de Neurologia do Amapá", font=font(34), fill=MINT)
    image.convert("RGB").save(
        ROOT / "public/images/carrossel/inneuro-institucional.webp",
        "WEBP",
        quality=86,
        method=6,
    )


def make_social(filename: str) -> None:
    image = background((1200, 630)).convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    rings(draw, (930, 315), 245)
    draw.text((78, 135), "INNEURO", font=font(38, True), fill=WHITE)
    draw.text((78, 215), "Tecnologia que", font=font(62, True), fill=WHITE)
    draw.text((78, 292), "enxerga além.", font=font(62, True), fill=TECH)
    draw.text((82, 405), "Diagnóstico por imagem com precisão,", font=font(25), fill=MINT)
    draw.text((82, 442), "confiança e cuidado em cada etapa.", font=font(25), fill=MINT)
    image.convert("RGB").save(ROOT / f"src/app/{filename}", "PNG", optimize=True)


def make_icon(size: int, filename: str, image_format: str = "PNG") -> None:
    image = background((size, size)).convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    rings(draw, (size // 2, size // 2), int(size * 0.34))
    output = image if image_format == "ICO" else image.convert("RGB")
    output.save(ROOT / f"src/app/{filename}", image_format)


if __name__ == "__main__":
    make_carousel()
    make_social("opengraph-image.png")
    make_social("twitter-image.png")
    make_icon(512, "icon.png")
    make_icon(180, "apple-icon.png")
    make_icon(64, "favicon.ico", "ICO")

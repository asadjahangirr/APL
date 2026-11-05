"""Create original local artwork for APL's paired Phase 4 templates.

These are illustrations for fictional example projects, not client photographs.
No downloaded imagery or external rendering service is used.
"""
from pathlib import Path
import random
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "studio" / "assets"
OUTPUT.mkdir(parents=True, exist_ok=True)
SIZE = 1200


def font(size, bold=False):
    filename = "arialbd.ttf" if bold else "arial.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / filename), size)


def finish(image, filename, seed):
    # A quiet print grain keeps the large fields from looking machine-perfect.
    rng = random.Random(seed)
    pixels = image.load()
    for _ in range(65000):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        rgb = pixels[x, y]
        amount = rng.choice([-3, -2, 2, 3])
        pixels[x, y] = tuple(max(0, min(255, c + amount)) for c in rgb)
    image.save(OUTPUT / filename, "WEBP", quality=88, method=6)
    print(filename, (OUTPUT / filename).stat().st_size)


def meridian():
    image = Image.new("RGB", (SIZE, SIZE), "#e9dfcf")
    draw = ImageDraw.Draw(image)
    # An imagined architectural model: copper walls, a skylight, and a blue well.
    draw.polygon([(150, 865), (745, 1080), (1090, 867), (495, 652)], fill="#d1c0a7")
    draw.polygon([(218, 776), (756, 960), (1001, 804), (463, 620)], fill="#f5eddd")
    draw.polygon([(218, 352), (756, 534), (756, 960), (218, 776)], fill="#aa583d")
    draw.polygon([(756, 534), (1001, 378), (1001, 804), (756, 960)], fill="#713e2d")
    draw.polygon([(218, 352), (462, 196), (1001, 378), (756, 534)], fill="#ca7956")
    # The open top is a deliberate interruption in the solid model.
    draw.polygon([(321, 349), (479, 246), (903, 389), (745, 492)], fill="#202a2e")
    draw.polygon([(341, 354), (489, 258), (879, 389), (731, 484)], fill="#435963")
    draw.polygon([(343, 704), (520, 765), (520, 459), (343, 398)], fill="#f1e7d6")
    draw.polygon([(562, 779), (704, 828), (704, 522), (562, 473)], fill="#f1e7d6")
    draw.polygon([(807, 773), (935, 692), (935, 448), (807, 529)], fill="#e6dccb")
    draw.line([(158, 1024), (434, 1120)], fill="#b4a38e", width=2)
    draw.text((78, 72), "MERIDIAN / SPATIAL STUDY", font=font(22, True), fill="#473f36")
    draw.text((78, 1108), "01   LIGHT, MATERIAL, AND ROOM TO THINK", font=font(19), fill="#61574a")
    finish(image, "phase4-meridian.webp", 41)


def material():
    image = Image.new("RGB", (SIZE, SIZE), "#eee6d8")
    draw = ImageDraw.Draw(image)
    draw.rectangle((130, 220, 875, 980), fill="#d7c8b2")
    draw.rectangle((260, 136, 1060, 925), fill="#b55f3e")
    draw.rectangle((358, 248, 946, 818), fill="#f6f0e5")
    draw.rectangle((436, 326, 868, 740), fill="#26353a")
    draw.ellipse((511, 388, 792, 669), fill="#cba277")
    draw.rectangle((140, 997, 1060, 999), fill="#998d7c")
    draw.text((140, 1054), "MERIDIAN", font=font(38, True), fill="#2b2925")
    draw.text((714, 1069), "MATERIAL / 02", font=font(19), fill="#5c554c")
    finish(image, "phase4-material.webp", 42)


def lumen():
    image = Image.new("RGB", (SIZE, SIZE), "#234ad9")
    draw = ImageDraw.Draw(image)
    draw.rectangle((99, 96, 1100, 1099), outline="#f7f4e8", width=3)
    draw.text((142, 130), "LUMEN", font=font(130, True), fill="#fffbed")
    draw.text((148, 284), "AN INDEPENDENT READING ROOM", font=font(25), fill="#fffbed")
    # A modular L and a yellow sun form an original publication identity.
    draw.rectangle((214, 439, 383, 886), fill="#fffbed")
    draw.rectangle((214, 717, 721, 886), fill="#fffbed")
    draw.ellipse((634, 412, 974, 752), fill="#f5c84b")
    draw.polygon([(777, 821), (974, 625), (974, 1017), (582, 1017)], fill="#142972")
    draw.text((144, 1018), "ISSUE 01 / THE OPEN PAGE", font=font(22, True), fill="#fffbed")
    finish(image, "phase4-lumen.webp", 43)


def tide():
    image = Image.new("RGB", (SIZE, SIZE), "#f2ca51")
    draw = ImageDraw.Draw(image)
    draw.rectangle((91, 89, 1108, 1108), fill="#fff9e4")
    draw.text((139, 140), "TIDE", font=font(151, True), fill="#173977")
    draw.text((142, 307), "ATLAS / A STUDY IN MOVEMENT", font=font(23, True), fill="#173977")
    for index in range(12):
        y = 473 + index * 43
        points = []
        for x in range(134, 1070, 5):
            # Smooth wave bands, drawn from an original deterministic equation.
            import math
            points.append((x, y + 30 * math.sin(x / 190 + index / 5)))
        draw.line(points, fill="#2056cc" if index % 3 else "#98b9bf", width=18)
    draw.rectangle((139, 1005, 1060, 1007), fill="#173977")
    draw.text((139, 1040), "INFORMATION DESIGN / FICTIONAL EDITORIAL PROJECT", font=font(18), fill="#173977")
    finish(image, "phase4-tide.webp", 44)


if __name__ == "__main__":
    meridian()
    material()
    lumen()
    tide()

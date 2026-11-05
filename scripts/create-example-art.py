"""Original geometric artwork for APL's fictional example brands. No external assets."""
from pathlib import Path
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parents[1] / 'src' / 'studio' / 'assets'
out.mkdir(parents=True, exist_ok=True)

def make(name, palette, composition):
    image = Image.new('RGB', (960, 960), palette[0])
    draw = ImageDraw.Draw(image)
    paper, ink, accent, pale = palette
    if composition == 'northline':
        # A layered architectural study: roof, colonnade, and reflected courtyard.
        draw.rectangle((80, 80, 880, 880), fill=pale)
        draw.polygon([(190, 360), (480, 155), (770, 360)], fill=accent)
        draw.rectangle((190, 362, 770, 640), fill=ink)
        for x in [228, 348, 468, 588, 708]:
            draw.rectangle((x, 400, x + 27, 640), fill=paper)
        draw.rectangle((140, 644, 820, 677), fill=accent)
        for y in range(702, 822, 24):
            draw.line((140, y, 820, y), fill=accent, width=3)
    elif composition == 'form':
        draw.ellipse((108, 108, 852, 852), fill=accent)
        draw.polygon([(135, 765), (495, 175), (825, 765)], fill=ink)
        draw.ellipse((290, 420, 670, 800), fill=paper)
        draw.rectangle((290, 610, 670, 825), fill=paper)
        draw.rectangle((90, 865, 870, 871), fill=ink)
    else:
        for i in range(6):
            x, y = 90 + (i % 3) * 270, 140 + (i // 3) * 380
            draw.rectangle((x, y, x+240, y+320), fill=accent if i % 2 else pale)
            draw.ellipse((x+30, y+40, x+210, y+220), fill=ink if i % 2 else accent)
            draw.rectangle((x+30, y+130, x+210, y+230), fill=accent if i % 2 else pale)
            draw.line((x+30, y+275, x+150, y+275), fill=ink, width=5)
    image.save(out / (name + '.webp'), quality=88, method=6)

make('northline', ['#efe9dd', '#252f29', '#657962', '#dbd8c9'], 'northline')
make('form-study', ['#f0efeb', '#222d41', '#3862b6', '#d6dae3'], 'form')
make('field-notes', ['#e8e2d6', '#292421', '#99523b', '#d4c7b2'], 'notes')

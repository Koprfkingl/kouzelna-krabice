import os, sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
from ikona import background, fg, rounded, circle, S
seed = int(sys.argv[1]); repo = sys.argv[2]
def badge(im):
    # a "TEST" ribbon across the bottom for the test app
    im = im.copy(); d = ImageDraw.Draw(im); w, h = im.size
    d.rectangle([0, h * 0.74, w, h * 0.9], fill=(230, 40, 70, 255))
    try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(h * 0.12))
    except Exception: f = ImageFont.load_default()
    d.text((w / 2, h * 0.82), 'TEST', fill='white', font=f, anchor='mm')
    return im
bg = background()
legacy = bg.copy(); legacy.alpha_composite(fg(seed, 0.8))
# adaptive: the launcher shows the middle 72 of 108 dp and may crop to a circle: content within ~60 %
fore = fg(seed, 0.55)
DENS = {'ldpi': 0.75, 'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
def write(res, test):
    L = badge(legacy) if test else legacy
    F = badge(fore.copy()) if test else fore
    for d, k in DENS.items():
        p = f'{res}/mipmap-{d}'; os.makedirs(p, exist_ok=True)
        n = round(48 * k)
        rounded(L.resize((n, n), Image.LANCZOS), n // 6).save(f'{p}/ic_launcher.png')
        circle(L.resize((n, n), Image.LANCZOS)).save(f'{p}/ic_launcher_round.png')
        a = round(108 * k)
        F.resize((a, a), Image.LANCZOS).save(f'{p}/ic_launcher_foreground.png')
        bg.resize((a, a), Image.LANCZOS).convert('RGB').save(f'{p}/ic_launcher_background.png')
    p = f'{res}/mipmap-anydpi-v26'; os.makedirs(p, exist_ok=True)
    xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@mipmap/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n'
    for n in ('ic_launcher', 'ic_launcher_round'): open(f'{p}/{n}.xml', 'w').write(xml)
write(f'{repo}/android/app/src/main/res', False)
write(f'{repo}/android/test-ikony/res', True)
legacy.convert('RGB').save(f'{repo}/assets/icon-only.png')
legacy.resize((180, 180), Image.LANCZOS).save(f'{repo}/www/ikona.png')
rounded(legacy.resize((512, 512), Image.LANCZOS), 90).save('ikona/nahled.png')
rounded(badge(legacy).resize((512, 512), Image.LANCZOS), 90).save('ikona/nahled-test.png')

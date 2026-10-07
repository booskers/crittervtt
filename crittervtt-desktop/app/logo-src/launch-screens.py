"""Makes the launch screens for Critter VTT on iPhones and iPads (added to the home screen): the orange mark in the middle
of Critter's dark tone, one picture per screen size, as iOS wants them. The Android app has its own (res/values-v31).

  app/assets/launch/<w>x<h>.png   one per iPhone and iPad screen (portrait, and landscape for iPads)
  app/assets/launch/launch.json   the list build.mjs turns into <link rel="apple-touch-startup-image"> tags

Run:  python app/logo-src/launch-screens.py   (the mark is drawn by Microsoft Edge, headless, from critter-vtt-app-icon.svg)
"""
import json, os, subprocess, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'launch')
TONE = (11, 12, 15)

# (css width, css height, pixel ratio, iPad?) in portrait
SCREENS = [
    (440, 956, 3, False), (430, 932, 3, False), (428, 926, 3, False), (414, 896, 3, False), (402, 874, 3, False),
    (393, 852, 3, False), (390, 844, 3, False), (375, 812, 3, False), (414, 896, 2, False), (375, 667, 2, False), (320, 568, 2, False),
    (1032, 1376, 2, True), (1024, 1366, 2, True), (834, 1194, 2, True), (820, 1180, 2, True), (834, 1112, 2, True),
    (810, 1080, 2, True), (768, 1024, 2, True), (744, 1133, 2, True),
]

edge = next(p for p in [r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'] if os.path.exists(p))
svg = open(os.path.join(HERE, 'critter-vtt-app-icon.svg'), encoding='utf8').read()
with tempfile.TemporaryDirectory() as tmp:
    page = os.path.join(tmp, 'mark.html')
    open(page, 'w', encoding='utf8').write(f'<!doctype html><style>html,body{{margin:0;background:#0b0c0f}}svg{{display:block;width:1024px;height:1024px}}</style>{svg}')
    shot = os.path.join(tmp, 'mark.png')
    subprocess.run([edge, '--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1024,1024',
                    f'--user-data-dir={os.path.join(tmp, "profile")}', f'--screenshot={shot}', 'file:///' + page.replace('\\', '/')], check=True, capture_output=True)
    icon = Image.open(shot).convert('RGB').crop((0, 0, 1024, 1024))
# the mark is 70% of the icon: cut it out with a little room
m = int(1024 * 0.15); mark = icon.crop((m, m, 1024 - m, 1024 - m))

os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
made = []
def screen(w, h):
    img = Image.new('RGB', (w, h), TONE)
    size = int(min(w, h) * 0.30)
    img.paste(mark.resize((size, size), Image.LANCZOS), ((w - size) // 2, (h - size) // 2))
    name = f'{w}x{h}.png'; img.save(os.path.join(OUT, name), optimize=True); return name
for cw, ch, dpr, ipad in SCREENS:
    made.append({'file': screen(cw * dpr, ch * dpr), 'w': cw, 'h': ch, 'dpr': dpr, 'o': 'portrait'})
    if ipad: made.append({'file': screen(ch * dpr, cw * dpr), 'w': cw, 'h': ch, 'dpr': dpr, 'o': 'landscape'})
json.dump(made, open(os.path.join(OUT, 'launch.json'), 'w'), indent=1)
print(f'{len(made)} launch screens in app/assets/launch, {sum(os.path.getsize(os.path.join(OUT, x["file"])) for x in made) // 1024} KB')

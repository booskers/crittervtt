"""Makes the Critter VTT app icon from the mark (critter-vtt-mark.svg): the flat orange mark on Critter's dark tone.

  app/logo-src/critter-vtt-app-icon.svg            the icon, square (iOS and Android cut the corners themselves)
  app/assets/apple-touch-icon.png                  180x180, what iPhones and iPads put on the home screen (iOS takes no SVG here)
  android/res/drawable/ic_launcher_foreground.xml  the same mark as an Android vector drawable, for the adaptive launcher icon

Run:  python app/logo-src/app-icon.py   (the PNG is drawn by Microsoft Edge, headless)
"""
import os, re, subprocess, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DESK = os.path.dirname(os.path.dirname(HERE))
TONE, ORANGE = '#0b0c0f', '#ff5c00'

src = open(os.path.join(HERE, 'critter-vtt-mark.svg'), encoding='utf8').read()
vx, vy, vw, vh = map(float, re.search(r'viewBox="([^"]+)"', src).group(1).split())
m = re.search(r'transform="matrix\(([^)]+)\)"', src).group(1).split(',')
ps, ptx, pty = float(m[0]), float(m[4]), float(m[5])
D = re.search(r' d="([^"]+)"', src).group(1)
assert set(re.findall(r'[A-Za-z]', D)) <= set('MLCZ'), 'the mark should use absolute M/L/C/Z only'

def mark(canvas, size):
    """the mark's path, `size` wide, in the middle of a `canvas`-wide square, in the square's own units"""
    s = size / vw
    ox, oy = (canvas - size) / 2 - vx * s, (canvas - vh * s) / 2 - vy * s
    def pair(mt):
        x, y = map(float, mt.group(0).split(','))
        return f'{ox + (ptx + x * ps) * s:.3f},{oy + (pty + y * ps) * s:.3f}'
    return re.sub(r'-?\d*\.?\d+,-?\d*\.?\d+', pair, D)

# the icon: the mark at 70% of the square
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="{TONE}"/>'
       f'<path d="{mark(1024, 1024 * 0.70)}" fill="{ORANGE}" fill-rule="evenodd"/></svg>\n')
open(os.path.join(HERE, 'critter-vtt-app-icon.svg'), 'w', encoding='utf8').write(svg)

# Android: a 108dp layer, of which launchers show the middle 72dp and may cut it to a circle (66dp across), so the mark is 56dp
xml = f'''<?xml version="1.0" encoding="utf-8"?>
<!-- made by app/logo-src/app-icon.py from critter-vtt-mark.svg; edit the mark and run it again rather than this file -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="#FFFF5C00" android:fillType="evenOdd" android:pathData="{mark(108, 56)}" />
</vector>
'''
drawable = os.path.join(DESK, 'android', 'res', 'drawable')
os.makedirs(drawable, exist_ok=True)
open(os.path.join(drawable, 'ic_launcher_foreground.xml'), 'w', encoding='utf8').write(xml)

# iOS: a 180px PNG, drawn by headless Edge at 1024 and scaled down
edge = next(p for p in [r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'] if os.path.exists(p))
with tempfile.TemporaryDirectory() as tmp:
    page = os.path.join(tmp, 'icon.html')
    open(page, 'w', encoding='utf8').write(f'<!doctype html><style>html,body{{margin:0;background:{TONE}}}svg{{display:block;width:1024px;height:1024px}}</style>{svg}')
    shot = os.path.join(tmp, 'icon.png')
    subprocess.run([edge, '--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1024,1024',
                    f'--user-data-dir={os.path.join(tmp, "profile")}', f'--screenshot={shot}', 'file:///' + page.replace('\\', '/')], check=True, capture_output=True)
    Image.open(shot).convert('RGB').crop((0, 0, 1024, 1024)).resize((180, 180), Image.LANCZOS).save(os.path.join(DESK, 'app', 'assets', 'apple-touch-icon.png'), optimize=True)
print('app icon: critter-vtt-app-icon.svg, apple-touch-icon.png, android ic_launcher_foreground.xml')

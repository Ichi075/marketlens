from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / "src-tauri" / "icons"
root.mkdir(parents=True, exist_ok=True)

size = 1024
image = Image.new("RGBA", (size, size), (13, 17, 24, 255))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((60, 60, 964, 964), radius=230, fill=(19, 28, 37, 255))
draw.rounded_rectangle((170, 192, 854, 477), radius=48, fill=(31, 56, 60, 255))
draw.rounded_rectangle((170, 547, 854, 832), radius=48, fill=(33, 43, 68, 255))
draw.line([(232, 400), (350, 352), (448, 380), (570, 282), (684, 314), (792, 239)],
          fill=(47, 218, 174, 255), width=38, joint="curve")
draw.line([(232, 755), (351, 678), (460, 716), (575, 630), (683, 667), (792, 601)],
          fill=(148, 172, 247, 255), width=38, joint="curve")
for point in [(232, 400), (570, 282), (792, 239)]:
    x, y = point
    draw.ellipse((x - 23, y - 23, x + 23, y + 23), fill=(47, 218, 174, 255))

image.save(root / "icon.png")
image.resize((32, 32), Image.Resampling.LANCZOS).save(root / "32x32.png")
image.resize((128, 128), Image.Resampling.LANCZOS).save(root / "128x128.png")
image.resize((256, 256), Image.Resampling.LANCZOS).save(root / "128x128@2x.png")
image.save(root / "icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
image.save(root / "icon.icns")

# Converts the Radiance .hdr room into an 8-bit sRGB JPEG.
# Phones handle an 8-bit environment far more reliably than float textures.
import sys, numpy as np
from PIL import Image

def read_hdr(path):
    f = open(path, 'rb')
    while True:
        line = f.readline().strip()
        if not line: break
    size = f.readline().split()
    h, w = int(size[1]), int(size[3])
    data = f.read()
    img = np.zeros((h, w, 4), np.uint8)
    pos = 0
    for y in range(h):
        if data[pos] == 2 and data[pos + 1] == 2:
            pos += 4
            for c in range(4):
                x = 0
                while x < w:
                    n = data[pos]; pos += 1
                    if n > 128:
                        n -= 128; img[y, x:x + n, c] = data[pos]; pos += 1
                    else:
                        img[y, x:x + n, c] = np.frombuffer(data[pos:pos + n], np.uint8); pos += n
                    x += n
        else:
            img[y] = np.frombuffer(data[pos:pos + w * 4], np.uint8).reshape(w, 4); pos += w * 4
    e = img[..., 3].astype(np.float32)
    scale = np.where(e > 0, np.ldexp(1.0, (e - 136).astype(np.int32)), 0)
    return img[..., :3].astype(np.float32) * scale[..., None]

lin = read_hdr(sys.argv[1])
exposure = 0.5 / np.median(lin.mean(axis=2))
x = np.clip(lin * exposure, 0, None)
x = x / (1 + x * 0.25)          # soft shoulder so bright lights keep some shape
x = np.clip(x, 0, 1)
srgb = np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)
Image.fromarray((srgb * 255 + 0.5).astype(np.uint8)).save(sys.argv[2], quality=90)
print('ok', lin.shape, 'exposure', exposure)

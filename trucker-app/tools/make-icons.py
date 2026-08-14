#!/usr/bin/env python3
"""Generate RouteRig PWA icons as PNGs (pure Python, no deps).
Draws an orange truck on: rounded-square icon (192/512), full-bleed maskable
(512), and full-bleed apple-touch (180, iOS applies its own mask)."""
import struct
import zlib
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
os.makedirs(OUT, exist_ok=True)

BG = (255, 140, 26, 255)      # brand orange
WHITE = (255, 255, 255, 255)
DARK = (22, 17, 12, 255)
GRAY = (139, 152, 169, 255)


def write_png(path, size, px):
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter: none
        for x in range(size):
            raw.extend(px(x / size, y / size))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    data = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) +
            chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(data)
    print('wrote', os.path.basename(path), len(data), 'bytes')


def in_rrect(u, v, u0, v0, u1, v1, r):
    if u < u0 or u > u1 or v < v0 or v > v1:
        return False
    cx = u0 + r if u < u0 + r else (u1 - r if u > u1 - r else u)
    cy = v0 + r if v < v0 + r else (v1 - r if v > v1 - r else v)
    return (u - cx) ** 2 + (v - cy) ** 2 <= r * r


def truck_color(x, y, s):
    """unit-square coords around (0.5,0.5), scale s"""
    cx = cy = 0.5
    x = (x - cx) / s + cx
    y = (y - cy) / s + cy
    for wx, wy, r in [(0.34, 0.80, 0.088), (0.66, 0.80, 0.088)]:
        d2 = (x - wx) ** 2 + (y - wy) ** 2
        if d2 <= r * r:
            return GRAY if d2 <= (r * 0.45) ** 2 else DARK
    if in_rrect(x, y, 0.15, 0.33, 0.52, 0.72, 0.06):   # trailer
        return WHITE
    if in_rrect(x, y, 0.56, 0.44, 0.84, 0.72, 0.07):   # cab
        return WHITE
    if in_rrect(x, y, 0.60, 0.48, 0.72, 0.58, 0.03):   # windshield
        return DARK
    if in_rrect(x, y, 0.74, 0.28, 0.80, 0.44, 0.02):   # exhaust stack
        return DARK
    return None


def icon_px(round_r, truck_s):
    def px(u, v):
        if round_r and not in_rrect(u, v, round_r, round_r, 1 - round_r, 1 - round_r, 0.18):
            return (0, 0, 0, 0)
        c = truck_color(u, v, truck_s)
        return c if c is not None else BG
    return px


write_png(os.path.join(OUT, 'icon-192.png'), 192, icon_px(0.0, 0.92))
write_png(os.path.join(OUT, 'icon-512.png'), 512, icon_px(0.0, 0.92))
write_png(os.path.join(OUT, 'maskable-512.png'), 512, icon_px(0.0, 0.55))
write_png(os.path.join(OUT, 'apple-touch-icon.png'), 180, icon_px(0.0, 0.70))

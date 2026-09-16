# -*- coding: utf-8 -*-
"""
《草稿箱》器乐重编 v2 — 采样缓存加速
Neo-soul · BPM72 · Ab · Stereo
"""
import math
import struct
import wave
import os
import random

SR = 44100
BPM = 72.0
BEAT = 60.0 / BPM
random.seed(72)

NOTE_NUM = {
    "C": 0, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5,
    "Gb": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11,
}


def n2f(note: str) -> float:
    name, octv = note[:-1], int(note[-1])
    midi = NOTE_NUM[name] + (octv + 1) * 12
    return 440.0 * (2 ** ((midi - 69) / 12.0))


# ---------- sample bank ----------
_BANK = {}


def _synth_ep(freq, dur):
    n = int(SR * dur)
    out = []
    a, d, s, r = 0.025, 0.4, 0.5, 0.18
    for i in range(n):
        t = i / SR
        if t < 0 or t > dur:
            out.append(0.0)
            continue
        if t < a:
            e = (t / a) ** 0.7
        elif t < a + d:
            e = 1.0 - (1.0 - s) * ((t - a) / d) ** 0.85
        elif t < dur - r:
            e = s
        else:
            e = s * ((dur - t) / r) ** 0.9 if t < dur else 0.0
        tine = math.exp(-t * 22.0) * 0.18 * math.sin(2 * math.pi * freq * 6.1 * t)
        tone = (
            math.sin(2 * math.pi * freq * t)
            + 0.28 * math.sin(2 * math.pi * freq * 2.0 * t + 0.5)
            + 0.08 * math.sin(2 * math.pi * freq * 3.0 * t + 1.1)
            + tine
        )
        tone *= 1.0 + 0.03 * math.sin(2 * math.pi * 3.8 * t)
        out.append(tone * e * 0.16)
    return out


def _synth_bass(freq, dur):
    n = int(SR * dur)
    out = []
    a, d, s, r = 0.02, 0.35, 0.5, 0.12
    for i in range(n):
        t = i / SR
        if t < a:
            e = (t / a) ** 0.7
        elif t < a + d:
            e = 1.0 - (1.0 - s) * ((t - a) / d) ** 0.85
        elif t < dur - r:
            e = s
        else:
            e = s * ((dur - t) / r) ** 0.9 if t < dur else 0.0
        tone = (
            math.sin(2 * math.pi * freq * t)
            + 0.18 * math.sin(2 * math.pi * freq * 2 * t + 0.3)
            + 0.05 * math.sin(2 * math.pi * freq * 3 * t)
        )
        out.append(tone * e * 0.20)
    return out


def _synth_guitar(freq, dur):
    n = int(SR * dur)
    out = []
    decay_k = 3.2 / max(0.4, min(dur, 2.0))
    for i in range(n):
        t = i / SR
        decay = math.exp(-t * decay_k)
        attack = min(1.0, t / 0.008) if t > 0 else 0.0
        tone = (
            math.sin(2 * math.pi * freq * t)
            + 0.22 * math.sin(2 * math.pi * freq * 2.002 * t + 0.15)
            + 0.07 * math.sin(2 * math.pi * freq * 3.0 * t + 0.4)
        )
        out.append(tone * decay * attack * 0.14)
    return out


def _synth_pad(freq, dur):
    n = int(SR * dur)
    out = []
    a, d, s, r = 0.35, 0.5, 0.75, 0.45
    for i in range(n):
        t = i / SR
        if t < a:
            e = (t / a) ** 0.7
        elif t < a + d:
            e = 1.0 - (1.0 - s) * ((t - a) / d) ** 0.85
        elif t < dur - r:
            e = s
        else:
            e = s * ((dur - t) / r) ** 0.9 if t < dur else 0.0
        tone = (
            math.sin(2 * math.pi * freq * t)
            + 0.20 * math.sin(2 * math.pi * freq * 1.001 * t + 0.7)
            + 0.10 * math.sin(2 * math.pi * freq * 2.0 * t + 0.2)
            + 0.04 * math.sin(2 * math.pi * freq * 3.0 * t)
        )
        tone *= 1.0 + 0.05 * math.sin(2 * math.pi * 4.8 * t + 1.0)
        out.append(tone * e * 0.10)
    return out


def _synth_kick(dur=0.32):
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        f = 78 * math.exp(-t * 16) + 42
        e = math.exp(-t * 11) * (1 - math.exp(-t * 200))
        out.append(math.sin(2 * math.pi * f * t) * e * 0.30)
    return out


def _synth_rim(seed):
    n = int(SR * 0.07)
    st = seed
    out = []
    for i in range(n):
        st = (1103515245 * st + 12345) & 0x7FFFFFFF
        x = st / 0x3FFFFFFF - 1.0
        t = i / SR
        out.append(x * math.exp(-t * 55) * 0.14)
    return out


def _synth_hat(seed, open_=False):
    n = int(SR * (0.12 if open_ else 0.045))
    st = seed
    out = []
    prev = 0.0
    for i in range(n):
        st = (1103515245 * st + 12345) & 0x7FFFFFFF
        x = st / 0x3FFFFFFF - 1.0
        t = i / SR
        e = math.exp(-t * (18 if open_ else 55))
        hp = x - prev * 0.6
        prev = x
        out.append(hp * e * 0.06)
    return out


def get_sample(kind, freq=None, dur=None, seed=None, open_=False):
    if kind == "kick":
        key = ("kick",)
        if key not in _BANK:
            _BANK[key] = _synth_kick()
        return _BANK[key]
    if kind == "rim":
        key = ("rim", seed)
        if key not in _BANK:
            _BANK[key] = _synth_rim(seed)
        return _BANK[key]
    if kind == "hat":
        key = ("hat", seed, open_)
        if key not in _BANK:
            _BANK[key] = _synth_hat(seed, open_)
        return _BANK[key]
    # pitched: quantize dur to 50ms buckets to increase cache hits
    dq = max(0.05, round(dur * 20) / 20.0)
    fq = round(freq, 2)
    key = (kind, fq, dq)
    if key not in _BANK:
        if kind == "ep":
            _BANK[key] = _synth_ep(fq, dq)
        elif kind == "bass":
            _BANK[key] = _synth_bass(fq, dq)
        elif kind == "guitar":
            _BANK[key] = _synth_guitar(fq, dq)
        elif kind == "pad":
            _BANK[key] = _synth_pad(fq, dq)
        elif kind == "lead":
            _BANK[key] = _synth_ep(fq, dq)  # same engine, amp applied later
        else:
            _BANK[key] = [0.0]
    return _BANK[key]


class Bus:
    def __init__(self, approx_sec=260):
        n = int(SR * approx_sec)
        self.L = [0.0] * n
        self.R = [0.0] * n

    def add(self, start, samples, gl=1.0, gr=1.0, amp=1.0):
        end = start + len(samples)
        if end > len(self.L):
            d = end - len(self.L)
            self.L.extend([0.0] * d)
            self.R.extend([0.0] * d)
        if start < 0:
            samples = samples[-start:]
            start = 0
        agl = gl * amp
        agr = gr * amp
        # tight loop
        L = self.L
        R = self.R
        for i in range(len(samples)):
            v = samples[i]
            L[start + i] += v * agl
            R[start + i] += v * agr


def V(*n):
    return list(n)


CHORDS = {
    "Abmaj9": (V("Ab3", "C4", "Eb4", "G4", "Bb4"), "Ab2"),
    "Dbmaj9": (V("Db3", "F3", "Ab3", "C4", "Eb4"), "Db2"),
    "Fm9":    (V("F3", "Ab3", "C4", "Eb4", "G4"), "F2"),
    "Bbm9":   (V("Bb2", "Db3", "F3", "Ab3", "C4"), "Bb2"),
    "Bbm7":   (V("Bb2", "Db3", "F3", "Ab3"), "Bb2"),
    "Eb13":   (V("Eb3", "G3", "Bb3", "Db4", "C5"), "Eb2"),
    "Eb7":    (V("Eb3", "G3", "Bb3", "Db4"), "Eb2"),
    "Eb7sus": (V("Eb3", "Ab3", "Bb3", "Db4"), "Eb2"),
    "Cm7":    (V("C3", "Eb3", "G3", "Bb3"), "C2"),
    "Gm7b5":  (V("G3", "Bb3", "Db4", "F4"), "G2"),
    "C7":     (V("C3", "E3", "Bb3", "Eb4"), "C2"),
    "Abm6":   (V("Ab3", "B3", "Eb4", "F4"), "Ab2"),
    "Db6":    (V("Db3", "F3", "Ab3", "Bb3"), "Db2"),
}

GUITARP = {
    "Abmaj9": ["C4", "Eb4", "G4", "Bb4", "G4", "Eb4"],
    "Dbmaj9": ["F3", "Ab3", "C4", "Eb4", "C4", "Ab3"],
    "Fm9":    ["Ab3", "C4", "Eb4", "G4", "Eb4", "C4"],
    "Bbm9":   ["Db3", "F3", "Ab3", "C4", "Ab3", "F3"],
    "Bbm7":   ["Db3", "F3", "Ab3", "F3", "Db3", "F3"],
    "Eb13":   ["G3", "Bb3", "Db4", "C5", "Db4", "Bb3"],
    "Eb7":    ["G3", "Bb3", "Db4", "Bb3", "G3", "Bb3"],
    "Eb7sus": ["Ab3", "Bb3", "Db4", "Bb3", "Ab3", "Bb3"],
    "Cm7":    ["Eb3", "G3", "Bb3", "G3", "Eb3", "G3"],
    "Gm7b5":  ["Bb3", "Db4", "F4", "Db4", "Bb3", "F3"],
    "C7":     ["E3", "Bb3", "Eb4", "Bb3", "E3", "G3"],
    "Abm6":   ["B3", "Eb4", "F4", "Eb4", "B3", "F4"],
    "Db6":    ["F3", "Ab3", "Bb3", "Ab3", "F3", "Ab3"],
}

PAD_TOP = {
    "Abmaj9": ["Eb5", "Bb4"],
    "Dbmaj9": ["F5", "C5"],
    "Fm9":    ["Ab4", "C5"],
    "Bbm9":   ["F4", "C5"],
    "Eb13":   ["Bb4", "C5"],
    "Eb7":    ["Db5", "Bb4"],
    "Cm7":    ["G4", "Bb4"],
    "Gm7b5":  ["Db5", "F4"],
    "C7":     ["Eb5", "Bb4"],
    "Abm6":   ["Eb5", "F4"],
    "Bbm7":   ["Ab4", "Db5"],
    "Eb7sus": ["Ab4", "Db5"],
    "Db6":    ["Ab4", "Bb4"],
}


def pan(i, n, width=0.85):
    if n <= 1:
        return 0.5, 0.5
    x = i / (n - 1)
    a = (x - 0.5) * width * math.pi
    l = math.cos(a + math.pi / 4)
    r = math.sin(a + math.pi / 4)
    return max(0.15, l), max(0.15, r)


def hit_chord(bus, beat, name, dur_beats, level=1.0, with_pad=True, with_guitar=True):
    notes, root = CHORDS[name]
    t0 = int(beat * BEAT * SR)
    for i, nn in enumerate(notes):
        jitter = int(random.uniform(0, 0.005) * SR)
        amp = (0.85 / (len(notes) ** 0.35)) * level
        dur = dur_beats * BEAT * 1.02
        s = get_sample("ep", n2f(nn), dur)
        gl, gr = pan(i, len(notes), 0.7)
        bus.add(t0 + jitter, s, gl, gr, amp)
    bs = get_sample("bass", n2f(root), dur_beats * BEAT * 0.55)
    bus.add(t0, bs, 0.7, 0.7, 0.75 * level)
    if with_guitar:
        pat = GUITARP[name]
        step = 0.5
        k = 0
        t = beat
        while t < beat + dur_beats - 0.08:
            nn = pat[k % len(pat)]
            s = get_sample("guitar", n2f(nn), step * BEAT * 2.0)
            bus.add(int(t * BEAT * SR), s, 0.32, 0.68, 0.22 * level)
            t += step
            k += 1
    if with_pad:
        tops = PAD_TOP.get(name, [])
        for j, nn in enumerate(tops):
            s = get_sample("pad", n2f(nn), dur_beats * BEAT * 1.08)
            gl, gr = pan(j, len(tops), 1.0)
            bus.add(t0, s, gl, gr, 0.14 * level)


def perc_bar(bus, beat0, intensity):
    if intensity <= 0:
        return
    swing = 0.54
    if intensity >= 1:
        for b in (0.0, 2.0):
            bus.add(int((beat0 + b) * BEAT * SR), get_sample("kick"), 0.65, 0.65, 0.55 + 0.05 * intensity)
        for b, sd in ((1.0, 11), (3.0, 22)):
            bus.add(int((beat0 + b) * BEAT * SR), get_sample("rim", seed=sd), 0.45, 0.55, 1.0)
    if intensity >= 2:
        positions = [0.0, swing, 1.0, 1 + swing, 2.0, 2 + swing, 3.0, 3 + swing]
        for i, p in enumerate(positions):
            on = abs(p % 1.0) < 0.01
            bus.add(
                int((beat0 + p) * BEAT * SR),
                get_sample("hat", seed=30 + i),
                0.4, 0.6,
                1.0 if on else 0.55,
            )
    if intensity >= 3:
        bus.add(int((beat0 + 3.5) * BEAT * SR), get_sample("hat", seed=40), 0.5, 0.5, 0.7)
        bus.add(int((beat0 + 1.75) * BEAT * SR), get_sample("rim", seed=41), 0.4, 0.6, 0.55)


def hit_lead(bus, beat, note, dur, amp=0.9):
    micro = random.uniform(-0.003, 0.008)
    t0 = int((beat * BEAT + micro) * SR)
    if t0 < 0:
        t0 = 0
    s = get_sample("lead", n2f(note), dur * BEAT * 0.94)
    bus.add(t0, s, 0.48, 0.52, amp)


INTRO_C = ["Abmaj9", "Fm9", "Dbmaj9", "Eb7sus"]
VERSE_C = [
    "Abmaj9", "Gm7b5", "C7", "Fm9",
    "Bbm9", "Eb13", "Abmaj9", "Dbmaj9",
    "Abmaj9", "Gm7b5", "C7", "Fm9",
    "Bbm9", "Eb13", "Abmaj9", "Eb7sus",
]
PRE_C = [
    "Bbm9", "Eb13", "Dbmaj9", "Eb7sus",
    "Bbm9", "Eb13", "Gm7b5", "C7",
]
CHO_C = [
    "Abmaj9", "Dbmaj9", "Cm7", "Fm9",
    "Bbm9", "Eb13", "Abmaj9", "Db6",
    "Abmaj9", "Dbmaj9", "Cm7", "Fm9",
    "Bbm9", "Eb7sus", "Abmaj9", "Abmaj9",
]
BRI_C = [
    "Fm9", "Bbm9", "Eb7sus", "Abmaj9",
    "Dbmaj9", "Abm6", "Bbm7", "Eb7",
]
OUTRO_C = ["Abmaj9", "Dbmaj9", "Abmaj9", "Abmaj9"]

V_LEAD = [
    (0.5, "Eb4", 0.75, 0.85), (1.25, "F4", 0.75, 0.85), (2.0, "G4", 1.0, 0.9),
    (3.0, "Ab4", 1.5, 0.9), (4.5, "G4", 0.5, 0.85), (5.0, "F4", 0.75, 0.85),
    (5.75, "Eb4", 1.25, 0.9), (8.0, "Eb4", 0.5, 0.8), (8.5, "F4", 0.5, 0.8),
    (9.0, "G4", 0.75, 0.9), (10.0, "C5", 1.0, 0.95), (11.0, "Bb4", 0.75, 0.85),
    (11.75, "Ab4", 1.25, 0.9), (12.5, "F4", 0.75, 0.85), (13.25, "Ab4", 0.75, 0.85),
    (14.0, "C5", 1.0, 0.9), (15.0, "Bb4", 1.5, 0.85), (16.5, "Ab4", 2.0, 0.9),
    (20.5, "Eb4", 0.75, 0.85), (21.25, "F4", 0.75, 0.85), (22.0, "G4", 1.0, 0.9),
    (23.0, "Ab4", 1.5, 0.9), (24.5, "Bb4", 0.5, 0.85), (25.0, "C5", 0.75, 0.9),
    (25.75, "Bb4", 1.25, 0.85), (28.0, "Ab4", 0.75, 0.85), (28.75, "Bb4", 0.75, 0.85),
    (29.5, "C5", 1.0, 0.9), (32.0, "Eb5", 1.0, 0.95), (33.0, "Db5", 0.75, 0.9),
    (33.75, "C5", 1.25, 0.9), (36.0, "Bb4", 1.0, 0.85), (37.0, "Ab4", 2.0, 0.85),
    (40.0, "Eb4", 0.75, 0.8), (40.75, "F4", 0.75, 0.8), (41.5, "G4", 1.0, 0.85),
    (44.0, "Ab4", 3.0, 0.9), (48.0, "C5", 1.0, 0.9), (49.0, "Bb4", 0.75, 0.85),
    (49.75, "Ab4", 1.25, 0.9), (52.0, "G4", 0.75, 0.85), (52.75, "F4", 0.75, 0.85),
    (53.5, "Eb4", 1.0, 0.9), (56.0, "F4", 1.0, 0.85), (57.0, "G4", 0.75, 0.85),
    (57.75, "Ab4", 2.0, 0.9), (60.0, "Bb4", 0.75, 0.85), (60.75, "Ab4", 0.75, 0.85),
    (61.5, "G4", 1.0, 0.85), (64.0, "Ab4", 3.0, 0.9),
]

P_LEAD = [
    (0.5, "F4", 0.75, 0.85), (1.25, "G4", 0.75, 0.85), (2.0, "Ab4", 1.0, 0.9),
    (3.0, "Bb4", 1.5, 0.9), (4.5, "C5", 0.75, 0.9), (5.25, "Bb4", 0.75, 0.85),
    (6.0, "Ab4", 1.5, 0.9), (8.0, "Ab4", 0.5, 0.85), (8.5, "Bb4", 0.5, 0.85),
    (9.0, "C5", 0.75, 0.9), (10.0, "Eb5", 1.5, 0.95), (12.0, "Db5", 0.75, 0.9),
    (12.75, "C5", 0.75, 0.9), (13.5, "Bb4", 1.5, 0.9), (16.0, "Ab4", 0.75, 0.85),
    (16.75, "Bb4", 0.75, 0.85), (17.5, "C5", 1.0, 0.9), (20.0, "Eb5", 1.5, 0.95),
    (24.0, "Db5", 0.75, 0.9), (24.75, "C5", 0.75, 0.9), (25.5, "Bb4", 0.75, 0.85),
    (26.25, "G4", 0.75, 0.85), (28.0, "Bb4", 1.0, 0.9), (29.0, "Db5", 1.0, 0.9),
    (30.0, "C5", 1.0, 0.9), (31.0, "Bb4", 1.0, 0.85),
]

C_LEAD = [
    (0.0, "C5", 1.0, 1.0), (1.0, "Eb5", 1.0, 1.0), (2.0, "F5", 1.5, 1.0),
    (3.5, "Eb5", 0.5, 0.95), (4.0, "F5", 1.0, 1.0), (5.0, "Ab5", 1.5, 1.0),
    (6.5, "G5", 0.5, 0.95), (7.0, "F5", 1.0, 1.0), (8.0, "Eb5", 1.0, 1.0),
    (9.0, "G5", 1.0, 1.0), (10.0, "F5", 0.75, 0.95), (10.75, "Eb5", 1.25, 0.95),
    (12.0, "C5", 1.0, 1.0), (13.0, "Ab4", 1.0, 0.95), (14.0, "C5", 1.5, 1.0),
    (16.0, "Db5", 1.0, 1.0), (17.0, "F5", 1.0, 1.0), (18.0, "Eb5", 1.0, 0.95),
    (19.0, "Db5", 1.0, 0.95), (20.0, "C5", 1.0, 1.0), (21.0, "Bb4", 1.0, 0.95),
    (22.0, "G4", 1.5, 0.9), (24.0, "Ab4", 2.0, 0.95), (28.0, "Bb4", 1.0, 0.9),
    (29.0, "Ab4", 2.5, 0.9), (32.0, "Eb5", 1.0, 1.0), (33.0, "G5", 1.0, 1.0),
    (34.0, "Ab5", 1.5, 1.0), (35.5, "G5", 0.5, 0.95), (36.0, "F5", 1.0, 1.0),
    (37.0, "Ab5", 1.5, 1.0), (38.5, "G5", 0.5, 0.95), (39.0, "Eb5", 1.0, 1.0),
    (40.0, "Eb5", 1.0, 1.0), (41.0, "G5", 1.0, 1.0), (42.0, "F5", 0.75, 0.95),
    (42.75, "Eb5", 1.25, 0.95), (44.0, "C5", 1.5, 1.0), (45.5, "Ab4", 1.0, 0.95),
    (46.5, "C5", 1.5, 1.0), (48.0, "Db5", 1.0, 1.0), (49.0, "F5", 1.0, 1.0),
    (50.0, "Eb5", 1.0, 0.95), (51.0, "Db5", 1.0, 0.95), (52.0, "C5", 2.0, 1.0),
    (56.0, "Bb4", 1.0, 0.95), (57.0, "C5", 3.0, 1.0), (60.0, "Ab4", 4.0, 0.9),
]

B_LEAD = [
    (0.5, "C5", 0.75, 0.85), (1.25, "Db5", 0.75, 0.85), (2.0, "C5", 1.5, 0.9),
    (4.5, "Bb4", 0.75, 0.85), (5.25, "C5", 0.75, 0.85), (6.0, "Eb5", 1.5, 0.9),
    (8.5, "Db5", 0.75, 0.85), (9.25, "C5", 0.75, 0.85), (10.0, "Bb4", 1.5, 0.85),
    (12.0, "Ab4", 2.0, 0.9), (16.0, "F4", 0.75, 0.85), (16.75, "Ab4", 0.75, 0.85),
    (17.5, "Bb4", 1.0, 0.9), (20.0, "B4", 1.0, 0.85), (21.0, "Eb5", 1.5, 0.9),
    (24.0, "Db5", 1.0, 0.9), (25.0, "C5", 1.0, 0.9), (26.0, "Bb4", 2.0, 0.9),
    (28.0, "Ab4", 1.0, 0.9), (29.0, "Bb4", 1.0, 0.9), (30.0, "C5", 2.0, 0.95),
]


def play_section(bus, start, chords, level, perc, lead):
    for i, ch in enumerate(chords):
        b = start + i * 4
        if isinstance(perc, tuple):
            pi = int(round(perc[0] + (perc[1] - perc[0]) * (i / max(1, len(chords) - 1))))
        else:
            pi = perc
        hit_chord(bus, b, ch, 4, level=level)
        perc_bar(bus, b, pi)
    for item in lead:
        rel, note, dur, amp = item
        hit_lead(bus, start + rel, note, dur, amp)


def write_wav(path, bus, fade_in=0.12, fade_out=3.0):
    n = len(bus.L)
    peak = max(1e-9, max(max(abs(x) for x in bus.L), max(abs(x) for x in bus.R)))
    gain = 0.68 / peak
    fi = int(SR * fade_in)
    fo = int(SR * fade_out)
    frames = bytearray()
    for i in range(n):
        e = 1.0
        if i < fi:
            e = i / fi
        if i > n - fo:
            e *= max(0.0, (n - i) / fo)
        l = max(-1.0, min(1.0, bus.L[i] * gain * e))
        r = max(-1.0, min(1.0, bus.R[i] * gain * e))
        frames += struct.pack("<hh", int(l * 32767), int(r * 32767))
    with wave.open(path, "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(frames)
    print(f"wrote {os.path.basename(path)}  {n/SR:.1f}s  bank={len(_BANK)}")


def main():
    bus = Bus(280)
    # Intro
    for i, ch in enumerate(INTRO_C):
        b = i * 4
        hit_chord(bus, b, ch, 4, level=0.55 if i < 2 else 0.65,
                  with_guitar=(i >= 2), with_pad=True)
        perc_bar(bus, b, 0 if i < 2 else 1)

    play_section(bus, 16, VERSE_C, 0.82, (1, 2), V_LEAD)
    play_section(bus, 16 + 64, PRE_C, 0.88, (2, 3), P_LEAD)
    play_section(bus, 16 + 64 + 32, CHO_C, 0.95, 3, C_LEAD)
    play_section(bus, 16 + 64 + 32 + 64, BRI_C, 0.72, 1, B_LEAD)
    play_section(bus, 16 + 64 + 32 + 64 + 32, CHO_C, 1.0, 3, C_LEAD)

    out_start = 16 + 64 + 32 + 64 + 32 + 64
    for i, ch in enumerate(OUTRO_C):
        b = out_start + i * 4
        hit_chord(bus, b, ch, 5 if i < 3 else 8, level=max(0.2, 0.55 - i * 0.08),
                  with_guitar=(i == 0))
        if i < 2:
            perc_bar(bus, b, 1)
    for j, nn in enumerate(["Ab3", "C4", "Eb4", "G4", "C5"]):
        s = get_sample("guitar", n2f(nn), 4.0 * BEAT)
        bus.add(int((out_start + 2 + j * 0.4) * BEAT * SR), s, 0.4, 0.6, 0.2)

    outdir = r"D:\Soft\main\ruanjian\AI\MIMO-desktop\tempproject\caogaoxiang"
    write_wav(os.path.join(outdir, "草稿箱_完整编曲.wav"), bus)


if __name__ == "__main__":
    main()

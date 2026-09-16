# -*- coding: utf-8 -*-
"""草稿箱 — karaoke backing + guide-melody. Stereo, soft percussion, stdlib only."""
import math
import struct
import wave
import os

SR = 44100
BPM = 72.0
BEAT = 60.0 / BPM

NAMES = {
    "C": 261.63, "C#": 277.18, "Db": 277.18, "D": 293.66, "D#": 311.13,
    "Eb": 311.13, "E": 329.63, "F": 349.23, "F#": 369.99, "Gb": 369.99,
    "G": 392.00, "G#": 415.30, "Ab": 415.30, "A": 440.00, "A#": 466.16,
    "Bb": 466.16, "B": 493.88,
}


def n2f(note: str) -> float:
    if note.endswith(tuple("0123456789")):
        name, octv = note[:-1], int(note[-1])
    else:
        name, octv = note, 4
    return NAMES[name] * (2 ** (octv - 4))


def env(t, dur, a, d, s, r):
    if t < 0 or t > dur:
        return 0.0
    if t < a:
        return t / a
    if t < a + d:
        return 1.0 - (1.0 - s) * (t - a) / d
    if t < dur - r:
        return s
    if t < dur:
        return s * (dur - t) / r
    return 0.0


def rhodes(freq, t, vel=1.0):
    tone = (
        math.sin(2 * math.pi * freq * t)
        + 0.32 * math.sin(2 * math.pi * freq * 2.0 * t + 0.4)
        + 0.10 * math.sin(2 * math.pi * freq * 3.0 * t + 0.9)
        + 0.05 * math.sin(2 * math.pi * freq * 4.02 * t)
    )
    tone *= 1.0 + 0.035 * math.sin(2 * math.pi * 4.2 * t)
    return vel * tone * 0.18


def bass_tone(freq, t, vel=1.0):
    tone = math.sin(2 * math.pi * freq * t) + 0.22 * math.sin(2 * math.pi * freq * 2 * t)
    return vel * tone * 0.22


def pluck(freq, t, dur, vel=1.0):
    """Guitar-ish soft pluck."""
    decay = math.exp(-t * 6.5 / max(dur, 0.15))
    tone = (
        math.sin(2 * math.pi * freq * t)
        + 0.28 * math.sin(2 * math.pi * freq * 2 * t + 0.2)
        + 0.10 * math.sin(2 * math.pi * freq * 3 * t)
    )
    return vel * tone * decay * 0.16


def noise_hit(dur, bright=0.5, amp=0.2):
    """Soft noise burst for rim / hat-ish."""
    out = []
    n = int(SR * dur)
    # simple LCG noise
    state = 1234567
    for i in range(n):
        state = (1103515245 * state + 12345) & 0x7FFFFFFF
        nz = (state / 0x3FFFFFFF) - 1.0
        t = i / SR
        e = math.exp(-t * (28 if bright < 0.5 else 48))
        tone = nz * e
        if bright > 0.5:
            # crude high-pass: difference
            if i:
                tone = nz * e - out[-1] * 0.3
        out.append(tone * amp)
    return out


def kick(dur=0.28, amp=0.35):
    out = []
    n = int(SR * dur)
    for i in range(n):
        t = i / SR
        f = 90 * math.exp(-t * 18) + 45
        e = math.exp(-t * 14)
        out.append(math.sin(2 * math.pi * f * t) * e * amp)
    return out


def mix_at(buf_l, buf_r, start, samples, gain_l=1.0, gain_r=1.0):
    end = start + len(samples)
    need = end - len(buf_l)
    if need > 0:
        buf_l.extend([0.0] * need)
        buf_r.extend([0.0] * need)
    for i, s in enumerate(samples):
        buf_l[start + i] += s * gain_l
        buf_r[start + i] += s * gain_r


def note_samples(freq, dur, amp, kind):
    n = int(SR * dur * 0.96)
    out = []
    for i in range(n):
        t = i / SR
        if kind == "lead":
            e = env(t, dur, 0.02, 0.22, 0.55, 0.08)
            out.append(rhodes(freq, t, amp) * e)
        elif kind == "bass":
            e = env(t, dur, 0.03, 0.3, 0.45, 0.12)
            out.append(bass_tone(freq, t, amp) * e)
        elif kind == "guitar":
            out.append(pluck(freq, t, dur, amp))
        else:
            e = env(t, dur, 0.03, 0.35, 0.45, 0.15)
            out.append(rhodes(freq, t, amp * 0.75) * e)
    return out


CHORDS = {
    "Abmaj9": ["Ab3", "C4", "Eb4", "G4", "Bb4"],
    "Fm9": ["F3", "Ab3", "C4", "Eb4", "G4"],
    "Dbmaj7": ["Db3", "F3", "Ab3", "C4"],
    "Bbm7": ["Bb2", "Db3", "F3", "Ab3"],
    "Eb7": ["Eb3", "G3", "Bb3", "Db4"],
    "Abmaj7": ["Ab3", "C4", "Eb4", "G4"],
    "Cm7": ["C3", "Eb3", "G3", "Bb3"],
    "Eb7sus": ["Eb3", "Ab3", "Bb3", "Db4"],
    "Abm6": ["Ab3", "B3", "Eb4", "F4"],
}
ROOTS = {
    "Abmaj9": "Ab2", "Fm9": "F2", "Dbmaj7": "Db2", "Bbm7": "Bb2",
    "Eb7": "Eb2", "Abmaj7": "Ab2", "Cm7": "C2", "Eb7sus": "Eb2", "Abm6": "Ab2",
}
# simple arpeggio for guitar layer (root-5-3-oct shapes)
GUITAR = {
    "Abmaj9": ["Ab3", "Eb4", "C4", "G4"],
    "Fm9": ["F3", "C4", "Ab3", "Eb4"],
    "Dbmaj7": ["Db3", "Ab3", "F3", "C4"],
    "Bbm7": ["Bb2", "F3", "Db3", "Ab3"],
    "Eb7": ["Eb3", "Bb3", "G3", "Db4"],
    "Abmaj7": ["Ab3", "Eb4", "C4", "G4"],
    "Cm7": ["C3", "G3", "Eb3", "Bb3"],
    "Eb7sus": ["Eb3", "Bb3", "Ab3", "Db4"],
    "Abm6": ["Ab3", "Eb4", "B3", "F4"],
}


def play_chord(buf_l, buf_r, beat, name, dur_beats, amp=0.85):
    t0 = int(beat * BEAT * SR)
    notes = CHORDS[name]
    g = amp / max(1, len(notes) ** 0.45)
    for i, nn in enumerate(notes):
        pan_l = 0.55 + 0.45 * math.cos(i * 1.1)
        pan_r = 0.55 + 0.45 * math.sin(i * 1.1)
        s = note_samples(n2f(nn), dur_beats * BEAT, g, "pad")
        mix_at(buf_l, buf_r, t0, s, pan_l, pan_r)
    # guitar arpeggio: 8ths lightly
    arp = GUITAR[name]
    step = 0.5
    k = 0
    t = beat
    while t < beat + dur_beats - 0.05:
        nn = arp[k % len(arp)]
        s = note_samples(n2f(nn), step * BEAT * 1.8, amp * 0.22, "guitar")
        mix_at(buf_l, buf_r, int(t * BEAT * SR), s, 0.35, 0.7)
        t += step
        k += 1
    s = note_samples(n2f(ROOTS[name]), dur_beats * BEAT * 0.55, 0.7, "bass")
    mix_at(buf_l, buf_r, t0, s, 0.6, 0.6)


def play_lead(buf_l, buf_r, beat, note, dur, amp=1.0):
    s = note_samples(n2f(note), dur * BEAT, amp, "lead")
    mix_at(buf_l, buf_r, int(beat * BEAT * SR), s, 0.5, 0.5)


def play_perc(buf_l, buf_r, beat, kind="rim"):
    t0 = int(beat * BEAT * SR)
    if kind == "kick":
        s = kick(amp=0.28)
        mix_at(buf_l, buf_r, t0, s, 0.7, 0.7)
    elif kind == "rim":
        s = noise_hit(0.08, bright=0.2, amp=0.18)
        mix_at(buf_l, buf_r, t0, s, 0.45, 0.55)
    elif kind == "hat":
        s = noise_hit(0.05, bright=0.9, amp=0.08)
        mix_at(buf_l, buf_r, t0, s, 0.4, 0.6)
    elif kind == "ghost":
        s = noise_hit(0.04, bright=0.9, amp=0.04)
        mix_at(buf_l, buf_r, t0, s, 0.5, 0.5)


def fill_perc(buf_l, buf_r, start_beat, n_bars, intensity=1):
    """Soft brush pattern: kick on 1 & 3-ish, rim on 2 & 4, sparse hats."""
    for bar in range(n_bars):
        b0 = start_beat + bar * 4
        play_perc(buf_l, buf_r, b0, "kick")
        play_perc(buf_l, buf_r, b0 + 2, "kick")
        play_perc(buf_l, buf_r, b0 + 1, "rim")
        play_perc(buf_l, buf_r, b0 + 3, "rim")
        if intensity >= 2:
            play_perc(buf_l, buf_r, b0 + 0.5, "hat")
            play_perc(buf_l, buf_r, b0 + 1.5, "hat")
            play_perc(buf_l, buf_r, b0 + 2.5, "hat")
            play_perc(buf_l, buf_r, b0 + 3.5, "hat")
        if intensity >= 3 and bar % 2 == 1:
            play_perc(buf_l, buf_r, b0 + 3.75, "ghost")


def bars(buf_l, buf_r, names, start, bar_beats=4, amp=0.85, perc=0):
    t = start
    for i, name in enumerate(names):
        play_chord(buf_l, buf_r, t, name, bar_beats, amp=amp)
        if perc:
            fill_perc(buf_l, buf_r, t, 1, intensity=perc)
        t += bar_beats
    return t


def write_wav(path, buf_l, buf_r, fade_out_sec=2.0):
    peak = max(1e-9, max(max(abs(x) for x in buf_l), max(abs(x) for x in buf_r)))
    gain = 0.70 / peak
    n = len(buf_l)
    fo = int(SR * fade_out_sec)
    frames = bytearray()
    for i in range(n):
        env_f = 1.0
        if i > n - fo:
            env_f = max(0.0, (n - i) / fo)
        # gentle head fade-in 80ms
        if i < int(SR * 0.08):
            env_f *= i / (SR * 0.08)
        l = max(-1.0, min(1.0, buf_l[i] * gain * env_f))
        r = max(-1.0, min(1.0, buf_r[i] * gain * env_f))
        frames += struct.pack("<hh", int(l * 32767), int(r * 32767))
    with wave.open(path, "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(frames)
    print(f"wrote {os.path.basename(path)}  dur={n/SR:.1f}s  stereo")


def build(include_lead: bool, out_path: str):
    buf_l, buf_r = [], []
    # Intro 4 — quiet, no perc first 2
    t = 0
    t = bars(buf_l, buf_r, ["Abmaj9", "Fm9"], t, 4, amp=0.65, perc=0)
    t = bars(buf_l, buf_r, ["Dbmaj7", "Eb7sus"], t, 4, amp=0.7, perc=1)

    # Verse 16
    v = t
    bars(buf_l, buf_r, [
        "Abmaj9", "Fm9", "Dbmaj7", "Bbm7", "Eb7",
        "Abmaj9", "Fm9", "Dbmaj7", "Bbm7", "Eb7",
        "Abmaj9", "Fm9", "Dbmaj7", "Bbm7", "Eb7", "Abmaj7",
    ], v, 4, amp=0.8, perc=1)
    fill_perc(buf_l, buf_r, v + 48, 4, 2)  # lift last 4 bars of verse

    lead_v = [
        (0.5, "Ab4", 0.5), (1.0, "Ab4", 0.5), (1.5, "C5", 0.75),
        (2.5, "C5", 0.5), (3.0, "Eb5", 1.5),
        (4.5, "Eb5", 0.5), (5.0, "F5", 0.5), (5.5, "Eb5", 0.75),
        (6.5, "C5", 0.5), (7.0, "Ab4", 1.5),
        (8.5, "C5", 0.5), (9.0, "Eb5", 0.5), (9.5, "F5", 0.75),
        (10.5, "Eb5", 0.5), (11.0, "Db5", 1.0),
        (12.0, "Bb4", 1.0), (13.0, "C5", 2.5),
        (16.5, "Ab4", 0.5), (17.0, "Ab4", 0.5), (17.5, "C5", 0.75),
        (18.5, "C5", 0.5), (19.0, "Eb5", 1.5),
        (20.5, "Eb5", 0.5), (21.0, "F5", 0.5), (21.5, "Eb5", 0.75),
        (22.5, "C5", 0.5), (23.0, "Ab4", 1.5),
        (24.5, "C5", 0.5), (25.0, "Eb5", 0.5), (25.5, "F5", 0.75),
        (26.5, "G5", 0.5), (27.0, "F5", 1.0),
        (28.0, "Eb5", 1.0), (29.0, "C5", 2.5),
    ]
    if include_lead:
        for off, nn, dur in lead_v:
            play_lead(buf_l, buf_r, v + off, nn, dur, 0.9)

    # Pre 8
    pre = v + 64
    bars(buf_l, buf_r, [
        "Bbm7", "Eb7", "Dbmaj7", "Eb7sus",
        "Bbm7", "Eb7", "Dbmaj7", "Eb7",
    ], pre, 4, amp=0.85, perc=2)
    pre_lead = [
        (0.5, "F5", 0.5), (1.0, "Eb5", 0.5), (1.5, "Db5", 0.75),
        (2.5, "C5", 0.5), (3.0, "Bb4", 1.5),
        (4.5, "G4", 0.5), (5.0, "Ab4", 0.5), (5.5, "Bb4", 0.75),
        (6.5, "C5", 0.5), (7.0, "Eb5", 2.0),
        (8.5, "C5", 0.5), (9.0, "Eb5", 0.5), (9.5, "F5", 0.75),
        (10.5, "Eb5", 0.5), (11.0, "Db5", 1.5),
        (12.0, "Bb4", 1.0), (13.0, "C5", 2.5),
    ]
    if include_lead:
        for off, nn, dur in pre_lead:
            play_lead(buf_l, buf_r, pre + off, nn, dur, 0.95)

    # Chorus 16
    cho = pre + 32
    bars(buf_l, buf_r, [
        "Abmaj7", "Dbmaj7", "Cm7", "Fm9",
        "Bbm7", "Eb7", "Abmaj7", "Dbmaj7",
        "Abmaj7", "Dbmaj7", "Cm7", "Fm9",
        "Bbm7", "Eb7sus", "Abmaj7", "Abmaj7",
    ], cho, 4, amp=0.9, perc=3)
    cho_lead = [
        (0.0, "C5", 1.0), (1.0, "Eb5", 1.0), (2.0, "F5", 0.75),
        (3.0, "G5", 0.5), (3.5, "F5", 2.0),
        (4.0, "F5", 1.0), (5.0, "Ab5", 1.5), (7.0, "G5", 0.5),
        (7.5, "F5", 0.5), (8.0, "Eb5", 1.5),
        (12.0, "Eb5", 1.0), (13.0, "C5", 1.0), (14.0, "Ab4", 0.75),
        (15.0, "C5", 1.5),
        (16.0, "Bb4", 1.0), (17.0, "C5", 2.5),
        (20.0, "Eb5", 1.0), (21.0, "G5", 1.0), (22.0, "Ab5", 0.75),
        (23.0, "Bb5", 0.5), (23.5, "Ab5", 2.0),
        (24.0, "F5", 1.0), (25.0, "Ab5", 1.5), (27.0, "G5", 0.5),
        (27.5, "Eb5", 0.5), (28.0, "F5", 1.5),
        (32.0, "Db5", 1.0), (33.0, "Eb5", 1.0), (34.0, "F5", 0.75),
        (35.0, "Eb5", 0.5), (35.5, "C5", 2.0),
        (40.0, "Bb4", 1.0), (41.0, "C5", 3.0),
        (48.0, "Ab4", 4.0),
    ]
    if include_lead:
        for off, nn, dur in cho_lead:
            play_lead(buf_l, buf_r, cho + off, nn, dur, 1.0)

    # Bridge 8
    bri = cho + 64
    bars(buf_l, buf_r, [
        "Abmaj7", "Abm6", "Fm9", "Bbm7",
        "Eb7", "Dbmaj7", "Eb7sus", "Eb7",
    ], bri, 4, amp=0.75, perc=1)
    bri_lead = [
        (0.5, "C5", 0.5), (1.0, "C5", 0.5), (1.5, "Db5", 1.0),
        (2.5, "C5", 0.5), (3.0, "B4", 1.5),
        (4.5, "Ab4", 0.5), (5.0, "C5", 0.5), (5.5, "Eb5", 1.5),
        (6.5, "F5", 0.5), (7.0, "Eb5", 1.5),
        (8.5, "Db5", 0.5), (9.0, "C5", 0.5), (9.5, "Bb4", 1.5),
        (12.0, "Ab4", 1.0), (13.0, "C5", 2.5),
        (16.0, "Eb5", 1.0), (17.0, "Db5", 1.0), (18.0, "C5", 2.0),
        (24.0, "Bb4", 2.0), (26.0, "C5", 2.5),
    ]
    if include_lead:
        for off, nn, dur in bri_lead:
            play_lead(buf_l, buf_r, bri + off, nn, dur, 0.92)

    # Final chorus 16
    cho2 = bri + 32
    bars(buf_l, buf_r, [
        "Abmaj7", "Dbmaj7", "Cm7", "Fm9",
        "Bbm7", "Eb7", "Abmaj7", "Dbmaj7",
        "Abmaj7", "Dbmaj7", "Cm7", "Fm9",
        "Bbm7", "Eb7sus", "Abmaj7", "Abmaj7",
    ], cho2, 4, amp=0.9, perc=3)
    if include_lead:
        for off, nn, dur in cho_lead:
            play_lead(buf_l, buf_r, cho2 + off, nn, dur, 1.0)
        play_lead(buf_l, buf_r, cho2 + 56, "Eb5", 1.0, 0.85)
        play_lead(buf_l, buf_r, cho2 + 57, "C5", 1.0, 0.8)
        play_lead(buf_l, buf_r, cho2 + 58, "Ab4", 3.0, 0.75)

    # Outro 8 beats + pad
    outro = cho2 + 64
    play_chord(buf_l, buf_r, outro, "Abmaj7", 8, amp=0.55)
    # soft final guitar
    for i, nn in enumerate(["Ab3", "C4", "Eb4", "Ab4"]):
        s = note_samples(n2f(nn), 3.5 * BEAT, 0.2, "guitar")
        mix_at(buf_l, buf_r, int((outro + i * 0.35) * BEAT * SR), s, 0.4, 0.6)

    write_wav(out_path, buf_l, buf_r, fade_out_sec=2.5)


if __name__ == "__main__":
    outdir = r"D:\Soft\main\ruanjian\AI\MIMO-desktop\tempproject\caogaoxiang"
    build(False, os.path.join(outdir, "草稿箱_跟唱伴奏.wav"))
    build(True, os.path.join(outdir, "草稿箱_导唱版.wav"))

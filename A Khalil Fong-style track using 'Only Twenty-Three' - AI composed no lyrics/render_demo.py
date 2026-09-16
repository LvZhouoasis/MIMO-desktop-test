# -*- coding: utf-8 -*-
"""Synthesize 草稿箱 demo: Rhodes-ish chords + lead melody. Pure stdlib."""
import math
import struct
import wave

SR = 44100
BPM = 72.0
BEAT = 60.0 / BPM  # 0.833s

# Note name -> frequency (A4=440). Octave 4 = middle.
NAMES = {
    "C": 261.63, "C#": 277.18, "Db": 277.18, "D": 293.66, "D#": 311.13,
    "Eb": 311.13, "E": 329.63, "F": 349.23, "F#": 369.99, "Gb": 369.99,
    "G": 392.00, "G#": 415.30, "Ab": 415.30, "A": 440.00, "A#": 466.16,
    "Bb": 466.16, "B": 493.88,
}


def n2f(note: str) -> float:
    """'Ab4' -> freq."""
    if note.endswith(("0", "1", "2", "3", "4", "5", "6", "7", "8", "9")):
        name, octv = note[:-1], int(note[-1])
    else:
        name, octv = note, 4
    base = NAMES[name]
    return base * (2 ** (octv - 4))


def env_adsr(t, dur, a=0.012, d=0.15, s=0.65, r=0.12):
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
    """Simple EP-ish tone: sine fundamental + soft harmonics + slight detune."""
    e = 1.0
    tone = (
        1.00 * math.sin(2 * math.pi * freq * t)
        + 0.35 * math.sin(2 * math.pi * freq * 2.0 * t + 0.4)
        + 0.12 * math.sin(2 * math.pi * freq * 3.0 * t + 0.9)
        + 0.06 * math.sin(2 * math.pi * freq * 4.02 * t)
    )
    # slight tremolo (EP vibe)
    tone *= 1.0 + 0.04 * math.sin(2 * math.pi * 4.5 * t)
    return vel * e * tone * 0.18


def bass_tone(freq, t, vel=1.0):
    tone = (
        math.sin(2 * math.pi * freq * t)
        + 0.25 * math.sin(2 * math.pi * freq * 2 * t)
        + 0.08 * math.sin(2 * math.pi * freq * 3 * t)
    )
    return vel * tone * 0.22


def mix_at(buf, start_sample, samples, gain=1.0):
    end = start_sample + len(samples)
    if end > len(buf):
        buf.extend([0.0] * (end - len(buf)))
    for i, s in enumerate(samples):
        buf[start_sample + i] += s * gain


def render_note(freq, dur, amp, kind="lead"):
    length = int(SR * dur)
    out = []
    for i in range(length):
        t = i / SR
        e = env_adsr(t, dur, a=0.02 if kind == "lead" else 0.03,
                     d=0.25 if kind == "lead" else 0.35,
                     s=0.55 if kind == "lead" else 0.45,
                     r=0.08 if kind == "lead" else 0.15)
        if kind == "lead":
            v = rhodes(freq, t, amp) * e
        elif kind == "bass":
            v = bass_tone(freq, t, amp) * e
        else:  # pad/chord
            v = rhodes(freq, t, amp * 0.7) * e
        out.append(v)
    return out


def play_chord(buf, at_beat, notes, dur_beats, amp=0.9, kind="pad"):
    start = int(at_beat * BEAT * SR)
    for nn in notes:
        f = n2f(nn)
        samples = render_note(f, dur_beats * BEAT * 0.98, amp / max(1, len(notes) ** 0.5), kind)
        mix_at(buf, start, samples, 0.85)


def play_note(buf, at_beat, note, dur_beats, amp=1.0, kind="lead"):
    start = int(at_beat * BEAT * SR)
    f = n2f(note)
    samples = render_note(f, dur_beats * BEAT * 0.95, amp, kind)
    mix_at(buf, start, samples, 1.0)


# --- Song map (beats from 0) ---
# Structure: Intro 4 | Verse 16 | Pre 8 | Chorus 16 | Bridge 8 | Chorus 16 | Outro 4
# Total ~72 beats ≈ 60s

def build():
    buf = []
    # helper: chord voicings in Ab
    chords = {
        "Abmaj9": ["Ab3", "C4", "Eb4", "G4", "Bb4"],
        "Fm9":   ["F3", "Ab3", "C4", "Eb4", "G4"],
        "Dbmaj7": ["Db3", "F3", "Ab3", "C4"],
        "Bbm7":  ["Bb2", "Db3", "F3", "Ab3"],
        "Eb7":   ["Eb3", "G3", "Bb3", "Db4"],
        "Abmaj7": ["Ab3", "C4", "Eb4", "G4"],
        "Cm7":   ["C3", "Eb3", "G3", "Bb3"],
        "Eb7sus": ["Eb3", "Ab3", "Bb3", "Db4"],
        "Abm6":  ["Ab3", "B3", "Eb4", "F4"],  # B natural ~ Cb, harmonic color
    }

    def bars(chord_list, start_beat, bar_beats=4, amp=0.85):
        t = start_beat
        for name in chord_list:
            play_chord(buf, t, chords[name], bar_beats, amp=amp)
            # bass root
            roots = {
                "Abmaj9": "Ab2", "Fm9": "F2", "Dbmaj7": "Db2", "Bbm7": "Bb2",
                "Eb7": "Eb2", "Abmaj7": "Ab2", "Cm7": "C2", "Eb7sus": "Eb2",
                "Abm6": "Ab2",
            }
            play_note(buf, t, roots[name], bar_beats * 0.55, amp=0.7, kind="bass")
            t += bar_beats

    # ===== INTRO (4 bars) =====
    bars(["Abmaj9", "Fm9", "Dbmaj7", "Eb7sus"], 0, 4, amp=0.7)

    # ===== VERSE (16 bars / 4 phrases of 4) =====
    # Melody: weak-entry syncopation, Ab key written pitch = sounding
    # phrase A: 收件箱很安静 | 草稿却存了七年
    v_start = 16
    bars(["Abmaj9", "Fm9", "Dbmaj7", "Bbm7", "Eb7",
          "Abmaj9", "Fm9", "Dbmaj7", "Bbm7", "Eb7",
          "Abmaj9", "Fm9", "Dbmaj7", "Bbm7", "Eb7", "Abmaj7"],
         v_start, 4, amp=0.8)

    # Lead phrases (beat offsets relative to v_start)
    # 第一句
    lead = [
        (0.5, "Ab4", 0.5), (1.0, "Ab4", 0.5), (1.5, "C5", 0.75),
        (2.5, "C5", 0.5), (3.0, "Eb5", 1.5),
        # 2nd bar rest mostly
        (4.5, "Eb5", 0.5), (5.0, "F5", 0.5), (5.5, "Eb5", 0.75),
        (6.5, "C5", 0.5), (7.0, "Ab4", 1.5),
        # 第一封写着我没事
        (8.5, "C5", 0.5), (9.0, "Eb5", 0.5), (9.5, "F5", 0.75),
        (10.5, "Eb5", 0.5), (11.0, "Db5", 1.0),
        # 落款是昨天
        (12.0, "Bb4", 1.0), (13.0, "C5", 2.5),
        # repeat variation
        (16.5, "Ab4", 0.5), (17.0, "Ab4", 0.5), (17.5, "C5", 0.75),
        (18.5, "C5", 0.5), (19.0, "Eb5", 1.5),
        (20.5, "Eb5", 0.5), (21.0, "F5", 0.5), (21.5, "Eb5", 0.75),
        (22.5, "C5", 0.5), (23.0, "Ab4", 1.5),
        (24.5, "C5", 0.5), (25.0, "Eb5", 0.5), (25.5, "F5", 0.75),
        (26.5, "G5", 0.5), (27.0, "F5", 1.0),
        (28.0, "Eb5", 1.0), (29.0, "C5", 2.5),
    ]
    for off, nn, dur in lead:
        play_note(buf, v_start + off, nn, dur, amp=0.95)

    # ===== PRE-CHORUS (8 bars) =====
    pre = v_start + 64  # 16 bars * 4
    bars(["Bbm7", "Eb7", "Dbmaj7", "Eb7sus",
          "Bbm7", "Eb7", "Dbmaj7", "Eb7"], pre, 4, amp=0.85)
    pre_lead = [
        (0.5, "F5", 0.5), (1.0, "Eb5", 0.5), (1.5, "Db5", 0.75),
        (2.5, "C5", 0.5), (3.0, "Bb4", 1.5),
        (4.5, "G4", 0.5), (5.0, "Ab4", 0.5), (5.5, "Bb4", 0.75),
        (6.5, "C5", 0.5), (7.0, "Eb5", 2.0),
        (8.5, "C5", 0.5), (9.0, "Eb5", 0.5), (9.5, "F5", 0.75),
        (10.5, "Eb5", 0.5), (11.0, "Db5", 1.5),
        (12.0, "Bb4", 1.0), (13.0, "C5", 2.5),
    ]
    for off, nn, dur in pre_lead:
        play_note(buf, pre + off, nn, dur, amp=1.0)

    # ===== CHORUS (16 bars) =====
    cho = pre + 32
    bars(["Abmaj7", "Dbmaj7", "Cm7", "Fm9",
          "Bbm7", "Eb7", "Abmaj7", "Dbmaj7",
          "Abmaj7", "Dbmaj7", "Cm7", "Fm9",
          "Bbm7", "Eb7sus", "Abmaj7", "Abmaj7"],
         cho, 4, amp=0.9)
    cho_lead = [
        # 别急着清空草稿箱  c-e-f-g-f
        (0.0, "C5", 1.0), (1.0, "Eb5", 1.0), (2.0, "F5", 0.75),
        (3.0, "G5", 0.5), (3.5, "F5", 2.0),
        # 那里住着没长大的晚上  f-a-a-g-f-e
        (4.0, "F5", 1.0), (5.0, "Ab5", 1.5), (7.0, "G5", 0.5),
        (7.5, "F5", 0.5), (8.0, "Eb5", 1.5),
        # 一笔一画都是方向
        (12.0, "Eb5", 1.0), (13.0, "C5", 1.0), (14.0, "Ab4", 0.75),
        (15.0, "C5", 1.5),
        # 写歪了也算一趟
        (16.0, "Bb4", 1.0), (17.0, "C5", 2.5),
        # 第二遍 higher
        (20.0, "Eb5", 1.0), (21.0, "G5", 1.0), (22.0, "Ab5", 0.75),
        (23.0, "Bb5", 0.5), (23.5, "Ab5", 2.0),
        (24.0, "F5", 1.0), (25.0, "Ab5", 1.5), (27.0, "G5", 0.5),
        (27.5, "Eb5", 0.5), (28.0, "F5", 1.5),
        # 还愿意陪我站到天亮
        (32.0, "Db5", 1.0), (33.0, "Eb5", 1.0), (34.0, "F5", 0.75),
        (35.0, "Eb5", 0.5), (35.5, "C5", 2.0),
        (40.0, "Bb4", 1.0), (41.0, "C5", 3.0),
        (48.0, "Ab4", 4.0),
    ]
    for off, nn, dur in cho_lead:
        play_note(buf, cho + off, nn, dur, amp=1.05)

    # ===== BRIDGE (8 bars) =====
    bri = cho + 64
    bars(["Abmaj7", "Abm6", "Fm9", "Bbm7",
          "Eb7", "Dbmaj7", "Eb7sus", "Eb7"], bri, 4, amp=0.75)
    bri_lead = [
        (0.5, "C5", 0.5), (1.0, "C5", 0.5), (1.5, "Db5", 1.0),
        (2.5, "C5", 0.5), (3.0, "B4", 1.5),  # B natural from Abm6 color
        (4.5, "Ab4", 0.5), (5.0, "C5", 0.5), (5.5, "Eb5", 1.5),
        (6.5, "F5", 0.5), (7.0, "Eb5", 1.5),
        (8.5, "Db5", 0.5), (9.0, "C5", 0.5), (9.5, "Bb4", 1.5),
        (12.0, "Ab4", 1.0), (13.0, "C5", 2.5),
        (16.0, "Eb5", 1.0), (17.0, "Db5", 1.0), (18.0, "C5", 2.0),
        (24.0, "Bb4", 2.0), (26.0, "C5", 2.5),
    ]
    for off, nn, dur in bri_lead:
        play_note(buf, bri + off, nn, dur, amp=0.95)

    # ===== FINAL CHORUS (16 bars) =====
    cho2 = bri + 32
    bars(["Abmaj7", "Dbmaj7", "Cm7", "Fm9",
          "Bbm7", "Eb7", "Abmaj7", "Dbmaj7",
          "Abmaj7", "Dbmaj7", "Cm7", "Fm9",
          "Bbm7", "Eb7sus", "Abmaj7", "Abmaj7"],
         cho2, 4, amp=0.9)
    # reuse chorus melody with slight extension
    for off, nn, dur in cho_lead:
        play_note(buf, cho2 + off, nn, dur, amp=1.05)
    # outro tag: 犹豫过
    play_note(buf, cho2 + 56, "Eb5", 1.0, amp=0.9)
    play_note(buf, cho2 + 57, "C5", 1.0, amp=0.85)
    play_note(buf, cho2 + 58, "Ab4", 3.0, amp=0.8)

    # ===== OUTRO fade chord =====
    outro = cho2 + 64
    play_chord(buf, outro, ["Ab3", "C4", "Eb4", "G4", "C5"], 8, amp=0.55)

    # normalize + soft clip
    peak = max(1e-9, max(abs(x) for x in buf))
    gain = 0.72 / peak
    frames = bytearray()
    for x in buf:
        v = max(-1.0, min(1.0, x * gain))
        frames += struct.pack("<h", int(v * 32767))

    out = r"D:\Soft\main\ruanjian\AI\MIMO-desktop\tempproject\caogaoxiang\草稿箱_demo.wav"
    with wave.open(out, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(frames)
    print(f"wrote {out}  samples={len(buf)}  dur={len(buf)/SR:.1f}s")


if __name__ == "__main__":
    build()

# -*- coding: utf-8 -*-
"""Write melody MIDI for ACE Studio import. Tempo 72, Ab major."""
import struct
import os

# MIDI helpers
def vlq(n):
    n = int(n)
    if n < 0:
        n = 0
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.append((n & 0x7F) | 0x80)
        n >>= 7
    return bytes(reversed(out))


def track_chunk(events):
    """events: list of (delta_ticks, bytes)"""
    data = b""
    for delta, msg in events:
        data += vlq(delta) + msg
    data += vlq(0) + b"\xff\x2f\x00"  # end of track
    return b"MTrk" + struct.pack(">I", len(data)) + data


def note_on(ch, note, vel=90):
    return bytes([0x90 | (ch & 0x0F), note & 0x7F, vel & 0x7F])


def note_off(ch, note):
    return bytes([0x80 | (ch & 0x0F), note & 0x7F, 0x40])


def meta_tempo(bpm):
    us = int(60_000_000 / bpm)
    return b"\xff\x51\x03" + us.to_bytes(3, "big")


def meta_name(name):
    raw = name.encode("utf-8")
    return b"\xff\x03" + vlq(len(raw)) + raw


def meta_marker(text):
    raw = text.encode("utf-8")
    return b"\xff\x06" + vlq(len(raw)) + raw


# Name to MIDI note (Ab major pieces)
NOTE_BASE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
# flats used: Ab Bb Db Eb → map by exact name
NOTE_NUM = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4,
    "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9,
    "A#": 10, "Bb": 10, "B": 11,
}


def n2m(note):
    name, octv = note[:-1], int(note[-1])
    return NOTE_NUM[name] + (octv + 1) * 12  # MIDI: C4=60 → our C4 should be 60


# ticks
PPQ = 480
BPM = 72
BEAT = PPQ  # one quarter


def beats_to_ticks(b):
    return int(round(b * PPQ))


# --- Song map: section markers at bar starts (in beats from 0) ---
# Intro 0, Verse 16, Pre 80, Chorus 112, V3 176, Pre 208, Chorus2 240,
# Bridge 304, Chorus3 336, Outro 400  (from earlier structure)
# Recalculate from build():
# intro 16 beats (4 bars), verse 64, pre 32, cho 64, bridge 32, cho2 64, outro ~8+
# 0 intro, 16 verse, 80 pre, 112 chorus, 176 bridge, 208 chorus2, 272 outro
# Wait rebuild from render_karaoke:
# intro 8? bars 2+2=4 bars = 16 beats. t=16
# verse 16 bars = 64, t=80
# pre 8 = 32, t=112
# cho 16 = 64, t=176
# bri 8 = 32, t=208
# cho2 16 = 64, t=272
# outro starts 272, pad 8 beats

STRUCTURE = [
    (0, "Intro"),
    (16, "主歌1 收件箱很安静"),
    (48, "主歌2 光标闪得很慢"),
    (80, "预副歌 原来长大"),
    (112, "副歌 别急着清空草稿箱"),
    (176, "桥段 如果人生有存档"),
    (208, "副歌2 就让草稿箱一直满着"),
    (272, "尾声"),
]

# Melody phrases: (start_beat, [(note, dur_beats), ...], lyric syllables)
# One syllable per note. Chinese: one char = one note typically.

# Verse phrase A: 收件箱很安静 (6 chars) — weak entry
# from lead: 0.5 A, 1.0 A, 1.5 c, 2.5 c, 3.0 e
# 收 件 箱 很 安 静 — need 6 notes, we have 5. Adjust:
# 收件箱很安静 → 收,件,箱,很,安,静

def pack_phrase(start, items):
    """items: list of (note_name, dur, lyric or None)"""
    return start, items

# Build full melody with lyrics aligned
# Format: (start_beat_abs, note, dur, syllable)

def expand(start, pairs):
    """pairs: [(note, dur, syl), ...]"""
    out = []
    t = start
    for note, dur, syl in pairs:
        out.append((t, note, dur, syl))
        t += dur
    return out


MELODY = []

# ===== Verse 1 (start 16) =====
# bar structure from karaoke lead relative to v_start=16
v = 16
# 0.5 A, 1.0 A, 1.5 c(0.75), 2.5 c, 3.0 e(1.5)  — 收件箱很安静 6 syllables
# Use: 收(0.5,A) 件(0.5,A) 箱(0.75,c) 很(0.5,c) 安静 wait 5 notes for 6 chars
# Split 安 静: e half + hold, or 安 e, 静 rest then... better:
# 收 A 0.5 | 件 A 0.5 | 箱 c 0.75 | 很 c 0.5 | 安 e 0.75 | 静 e 0.75
MELODY += expand(v + 0.5, [
    ("Ab4", 0.5, "收"), ("Ab4", 0.5, "件"), ("C5", 0.75, "箱"),
    ("C5", 0.5, "很"), ("Eb5", 0.75, "安"), ("Eb5", 0.75, "静"),
])
# rest then 草稿却存了七年 (7 chars)
# 4.5 e, 5.0 f, 5.5 e, 6.5 c, 7.0 A
MELODY += expand(v + 4.5, [
    ("Eb5", 0.5, "草"), ("F5", 0.5, "稿"), ("Eb5", 0.75, "却"),
    ("C5", 0.5, "存"), ("Ab4", 0.5, "了"), ("Ab4", 0.5, "七"), ("Ab4", 1.0, "年"),
])
# 第一封写着我没事 (8)
# 8.5 c, 9.0 e, 9.5 f, 10.5 e, 11.0 d
MELODY += expand(v + 8.5, [
    ("C5", 0.5, "第"), ("C5", 0.5, "一"), ("Eb5", 0.5, "封"),
    ("F5", 0.75, "写"), ("Eb5", 0.5, "着"), ("Db5", 0.5, "我"),
    ("Db5", 0.5, "没"), ("Db5", 0.5, "事"),
])
# 落款是昨天 (5)
MELODY += expand(v + 12.0, [
    ("Bb4", 0.75, "落"), ("Bb4", 0.75, "款"), ("C5", 0.5, "是"),
    ("C5", 0.75, "昨"), ("C5", 1.5, "天"),
])

# Verse second half (光标...) start v+16 = 32
MELODY += expand(v + 16.5, [
    ("Ab4", 0.5, "光"), ("Ab4", 0.5, "标"), ("C5", 0.75, "闪"),
    ("C5", 0.5, "得"), ("Eb5", 0.75, "很"), ("Eb5", 0.75, "慢"),
])
MELODY += expand(v + 20.5, [
    ("Eb5", 0.5, "像"), ("F5", 0.5, "谁"), ("Eb5", 0.75, "在"),
    ("C5", 0.5, "门"), ("Ab4", 0.5, "外"), ("Ab4", 0.5, "犹"), ("Ab4", 1.0, "豫"),
])
MELODY += expand(v + 24.5, [
    ("C5", 0.5, "我"), ("C5", 0.5, "把"), ("Eb5", 0.5, "喜"),
    ("F5", 0.75, "欢"), ("G5", 0.5, "折"), ("F5", 0.5, "成"), ("F5", 0.5, "附"), ("F5", 0.5, "件"),
])
MELODY += expand(v + 28.0, [
    ("Eb5", 0.75, "又"), ("Eb5", 0.75, "改"), ("C5", 0.5, "成"),
    ("C5", 0.75, "最"), ("C5", 0.75, "近"), ("C5", 0.5, "好"), ("C5", 1.0, "吗"),
])

# ===== Pre (80) =====
# 原来长大不是学会发送 (10)
MELODY += expand(80 + 0.5, [
    ("F5", 0.5, "原"), ("Eb5", 0.5, "来"), ("Db5", 0.75, "长"),
    ("C5", 0.5, "大"), ("Bb4", 0.5, "不"), ("Bb4", 0.5, "是"),
    ("Ab4", 0.5, "学"), ("Ab4", 0.5, "会"), ("Ab4", 0.75, "发"), ("Ab4", 0.75, "送"),
])
# 是懂得有些字只适合留在半路 (14) — long, use two waves
MELODY += expand(80 + 4.5, [
    ("G4", 0.5, "是"), ("Ab4", 0.5, "懂"), ("Bb4", 0.75, "得"),
    ("C5", 0.5, "有"), ("Eb5", 0.5, "些"), ("Eb5", 0.5, "字"),
    ("Eb5", 0.5, "只"), ("Eb5", 0.5, "适"), ("Eb5", 0.75, "合"),
    ("Eb5", 0.75, "留"), ("Eb5", 0.5, "在"), ("Eb5", 1.0, "半"), ("Eb5", 1.0, "路"),
])

# ===== Chorus (112) =====
# 别急着清空草稿箱 (8)  c e f g f pattern
MELODY += expand(112 + 0.0, [
    ("C5", 0.75, "别"), ("C5", 0.25, "急"), ("Eb5", 0.75, "着"),
    ("Eb5", 0.25, "清"), ("F5", 0.75, "空"), ("F5", 0.25, "草"),
    ("G5", 0.5, "稿"), ("F5", 1.5, "箱"),
])
# 那里住着没长大的晚上 (10)
MELODY += expand(112 + 4.0, [
    ("F5", 0.75, "那"), ("F5", 0.25, "里"), ("Ab5", 0.75, "住"),
    ("Ab5", 0.75, "着"), ("G5", 0.5, "没"), ("F5", 0.5, "长"),
    ("Eb5", 0.5, "大"), ("Eb5", 0.5, "的"), ("Eb5", 0.75, "晚"), ("Eb5", 0.75, "上"),
])
# 一笔一画都是方向 (8)
MELODY += expand(112 + 12.0, [
    ("Eb5", 0.75, "一"), ("Eb5", 0.25, "笔"), ("C5", 0.75, "一"),
    ("C5", 0.25, "画"), ("Ab4", 0.75, "都"), ("Ab4", 0.25, "是"),
    ("C5", 0.75, "方"), ("C5", 1.25, "向"),
])
# 写歪了也算一趟 (7)
MELODY += expand(112 + 16.0, [
    ("Bb4", 0.75, "写"), ("Bb4", 0.25, "歪"), ("C5", 0.75, "了"),
    ("C5", 0.25, "也"), ("C5", 0.75, "算"), ("C5", 0.75, "一"), ("C5", 1.5, "趟"),
])
# 别急着清空草稿箱 (8) higher
MELODY += expand(112 + 20.0, [
    ("Eb5", 0.75, "别"), ("Eb5", 0.25, "急"), ("G5", 0.75, "着"),
    ("G5", 0.25, "清"), ("Ab5", 0.75, "空"), ("Ab5", 0.25, "草"),
    ("Bb5", 0.5, "稿"), ("Ab5", 1.5, "箱"),
])
# 有些人只在未完成里 (9)
MELODY += expand(112 + 24.0, [
    ("F5", 0.75, "有"), ("F5", 0.25, "些"), ("Ab5", 0.75, "人"),
    ("Ab5", 0.75, "只"), ("G5", 0.5, "在"), ("Eb5", 0.5, "未"),
    ("F5", 0.5, "完"), ("F5", 0.5, "成"), ("F5", 1.0, "里"),
])
# 还愿意陪我站到天亮 (9)
MELODY += expand(112 + 32.0, [
    ("Db5", 0.75, "还"), ("Db5", 0.25, "愿"), ("Eb5", 0.75, "意"),
    ("Eb5", 0.25, "陪"), ("F5", 0.75, "我"), ("F5", 0.25, "站"),
    ("Eb5", 0.75, "到"), ("Eb5", 0.75, "天"), ("C5", 2.0, "亮"),
])

# ===== Bridge (176) =====
# 如果人生有存档 (7)
MELODY += expand(176 + 0.5, [
    ("C5", 0.5, "如"), ("C5", 0.5, "果"), ("Db5", 0.75, "人"),
    ("Db5", 0.75, "生"), ("C5", 0.5, "有"), ("B4", 0.75, "存"), ("B4", 1.5, "档"),
])
# 我想存那个雨天 (7)
MELODY += expand(176 + 4.5, [
    ("Ab4", 0.5, "我"), ("C5", 0.5, "想"), ("Eb5", 0.75, "存"),
    ("Eb5", 0.75, "那"), ("F5", 0.5, "个"), ("Eb5", 0.75, "雨"), ("Eb5", 1.0, "天"),
])
# 你把伞倾向我这边 (8)
MELODY += expand(176 + 8.5, [
    ("Db5", 0.5, "你"), ("Db5", 0.5, "把"), ("C5", 0.75, "伞"),
    ("C5", 0.75, "倾"), ("Bb4", 0.5, "向"), ("Ab4", 0.5, "我"),
    ("Ab4", 0.75, "这"), ("Ab4", 1.0, "边"),
])
# 自己的肩膀湿了一片 (9)
MELODY += expand(176 + 12.0, [
    ("Bb4", 0.75, "自"), ("Bb4", 0.25, "己"), ("C5", 0.75, "的"),
    ("C5", 0.75, "肩"), ("C5", 0.5, "膀"), ("C5", 0.5, "湿"),
    ("C5", 0.5, "了"), ("C5", 0.75, "一"), ("C5", 1.5, "片"),
])
# 如果原谅有附件 (7)
MELODY += expand(176 + 16.0, [
    ("Eb5", 0.75, "如"), ("Eb5", 0.25, "果"), ("Db5", 0.75, "原"),
    ("Db5", 0.75, "谅"), ("C5", 0.75, "有"), ("C5", 1.0, "附"), ("C5", 1.0, "件"),
])
# 请替我签上 那个还没学会告别的少年
MELODY += expand(176 + 24.0, [
    ("Bb4", 0.75, "请"), ("Bb4", 0.75, "替"), ("C5", 1.5, "我"),
    ("C5", 1.0, "签"), ("C5", 1.0, "上"),
])
MELODY += expand(176 + 28.0, [
    ("Bb4", 0.5, "那"), ("C5", 0.5, "个"), ("Eb5", 0.75, "还"),
    ("Eb5", 0.5, "没"), ("Eb5", 0.5, "学"), ("Eb5", 0.5, "会"),
    ("Eb5", 0.75, "告"), ("Eb5", 0.75, "别"), ("Eb5", 0.5, "的"), ("C5", 1.5, "少"), ("C5", 1.0, "年"),
])

# ===== Chorus 2 (208) — same as chorus 1 but final line 犹豫过
MELODY += expand(208 + 0.0, [
    ("C5", 0.75, "就"), ("C5", 0.25, "让"), ("Eb5", 0.75, "草"),
    ("Eb5", 0.25, "稿"), ("F5", 0.75, "箱"), ("F5", 0.25, "一"),
    ("G5", 0.5, "直"), ("F5", 1.5, "满"), ("F5", 1.0, "着"),
])
MELODY += expand(208 + 4.0, [
    ("F5", 0.75, "像"), ("F5", 0.25, "心"), ("Ab5", 0.75, "口"),
    ("Ab5", 0.75, "一"), ("G5", 0.5, "小"), ("F5", 0.5, "块"),
    ("Eb5", 0.5, "没"), ("Eb5", 0.5, "关"), ("Eb5", 0.75, "灯"), ("Eb5", 0.75, "的"), ("Eb5", 1.0, "夜"),
])
MELODY += expand(208 + 12.0, [
    ("Eb5", 0.75, "等"), ("Eb5", 0.25, "哪"), ("C5", 0.75, "天"),
    ("C5", 0.75, "勇"), ("Ab4", 0.75, "气"), ("C5", 1.0, "路"), ("C5", 1.0, "过"),
])
MELODY += expand(208 + 16.0, [
    ("Bb4", 0.75, "随"), ("Bb4", 0.25, "便"), ("C5", 0.75, "点"),
    ("C5", 0.75, "开"), ("C5", 0.5, "哪"), ("C5", 0.75, "一"), ("C5", 1.0, "篇"),
])
MELODY += expand(208 + 20.0, [
    ("Eb5", 0.75, "都"), ("Eb5", 0.25, "能"), ("G5", 0.75, "读"),
    ("G5", 0.75, "见"), ("Ab5", 0.75, "我"), ("Ab5", 0.75, "们"),
    ("Bb5", 0.5, "曾"), ("Ab5", 1.5, "经"),
])
MELODY += expand(208 + 24.0, [
    ("F5", 0.75, "那"), ("F5", 0.25, "么"), ("Ab5", 0.75, "近"),
    ("Ab5", 0.75, "地"), ("G5", 0.75, "犹"), ("Eb5", 1.5, "豫"), ("Eb5", 2.0, "过"),
])
# soft tag 犹豫过 at end of chorus2 from karaoke cho2+56
MELODY += expand(208 + 56.0, [
    ("Eb5", 0.75, "犹"), ("C5", 0.75, "豫"), ("Ab4", 3.0, "过"),
])


def write_midi(path):
    # Track 0: tempo + markers
    ev0 = []
    last = 0
    ev0.append((0, meta_name("草稿箱 Melody for ACE Studio")))
    ev0.append((0, meta_tempo(BPM)))
    ev0.append((0, bytes([0x59, 0x02, 0x03, 0x00])))  # Ab major, major key? Ab=4 flats = F? MIDI: sf=-4 Ab major, mi=0
    # Key signature: Ab major is 4 flats, sf = -4 (0xFC), mi = 0
    ev0[-1] = (0, bytes([0x59, 0x02, 0xFC, 0x00]))
    last_ticks = 0
    for beat, text in STRUCTURE:
        dt = beats_to_ticks(beat) - last_ticks
        if dt < 0:
            dt = 0
        ev0.append((dt, meta_marker(text)))
        last_ticks = beats_to_ticks(beat)
    tr0 = track_chunk(ev0)

    # Track 1: melody ch0
    events = []
    # sort by start
    notes = sorted(MELODY, key=lambda x: x[0])
    # convert to on/off timeline
    raw = []
    for start, name, dur, syl in notes:
        m = n2m(name)
        t_on = beats_to_ticks(start)
        t_off = beats_to_ticks(start + dur * 0.92)
        if t_off <= t_on:
            t_off = t_on + 60
        raw.append((t_on, 1, m, syl))
        raw.append((t_off, 0, m, syl))
    raw.sort(key=lambda x: (x[0], x[1]))  # offs before ons at same tick? put offs first
    # actually at same tick prefer off then on: sort key (t, off=0 first)
    last = 0
    pending_lyrics = []  # collect for text file
    for t, kind, m, syl in raw:
        dt = t - last
        if dt < 0:
            dt = 0
        if kind == 1:
            events.append((dt, note_on(0, m, 88)))
            pending_lyrics.append((t, m, syl))
        else:
            events.append((dt, note_off(0, m)))
        last = t
    tr1 = track_chunk(events)

    header = b"MThd" + struct.pack(">IHHH", 6, 1, 2, PPQ)
    with open(path, "wb") as f:
        f.write(header + tr0 + tr1)

    # lyrics text aligned
    lyr_path = os.path.join(os.path.dirname(path), "草稿箱_歌词对位.txt")
    with open(lyr_path, "w", encoding="utf-8") as f:
        f.write("# 草稿箱 — 歌词与音符对位（按出现顺序，每字一音）\n")
        f.write("# BPM 72 | PPQ 480 | 调 Ab\n\n")
        f.write("完整连唱（可直接贴 ACE 歌词框）：\n")
        syls = [s for _, _, _, s in MELODY]
        # group by sections roughly
        full = "".join(syls)
        # better write with spaces for ACE (ACE often wants space or newline separated)
        f.write(" ".join(syls) + "\n\n")
        f.write("逐句：\n")
        i = 0
        line = []
        for _, _, _, s in MELODY:
            line.append(s)
            i += 1
            if i % 8 == 0:
                f.write("".join(line) + "\n")
                line = []
        if line:
            f.write("".join(line) + "\n")
    print(f"wrote {path}  notes={len(MELODY)}  lyr={lyr_path}")


if __name__ == "__main__":
    outdir = r"D:\Soft\main\ruanjian\AI\MIMO-desktop\tempproject\caogaoxiang"
    write_midi(os.path.join(outdir, "草稿箱_主旋律.mid"))

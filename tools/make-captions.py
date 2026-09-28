#!/usr/bin/env python3
"""Builds docs/submission/video-captions.srt from the voiceover table in
docs/submission/VIDEO_SCRIPT.md. Each block's time range is shared between its
sentences in proportion to their length; lines wrap at 42 characters."""
import re
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
script = (ROOT / 'docs/submission/VIDEO_SCRIPT.md').read_text()


def secs(t: str) -> float:
    m, s = t.split(':')
    return int(m) * 60 + float(s)


def stamp(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'


cues = []
for line in script.splitlines():
    # The last cell (on-screen text) may be empty.
    m = re.match(r'^\| (\d:\d\d)–(\d:\d\d) \| (.*?) \| (.*?) \|(.*?)\|$', line)
    if not m:
        continue
    start, end, vo = secs(m.group(1)), secs(m.group(2)), m.group(4).strip()
    # Sentences, then split long ones at commas so each cue stays short.
    parts = []
    for sentence in re.split(r'(?<=[.!?])\s+', vo):
        if len(sentence) > 84 and ', ' in sentence:
            chunks, cur = [], ''
            for piece in sentence.split(', '):
                cand = f'{cur}, {piece}' if cur else piece
                if len(cand) > 84 and cur:
                    chunks.append(cur + ',')
                    cur = piece
                else:
                    cur = cand
            chunks.append(cur)
            parts.extend(chunks)
        else:
            parts.append(sentence)
    span = (end - start) - 0.4
    total = sum(len(p) for p in parts)
    t = start + 0.2
    for p in parts:
        d = span * len(p) / total
        cues.append((t, t + d - 0.08, '\n'.join(textwrap.wrap(p, 42))))
        t += d

out = []
for i, (a, b, text) in enumerate(cues, 1):
    out.append(f'{i}\n{stamp(a)} --> {stamp(b)}\n{text}\n')
(ROOT / 'docs/submission/video-captions.srt').write_text('\n'.join(out))
print(f'{len(cues)} cues')

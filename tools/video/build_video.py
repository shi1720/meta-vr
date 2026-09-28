#!/usr/bin/env python3
"""Assemble the Signsprout demo video from captured clips.

    node tools/video/render-cards.mjs              # title cards and tags -> tools/video/cards/
    python3 tools/video/build_video.py tools/video/spec.json

Timeline: list of segments. Each segment takes a slice of a source clip (or a
still/card), optionally changes speed, adds overlay PNGs for part of its
duration, and fades in/out. Segments are rendered to intermediates and
concatenated; captions are burned in; a music bed and chimes are mixed.

Clips come from tools/record.mjs and tools/record-web.mjs (the shot list is in
docs/submission/VIDEO_SCRIPT.md). Environment:
  CAPTURES   folder with the captured clips (default out/captures)
  VIDEO_OUT  output folder (default out/video)
  FFMPEG     ffmpeg binary (default ffmpeg; needs libass for captions)
  FONTS_DIR  optional folder with Inter SemiBold for the captions
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FF = os.environ.get('FFMPEG', 'ffmpeg')
CAP = Path(os.environ.get('CAPTURES', ROOT / 'out/captures'))
CARDS = HERE / 'cards'
OUT = Path(os.environ.get('VIDEO_OUT', ROOT / 'out/video'))
OUT.mkdir(parents=True, exist_ok=True)
FPS = 30


def still(name):
    """Cards live next to this script; other stills sit with the captures."""
    return CARDS / name if (CARDS / name).exists() else CAP / name


def run(args):
    r = subprocess.run([FF, '-y', '-loglevel', 'error', *args])
    if r.returncode:
        sys.exit(f'ffmpeg failed: {" ".join(args)[:400]}')


def render_segment(i, seg):
    """seg: {src, start, dur, speed=1, overlays=[[png, t0, t1]], fade_in, fade_out, zoom}"""
    out = OUT / f'seg{i:02d}.mp4'
    # Reuse a segment rendered earlier from the same spec and source.
    key = OUT / f'seg{i:02d}.json'
    src_path = still(seg['src']) if seg['src'].endswith(('.png', '.jpg')) else CAP / seg['src']
    stamp_ = json.dumps({**seg, '_mtime': src_path.stat().st_mtime if src_path.exists() else 0}, sort_keys=True)
    if out.exists() and key.exists() and key.read_text() == stamp_:
        return out
    dur = seg['dur']
    speed = seg.get('speed', 1.0)
    src = seg['src']
    inputs = []
    if src.endswith('.png') or src.endswith('.jpg'):
        inputs += ['-loop', '1', '-t', f'{dur}', '-i', str(still(src))]
        base = '[0:v]scale=1920:1080,setsar=1,fps=30'
    else:
        path = str(CAP / src)
        src_len = dur * speed
        inputs += ['-ss', f"{seg['start']}", '-t', f'{src_len + 0.2}', '-i', path]
        base = f'[0:v]setpts=(PTS-STARTPTS)/{speed},' + ('minterpolate=fps=30:mi_mode=blend,' if seg.get('blend') else 'fps=30,') + 'scale=1920:1080,setsar=1'
    z = seg.get('zoom')
    if z:
        # slow push-in: from 1.0 to z over the segment
        frames = int(dur * FPS)
        base += f",zoompan=z='1+({z}-1)*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30"
    chain = [base + '[v0]']
    last = 'v0'
    for k, (png, t0, t1) in enumerate(seg.get('overlays', [])):
        inputs += ['-loop', '1', '-t', f'{dur}', '-i', str(CARDS / png)]
        idx = len([x for x in inputs if x == '-i']) - 1
        fade = f"[{idx}:v]format=rgba,fade=t=in:st={t0}:d=0.35:alpha=1,fade=t=out:st={max(t0, t1 - 0.35)}:d=0.35:alpha=1[o{k}]"
        chain.append(fade)
        chain.append(f"[{last}][o{k}]overlay=0:0:enable='between(t,{t0},{t1})'[v{k + 1}]")
        last = f'v{k + 1}'
    fi = seg.get('fade_in', 0)
    fo = seg.get('fade_out', 0)
    post = []
    if fi:
        post.append(f'fade=t=in:st=0:d={fi}')
    if fo:
        post.append(f'fade=t=out:st={dur - fo}:d={fo}')
    post.append(f'trim=duration={dur}')
    chain.append(f"[{last}]{','.join(post)},format=yuv420p[vout]")
    run([*inputs, '-filter_complex', ';'.join(chain), '-map', '[vout]', '-an', '-r', '30', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', str(out)])
    got = duration(out)
    if abs(got - dur) > 0.05:
        sys.exit(f'segment {i} ({src}) is {got:.2f} s, expected {dur} s: source too short?')
    key.write_text(stamp_)
    return out


def duration(path):
    r = subprocess.run([FF, '-i', str(path)], capture_output=True, text=True)
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r.stderr)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def music_bed(total, path):
    """Warm major-seventh pad, chords crossfading every 8 s."""
    chords = [[130.81, 164.81, 196.0, 246.94], [110.0, 130.81, 164.81, 196.0], [87.31, 110.0, 130.81, 164.81], [98.0, 123.47, 146.83, 196.0]]
    terms = []
    for k, ch in enumerate(chords):
        w = f"(0.5-0.5*cos(2*PI*min(mod(t-{8 * k}+32,32),16)/16))*lt(mod(t-{8 * k}+32,32),16)"
        notes = '+'.join(f'sin(2*PI*{f}*t)+0.35*sin(2*PI*{2 * f}*t)' for f in ch)
        terms.append(f'{w}*({notes})')
    expr = '0.042*(' + '+'.join(terms) + ')'
    run(['-f', 'lavfi', '-i', f"aevalsrc='{expr}|{expr}':s=48000:d={total}",
         '-af', f'lowpass=f=1800,aecho=0.8:0.7:120|240:0.25|0.18,afade=t=in:d=2,afade=t=out:st={total - 3}:d=3', str(path)])


def chime(path):
    notes = [523.25, 659.25, 783.99, 1046.5]
    parts = [f"0.12*sin(2*PI*{f}*t)*exp(-3.2*(t-{0.09 * i}))*gte(t,{0.09 * i})" for i, f in enumerate(notes)]
    run(['-f', 'lavfi', '-i', f"aevalsrc='{'+'.join(parts)}':s=48000:d=2.2", '-af', 'aecho=0.8:0.6:60:0.2', str(path)])


def build(spec_path, only_ready=False):
    spec = json.loads(Path(spec_path).read_text())
    if only_ready:
        for i, s in enumerate(spec['segments']):
            if s['src'] not in only_ready:
                render_segment(i, s)
                print(f'segment {i} ready', flush=True)
        return
    segs = [render_segment(i, s) for i, s in enumerate(spec['segments'])]
    lst = OUT / 'list.txt'
    lst.write_text(''.join(f"file '{s}'\n" for s in segs))
    silent = OUT / 'silent.mp4'
    run(['-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(silent)])
    total = sum(s['dur'] for s in spec['segments'])
    bed = OUT / 'bed.wav'
    music_bed(total, bed)
    ch = OUT / 'chime.wav'
    chime(ch)
    # mix chimes at the given times
    inputs = ['-i', str(bed)]
    filt = []
    for i, t in enumerate(spec.get('chimes', [])):
        inputs += ['-i', str(ch)]
        filt.append(f'[{i + 1}:a]adelay={int(t * 1000)}|{int(t * 1000)}[c{i}]')
    mix_in = '[0:a]' + ''.join(f'[c{i}]' for i in range(len(spec.get('chimes', []))))
    filt.append(f"{mix_in}amix=inputs={1 + len(spec.get('chimes', []))}:normalize=0,alimiter=limit=0.9[a]")
    fx = OUT / 'music_fx.wav'
    run([*inputs, '-filter_complex', ';'.join(filt), '-map', '[a]', str(fx)])
    srt = spec.get('captions')
    if srt:
        srt = str((ROOT / srt).resolve())
    style = "FontName=Inter SemiBold,FontSize=15,PrimaryColour=&H00FFFFFF,OutlineColour=&H80101A1F,BackColour=&H80101A1F,BorderStyle=4,Outline=0,Shadow=0,MarginV=34,Alignment=2"
    final = OUT / spec['out']
    fonts = f":fontsdir='{os.environ['FONTS_DIR']}'" if os.environ.get('FONTS_DIR') else ''
    vf = f"subtitles='{srt}'{fonts}:force_style='{style}'" if srt else 'null'
    run(['-i', str(silent), '-i', str(fx), '-vf', vf, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
         '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', str(final)])
    clean = final.with_name(final.stem + '-no-captions.mp4')
    run(['-i', str(silent), '-i', str(fx), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', str(clean)])
    print(f'wrote {final} ({total:.1f} s) and {clean}; music+fx at {fx}')


if __name__ == '__main__':
    # --skip SRC [SRC...]: pre-render every segment except those from SRC
    build(sys.argv[1], sys.argv[3:] if len(sys.argv) > 2 and sys.argv[2] == '--skip' else False)

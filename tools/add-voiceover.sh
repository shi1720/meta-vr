#!/usr/bin/env bash
# Mix a recorded voiceover into the demo video.
#
#   tools/add-voiceover.sh signsprout-demo.mp4 my-voice.m4a signsprout-final.mp4 [offset-seconds]
#
# The voice is cleaned up (low-cut, gentle compression, loudness to -16 LUFS)
# and the video's music bed ducks automatically whenever you speak. Record the
# script in docs/submission/VIDEO_SCRIPT.md in one take from 0:00 (a phone voice
# memo in a quiet room with soft furnishings is fine), or pass an offset if
# your recording starts late or early.
set -euo pipefail

video=${1:?video.mp4}
voice=${2:?voice audio file}
out=${3:?output.mp4}
offset=${4:-0}
FFMPEG=${FFMPEG:-ffmpeg}
delay_ms=$(awk "BEGIN { printf \"%d\", ${offset} * 1000 }")

"$FFMPEG" -hide_banner -loglevel warning -y -i "$video" -i "$voice" -filter_complex "
  [1:a]aresample=48000,highpass=f=80,afftdn=nf=-25,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,
       loudnorm=I=-16:TP=-1.5:LRA=11,adelay=${delay_ms}|${delay_ms},asplit=2[vo][key];
  [0:a][key]sidechaincompress=threshold=0.03:ratio=10:attack=30:release=500[bed];
  [bed][vo]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart "$out"
echo "Wrote $out"

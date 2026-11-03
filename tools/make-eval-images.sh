#!/usr/bin/env bash
# Build the vision eval image set (12 images): the 8 bundled hand-drawn-style SVGs rendered
# to PNG (rsvg-convert, 1.5x), plus 4 photo-like variants made with ImageMagick 7.
# Needs: rsvg-convert (librsvg2-bin), magick. Run: bash tools/make-eval-images.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/eval/images"
for f in "$ROOT"/public/samples/*.svg "$ROOT"/public/classics/*.svg; do
  rsvg-convert -z 1.5 -o "$ROOT/eval/images/$(basename "$f" .svg).png" "$f"
done
cd "$ROOT/eval/images"
# 1. phone held at an angle: 9° tilt on a desk-grey background + sensor noise
magick rc-lowpass.png -background '#b9b4a8' -rotate 9 -attenuate 0.6 +noise Gaussian -quality 85 rc-lowpass--tilt.jpg
# 2. pencil on plain paper: graphite grey, softer strokes, grain, no blue grid colour
magick rlc-ringing.png -colorspace Gray -level 0%,100%,0.8 -blur 0x0.8 -attenuate 0.9 +noise Gaussian -fill '#e9e6df' -colorize 8% -quality 85 rlc-ringing--pencil.jpg
# 3. photo of a notebook page: perspective keystone, uneven lamp lighting, defocus, low JPEG quality, 1000 px
magick opamp-inverting.png -virtual-pixel background -background '#6b6157' \
  -distort Perspective '0,0 60,40  1080,0 1010,0  0,660 0,660  1080,660 1080,610' \
  \( +clone -sparse-color Barycentric '0,0 #ffffff 1080,660 #8a8070' \) -compose Multiply -composite \
  -blur 0x1.4 -resize 1000x -quality 55 opamp-inverting--photo.jpg
# 4. photo of an old print: perspective, vignette shadow, blur, small (900 px) and heavy JPEG
magick wien-bridge.png -virtual-pixel background -background '#3d352c' \
  -distort Perspective '0,0 40,30  1230,0 1180,60  0,840 70,840  1230,840 1230,780' \
  \( +clone -fill white -colorize 100 -background black -vignette 0x120 \) -compose Multiply -composite \
  -blur 0x1.2 -resize 900x -quality 50 wien-bridge--photo.jpg
ls -la

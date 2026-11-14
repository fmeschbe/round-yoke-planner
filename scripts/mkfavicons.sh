#!/usr/bin/env bash
set -euo pipefail

# Simple script to generate favicon and PWA icons from a source image.
# The source image must be provided as the sole argument to this script
# defaulting to "src/assets/logo.png".
# If the source image is missing or not readable, an error is printed
# stderr and the script exits with code 1.
#
# Otherwise the assets as required by the public/assets/ryp.webmanifest
# and the index.html are created:
#
#  public/assets for webmanifest icons
#  src/assets for favicons referenced in index.html

SRC="${1:-src/assets/logo.png}"

if [[ ! -r "${SRC}" ]]; then
  echo "ERR: Source '${SRC}' does not exist of cannot be read" >&2
  exit 1
fi

# Assets copied to dist by the PWA plugin
# These assets are copied as is
PUBLIC_PWA="public/assets"

# Assets copied to dist as referenced by HTML files
# These assets get a unique ID attached for versioning
SRC_ICONS="src/assets"

function doMagick() {
  local src="${1}"
  local resize="${2}x${2}"
  local prefix="${3}"
  local extent="${4}x${4}"
  local target="${prefix}${resize}.png"
  local extra_args=()

  if [[ "${extent}" != "x" ]]; then
    target="${prefix}${extent}.png"
    extra_args=(
      -background "#ffffff"
      -gravity center
      -extent "${extent}"
    )
  fi

  echo "  > ${target} (${resize})"
  magick "${src}" \
    -depth 8 \
    -resize "${resize}" \
    "${extra_args[@]}" \
    "${target}"
}

echo "Resizing ${SRC}"

# PWA icons
for SIZE in 64 192 512; do
  doMagick "${SRC}" "${SIZE}" "${PUBLIC_PWA}/pwa-"
done

# Maskable PWA (one size only)
doMagick "${SRC}" 409 "${PUBLIC_PWA}/maskable-icon-" 512

# favicons
echo "  > ${SRC_ICONS}/favicon.ico (48, 32, 16)"
magick "${SRC}" -define icon:auto-resize=48,32,16 "${SRC_ICONS}/favicon.ico"

for SIZE in 48 32 16; do
  doMagick "${SRC}" "${SIZE}" "${SRC_ICONS}/favicon-"
done

# Apple touch icon
doMagick "${SRC}" 180 "${SRC_ICONS}/apple-touch-icon-"

#!/usr/bin/env bash
# Builds the zip file to upload to the Chrome Web Store. Only the files the extension needs at
# runtime are included, so docs, icon sources, and other repo files stay out of the package.
set -euo pipefail

project_directory="$(cd "$(dirname "$0")/.." && pwd)"
version="$(node -p "require('${project_directory}/manifest.json').version")"
output_directory="${project_directory}/dist"
output_file="${output_directory}/arc-command-bar-${version}.zip"

mkdir -p "${output_directory}"
rm -f "${output_file}"

cd "${project_directory}"
zip -X -q "${output_file}" \
  manifest.json \
  background.js \
  content-script.js \
  command-bar.html \
  command-bar.js \
  command-bar.css \
  icons/icon-16.png \
  icons/icon-32.png \
  icons/icon-48.png \
  icons/icon-128.png

echo "Created ${output_file}"
unzip -l "${output_file}"

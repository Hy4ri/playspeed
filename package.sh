#!/usr/bin/env bash
set -euo pipefail

# PlaySpeed — Chrome Web Store packaging script
# Usage: bash package.sh
# Creates playspeed-v{version}.zip in the project root.

NAME="playspeed"
VERSION="1.4.3"
OUTPUT="${NAME}-v${VERSION}.zip"

cd "$(dirname "$0")"

echo "Creating ${OUTPUT}..."

# Remove old package if it exists
rm -f "${OUTPUT}"

# Use Python's zipfile module to create a clean package
python3 -c "
import zipfile, os

files = [
    'manifest.json',
    'background.js',
    'content.js',
    'popup.html',
    'popup.js',
    'popup.css',
    'options.html',
    'options.js',
    'options.css',
    'icons/icon16.png',
    'icons/icon32.png',
    'icons/icon48.png',
    'icons/icon128.png',
]

with zipfile.ZipFile('${OUTPUT}', 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in files:
        if os.path.isfile(f):
            zf.write(f)
            print(f'  added: {f}')
        else:
            print(f'  WARNING: {f} not found — skipped')
"

echo ""
echo "Done: ${OUTPUT}"
echo ""
echo "To submit to Chrome Web Store, upload ${OUTPUT} in the"
echo "Developer Dashboard at https://chrome.google.com/webstore/devconsole"

#!/usr/bin/env bash
set -euo pipefail

# PlaySpeed — Chrome Web Store packaging script
# Usage: bash package.sh
# Creates playspeed-v{version}.zip in the project root.

NAME="playspeed"

cd "$(dirname "$0")"

# Derive VERSION from manifest.json so package filename always matches
# the manifest's declared version. No more drift between script and manifest.
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required to package the extension." >&2
  exit 1
fi

VERSION=$(python3 -c "import json,sys; print(json.load(open('manifest.json'))['version'])")
if [ -z "${VERSION}" ]; then
  echo "ERROR: could not read version from manifest.json" >&2
  exit 1
fi

OUTPUT="${NAME}-v${VERSION}.zip"

echo "Packaging ${NAME} v${VERSION}..."
echo ""

# Remove old package if it exists
rm -f "${OUTPUT}"

# Use Python's zipfile module to create a clean package
OUTPUT_PATH="${OUTPUT}" python3 - <<'PYEOF'
import zipfile, os, json, sys

OUTPUT_PATH = os.environ['OUTPUT_PATH']

# Single source of truth: read manifest.json and verify every referenced file
# exists before packaging, so a broken upload can never silently ship.
with open('manifest.json', 'r') as f:
    manifest = json.load(f)

files = [
    'manifest.json',
    'background.js',
    'content.js',
    'yt-bridge.js',
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

# Sanity-check: ensure manifest-referenced files are all included.
expected = set()
for icon_set in (manifest.get('icons') or {}).values():
    expected.add(icon_set)
action = manifest.get('action') or {}
for icon in (action.get('default_icon') or {}).values():
    expected.add(icon)
if 'default_popup' in action:
    expected.add(action['default_popup'])
bg = manifest.get('background') or {}
if 'service_worker' in bg:
    expected.add(bg['service_worker'])
if 'page' in (manifest.get('options_ui') or {}):
    expected.add(manifest['options_ui']['page'])
for cs in (manifest.get('content_scripts') or []):
    expected.update(cs.get('js') or [])
for war in (manifest.get('web_accessible_resources') or []):
    expected.update(war.get('resources') or [])

missing_from_list = expected - set(files)
if missing_from_list:
    print('ERROR: manifest references files not in package list:', file=sys.stderr)
    for f in sorted(missing_from_list):
        print('  - ' + f, file=sys.stderr)
    sys.exit(1)

missing_on_disk = []
with zipfile.ZipFile(OUTPUT_PATH, 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in files:
        if os.path.isfile(f):
            zf.write(f)
            print('  added: ' + f)
        else:
            missing_on_disk.append(f)

if missing_on_disk:
    print('', file=sys.stderr)
    print('ERROR: files missing on disk — package is incomplete:', file=sys.stderr)
    for f in missing_on_disk:
        print('  - ' + f, file=sys.stderr)
    os.remove(OUTPUT_PATH)
    sys.exit(1)

print('')
print('OK: all manifest-referenced files packaged.')
PYEOF

echo ""
echo "Done: ${OUTPUT}"
echo ""
echo "To submit to Chrome Web Store, upload ${OUTPUT} in the"
echo "Developer Dashboard at https://chrome.google.com/webstore/devconsole"

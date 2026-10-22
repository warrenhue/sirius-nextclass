#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
exec /usr/bin/osascript -l JavaScript nextclass.js --choose-group

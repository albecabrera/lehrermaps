#!/usr/bin/env bash
# Launchd-compatible server launcher — no browser, no interactive output
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin"
cd /Users/acabrera/repos/ordnerstruktur_lehrer/lehrermaps/server
exec node index.js

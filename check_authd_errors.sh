#!/bin/bash
echo "=== authd error log at 03:36 UTC ==="
echo "--- enterWorld errors ---"
grep '2026-06-16T03:36' /data/uwo/.pm2/logs/authd-error.log | grep -i 'enterWorld' | head -20
echo ""
echo "--- ERROR level (not kick/online) ---"
grep '2026-06-16T03:36' /data/uwo/.pm2/logs/authd-error.log | grep -v 'kick timed out' | grep -v 'is still online' | head -30
echo ""
echo "--- 03:35~03:37 full error sample ---"
grep '2026-06-16T03:3[567]' /data/uwo/.pm2/logs/authd-error.log | grep -v 'kick timed out' | grep -v 'is still online' | head -40
echo ""
echo "--- timeout/exception errors ---"
grep '2026-06-16T03:3[567]' /data/uwo/.pm2/logs/authd-error.log | grep -iE 'timeout|exception|error|fail|ECONNR' | head -30
echo ""
echo "--- out log (slow/warn) at 03:36 ---"
grep '2026-06-16T03:36' /data/uwo/.pm2/logs/authd-out.log | grep -iE 'slow|warn|error|timeout|exceed' | head -20

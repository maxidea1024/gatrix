#!/bin/bash
grep -A4 "2026-06-16T03:36.*logout.*exception" /data/uwo/.pm2/logs/lobbyd-error.log | head -30
echo "==="
grep -A4 "2026-06-16T03:36.*enterWorld.*exception" /data/uwo/.pm2/logs/lobbyd-error.log | head -30

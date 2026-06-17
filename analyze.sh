#!/bin/bash
echo "=== 03:36 UTC Error Breakdown ==="
echo -n "ping_timeout: "; grep '2026-06-16T03:36' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'ping.timeout'
echo -n "payload_exceeded: "; grep '2026-06-16T03:36' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'payloadSize'
echo -n "enterWorld_exception: "; grep '2026-06-16T03:36' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'enterWorld'
echo -n "logout_exception: "; grep '2026-06-16T03:36' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'logout'
echo -n "kicking_user: "; grep '2026-06-16T03:36' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'kicking'
echo -n "taskQueue_flush: "; grep '2026-06-16T03:36' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'taskQueue'
echo -n "socket_timeout: "; grep '2026-06-16T03:36' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'SOCKET'
echo -n "task_dump: "; grep '2026-06-16T03:36' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'task.dump'
echo -n "disconnect_reason: "; grep '2026-06-16T03:36' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'disconnect.reason'
echo -n "packet_interval: "; grep '2026-06-16T03:36' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'packet-interval'
echo -n "7000ms_timeout: "; grep '2026-06-16T03:36' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c '7000ms'
echo "=== 03:37 UTC Error Breakdown ==="
echo -n "ping_timeout: "; grep '2026-06-16T03:37' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'ping.timeout'
echo -n "payload_exceeded: "; grep '2026-06-16T03:37' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'payloadSize'
echo -n "enterWorld_exception: "; grep '2026-06-16T03:37' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'enterWorld'
echo -n "logout_exception: "; grep '2026-06-16T03:37' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c 'logout'
echo -n "7000ms_timeout: "; grep '2026-06-16T03:37' /data/uwo/.pm2/logs/lobbyd-error.log | grep -c '7000ms'

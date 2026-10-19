#!/usr/bin/env bash
# Restart the production server on port 3100 in the background (local verification helper).
PID=$(lsof -ti tcp:3100 2>/dev/null || fuser 3100/tcp 2>/dev/null)
[ -n "$PID" ] && kill $PID 2>/dev/null
sleep 1
nohup npx next start -p 3100 > /tmp/claude-0/next.log 2>&1 &
sleep 3

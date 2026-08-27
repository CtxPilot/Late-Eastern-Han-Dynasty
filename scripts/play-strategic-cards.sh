#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 CtxPilot
#
# 一键打开「战略卡片世界屏」供人工测试（离线，无需服务端）。
#
# 用法：
#   pnpm play:strategic
#   ./scripts/play-strategic-cards.sh
#   ./scripts/play-strategic-cards.sh --verify   # 顺带跑自动化冒烟（需 Chrome CDP 9242）
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${LEH_CLIENT_PORT:-5173}"
HOST="${LEH_CLIENT_HOST:-127.0.0.1}"
URL="http://${HOST}:${PORT}/?offline=1"
PID_FILE="/tmp/leh-strategic-vite.pid"
LOG_FILE="/tmp/leh-strategic-vite.log"
VERIFY=0

for arg in "$@"; do
  case "$arg" in
    --verify|-v) VERIFY=1 ;;
    --help|-h)
      cat <<EOF
一键启动战略卡片测试页（离线）

  pnpm play:strategic
  ./scripts/play-strategic-cards.sh [--verify]

环境变量：
  LEH_CLIENT_HOST  默认 127.0.0.1
  LEH_CLIENT_PORT  默认 5173
EOF
      exit 0
      ;;
  esac
done

port_up() {
  curl -sf -o /dev/null --max-time 1 "http://${HOST}:${PORT}/" 2>/dev/null
}

ensure_client() {
  if port_up; then
    echo "✓ 客户端已在 ${HOST}:${PORT} 运行"
    return 0
  fi
  echo "→ 启动 Vite 客户端（离线可玩，不启服务端）…"
  # 清掉可能残留的旧 pid
  if [[ -f "$PID_FILE" ]]; then
    old="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${old:-}" ]] && kill -0 "$old" 2>/dev/null; then
      kill "$old" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  # 后台启动；日志写入 /tmp
  nohup pnpm --filter @leh/client dev -- --host "$HOST" --port "$PORT" \
    >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  echo "  pid=$(cat "$PID_FILE")  log=$LOG_FILE"
  for i in $(seq 1 60); do
    if port_up; then
      echo "✓ 客户端就绪 ${URL}"
      return 0
    fi
    sleep 0.5
  done
  echo "✗ 等待 ${HOST}:${PORT} 超时，请查看 $LOG_FILE" >&2
  exit 1
}

open_browser() {
  echo "→ 打开浏览器：${URL}"
  if command -v google-chrome >/dev/null 2>&1; then
    google-chrome --new-window "$URL" >/dev/null 2>&1 &
  elif command -v chromium-browser >/dev/null 2>&1; then
    chromium-browser --new-window "$URL" >/dev/null 2>&1 &
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  else
    echo "未找到浏览器，请手动打开：${URL}" >&2
    return 1
  fi
}

print_checklist() {
  cat <<EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  战略卡片 · 建议手测路径
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. 选「英雄集结」→「曹操」→「进入剧本」
  2. 中央应见「天下形势」州卡片（无大地图拖拽）
  3. 点「荆州」→ 见宛/江陵/襄阳等城卡
  4. 点城 → 右侧「城池详情」刷新
  5. 左栏「己方城池」点城 → 切到该州并选中
  6. TopBar「结束回合」可推进月份

  自动化冒烟（可选）：
    pnpm play:strategic -- --verify
    # 或先起 Chrome CDP 9242 再：
    pnpm verify-s379-strategic-cards
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
}

ensure_client
open_browser || true
print_checklist

if [[ "$VERIFY" -eq 1 ]]; then
  echo "→ 运行自动化冒烟（需要本机 Chrome --remote-debugging-port=9242）…"
  if ! curl -sf -o /dev/null --max-time 1 "http://127.0.0.1:9242/json"; then
    echo "  CDP 未就绪，尝试拉起 headless Chrome…"
    PROFILE="/tmp/leh-chrome-strategic-verify"
    rm -rf "$PROFILE"
    mkdir -p "$PROFILE"
    nohup google-chrome --headless=new --disable-gpu \
      --remote-debugging-port=9242 \
      --user-data-dir="$PROFILE" \
      --window-size=1440,900 about:blank \
      >"/tmp/leh-chrome-strategic-verify.log" 2>&1 &
    for i in $(seq 1 40); do
      curl -sf -o /dev/null --max-time 1 "http://127.0.0.1:9242/json" && break
      sleep 0.25
    done
  fi
  SMOKE_URL="$URL" node "$ROOT/scripts/verify-s379-strategic-cards.mjs"
fi

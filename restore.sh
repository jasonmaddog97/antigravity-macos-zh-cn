#!/usr/bin/env bash
set -euo pipefail

APP_PATH="/Applications/Antigravity.app"
RESOURCES_DIR="${APP_PATH}/Contents/Resources"
ASAR_FILE="${RESOURCES_DIR}/app.asar"
BACKUP_FILE="${RESOURCES_DIR}/app.asar.bak"

if pgrep -x "Antigravity" >/dev/null 2>&1; then
  echo "❌ 检测到 Antigravity 正在运行，请先完全退出后再执行还原。"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ 未找到备份文件 ${BACKUP_FILE}，无法还原。"
  exit 1
fi

echo "♻️ 正在还原原版 app.asar..."
cp "${BACKUP_FILE}" "${ASAR_FILE}"

echo "🔏 恢复 macOS 本地代码签名..."
codesign --force --deep --sign - "${APP_PATH}"

echo "✅ 已还原为官方英文原版！"

#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-/Applications/Antigravity.app}"
APP_NAME="$(basename "${APP_PATH}" .app)"
RESOURCES_DIR="${APP_PATH}/Contents/Resources"
ASAR_FILE="${RESOURCES_DIR}/app.asar"
BACKUP_FILE="${RESOURCES_DIR}/app.asar.bak"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

# 补充常见 Node.js 路径
export PATH="/opt/homebrew/bin:/usr/local/bin:${HOME}/.nvm/versions/node/$(ls "${HOME}/.nvm/versions/node" 2>/dev/null | tail -n 1)/bin:${PATH}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ 未检测到 python3，请先安装 Python 3"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未检测到 node，请先安装 Node.js (例如: brew install node)"
  exit 1
fi

if pgrep -x "${APP_NAME}" >/dev/null 2>&1; then
  echo "❌ 检测到 ${APP_NAME} 正在运行，请先完全退出后再执行本脚本。"
  exit 1
fi

if [ ! -f "${ASAR_FILE}" ]; then
  echo "❌ 未找到 ${ASAR_FILE}"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "📦 备份原版 app.asar -> app.asar.bak"
  cp "${ASAR_FILE}" "${BACKUP_FILE}"
else
  echo "ℹ️ 已存在备份 app.asar.bak，跳过备份。"
fi

echo "📂 解包 app.asar..."
python3 "${SCRIPT_DIR}/asar_tool.py" extract "${BACKUP_FILE}" "${WORK_DIR}/app"

echo "🧩 注入中文补丁与词典..."
cp "${SCRIPT_DIR}/zh-patch.js" "${WORK_DIR}/app/zh-patch.js"
cp "${SCRIPT_DIR}/dict.json" "${WORK_DIR}/app/dict.json"

MAIN_ENTRY=$(node -e "console.log(require('${WORK_DIR}/app/package.json').main)")
ENTRY_FILE="${WORK_DIR}/app/${MAIN_ENTRY}"

if [ ! -f "${ENTRY_FILE}" ]; then
  echo "❌ 未找到入口文件: ${ENTRY_FILE}"
  exit 1
fi

if ! grep -q "zh-patch.js" "${ENTRY_FILE}"; then
  REL_PATCH=$(node -e "const p=require('path'); console.log(p.relative(p.dirname('${ENTRY_FILE}'), '${WORK_DIR}/app/zh-patch.js').replace(/\\\\/g, '/'))")
  [[ "${REL_PATCH}" != .* ]] && REL_PATCH="./${REL_PATCH}"
  printf "require('%s');\n%s" "${REL_PATCH}" "$(cat "${ENTRY_FILE}")" > "${ENTRY_FILE}"
fi

echo "📦 重新打包 app.asar..."
python3 "${SCRIPT_DIR}/asar_tool.py" pack "${WORK_DIR}/app" "${ASAR_FILE}"

echo "🔏 修复 macOS 本地代码签名..."
codesign --force --deep --sign - "${APP_PATH}"

echo "✅ 汉化完成！现在可以重新打开 Antigravity。"

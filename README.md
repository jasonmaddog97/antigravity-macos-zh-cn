# Antigravity 最小化中文汉化脚本

本套件提供针对 macOS 版 `/Applications/Antigravity.app` 的最小化本地汉化注入与一键还原脚本。

## 前置依赖
- macOS 系统
- Node.js（用于运行 `@electron/asar` 解包与重打包，可通过 `brew install node` 安装）

## 使用方法

1. **完全退出 Antigravity 客户端**（`Cmd + Q`）。
2. 在终端中赋予脚本执行权限并运行安装：
   ```bash
   chmod +x install.sh restore.sh
   ./install.sh
   ```
3. 如需还原为官方英文原版：
   ```bash
   ./restore.sh
   ```

## 自定义词条
直接编辑 `dict.json` 添加或修改 `"英文": "中文"` 映射，然后重新运行 `./install.sh` 即可生效。

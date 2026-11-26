// Antigravity 中文本地化注入模块
const fs = require('fs');
const path = require('path');

let dict = {};
try {
  dict = JSON.parse(fs.readFileSync(path.join(__dirname, 'dict.json'), 'utf8'));
} catch (e) {
  console.error('[zh-cn] Failed to load dict.json:', e);
}

function translateText(text) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (dict[trimmed]) {
    return text.replace(trimmed, dict[trimmed]);
  }
  return text;
}

const electron = (() => {
  try { return require('electron'); } catch (_) { return null; }
})();
const APP_NAME = (electron && electron.app && electron.app.getName && electron.app.getName()) || 'App';

const ROLE_LABELS = {
  about: `关于 ${APP_NAME}`,
  services: '服务',
  hide: `隐藏 ${APP_NAME}`,
  hideOthers: '隐藏其他',
  unhide: '全部显示',
  quit: `退出 ${APP_NAME}`,
  undo: '撤销',
  redo: '重做',
  cut: '剪切',
  copy: '复制',
  paste: '粘贴',
  pasteAndMatchStyle: '粘贴并匹配样式',
  delete: '删除',
  selectAll: '全选',
  reload: '重新加载',
  forceReload: '强制重新加载',
  toggleDevTools: '切换开发者工具',
  resetZoom: '实际大小',
  zoomIn: '放大',
  zoomOut: '缩小',
  togglefullscreen: '切换全屏',
  minimize: '最小化',
  zoom: '缩放',
  front: '前置全部窗口',
  close: '关闭窗口',
  fileMenu: '文件',
  editMenu: '编辑',
  viewMenu: '视图',
  windowMenu: '窗口',
  appMenu: 'Antigravity',
};

function translateMenuTemplate(template) {
  if (!Array.isArray(template)) return template;
  return template.map((item) => {
    const next = { ...item };
    if (next.label) {
      next.label = translateText(next.label);
    } else if (next.role && ROLE_LABELS[next.role]) {
      next.label = ROLE_LABELS[next.role];
    }
    if (next.submenu) next.submenu = translateMenuTemplate(next.submenu);
    return next;
  });
}

try {
  const electron = require('electron');
  if (electron && electron.Menu && electron.Menu.buildFromTemplate) {
    const origBuild = electron.Menu.buildFromTemplate.bind(electron.Menu);
    electron.Menu.buildFromTemplate = (template) => origBuild(translateMenuTemplate(template));
  }

  if (electron && electron.app) {
    const COLLECT_FILE = '/tmp/ag_untranslated.json';
    let collected = new Set();
    try {
      if (fs.existsSync(COLLECT_FILE)) {
        JSON.parse(fs.readFileSync(COLLECT_FILE, 'utf8')).forEach((s) => collected.add(s));
      }
    } catch (_) {}

    const saveCollected = (items) => {
      let changed = false;
      for (const s of items) {
        if (s && !collected.has(s)) {
          collected.add(s);
          changed = true;
        }
      }
      if (changed) {
        try {
          fs.writeFileSync(COLLECT_FILE, JSON.stringify([...collected], null, 2), 'utf8');
        } catch (_) {}
      }
    };

    const dictJson = JSON.stringify(dict);
    const rendererScript = `
      (function() {
        if (window.__agZhPatched) return;
        window.__agZhPatched = true;
        const DICT = ${dictJson};
        const sent = new Set();
        let queue = [];
        let flushTimer = null;
        function queueCollect(s) {
          if (!s) return;
          const k = s.trim();
          if (k.length < 2 || k.length > 300) return;
          if (!/[a-zA-Z]{2,}/.test(k)) return;
          if (DICT[k] || sent.has(k)) return;
          sent.add(k);
          queue.push(k);
          if (!flushTimer) {
            flushTimer = setTimeout(() => {
              flushTimer = null;
              if (queue.length > 0) {
                console.debug('__ZH_COLLECT__:' + JSON.stringify(queue.splice(0, queue.length)));
              }
            }, 300);
          }
        }
        function t(s) {
          if (!s) return s;
          const k = s.trim();
          if (DICT[k]) return s.replace(k, DICT[k]);
          queueCollect(s);
          return s;
        }
        function walk(root) {
          if (!root) return;
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
          let node;
          while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.isContentEditable) continue;
            const next = t(node.nodeValue);
            if (next !== node.nodeValue) node.nodeValue = next;
          }
          if (root.querySelectorAll) {
            root.querySelectorAll('[placeholder],[title],[aria-label]').forEach((el) => {
              ['placeholder', 'title', 'aria-label'].forEach((attr) => {
                const val = el.getAttribute(attr);
                const next = t(val);
                if (next && next !== val) el.setAttribute(attr, next);
              });
            });
          }
        }
        const start = () => {
          if (!document.body) return;
          walk(document.body);
          let timer = null;
          new MutationObserver(() => {
            if (timer) return;
            timer = setTimeout(() => {
              timer = null;
              walk(document.body);
            }, 80);
          }).observe(document.body, { childList: true, subtree: true, characterData: true });
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
        else start();
      })();
    `;

    electron.app.on('web-contents-created', (_event, contents) => {
      const inject = () => contents.executeJavaScript(rendererScript).catch(() => {});
      contents.on('dom-ready', inject);
      contents.on('did-finish-load', inject);
      if (process.env.ZH_COLLECT === '1') {
        contents.on('console-message', (_e, _level, message) => {
          if (typeof message === 'string' && message.startsWith('__ZH_COLLECT__:')) {
            try {
              const items = JSON.parse(message.slice('__ZH_COLLECT__:'.length));
              if (Array.isArray(items)) saveCollected(items);
            } catch (_) {}
          }
        });
      }
    });
  }
} catch (e) {
  console.error('[zh-cn] Hook error:', e);
}

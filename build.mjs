// build.mjs —— 把 skin.css 与 lib/bg-engine.js 内联进 lib/client.js
// 用法：node plugins/dsh-tsnet-skin-pilot/build.mjs             （舰队本机版：烘入本机工作区路径）
//       node plugins/dsh-tsnet-skin-pilot/build.mjs --public   （对外发布版：**不烘任何本机路径**）
// 约定：client.js 里 /*__TSNET_CSS_START__*/…/*__TSNET_CSS_END__*/ 与
//       /*__TSNET_BG_START__*/…/*__TSNET_BG_END__*/ 之间是**生成区**，禁止手改。
// 内联用 JSON.stringify 对 CSS 转义；bg-engine.js 是 JS 源码，按原文内联（它不是字符串）。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = join(here, 'skin.css');
const bgPath = join(here, 'lib', 'bg-engine.js');
const railPath = join(here, 'lib', 'rail-engine.js');   // 批 5：对话刻度轨（同样按原文内联，不是字符串）
const clientPath = join(here, 'lib', 'client.js');

// 公开版（--public）：把工作区占位符填成**空串** ⇒ 产物里不含任何本机路径，
// 且 bg-engine 会据此关闭"跨入口偏好同步"（那一功能依赖中控台的 /dsh-ftree-* 路由，
// 在别人的机器上并不存在）——只在本入口生效，并在设置行如实写出这一状态。
const PUBLIC = process.argv.includes('--public') || process.env.TSNET_PUBLIC === '1';

// 工作区根：从**插件自身位置**推导（plugins/<name> → plugins → 根），再烘进 client.js。
// 这样浏览器半不硬编码路径（与 fleet D2 同精神：路径只有一个来源）。
const WORKSPACE = PUBLIC ? '' : join(here, '..', '..').replace(/\\/g, '/');

const css = readFileSync(cssPath, 'utf8');
let bg = readFileSync(bgPath, 'utf8');
if (!bg.includes("'__TSNET_WORKSPACE__'")) {
  console.error('build.mjs: bg-engine.js 里找不到 __TSNET_WORKSPACE__ 占位符');
  process.exit(1);
}
bg = bg.split("'__TSNET_WORKSPACE__'").join(JSON.stringify(WORKSPACE));
const rail = readFileSync(railPath, 'utf8');
let client = readFileSync(clientPath, 'utf8');

function replaceRegion(text, start, end, body, label) {
  const i = text.indexOf(start);
  const j = text.indexOf(end);
  if (i === -1 || j === -1 || j < i) {
    console.error('build.mjs: markers not found: ' + label);
    process.exit(1);
  }
  return text.slice(0, i) + start + '\n    ' + body + '\n    ' + text.slice(j);
}

client = replaceRegion(client, '/*__TSNET_CSS_START__*/', '/*__TSNET_CSS_END__*/', 'var CSS = ' + JSON.stringify(css) + ';', 'css');
client = replaceRegion(client, '/*__TSNET_BG_START__*/', '/*__TSNET_BG_END__*/', bg.trim(), 'bg-engine');
client = replaceRegion(client, '/*__TSNET_RAIL_START__*/', '/*__TSNET_RAIL_END__*/', rail.trim(), 'rail-engine');

// 全仓 LF（D8）：写前归一化行尾
writeFileSync(clientPath, client.replace(/\r\n/g, '\n'), 'utf8');

// 回读断言（§12.4：写完必须回读，不信"我执行了"）
const back = readFileSync(clientPath, 'utf8');
// 判据自身的坑（实测）：① JSON.stringify('') 产出的是 `""` 而不是 `''`；② 直接拿 `[A-Za-z]:[\\/]`
// 找盘符会把 `https://`、`data:` 这类 **URL 协议**误判成本机路径（假 FAIL）。先剥协议再判。
const denuded = back.replace(/[a-z][a-z0-9+.-]*:\/\//gi, '').replace(/data:[^"')]*/gi, '');
const checks = {
  css: back.includes('--sk-primary') && back.includes('--dsw-alias-label-primary'),
  bg: back.includes('settings.general.item') && back.includes('installBackgroundFeature') && back.includes("'/dsh-ftree-'"),
  rail: back.includes('installRailFeature') && back.includes('data-chat-flow-kind') && back.includes("'dsh-tsnet-rail-host'"),
  ws: PUBLIC
    ? (!back.includes('__TSNET_WORKSPACE__') && back.includes('var FT_ROOT = ""'))
    : (back.includes(WORKSPACE) && !back.includes('__TSNET_WORKSPACE__')),
  // 公开版硬判据：产物里**不许出现任何本机绝对路径**（盘符路径本就不该出现在别人的机器上）
  noHostPath: !PUBLIC || !/[A-Za-z]:[\\/]/.test(denuded),
  markers: back.includes('/*__TSNET_CSS_START__*/') && back.includes('/*__TSNET_BG_END__*/') && back.includes('/*__TSNET_RAIL_END__*/'),
};
const ok = checks.css && checks.bg && checks.rail && checks.ws && checks.noHostPath && checks.markers;
console.log(`build.mjs: public=${PUBLIC} css=${css.length}B bg=${bg.length}B rail=${rail.length}B client=${back.length}B ws=${PUBLIC ? '(空)' : WORKSPACE} cssInlined=${checks.css} bgInlined=${checks.bg} railInlined=${checks.rail} wsBaked=${checks.ws} noHostPath=${checks.noHostPath} markerOk=${checks.markers} ${ok ? 'OK' : 'CHECK'}`);
process.exit(ok ? 0 : 1);

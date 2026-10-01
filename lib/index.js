// lib/index.js —— 主机半：**刻意空实现**
//
// 为什么不留路由（2026-09-28 实测后改的，写下来免得下一个人再走一遍）：
//   · DSH 的 `dsh.profile.bundles` 只在**进程启动时读一次** —— 把本包加进 bundles、改 `cordis.patch.yml`、
//     卸载再重装，路由都仍然 404；而补丁层（cordis.patch.yml）热的只是**浏览器那半**。
//     ⇒ 主机半要生效必须重启 DSH，而本会话就跑在 DSH 进程里，不能重启。
//   · 于是背景的数据面改为**复用已在运行的 folder-tree-sh** 的宿主路由
//     （`/dsh-ftree-list` 列目录、`/dsh-ftree-raw` 读字节，实测同源免令牌、图片 200）——
//     浏览器半直接用它们读中控台的样品图目录与相册目录。
//   · 结论：本插件**不需要主机半**；留一个空实现是为了 package.json 的契约完整，且不制造死代码。
//
// 如果将来确实要自开路由（比如要加权限控制或缩略图缩放），先重启一次 DSH 让它进 bundles，
// 再把路由写在这里，并在 README 里把"需要重启一次"这件事写清楚。
export const name = 'dsh-tsnet-skin-pilot';

export function apply() {
  // 刻意什么都不做：不注册服务、不加路由、不碰文件系统。
  // 皮肤与背景都由浏览器半完成（lib/client.js + skin.css + lib/bg-engine.js）。
}

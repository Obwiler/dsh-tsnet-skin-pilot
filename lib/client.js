"use strict";
/**
 * dsh-tsnet-skin-pilot —— 浏览器半：DSH 皮肤（浮层 + 侧栏 + 背景档位）。
 *
 * 做什么（四件事）：
 *   ① 往 <head> 插一份 <style id="dsh-tsnet-skin-css">（内容 = skin.css，由 build.mjs 内联，
 *      单一来源是 plugins/dsh-tsnet-skin-pilot/skin.css，本文件里那段是**生成物**，别手改）；
 *   ② 给 body 挂 data-tsnet-skin（皮肤规则开关）；
 *   ③ 背景引擎（内容 = lib/bg-engine.js，同样由 build.mjs 内联）：把中控台那套背景档位
 *      画在 body 的两个伪元素上，并在 **DSH 设置 → 常规** 注册一行「背景」；
 *   ④ 尊重退出开关：localStorage.tsnetSkin === "off" 时不注入（皮肤与背景一起关）。
 *
 * 不做什么（本次事故换来的纪律）：不改 DOM 结构、不拦事件、不对**任何可能包含弹层的祖先**
 * 做裁剪/变换/滤镜（DSH 的 popover 不 portal，是输入卡的 DOM 子孙；上一版给输入卡加装饰性
 * clip-path，直接把模型选择面板裁到屏幕外）。背景用的是 body::before/::after 两个**伪元素**，
 * 它们没有子节点，不在任何弹层的祖先链上。
 *
 * 怎么撤：从 $DSH_HOME/profiles/web/cordis.patch.yml 删掉本段（热生效），
 * 或跑插件目录里的 install.ps1 -Uninstall。
 */
window.__ModuleLoader__.load({
  id: "dsh-tsnet-skin-pilot",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var react = require("react");

    var STYLE_ID = "dsh-tsnet-skin-css";
    var ATTR = "data-tsnet-skin";

    /*__TSNET_CSS_START__*/
    var CSS = "/* skin.css —— DSH 皮肤 v3 · 阶段 3 试点（浮层 + 侧栏）2026-09-28\n *\n * 试点范围**只有两块**：① 浮层（菜单 / 对话框 / 列表 / 提示）② 侧栏。\n * 会话列、输入卡、数据区一律不动 —— 等这两块跑通回归再扩面。\n *\n * ★ 本文件遵守 tsnet-ui-engineering §70 的五条硬约束，重点是：\n *   · **零几何改动**：一切发丝线与左轨都用 `box-shadow`（inset）画，不用 border 宽度、不改 padding；\n *   · **零裁剪**：不用 clip-path / overflow / mask / transform / filter / backdrop-filter ——\n *     切角留到阶段 4，按\"叶子白名单\"逐项验证（叶子 = 不包含任何弹层的元素）；\n *   · 只动：颜色令牌、字体族/字号/字重/字距、圆角（不裁子孙）、阴影、焦点环与选中色、滚动条配色。\n *\n * 根因备忘（为什么这么保守）：上一版给输入卡加装饰性 clip-path，而 DSH 的 popover 是输入卡的\n * DOM 子孙（不 portal），于是整个模型选择面板被裁到屏幕外 ⇒ 用户换不了模型（风险级功能缺失）。\n * 取证：docs\\archive\\dsh-tsnet-theme-20260928\\evidence\\45-clip-kills-menu.png\n */\n\n/* ═══ 1. 令牌（形态感知，单一来源）═══ */\nbody[data-tsnet-skin] {\n  --sk-rail: 4px;\n  --sk-hair: rgba(163, 219, 235, .10);\n  --sk-hair-2: rgba(163, 219, 235, .06);\n  --sk-paper: rgba(242, 247, 248, .985);\n  --sk-paper-ink: #10262e;\n  --sk-paper-line: rgba(16, 42, 51, .14);\n  --sk-shadow: 0 22px 60px rgba(0, 0, 0, .52);\n  /* 背景场令牌（背景引擎与档位共用；改档只改变量，不改变规则） */\n  --tsn-noise: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.04 0'/></filter><rect width='256' height='256' filter='url(%23n)'/></svg>\");\n  --tsn-grid: rgba(163, 219, 235, .055);   /* ★ 2026-09-28 批1 实测上调（原 .028）：\n      第一轮读图发现整个界面是\"纯暗平面\"、材质四档**看不出差别** —— 真因不是材质没生效\n      （计算值实测 0.38/0.45/0.60/0.96 都对），而是**背后没有可透出的结构**：网格 alpha 太低，\n      玻璃没有东西可以\"模糊\"。中控台读得出亚克力，正因为它背后有结构。\n      这一条是**方向性改动**（默认背景的强度），已出样张供用户拍板；嫌重就调回 .028。 */\n  --tsn-glow-cool: rgba(86, 200, 221, .22);\n  --tsn-glow-warm: rgba(255, 166, 61, .26);\n  --tsn-bg-layer: none;\n  --tsn-bg-blur: 0px;\n  --tsn-bg-dim: 0;\n  --tsn-bg-scale: 1;\n}\nbody[data-tsnet-skin][data-ds-dark-theme] {\n  --sk-primary: #ff7a3c;          /* 暗形态主色：琥珀橙（主色跟随背景时由引擎覆盖） */\n  --sk-secondary: #56c8dd;        /* 副色：青蓝（信息/焦点/选中） */\n  /* 双层阴影：一层紧贴（给\"坐在上面\"的接触感）+ 一层环境（拉开空间） */\n  --sk-shadow: 0 2px 8px rgba(0, 0, 0, .42), 0 22px 60px rgba(0, 0, 0, .52);\n}\nbody[data-tsnet-skin]:not([data-ds-dark-theme]) {\n  --sk-primary: #0e7c8c;          /* 亮形态主色：深青（主色随形态换） */\n  --sk-secondary: #0f6f9f;\n  --sk-hair: rgba(16, 42, 51, .12);\n  --sk-hair-2: rgba(16, 42, 51, .07);\n  /* ★ 亮形态的浮层必须比底面更亮：底色是青纸 #f2f7f8，浮层给纯白 ——\n     否则纸面与背景同色，浮层\"贴\"在背景上（读图实测过，这是第 1 轮抓到的问题） */\n  --sk-paper: #ffffff;\n  --sk-paper-line: rgba(16, 42, 51, .20);\n  --sk-shadow: 0 2px 6px rgba(16, 42, 51, .12), 0 20px 48px rgba(16, 42, 51, .22);\n  --tsn-grid: rgba(16, 42, 51, .025);\n  --tsn-glow-cool: rgba(15, 111, 159, .14);\n  --tsn-glow-warm: rgba(255, 166, 61, .12);\n}\n\n/* ═══ 1c. 让背景真的看得见（否则\"选了看不见\"＝界面在说假话）═══\n * 实测（2026-09-28）：把亮渐变写进 --tsn-bg-layer 后屏幕仍是暗色 —— 用 elementsFromPoint 逐层查，\n * 遮挡者是 DSH 应用外框 `[class*=\"_frame\"]` 的**不透明**底色 rgb(21,21,23)。\n * 这里只**降 alpha**：绝不加 clip-path / transform / filter / backdrop-filter ——\n * 那几样会给弹层换包含块或直接把弹层裁掉（§70 禁令，本次事故就是这么来的）。 */\nbody[data-tsnet-skin][data-tsn-bg] [class*=\"_frame\"] {\n  /* ★ 批 3（2026-09-28）：原来写死 64%。读图实测（鲜渐变档）：消息区能看出背景，\n     但**侧栏几乎全暗** —— 因为复合不透明 ≈ 1−(1−0.45)(1−0.64) = **0.80**，只剩 20% 透出。\n     现在外框也用**材质令牌**（权重 70%），于是\"背景覆盖范围\"跟着材质档/倍率一起动：\n     材质 mid ⇒ 外框 0.315 ⇒ 侧栏复合 ≈ 0.62（透出 38%）；材质关 ⇒ 外框 0.67 ⇒ 复合 0.87（接近实心）。\n     这样\"背景扩面\"与\"明度/透明倍率自选\"是**同一套旋钮**，不再是两处互相打架的常数。 */\n  background-color: color-mix(in srgb, var(--sk-tint) calc(var(--sk-alpha) * 70%), transparent);\n}\n/* 最后一个遮挡者：会话列外框。\n   实测（2026-09-28）真实祖先链是 [class*=\"_centerCol\"] → 无类名 DIV → [class*=\"_root\"]，\n   所以这里必须是两级后代；只把它的底色改透明，**不动 clip/transform/filter**。\n   引擎里另有一条自检：若背景仍被不透明元素盖住，会在设置行里如实报出遮挡元素的类名。 */\nbody[data-tsnet-skin][data-tsn-bg] [class*=\"_centerCol\"] > div > [class*=\"_root\"] {\n  background-color: transparent;\n}\n/* ★★ 2026-09-28 实测更正（真缺陷）：`[data-slot=\"sidebar\"]` 与 `[data-slot=\"conversation\"]` **都是\n   `display: contents`** —— 本机 27 个槽位标记**全部 0×0、不生成盒子**。写在槽位元素**本身**上的\n   `background-color` / `box-shadow` **一律不绘制**，所以原来这两条规则**从未生效**\n   （这就是\"背景档选了却盖不住侧栏/阅读面\"的真因，也解释了用户问的\"背景图为什么没能更大范围覆盖\"）。\n   槽位标记只对**后代选择器**有效（它的子树是真 DOM）。真实盒子（实测）：\n   · 侧栏＝`[class*=\"sidebarCol\"]`（内层还有 `[class*=\"hHd-Xa_root\"]`，两层都得不透明底才挡得住）\n   · 阅读面＝`[class*=\"scrollBody\"]`（会话滚动体，实测 rect [280,76,988,418]） */\n/* ★ 侧栏的\"让背景透出来\"**统一由材质档负责**（`--sk-panel`）。\n   原来这里有一条 `[data-tsn-bg] [class*=\"sidebarCol\"]{...74%...}`，实测它与材质规则**打架**：\n   该选择器特异性 (0,3,1) 高于材质那条 (0,2,1) ⇒ 只要背景档开着（默认就开着），侧栏就永远吃 74%，\n   材质档的 alpha 在侧栏上**根本没生效**（实测 bg = color(srgb .137 .137 .141 / 0.74)）。\n   两条规则表达的是同一件事（让背景透出来）⇒ 合并成一条，唯一来源＝材质令牌。 */\nbody[data-tsnet-skin][data-tsn-bg] [class*=\"sidebarCol\"] [class*=\"hHd-Xa_root\"] {\n  background-color: transparent;\n}\n/* 阅读面留一层薄纱，保证照片档下正文仍有对比度（同样是 alpha，不裁剪） */\nbody[data-tsnet-skin][data-tsn-bg] [class*=\"scrollBody\"] {\n  background-color: color-mix(in srgb, var(--dsw-alias-bg-base) 40%, transparent);\n}\n\n/* ═══ 1b. 背景场：只画在 body::before / body::after 两个**伪元素**上 ═══\n * 伪元素没有子节点 ⇒ 不是任何弹层的祖先 ⇒ 这里用 filter/transform 不违反 §70 禁令\n * （禁令针对的是\"可能包含弹层的祖先\"）。档位由 body[data-tsn-bg] 标记；层内容与覆盖色令牌\n * 都由引擎写在 **body** 上 —— 令牌声明在 body，若把变量写在 html 上，里面的 var() 会在 html\n * 那层替换失败、整条 background-image 被丢弃（第一版就是这么错的，实测 body::before 只剩噪点）。 */\nbody[data-tsnet-skin] {\n  background-color: var(--dsw-alias-bg-base);\n}\nbody[data-tsnet-skin]::before {\n  content: '';\n  position: fixed;\n  inset: 0;\n  z-index: -2;\n  pointer-events: none;\n  background-image: var(--tsn-noise), var(--tsn-bg-layer);\n  background-repeat: repeat, repeat;\n  background-size: 256px 256px, auto;\n  background-position: 0 0, 0 0;\n  background-attachment: fixed;\n  filter: blur(var(--tsn-bg-blur));\n  transform: scale(var(--tsn-bg-scale));\n}\nbody[data-tsnet-skin]::after {\n  content: '';\n  position: fixed;\n  inset: 0;\n  z-index: -1;\n  pointer-events: none;\n  background: rgba(0, 0, 0, var(--tsn-bg-dim));\n}\n/* 纯色档＝\"没有结构，磨砂就看不出来\"（控制台原话）：这一档连噪点都去掉，才叫对照档 */\nbody[data-tsnet-skin][data-tsn-bg=\"plain\"]::before { background-image: none; }\n/* 图片/实景档：铺满、居中、不重复（模糊靠 ::before 的 filter，放大一点避免虚边） */\nbody[data-tsnet-skin][data-tsn-bg=\"image\"]::before,\nbody[data-tsnet-skin][data-tsn-bg=\"media\"]::before {\n  background-repeat: no-repeat;\n  background-size: cover;\n  background-position: center center;\n  background-attachment: fixed;\n}\nbody[data-tsnet-skin][data-tsn-bg=\"custom\"]::before {\n  background-repeat: no-repeat, no-repeat;\n  background-size: 256px 256px, cover;\n  background-position: 0 0, center center;\n}\n\n\n/* ═══ 2. 侧栏（骨架：颜色 + 发丝 + 左轨，全部走 box-shadow，零几何改动）═══\n * ★ 目标已更正：动**真实盒子** `[class*=\"sidebarCol\"]`，不是 `display:contents` 的槽位标记（见 1c 的实测）。\n *   内层 `[class*=\"hHd-Xa_root\"]` 让出一层，避免两层 alpha 叠加（各 45% 叠起来≈70% 实心，就不是亚克力了）。\n * 材质：侧栏只走 **alpha 色凋**（`--sk-panel`），**不挂 backdrop-filter** ——\n *   侧栏真磨砂的前提是给它加 `position: relative`，而\"侧栏内的绝对定位弹层会不会位移\"至今是 UNKNOWN\n *   （受控实验 B：会话行菜单在本机用合成 click / 真实 hover / 真实右键三种方式都打不开）\n *   ⇒ 没证实就不上（§70.1「弹层优先于美观」）。 */\nbody[data-tsnet-skin] [class*=\"sidebarCol\"] {\n  background-color: var(--sk-panel);\n  box-shadow: inset -1px 0 0 0 var(--sk-hair);\n  /* ═══ 批 2（2026-09-28）：侧栏真磨砂 —— 受控实验通过后启用 ═══\n   * 证据（侧栏 280×1800，**420 个后代元素逐元素比矩形**）：注入 `position:relative` +\n   *   伪元素 `backdrop-filter` ⇒ **零位移（0/420）**；侧栏内 5×5 命中网格 **25/25**；\n   *   移除注入后**复原差 0**、position 回到 static。注入与还原都是实测的，不是推理。\n   * 残余 UNKNOWN（不许读成通过）：若存在某个\"打不开的弹层\"是**侧栏内的 absolute 定位**，\n   *   它会被改挂到侧栏这个新包含块上 ⇒ 可能位移。五次尝试（合成 click / 真实 hover /\n   *   真实右键 / Shift+F10 / 按钮扫描）都打不开会话行菜单 ⇒ 既不能证实也不能证伪。\n   * 处置：先上（**一条规则即可回退**），观察期继续盯\"侧栏里有没有东西跑位\"。 */\n  position: relative;\n}\n/* ═══ 批 8：修掉两处\"渐变黑脏区\"（用户实测反馈，2026-09-28）═══════════════════════\n * ① **主界面下侧**：真凶是 **DSH 自己画的一条不透明渐变**——\n *    实测 `wSkVaW_composerSeat` 的 `background-image` ＝\n *    `linear-gradient(color(srgb 0 0 0 / 0) 0px, rgb(21,21,23) 36px)`（透明 → 不透明深色）。\n *    我的半透明皮肤让照片透上来，这条渐变就在底部压出一条**深色带**。\n *    修法：背景档开着时**改用我们的材质令牌**做同一条淡出（照片贯通到底，底部仍有薄纱保对比度）。\n *    只改 `background-image` 的渐变色，**不动它的位置/尺寸**。\n * ② **左侧栏**：`backdrop-filter: blur(26px)` 把照片在侧栏边缘**涂开成暗涂抹**（模糊核在元素边缘\n *    采不到外边内容）⇒ 看起来就是\"渐变黑的脏区\"。\n *    修法：侧栏磨砂**默认关**（回到只有 alpha 色凋 —— 与最初建议的\"亚克力只用于浮层、数据区平面\"一致），\n *    想要真磨砂的用户可在 设置→常规→材质 里打开（`body[data-tsn-sidebar-frost=\"on\"]`）。 */\n\n/* ═══ 批 10（2026-09-29）：底部\"渐变暗色脏块\"—— 用户第二次反馈，根因是批 8 的修法本身 ═══\n * 用户原话：「对话列表下侧还是有渐变暗色脏块，要修好。」\n * 先量后改（实测）：真凶仍是 `wSkVaW_composerSeat` 那条 190px 高的渐变，但**批 8 给它换的是\n * `var(--sk-panel)`（α .45）**，而阅读面 `[class*=\"scrollBody\"]` 已经有一层 40% 薄纱\n * ⇒ 底部**叠了两层**（.40 + .45 ≈ .67），比上方深约 27%，于是出现一条可见的横向台阶 ——\n * 在照片/亮色背景下读起来就是\"渐变暗色脏块\"。\n * 改法：**只改渐变的颜色与长度**，末端压到\"与薄纱几乎同深\"（α .10）、淡出拉长到 72px，\n * 台阶落到肉眼不可辨；元素的位置与尺寸一律不动（§70：不用裁剪/变换/滤镜）。 */\nbody[data-tsnet-skin][data-tsn-bg] [class*=\"composerSeat\"] {\n  background-image: linear-gradient(to bottom, transparent 0px, color-mix(in srgb, var(--dsw-alias-bg-base) 10%, transparent) 72px);\n}\n\nbody[data-tsnet-skin] [class*=\"sidebarCol\"]::before {\n  content: '';\n  position: absolute;\n  inset: 0;\n  z-index: -1;                 /* 负 z：画在侧栏自己的底色之下、页面之上 */\n  pointer-events: none;        /* 伪元素不吃点击 */\n}\n/* 只有显式打开时才挂真磨砂（默认关：照片背景下会把边缘涂开成暗涂抹） */\nbody[data-tsnet-skin][data-tsn-sidebar-frost=\"on\"] [class*=\"sidebarCol\"]::before {\n  backdrop-filter: blur(var(--sk-blur)) saturate(var(--sk-sat)) brightness(var(--sk-bright));\n}\nbody[data-tsnet-skin]:not([data-tsn-sidebar-frost=\"on\"]) [class*=\"sidebarCol\"]::before {\n  backdrop-filter: none;\n  background: none;\n}\n/* 材质=关 时侧栏也不许留模糊（与输入卡同一条语义：关就是真关） */\nbody[data-tsnet-skin][data-tsn-glass=\"off\"] [class*=\"sidebarCol\"]::before {\n  backdrop-filter: none;\n}\nbody[data-tsnet-skin] [class*=\"sidebarCol\"] [class*=\"hHd-Xa_root\"] {\n  background-color: transparent;\n}\nbody[data-tsnet-skin] [data-slot=\"sidebar\"] [class*=\"_sessionRow\"] {\n  border-radius: 0;\n  box-shadow: inset 0 -1px 0 0 var(--sk-hair-2);\n}\nbody[data-tsnet-skin] [data-slot=\"sidebar\"] [class*=\"_sessionRow\"]:hover {\n  background-color: var(--dsw-alias-bg-layer-2);\n}\nbody[data-tsnet-skin] [data-slot=\"sidebar\"] [class*=\"_sessionRow\"][aria-selected=\"true\"],\nbody[data-tsnet-skin] [data-slot=\"sidebar\"] [class*=\"_sessionRow\"][data-active=\"true\"] {\n  background-color: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  box-shadow: inset var(--sk-rail) 0 0 0 var(--sk-primary), inset 0 -1px 0 0 var(--sk-hair-2);\n}\nbody[data-tsnet-skin] [data-slot=\"sidebar\"] [class*=\"_groupSection\"],\nbody[data-tsnet-skin] [data-slot=\"sidebar\"] [class*=\"_groupLabel\"] {\n  text-transform: uppercase;\n  letter-spacing: .12em;\n  font-size: 11px;\n  color: var(--dsw-alias-label-caption);\n}\nbody[data-tsnet-skin] [data-slot=\"sidebar\"] button[class*=\"_navCell\"][class*=\"_active\"],\nbody[data-tsnet-skin] [data-slot=\"sidebar\"] [class*=\"_navCell\"][aria-current=\"page\"] {\n  color: var(--sk-primary);\n}\nbody[data-tsnet-skin] [data-slot=\"sidebar\"] [class*=\"bm-row\"],\nbody[data-tsnet-skin] [data-slot=\"sidebar\"] [class*=\"_sessionRow\"] time,\nbody[data-tsnet-skin] [data-slot=\"sidebar\"] [class*=\"_sessionRow\"] span[class*=\"_meta\"] {\n  font-variant-numeric: tabular-nums;\n}\n\n/* ═══ 3. 浮层：纸面（只动颜色 / 圆角 / 阴影 / 边框色 ⇒ 不裁剪、不改几何）═══ */\nbody[data-tsnet-skin] [role=\"dialog\"],\nbody[data-tsnet-skin] [role=\"menu\"],\nbody[data-tsnet-skin] [role=\"listbox\"] {\n  background-color: var(--sk-paper);\n  border-radius: 2px;\n  /* 发丝线与投影都走 box-shadow：不改 border 宽度 ⇒ 容器内元素一行都不位移 */\n  box-shadow: 0 0 0 1px var(--sk-paper-line), var(--sk-shadow);\n  color: var(--sk-paper-ink);\n  /* 纸面作用域内令牌换档：浮层里的控件吃这组值，不必逐个改组件 */\n  --dsw-alias-label-primary: #10262e;\n  --dsw-alias-label-primary-bluish: #0d3a4a;\n  --dsw-alias-label-primary-dimmed: #3c5560;\n  --dsw-alias-label-primary-foreground: #10262e;\n  --dsw-alias-label-secondary: #3c5560;\n  --dsw-alias-label-tertiary: #5b7480;\n  --dsw-alias-label-caption: #5b7480;\n  --dsw-alias-label-dimmed: #9db0b8;\n  --dsw-alias-bg-layer-1: #f2f7f8;\n  --dsw-alias-bg-layer-2: #ecf3f4;\n  --dsw-alias-bg-layer-3: #e4edef;\n  --dsw-alias-bg-overlay: #cfdfe3;\n  --dsw-alias-bg-module-platform: #e4edef;\n  --dsw-alias-button-ghost-active-fill: #d9e6e9;\n  --dsw-alias-button-ghost-active-hover: #cfdfe3;\n  --dsw-alias-button-ghost-active-border: #b9cdd2;\n  --dsw-alias-button-elevated-fill: #ffffff;\n  --dsw-alias-button-floating-fill: #ffffff;\n  --dsw-alias-button-floating-hover: #ecf3f4;\n  --dsw-alias-interactive-bg-hover: #10262e0f;\n  --dsw-alias-interactive-bg-active: #10262e1a;\n  --dsw-alias-interactive-bg-hover-solid: #ecf3f4;\n  --dsw-alias-markdown-inline-code: #e4edef;\n  --dsw-alias-markdown-tag: #e4edef;\n  --dsw-alias-markdown-placeholder: #ecf3f4;\n  --dsw-alias-state-business-tertiary: #d7eaf2;\n  --dsw-alias-border-l1: rgba(16, 42, 51, .10);\n  --dsw-alias-border-l2: rgba(16, 42, 51, .14);\n  --dsw-alias-border-l3: rgba(16, 42, 51, .20);\n  --dsw-specific-selector: #ecf3f4;\n  --dsw-specific-tip: #e4edef;\n  --dsw-static-deepseek-600: #2b87a0;\n  --dsw-static-deepseek-800: #4a6069;\n  --dsw-static-deepseek-900: #3c5560;\n  --dsw-static-neutral-bluish-50: #f2f7f8;\n  --dsw-static-neutral-bluish-75: #e4edef;\n  --dsw-static-neutral-bluish-100: #d9e6e9;\n  --dsw-static-neutral-bluish-150: #cfdfe3;\n  --dsw-static-neutral-bluish-200: #c6d8dc;\n  --dsw-static-neutral-bluish-300: #b9cdd2;\n  --dsw-static-neutral-bluish-500: #7f95a0;\n  --dsw-static-neutral-bluish-600: #5b7480;\n  --dsw-static-neutral-bluish-750: #3c5560;\n  --dsw-static-neutral-bluish-900: #1a272d;\n  --dsw-static-neutral-bluish-950: #10262e;\n}\n/* 选中项：纸面里的浅蓝底（活动块是模块字面色，探针实测不吃令牌 ⇒ 组件层兜底） */\nbody[data-tsnet-skin] [role=\"dialog\"] [class*=\"_navCell\"][class*=\"_acti\"],\nbody[data-tsnet-skin] [role=\"menu\"] [class*=\"_option\"][class*=\"_selected\"],\nbody[data-tsnet-skin] [role=\"menu\"] [aria-selected=\"true\"] {\n  background-color: #d7eaf2;\n  color: #10262e;\n}\n/* 浮层里的条目：等宽数字 + 不用圆角 */\nbody[data-tsnet-skin] [role=\"menu\"] [class*=\"_option\"],\nbody[data-tsnet-skin] [role=\"listbox\"] [role=\"option\"] {\n  border-radius: 0;\n  font-variant-numeric: tabular-nums;\n}\n/* 提示气泡：暗形态给深板（不磨砂，避免在浮层上叠滤镜） */\nbody[data-tsnet-skin][data-ds-dark-theme] [role=\"tooltip\"] {\n  background-color: var(--dsw-alias-tooltip-bg);\n  border-radius: 2px;\n  color: var(--dsw-alias-label-primary);\n}\n\n/* ═══ 4. 全局收尾：焦点环 / 选中色（都不影响几何）═══\n * ★ 这里**刻意不做滚动条配色**：`scrollbar-color` 一旦生效，Chrome 会把滚动条从\"覆盖式\"\n *   换成\"占位式\"，**占掉布局宽度** —— 实测手机形态宽度少约 7px，右对齐的模型弹层整体左移 7px，\n *   被弹层回归量具判 FAIL（`--skin-off --inject` 二分定位：去掉这条即 8/8 PASS）。\n *   教训：滚动条配色**不是**纯外观声明，它可能改布局；白名单里那条已据此收紧（skill §70.1）。\n *   真要配色，只能在\"不参与布局测量\"的元素上做，并且必须跑量具。 */\nbody[data-tsnet-skin] :focus-visible {\n  outline: 2px solid var(--sk-secondary);\n  outline-offset: 2px;\n}\nbody[data-tsnet-skin] ::selection {\n  background: rgba(86, 200, 221, .30);\n}\nbody[data-tsnet-skin]:not([data-ds-dark-theme]) ::selection {\n  background: rgba(15, 111, 159, .22);\n}\n\n/* ═══ 5. 设置行「背景」（tsnbg-*）：自绘行，落在设置对话框的纸面上 ═══\n * 颜色一律用语义令牌（--dsw-alias-label-* 等），因为纸面作用域里这些令牌已经被换过档；\n * 几何克制：只改行内排布，不改设置对话框本身的骨架。 */\n.tsnbg-row {\n  display: flex; flex-direction: column; gap: 8px;\n  padding: 12px 0; border-top: 1px solid var(--dsw-alias-border-l1);\n}\n.tsnbg-head { display: flex; align-items: baseline; gap: 8px; }\n.tsnbg-label { font-size: 13px; color: var(--dsw-alias-label-primary); }\n.tsnbg-note { font-size: 11px; color: var(--dsw-alias-label-caption); }\n.tsnbg-desc { font-size: 11px; color: var(--dsw-alias-label-tertiary); }\n.tsnbg-modes { display: flex; flex-wrap: wrap; gap: 6px; }\n.tsnbg-mode {\n  font: inherit; font-size: 12px; padding: 5px 10px; border-radius: 2px; cursor: pointer;\n  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l1);\n}\n.tsnbg-mode:hover { border-color: var(--sk-secondary); color: var(--dsw-alias-label-primary); }\n.tsnbg-mode.on { color: var(--sk-primary); border-color: var(--sk-primary); background: var(--dsw-alias-bg-layer-3); }\n.tsnbg-sub { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 2px; }\n.tsnbg-line { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--dsw-alias-label-secondary); }\n.tsnbg-range { width: 110px; accent-color: var(--sk-primary); }\n.tsnbg-num { font: 11px/1 var(--ui-monospace, monospace); font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); min-width: 52px; }\n.tsnbg-btn {\n  font: inherit; font-size: 12px; padding: 4px 9px; border-radius: 2px; cursor: pointer;\n  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l1);\n}\n.tsnbg-btn:hover { border-color: var(--sk-secondary); color: var(--dsw-alias-label-primary); }\n.tsnbg-btn.on { color: var(--sk-primary); border-color: var(--sk-primary); }\n.tsnbg-x { border: 0; background: transparent; color: var(--dsw-alias-label-tertiary); cursor: pointer; font-size: 13px; padding: 0 4px; }\n.tsnbg-stops { display: flex; flex-direction: column; gap: 4px; }\n.tsnbg-stop { display: flex; align-items: center; gap: 6px; }\n.tsnbg-stop input[type=\"color\"] { width: 28px; height: 20px; padding: 0; border: 1px solid var(--dsw-alias-border-l1); background: transparent; }\n.tsnbg-thumbs { display: flex; flex-wrap: wrap; gap: 6px; }\n.tsnbg-thumb {\n  width: 54px; height: 34px; object-fit: cover; border-radius: 2px; cursor: pointer;\n  border: 1px solid var(--dsw-alias-border-l1);\n}\n.tsnbg-thumb:hover { border-color: var(--sk-secondary); }\n.tsnbg-thumb.on { border-color: var(--sk-primary); }\n.tsnbg-file { font-size: 11px; color: var(--dsw-alias-label-caption); }\n/* ★ 批 4：`.tsnbg-gal / .tsnbg-crumb / .tsnbg-dirs` 三条已删 —— 它们只服务「服务器图库」那一段，\n   图库按用户要求撤掉后它们就是**死样式**（与 1c 那三条 display:contents 死规则同类，不留）。 */\n.tsnbg-tone { border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 8px; }\n\n/* ═══ 6. 材质（skin v4 批 1，2026-09-28）：四档 × 用户倍率 × 明度 ══════════════════\n * 形制逐字抄中控台 tokens.css 的四档标定值（blur / 透明度基线 / 环境光 / 透射亮度）：\n *   high 34px .38 10% 1.07 · mid 26px .45 8% 1.05 · low 18px .60 5% 1.03 · off 0px .96 0% 1\n * 与中控台的唯一差别：**只有被实验放行的表面才用 backdrop-filter** ——\n *   · 输入卡 `[data-composer-card]`：受控实验 A ⇒ `ui-popover-regression` **8/8 PASS**\n *     （矩形/命中比例/条目数与基线全一致，含 `views-menu` 那条 position:fixed 的弹层）⇒ 放行；\n *   · 侧栏：**不放行**（见 §2 的 UNKNOWN，只走 alpha）；\n *   · 浮层：暂不放行（菜单里可能嵌二级面板，属\"可能包含弹层的祖先\"）。\n * ★ 令牌只在 `body[data-tsnet-skin]` 上声明，运行时也只写 body（§70.3-1：声明处＝赋值处）。 */\nbody[data-tsnet-skin] {\n  --sk-tint-base: rgb(22, 24, 29);\n  --sk-lum-toward: #ffffff;\n  --sk-sat: 132%;\n  --sk-alpha-k: 1;          /* 用户倍率：有效 alpha = 档位基线 × 倍率（声明只有一份，参数不复制） */\n  --sk-lum-k: 0%;           /* 用户明度加值 */\n  --sk-alpha-base: .45;\n  --sk-blur: 26px;\n  --sk-lum: 8%;\n  --sk-bright: 1.05;\n  /* 刻度轨墨色（批 5）：★ 第一版借用了 `--sk-hair`（那是给 1px 发丝线用的 10% 不透明），\n     结果读图发现暗形态下刻度几乎看不见 ⇒ 单独给一族可读的墨色，不再复用发丝线颜色。 */\n  --sk-rail-ink: rgba(163, 219, 235, .52);\n  --sk-rail-ink-hot: rgba(255, 122, 60, .95);\n}\nbody[data-tsnet-skin]:not([data-ds-dark-theme]) {\n  --sk-tint-base: rgb(242, 247, 248);\n  --sk-lum-toward: #000000;   /* 亮形态往黑让一步才叫\"调暗\" */\n  /* 亮形态的刻度墨色：暗青（与亮形态主色同族），否则在青纸底上看不见 */\n  --sk-rail-ink: rgba(16, 42, 51, .50);\n  --sk-rail-ink-hot: rgba(14, 124, 140, .95);\n}\nbody[data-tsnet-skin][data-tsn-glass=\"high\"] { --sk-blur: 34px; --sk-alpha-base: .38; --sk-lum: 10%; --sk-bright: 1.07; }\nbody[data-tsnet-skin][data-tsn-glass=\"mid\"]  { --sk-blur: 26px; --sk-alpha-base: .45; --sk-lum: 8%;  --sk-bright: 1.05; }\nbody[data-tsnet-skin][data-tsn-glass=\"low\"]  { --sk-blur: 18px; --sk-alpha-base: .60; --sk-lum: 5%;  --sk-bright: 1.03; }\nbody[data-tsnet-skin][data-tsn-glass=\"off\"]  { --sk-blur: 0px;  --sk-alpha-base: .96; --sk-lum: 0%;  --sk-bright: 1; }\n/* 派生值：全部在同一个元素（body）上声明 ⇒ var() 在 body 这一层替换，不会出现\"声明处 vs 赋值处\"错位 */\nbody[data-tsnet-skin] {\n  --sk-alpha: calc(var(--sk-alpha-base) * var(--sk-alpha-k));\n  --sk-lum-total: calc(var(--sk-lum) + var(--sk-lum-k));\n  --sk-tint: color-mix(in srgb, var(--sk-tint-base) calc(100% - var(--sk-lum-total)), var(--sk-lum-toward) var(--sk-lum-total));\n  --sk-panel: color-mix(in srgb, var(--sk-tint) calc(var(--sk-alpha) * 100%), transparent);\n}\n/* 输入卡＝唯一放行真磨砂的表面（实验 A 的结论）。发丝线与投影仍走 box-shadow：不改 border 宽度。 */\nbody[data-tsnet-skin] [data-composer-card] {\n  backdrop-filter: blur(var(--sk-blur)) saturate(var(--sk-sat)) brightness(var(--sk-bright));\n  background-color: var(--sk-panel);\n  box-shadow: inset 0 0 0 1px var(--sk-hair), 0 18px 44px rgba(0, 0, 0, .34);\n}\n/* 档位=关：连 blur(0px) 都不要 —— 非 none 的 backdrop-filter 一样会建包含块，\n   而\"关\"这一档的语义是\"与 DSH 默认一模一样\"（可对照、可回退）。 */\nbody[data-tsnet-skin][data-tsn-glass=\"off\"] [data-composer-card] {\n  backdrop-filter: none;\n  background-color: var(--dsw-alias-bg-layer-1);\n  box-shadow: none;\n}\n/* 材质行的自绘子块：复用背景行的 tsnbg-* 语言，不新增第二套样式 */\n.tsnbg-sub {\n  display: flex; flex-direction: column; gap: 6px; padding: 8px 10px;\n  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px;\n}\n\n/* ═══ 批 A2：浮层圆角照 Codex 规格（2px → 10px）；自绘控件同步 ═══\n * 依据：openai/codex 的 `style.rs` 与 `b-nnett/codex-plusplus` 的设置窗口实拍（我读过图）——\n * 卡片 10px、按钮 8px。`border-radius` 在 §70 白名单里（不裁子孙、不改几何），\n * 但仍照纪律跑了弹层量具（几何回归）后才提交。 */\nbody[data-tsnet-skin] [class*=\"dshwv-menu\"],\nbody[data-tsnet-skin] .tsnbg-sub,\nbody[data-tsnet-skin] .tsnbg-mode,\nbody[data-tsnet-skin] .tsnbg-btn {\n  border-radius: 10px;\n}\n\n/* ═══ 批 A4：照片档下占位符差一点（实测 4.14:1 vs 门槛 4.5）⇒ 最小必要提升 ═══\n * 判据：`tools\\skin-contrast.mjs`（官方 MIN_TEXT_CONTRAST = 4.5）。\n * 记录两次迭代（探针修好后）：无改动 4.14:1（FAIL，差 0.36）→ 本改动后再测（目标 5–6.5，留余量）。\n * ★ 中途教训：我第一版抬到 `label-primary 78%` ⇒ 14.68:1，**远超需要**（观感上会发白）；\n *   剂量由判据收敛，不靠手感。 */\nbody[data-tsnet-skin][data-tsn-bg] ::placeholder {\n  color: color-mix(in srgb, var(--dsw-alias-label-secondary) 80%, transparent);\n}\n\n/* ═══ 批 A3：缓动族与 reduced-motion（Codex 规格）═══════════════════════════════════\n * 依据（取证报告 §2）：参照物的动效差异**不在时长**（.16s/.12s 本就相近），而在\"有没有收尾\"——\n * 它们统一用 `cubic-bezier(.16,1,.3,1)`（进场）与 `(.22,1,.36,1)`（形变），三家独立一致。\n * 本批把这两条曲线做成**单一来源令牌**（声明在 body，与其它皮肤令牌同一处；自定义属性会继承进\n * 刻度轨的 Shadow DOM ⇒ rail 也吃同一份，不再是\"JS 写死一份、CSS 再写一份\"）。\n * 同时补 `prefers-reduced-motion` 覆盖 —— 无障碍要求，改前皮肤一条都没有。\n * 只覆盖**我们自己的**选择器，不动 DSH 自身的动效（§70 白名单）。 */\nbody[data-tsnet-skin] {\n  --sk-ease: cubic-bezier(.16, 1, .3, 1);        /* 进场 / 淡入 */\n  --sk-ease-soft: cubic-bezier(.22, 1, .36, 1);  /* 形变 / 宽度 */\n  --sk-dur: .16s;\n  --sk-dur-fast: .12s;\n}\nbody[data-tsnet-skin] .tsnbg-btn,\nbody[data-tsnet-skin] .tsnbg-mode,\nbody[data-tsnet-skin] .tsnbg-sub {\n  transition: background-color var(--sk-dur-fast) var(--sk-ease),\n              color var(--sk-dur-fast) var(--sk-ease),\n              border-color var(--sk-dur-fast) var(--sk-ease),\n              opacity var(--sk-dur-fast) var(--sk-ease);\n}\n@media (prefers-reduced-motion: reduce) {\n  body[data-tsnet-skin] .tsnbg-btn,\n  body[data-tsnet-skin] .tsnbg-mode,\n  body[data-tsnet-skin] .tsnbg-sub {\n    transition: none !important;\n    animation: none !important;\n  }\n}\n\n/* ═══ 批 A7：皮肤自己控件的手机形态判据（J4 触控 ≥44）═══════════════════════════════\n * 判据（`tools\\skin-form.mjs`）实测到的真缺陷：手机上\n *   · 背景档按钮 53×26px   · 背景模式块 53×28px   （材质/刻度子块 53×53 本就合格）\n * 修法：**不可见命中层**（`::after`）把命中区补到 44 高 —— **不改 padding / 不写死宽高**，\n * 所以不产生布局位移（白名单里\"内边距\"算越界，这条不算）。\n * 形态标记 `body[data-tsn-form]` 由 `rail-engine.js` 的 `isMobileForm()` **单一来源**写入\n * （DSH 外壳没有形态标记，实测）——不在 CSS 里另写一套媒体查询断点（skill §1③）。 */\nbody[data-tsnet-skin][data-tsn-form=\"mobile\"] .tsnbg-btn,\nbody[data-tsnet-skin][data-tsn-form=\"mobile\"] .tsnbg-mode {\n  position: relative;\n}\nbody[data-tsnet-skin][data-tsn-form=\"mobile\"] .tsnbg-btn::after,\nbody[data-tsnet-skin][data-tsn-form=\"mobile\"] .tsnbg-mode::after {\n  content: \"\";\n  position: absolute; left: 0; right: 0; top: 50%;\n  height: 44px; min-width: 44px;\n  transform: translateY(-50%);\n}\n\n";
    /*__TSNET_CSS_END__*/

    /*__TSNET_BG_START__*/
    /* lib/bg-engine.js —— 背景引擎 + DSH 设置行（手写源；由 build.mjs 内联进 lib/client.js）
 *
 * 复用中控台那一套（出处：public\assets\js\ui\shell2.js）
 *   · 档位：BGS 七档（网格/纯色/暖光/拉丝/实景/自定义/图片），id 与名称逐字对齐；
 *   · 图片档：**样品**（工作区 public\assets\img\bg\，随皮肤配置、未内联）＋ **本地图片**（只从本机选，
 *     缩到 1600px 存 dataURL）＋ 模糊度/暗化。
 *     ★ 2026-09-28 批 4（用户要求「选图片不能从服务器库，只能从本地选」）：原「服务器图库」
 *       （浏览 `files\图片`、点图即用，走 folder-tree-sh 的 /dsh-ftree-* 路由）**已整段撤除** ——
 *       连带删掉 `api.browse`、`S.gallery` 状态与 `.tsnbg-gal/.tsnbg-crumb/.tsnbg-dirs` 三条死样式。
 *       ★ 仍未改的同类项（如实登记，不假装已改）：**实景档** `pickMedia` 仍从 `files\图片` 随机取图 ——
 *       那是"背景模式自动取图"，不是"用户选图"；要不要一起改成本地，见 README 的已知边界。
 *   · 色调引擎：由背景求主色相 → 派生低饱和色阶（自动档），采不到就**不假装**（保留形态色并说明原因）。
 *
 * 纪律（tsnet-ui-engineering §70）：
 *   · 背景只画在 `body::before`（图/渐变）/ `body::after`（暗化）两个**伪元素**上 —— 它们没有子节点，
 *     不是任何弹层的祖先，因此这里用 filter/transform 是安全的（禁令针对的是"可能包含弹层的祖先"）；
 *   · 不改任何容器几何、不裁剪任何容器；
 *   · 不碰 DSH 自己的设置存储：偏好写在本插件自己的 localStorage 键里（前缀 tsnetSkin.）。
 *
 * 落点：DSH 设置 → 常规 里的一行（slot `settings.general.item`，与"外观/语言"同级）。
 */
function installBackgroundFeature(opts) {
  var react = opts.react;
  /* ── 数据面：复用已加载插件 folder-tree-sh 的宿主读取路由 ────────────────
   * 为什么不自己开路由：DSH 的 **bundles 列表只在启动时读一次**（实测：改 package.json 的
   * dsh.profile.bundles 后路由仍 404），主机半要重启 DSH 才会加载 —— 而本会话就跑在 DSH 进程里，
   * 不能重启。folder-tree-sh 已在 bundles 里、正在运行，且 `role=webServer` 上暴露了
   * `/dsh-ftree-list`（列目录）与 `/dsh-ftree-raw`（读字节，实测 image/png 200，同源免令牌）⇒ 直接复用。
   * 根路径不硬编码：由 build.mjs 从**插件自身位置**推导后烘进这里（与 fleet D2 同精神）。
   * 若哪天这些路由不在（插件被停用），下面的探测会如实报错，**不假装成功**。 */
  var FT = '/dsh-ftree-';
  var FT_ROOT = "";
  var DIR_SAMPLES = FT_ROOT + '/public/assets/img/bg';
  var DIR_GALLERY = FT_ROOT + '/files/图片';   // ★ 批 4 后**只剩一个用处**：实景档 pickMedia 随机取图（不是"用户选图"）
  var LS = {
    mode: 'tsnetSkin.bg',
    image: 'tsnetSkin.bg.image',
    custom: 'tsnetSkin.bg.custom',
    accent: 'tsnetSkin.accent',
  };
  var DEFAULT_IMAGE = { src: '', blur: 18, dim: 0.34 };          // 与中控台 DEFAULT_IMAGE 同参数
  var DEFAULT_CUSTOM = { angle: 135, stops: [{ pos: 0, color: '#ffa63d' }, { pos: 52, color: '#4aabea' }, { pos: 100, color: '#0d1013' }] };
  // 兜底档位清单（正常情况从 /list 取，单一来源仍是中控台那次扫描）
  var MODES_FALLBACK = [
    { id: 'grid', name: '网格 · 战术台', desc: '细网格 + 斜向排线（控制台默认档）' },
    { id: 'plain', name: '纯色 · 无结构', desc: '对照档：没有结构，磨砂就看不出来' },
    { id: 'dawn', name: '暖光 · 地平线', desc: '暖色光晕，检验暖底上的冷调面板' },
    { id: 'steel', name: '拉丝 · 金属', desc: '斜向拉丝，检验细条纹透过磨砂' },
    { id: 'media', name: '实景 · 相册图', desc: '站内真实图片当背景（最能看出亚克力）' },
    { id: 'custom', name: '自定义 · 渐变', desc: '点位与各点颜色自己配（在本行里编辑）' },
    /* ★ 批 4：原名「图片 · 上传或图库」—— 图库按用户要求撤掉后，这个名字本身就是假话，
       连同 desc 一起改成实际能力（样品随皮肤配置 + 只能从本机选图）。 */
    { id: 'image', name: '图片 · 本地', desc: '用图片当背景：样品（随皮肤配置）+ 本机选的图，模糊/暗化可调' },
  ];

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, String(v));
      // ★ 每次本地改动都盖时间戳：rev 是"哪边更新"的唯一判据。
      //   第一版漏了这一行 ⇒ rev 恒为 0 ⇒ 服务端偏好永远"不比本地新" ⇒ 跨入口共享事实上没生效
      //   （实测：note 写"已同步"，但远程入口仍是默认档）。教训：同步机制必须有自己的证据，
      //   不能只看"我调用了同步函数"。
      localStorage.setItem(REV_KEY, String(Date.now()));
    } catch (e) { /* 隐私模式等，忽略 */ }
    scheduleSyncPrefs();
  }
  function lsJson(k, d) { try { var raw = localStorage.getItem(k); if (!raw) return d; var o = JSON.parse(raw); return o || d; } catch (e) { return d; } }

  /* ── 偏好跨入口共享（2026-09-29 用户实测反馈："我在远程端口登录皮肤发现背景还有重新设置"）──
     localStorage 按**源**隔离 ⇒ 在 127.0.0.1:3080 设好的背景，用 tailnet 域名进来时又是默认。
     修法：把 `tsnetSkin.*` 整体存到**服务器侧**一个文件，任何入口读同一份。
     写走 `/dsh-ftree-write`（需令牌，取自 `/dsh-ftree-token`）、读走 `/dsh-ftree-read`；
     落点 `<工作区>/.local/skin-prefs.json`（该目录不进版本库，也不经 web 静态服务直出）。
     两边都带 rev（毫秒），**新的赢** —— 断网时本地改动不会被旧的服务端值吃掉。 */
  var PREFIX = 'tsnetSkin.';
  var PREFS_FILE = FT_ROOT + '/.local/skin-prefs.json';
  var REV_KEY = 'tsnetSkin.__rev';
  var CACHE_KEY = 'tsnetSkin.__cache';           // 最近一次整包（新入口首屏秒用，不必等网络）
  var BIG_LIMIT = 512 * 1024;                    // 超长值（通常是上传图 dataURL）只留本机，并在备注里写明
  var FT_TOKEN = '';
  var syncTimer = null;

  function localRev() { var v = Number(lsGet(REV_KEY, '0')); return isFinite(v) ? v : 0; }
  function collectPrefs() {
    var o = { __rev: localRev(), __skipped: [] };
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf(PREFIX) !== 0) continue;
        if (k === REV_KEY || k === CACHE_KEY) continue;
        var v = localStorage.getItem(k);
        if (v === null) continue;
        if (v.length > BIG_LIMIT) { o.__skipped.push(k); continue; }
        o[k] = v;
      }
    } catch (e) { /* 忽略 */ }
    return o;
  }
  function applyPrefs(o) {
    if (!o || typeof o !== 'object') return false;
    var changed = false;
    Object.keys(o).forEach(function (k) {
      if (k.indexOf(PREFIX) !== 0) return;
      try { if (localStorage.getItem(k) !== o[k]) { localStorage.setItem(k, o[k]); changed = true; } } catch (e) {}
    });
    return changed;
  }
  function scheduleSyncPrefs() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(pushPrefs, 500);
  }
  function pushPrefs() {
    var body = collectPrefs();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(body)); } catch (e) {}
    if (!FT_TOKEN) return;
    try {
      fetch(FT + 'write?path=' + encodeURIComponent(PREFS_FILE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: FT_TOKEN, content: JSON.stringify(body) }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        S.prefsNote = (d && d.ok) ? '偏好已同步到服务器（各入口一致）' : ('偏好同步失败：' + ((d && d.error) || '未知') + '（只在本入口生效）');
        if (S.onPrefsChange) S.onPrefsChange();
      }).catch(function (e) {
        S.prefsNote = '偏好同步失败：' + String((e && e.message) || e) + '（只在本入口生效）';
        if (S.onPrefsChange) S.onPrefsChange();
      });
    } catch (e) { /* 忽略 */ }
  }
  /** 从服务器取偏好；服务端更新则采用它，否则把本地推上去 */
  function loadServerPrefs() {
    return fetch(FT + 'read?path=' + encodeURIComponent(PREFS_FILE)).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok || typeof d.text !== 'string') return false;
      var server = null;
      try { server = JSON.parse(d.text); } catch (e) { return false; }
      if (!server || typeof server !== 'object') return false;
      var srev = Number(server.__rev) || 0;
      if (srev <= localRev()) { pushPrefs(); return false; }     // 本地更新 ⇒ 以本地为准并推上去
      applyPrefs(server);
      S.mode = lsGet(LS.mode, S.mode);
      S.image = lsJson(LS.image, S.image);
      S.custom = lsJson(LS.custom, S.custom);
      S.accent = lsGet(LS.accent, S.accent);
      applyBackground();
      applyMaterial();
      try { window.dispatchEvent(new CustomEvent('tsnet-prefs')); } catch (e) {}
      S.prefsNote = '已采用服务器上保存的偏好（来自另一个入口）';
      if (S.onPrefsChange) S.onPrefsChange();
      return true;
    }).catch(function () { return false; });
  }

  /* ── 状态 ─────────────────────────────────────────────────────────── */
  var S = {
    modes: MODES_FALLBACK,
    samples: [],
    mode: lsGet(LS.mode, 'grid'),
    image: lsJson(LS.image, DEFAULT_IMAGE),
    custom: lsJson(LS.custom, DEFAULT_CUSTOM),
    accent: lsGet(LS.accent, 'bg'),                  // 'bg' = 跟随背景 | 'form' = 按形态
    tone: null,                                      // { h, s } 或 null
    toneNote: '',
    dataNote: '',                                    // 数据面的如实报错（读不到就写在这里，不假装）
    mediaPicked: '',                                 // 实景档当前用的图（dataURL 或 ftree raw URL）
    folder: [],                                      // 批 6：从文件夹导入的图片（内存里的 File + blob 缩略图）
    /* ★ 批 4：原来的 `gallery`（服务器图库的目录/图片列表）状态**已删** —— 图库整段撤掉，图片只能从本机选。 */
  };

  /* ── 颜色工具（与中控台同族：hex → hsl；派生低饱和色阶）───────────── */
  function rgbOf(hexStr) {
    var v = String(hexStr || '').replace('#', '');
    var f = v.length === 3 ? v.split('').map(function (c) { return c + c; }).join('') : v;
    if (f.length !== 6) return null;
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  }
  function hslOf(rgb) {
    var R = rgb[0] / 255, G = rgb[1] / 255, B = rgb[2] / 255;
    var mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
    var l = (mx + mn) / 2;
    var s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    var h = 0;
    if (d !== 0) { if (mx === R) h = 60 * (((G - B) / d) % 6); else if (mx === G) h = 60 * ((B - R) / d + 2); else h = 60 * ((R - G) / d + 4); }
    return { h: (h + 360) % 360, s: s, l: l };
  }
  function hslToRgb(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  var rgbCss = function (a) { return 'rgb(' + a.join(',') + ')'; };

  /* ── 主色相采样：渐变按点位区间加权；图片按缩图取样（同中控台口径：S≥15% 且亮度中区）── */
  function toneFromGradient(cfg) {
    var stops = ((cfg && cfg.stops) || []).slice().sort(function (a, b) { return a.pos - b.pos; });
    if (!stops.length) return null;
    var acc = [0, 0, 0], wsum = 0;
    stops.forEach(function (st, i) {
      var next = stops[i + 1];
      var w = next ? Math.max(1, next.pos - st.pos) : 12;
      var rgb = rgbOf(st.color);
      if (!rgb) return;
      var hsl = hslOf(rgb);
      if (hsl.s < 0.15 || hsl.l < 0.10 || hsl.l > 0.92) return;   // 与中控台同一条：彩度不足或近黑近白的不算
      acc[0] += rgb[0] * w; acc[1] += rgb[1] * w; acc[2] += rgb[2] * w; wsum += w;
    });
    if (!wsum) return null;
    var avg = [acc[0] / wsum, acc[1] / wsum, acc[2] / wsum].map(Math.round);
    var h2 = hslOf(avg);
    return { h: h2.h, s: h2.s };
  }
  function toneFromImage(src, cb) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var W = 24, H = 24;
        var cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        var cx = cv.getContext('2d');
        cx.drawImage(img, 0, 0, W, H);
        var d = cx.getImageData(0, 0, W, H).data;
        var acc = [0, 0, 0], wsum = 0, n = 0;
        for (var i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 200) continue;
          var hsl = hslOf([d[i], d[i + 1], d[i + 2]]);
          n++;
          if (hsl.s < 0.15 || hsl.l < 0.10 || hsl.l > 0.92) continue;
          var w = hsl.s;                       // 越饱和权重越大
          acc[0] += d[i] * w; acc[1] += d[i + 1] * w; acc[2] += d[i + 2] * w; wsum += w;
        }
        if (!wsum) { cb(null, n ? '背景里没有足够彩度（S≥15% 且亮度中区）的样本' : '图片没取到像素'); return; }
        var avg = [acc[0] / wsum, acc[1] / wsum, acc[2] / wsum].map(Math.round);
        cb(hslOf(avg), '');
      } catch (e) { cb(null, '取色失败：' + String((e && e.message) || e)); }
    };
    img.onerror = function () { cb(null, '图片加载失败（取不到像素）'); };
    img.src = src;
  }

  /* ── 应用：档位 → CSS 变量（只写 html 上的变量与 data 属性）────────── */
  function layerFor(mode) {
    if (mode === 'plain') return 'none';
    if (mode === 'grid') {
      return 'repeating-linear-gradient(0deg, var(--tsn-grid) 0 1px, transparent 1px 48px),'
        + 'repeating-linear-gradient(90deg, var(--tsn-grid) 0 1px, transparent 1px 48px),'
        + 'repeating-linear-gradient(115deg, rgba(163,219,235,.016) 0 2px, transparent 2px 7px)';
    }
    if (mode === 'dawn') {
      return 'radial-gradient(1200px 620px at 78% 100%, var(--tsn-glow-warm), transparent 64%),'
        + 'radial-gradient(900px 420px at 12% 0%, var(--tsn-glow-cool), transparent 62%)';
    }
    if (mode === 'steel') {
      return 'repeating-linear-gradient(115deg, rgba(163,219,235,.030) 0 2px, transparent 2px 5px),'
        + 'linear-gradient(160deg, rgba(255,255,255,.020), transparent 60%)';
    }
    if (mode === 'custom') return gradCss(S.custom);
    if (mode === 'image') return S.image && S.image.src ? 'url("' + S.image.src + '")' : 'none';
    if (mode === 'media') return S.mediaPicked ? 'url("' + S.mediaPicked + '")' : 'none';
    return 'none';
  }
  function gradCss(c) {
    var cfg = c && c.stops && c.stops.length >= 2 ? c : DEFAULT_CUSTOM;
    var stops = cfg.stops.slice().sort(function (a, b) { return a.pos - b.pos; })
      .map(function (s) { return s.color + ' ' + Math.round(s.pos) + '%'; });
    return 'linear-gradient(' + Math.round(cfg.angle || 0) + 'deg, ' + stops.join(', ') + ')';
  }

  /** 自检：背景到底有没有露出来？被不透明的大块元素盖住就如实报出来（不假装成功）。
   *  只在大面积（>40% 视口）且不透明的容器里找，跳过弹层自身。 */
  function checkVisible() {
    try {
      if (S.mode === 'plain') { S.visibleNote = ''; return; }   // 纯色档本来就没有结构，不适用
      var vpArea = window.innerWidth * window.innerHeight;
      var bad = [];
      var nodes = document.querySelectorAll('div');
      for (var i = 0; i < nodes.length; i++) {
        var e = nodes[i];
        if (e.closest('[role="dialog"],[role="menu"],[role="listbox"]')) continue;
        var r = e.getBoundingClientRect();
        if (r.width * r.height < vpArea * 0.4) continue;
        var cs = getComputedStyle(e);
        var bg = cs.backgroundColor;
        if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
        var m = /rgba?\(([^)]+)\)/.exec(bg);
        var alpha = 1;
        if (m) { var parts = m[1].split(','); if (parts.length === 4) alpha = parseFloat(parts[3]); }
        else if (bg.indexOf('color(') === 0 && bg.indexOf('/') !== -1) {
          alpha = parseFloat(bg.slice(bg.lastIndexOf('/') + 1).replace(')', '')) || 1;
        }
        if (alpha > 0.3) bad.push((String(e.className || e.tagName)).slice(0, 34) + '（α' + alpha.toFixed(2) + '）');
      }
      S.visibleNote = bad.length ? ('背景被这些不透明面板挡住了：' + bad.slice(0, 3).join('、')) : '';
    } catch (e) { S.visibleNote = ''; }
  }

  function applyBackground() {
    /* ★ 一律写在 **body** 上：皮肤令牌（--tsn-grid / --tsn-glow-* / --sk-*）都声明在
       body[data-tsnet-skin] 上，而自定义属性的 var() 替换发生在**声明处**、随后按计算值继承。
       我第一版把 --tsn-bg-layer 写在 html 上 ⇒ 里面的 var(--tsn-grid) 在 html 处无法替换
       ⇒ 整条 background-image 失效、场根本画不出来（实测：body::before 只剩噪点那层）。 */
    var root = document.body;
    if (!root) return;
    root.dataset.tsnBg = S.mode;
    root.style.setProperty('--tsn-bg-layer', layerFor(S.mode));
    var isImg = S.mode === 'image' || S.mode === 'media';
    var blur = isImg ? Number((S.image && S.image.blur) || 0) : 0;
    var dim = isImg ? Number((S.image && S.image.dim) || 0) : 0;
    root.style.setProperty('--tsn-bg-blur', blur + 'px');
    root.style.setProperty('--tsn-bg-dim', String(dim));
    root.style.setProperty('--tsn-bg-scale', blur > 0 ? '1.08' : '1');
    // 主色：跟随背景 or 按形态
    if (S.accent === 'form') { clearAccent('按形态（暗橙 / 亮深青）'); return; }
    if (S.mode === 'custom') {
      var t = toneFromGradient(S.custom);
      if (t) applyAccent(t.h, t.s, '渐变主色相'); else clearAccent('渐变里没有足够彩度的样本');
      return;
    }
    if (isImg) {
      var src = S.mode === 'image' ? (S.image && S.image.src) : S.mediaPicked;
      if (!src) { clearAccent('还没选图'); return; }
      toneFromImage(src, function (t, why) {
        if (t) applyAccent(t.h, t.s, '背景图主色相'); else clearAccent(why || '取不到彩度');
      });
      return;
    }
    if (S.mode === 'dawn') { applyAccent(28, 0.55, '暖光档固定暖色相'); return; }
    clearAccent('这一档没有彩度（网格/纯色/拉丝）');
  }

  /** 派生低饱和一族并写进皮肤令牌（单一来源仍是 skin.css 的声明；这里只写运行时值） */
  function applyAccent(h, s, why) {
    var root = document.body;   // 与 applyBackground 同理：令牌声明在 body，覆盖也必须写 body
    var H = ((h % 360) + 360) % 360;
    var S2 = Math.max(0, Math.min(1, s == null ? 0.32 : s));
    /* ★ 批 11（A5）：**彩度不足就不采**，绝不把饱和硬抬起来造色。
       实测（2026-09-29）：落日照片采样出 `h=260 s=3%`（几乎无色），而旧公式把饱和
       `max(.45, s+0.25)` 硬抬到 45% ⇒ 凭空造出一个**紫色**，刻度和主色都变成照片上根本没有的颜色
       （用户原话："主色跟随主题色调啊，为什么要写硬编码？"——跟随的前提是**主题真的有那个色**）。
       与中控台原口径一致：'背景里没有足够彩度（S≥15% 且亮度中区）的样本' 时保留形态色并说明原因。 */
    if (S2 < 0.12) { clearAccent((why ? why + '：' : '') + '彩度只有 ' + Math.round(S2 * 100) + '%（<12%），不采色、保留形态色'); return; }
    var primary = hslToRgb(H, Math.min(0.78, Math.max(0.45, S2 + 0.25)), 0.56);
    var secondary = hslToRgb((H + 28) % 360, Math.min(0.62, Math.max(0.34, S2 + 0.10)), 0.60);
    root.style.setProperty('--sk-primary', rgbCss(primary));
    root.style.setProperty('--sk-primary-ink', hslOf(primary).l > 0.5 ? '#100602' : '#ffffff');
    root.style.setProperty('--sk-secondary', rgbCss(secondary));
    root.style.setProperty('--sk-hair', 'hsla(' + Math.round(H) + ' ' + Math.round(Math.min(24, S2 * 42)) + '% 88% / .10)');
    root.style.setProperty('--sk-hair-2', 'hsla(' + Math.round(H) + ' ' + Math.round(Math.min(24, S2 * 42)) + '% 88% / .06)');
    S.tone = { h: Math.round(H), s: Math.round(S2 * 100) };
    S.toneNote = why;
  }
  function clearAccent(why) {
    var root = document.body;
    ['--sk-primary', '--sk-primary-ink', '--sk-secondary', '--sk-hair', '--sk-hair-2'].forEach(function (k) { root.style.removeProperty(k); });
    S.tone = null;
    S.toneNote = why;
  }

  /* ── 数据：档位/样品图清单（样品图**扫目录**派生；读不到就如实说，不假装）──── */
  var IMG_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.bmp'];
  function isImg(name) {
    var n = String(name || '').toLowerCase();
    return IMG_EXT.some(function (e) { return n.slice(-e.length) === e; });
  }
  function ftList(absPath) {
    return fetch(FT + 'list?path=' + encodeURIComponent(absPath)).then(function (r) {
      if (!r.ok) throw new Error('列目录返回 ' + r.status);
      return r.json();
    }).then(function (d) {
      if (d && d.error) throw new Error(d.error);
      return d || { entries: [] };
    });
  }
  function ftRawUrl(absPath) { return FT + 'raw?path=' + encodeURIComponent(absPath); }

  function loadSamples() {
    return ftList(DIR_SAMPLES).then(function (d) {
      S.samples = (d.entries || []).filter(function (e) {
        return e.kind === 'file' && isImg(e.name);
      }).map(function (e) {
        return { file: e.name, kb: Math.round((e.size || 0) / 1024), path: e.path, url: ftRawUrl(e.path) };
      });
      S.dataNote = S.samples.length ? '' : '样品图目录是空的（' + DIR_SAMPLES + '）';
      return S.samples;
    }).catch(function (e) {
      S.samples = [];
      S.dataNote = '读不到样品图：' + String((e && e.message) || e) + '（图片档仍可上传本地图片）';
      return [];
    });
  }

  /* ── 设置行 UI（自绘；类名 tsnbg-*，样式在 skin.css）────────────────── */
  function el(tag, props) {
    var kids = Array.prototype.slice.call(arguments, 2);
    var p = props || {};
    if (p.style) { p = Object.assign({}, p, { style: p.style }); }
    return react.createElement.apply(null, [tag, p].concat(kids));
  }

  function ModeButtons(state, onPick) {
    return el('div', { className: 'tsnbg-modes' },
      S.modes.map(function (m) {
        return el('button', {
          key: m.id, type: 'button', title: m.desc,
          className: 'tsnbg-mode' + (state.mode === m.id ? ' on' : ''),
          onClick: function () { onPick(m.id); },
        }, m.name);
      })
    );
  }

  function CustomEditor(state, onChange) {
    var cfg = state.custom;
    var setStop = function (i, patch) {
      var stops = cfg.stops.slice();
      stops[i] = Object.assign({}, stops[i], patch);
      onChange({ angle: cfg.angle, stops: stops });
    };
    return el('div', { className: 'tsnbg-sub' },
      el('label', { className: 'tsnbg-line' }, '角度',
        el('input', {
          type: 'range', min: 0, max: 360, value: cfg.angle, className: 'tsnbg-range',
          onChange: function (e) { onChange({ angle: Number(e.target.value), stops: cfg.stops }); },
        }),
        el('b', { className: 'tsnbg-num' }, String(Math.round(cfg.angle)) + '°')
      ),
      el('div', { className: 'tsnbg-stops' }, cfg.stops.map(function (st, i) {
        return el('span', { key: 'st' + i, className: 'tsnbg-stop' },
          el('input', { type: 'color', value: st.color, onChange: function (e) { setStop(i, { color: e.target.value }); } }),
          el('input', {
            type: 'range', min: 0, max: 100, value: st.pos, className: 'tsnbg-range',
            onChange: function (e) { setStop(i, { pos: Number(e.target.value) }); },
          }),
          el('b', { className: 'tsnbg-num' }, String(Math.round(st.pos)) + '%'),
          cfg.stops.length > 2 ? el('button', {
            type: 'button', className: 'tsnbg-x', title: '删掉这个停点',
            onClick: function () { onChange({ angle: cfg.angle, stops: cfg.stops.filter(function (_, j) { return j !== i; }) }); },
          }, '×') : null
        );
      })),
      el('button', {
        type: 'button', className: 'tsnbg-btn',
        onClick: function () {
          var stops = cfg.stops.slice();
          stops.push({ pos: 100, color: '#4aabea' });
          onChange({ angle: cfg.angle, stops: stops });
        },
      }, '＋ 加一个停点'),
      el('span', { className: 'tsnbg-note' }, '改动实时生效并记住（与中控台同一手感）')
    );
  }

  function ImagePanel(state, api) {
    var img = state.image || DEFAULT_IMAGE;
    return el('div', { className: 'tsnbg-sub' },
      el('div', { className: 'tsnbg-line' }, '样品',
        /* ★ 标签必须说真话：这批样品是**从工作区读**的（`public\assets\img\bg`，2.1 MB，
           Node 侧零依赖做不了缩图 ⇒ 内联不现实）。用户原话想要"随插件自带"的标签，
           但实测它们并不随插件走 ⇒ 这里按实际来源写明，不写假话（§7.2/§8.3）。 */
        el('span', { className: 'tsnbg-note' }, '随皮肤配置（工作区 public/assets/img/bg）'),
        state.samples.length
          ? el('span', { className: 'tsnbg-thumbs' }, state.samples.map(function (s) {
            return el('img', {
              key: s.file, src: s.url, title: s.file + '（' + s.kb + ' KB）',
              className: 'tsnbg-thumb' + (img.src === s.url ? ' on' : ''),
              onClick: function () { api.setImage({ src: s.url }); },
            });
          }))
          : el('span', { className: 'tsnbg-note' }, state.dataNote || '（样品目录是空的）')
      ),
      /* ★ 2026-09-28 批 4（用户要求「选图片不能从服务器库，**只能从本地选**」）：
         这一段原来是「服务器图库」——浏览 `files\图片`、点图即用、还有目录面包屑与 60 张缩略图网格
         （走 folder-tree-sh 的 `/dsh-ftree-*` 路由）。**整段已撤**。
         现在图片档只有两个来源：① 上面那排**样品**（随皮肤配置，位置在界面上如实写明）
         ② **本机选的文件**（下面这一行，唯一的"选图"入口）。
         顺带收益：少一条对别的插件的路由依赖（那个插件一改我们就坏）。 */
      el('div', { className: 'tsnbg-line' }, '本地图片',
        el('input', {
          type: 'file', accept: 'image/*', className: 'tsnbg-file',
          onChange: function (e) { var f = e.target.files && e.target.files[0]; if (f) api.upload(f); },
        }),
        el('span', { className: 'tsnbg-note' }, '只从本机选（缩到 1600px 内再存，与中控台同做法；不上传任何地方）')
      ),
      /* 批 6：文件夹导入（用户澄清的做法）—— 一个文件夹里的图片一次列出来，点一张即用 */
      el('div', { className: 'tsnbg-line' }, '导入文件夹',
        el('input', {
          type: 'file', className: 'tsnbg-file', multiple: true,
          webkitdirectory: '', directory: '',
          onChange: function (e) { api.loadFolder(e.target.files); },
        }),
        el('span', { className: 'tsnbg-note' }, '把文件夹里的图片列成缩略图，点一张即用（只在本机读，不上传）')
      ),
      state.folder && state.folder.length ? el('div', { className: 'tsnbg-thumbs' }, state.folder.map(function (f) {
        return el('img', {
          key: f.name + '|' + f.kb, src: f.url, title: f.name + '（' + f.kb + ' KB）',
          className: 'tsnbg-thumb',
          onClick: function () { api.upload(f.file); },
        });
      })) : null,
      el('div', { className: 'tsnbg-line' }, '模糊',
        el('input', {
          type: 'range', min: 0, max: 40, value: img.blur, className: 'tsnbg-range',
          onChange: function (e) { api.setImage({ blur: Number(e.target.value) }); },
        }), el('b', { className: 'tsnbg-num' }, String(img.blur) + 'px')
      ),
      el('div', { className: 'tsnbg-line' }, '暗化',
        el('input', {
          type: 'range', min: 0, max: 80, value: Math.round((img.dim || 0) * 100), className: 'tsnbg-range',
          onChange: function (e) { api.setImage({ dim: Number(e.target.value) / 100 }); },
        }), el('b', { className: 'tsnbg-num' }, String(Math.round((img.dim || 0) * 100)) + '%')
      )
    );
  }

  function MediaPanel(state, api) {
    return el('div', { className: 'tsnbg-sub' },
      el('div', { className: 'tsnbg-line' },
        el('button', { type: 'button', className: 'tsnbg-btn', onClick: function () { api.pickMedia(); } }, '从相册取一张'),
        el('span', { className: 'tsnbg-note' }, state.mediaPicked ? '已在用一张相册图（每次点会换一张）' : '还没取图（取不到会自动退回网格档，不假装）')
      ),
      el('div', { className: 'tsnbg-line' }, '模糊',
        el('input', {
          type: 'range', min: 0, max: 40, value: state.image.blur, className: 'tsnbg-range',
          onChange: function (e) { api.setImage({ blur: Number(e.target.value) }); },
        }), el('b', { className: 'tsnbg-num' }, String(state.image.blur) + 'px')
      )
    );
  }

  function BackgroundRow() {
    var s = react.useState(0);
    var tick = s[0], bump = s[1];
    var rerender = function () { bump(function (n) { return n + 1; }); };
    react.useEffect(function () {
      var off = subscribe(rerender);
      S.onPrefsChange = rerender;                      // 同步结果（成功/失败）要能刷到界面上
      if (!S.samples.length) loadSamples().then(function () { rerender(); });
      return function () { off(); if (S.onPrefsChange === rerender) S.onPrefsChange = null; };
    }, []);
    var cur = S.modes.filter(function (m) { return m.id === S.mode; })[0] || S.modes[0];
    var api = {
      setImage: function (patch) {
        S.image = Object.assign({}, S.image, patch);
        lsSet(LS.image, JSON.stringify(S.image));
        applyBackground(); rerender();
      },
      upload: function (file) {
        var fr = new FileReader();
        fr.onload = function () {
          var im = new Image();
          im.onload = function () {
            var max = 1600;
            var scale = Math.min(1, max / Math.max(im.width, im.height));
            var cv = document.createElement('canvas');
            cv.width = Math.round(im.width * scale); cv.height = Math.round(im.height * scale);
            cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
            api.setImage({ src: cv.toDataURL('image/jpeg', 0.82) });
          };
          im.onerror = function () { /* 图坏了就不动（不假装成功） */ };
          im.src = String(fr.result);
        };
        fr.readAsDataURL(file);
      },
      /* ★ 批 4：`browse`（服务器图库的列目录/取图）**已整段删除** —— 见 ImagePanel 里的说明。
         实景档用的 `pickMedia` 仍走 ftree（那是"背景模式自动取图"，不是"用户选图"），
         这一点在 README 的"已知边界"里如实登记，没有跟着一起改。 */
      /* ★ 批 6（用户澄清「留几张样图能直接测试用，**其他的按文件夹导入即可**，没必要那么复杂」）：
         选一个文件夹 → 把里面的图片列成缩略图 → 点一张即用。
         实现＝原生 `webkitdirectory`（Edge/Chrome 支持，无依赖）；**只在本机读、不上传**；
         点缩略图时复用上面的 `upload` 管线（缩到 1600px 存 dataURL ⇒ 能跨刷新保留）。 */
      loadFolder: function (fileList) {
        var all = Array.prototype.slice.call(fileList || []);
        var imgs = all.filter(function (f) {
          return /^image\//i.test(f.type || '') || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(f.name || '');
        });
        S.folder = [];
        if (!all.length) { S.dataNote = '没选到文件夹（这台浏览器可能不支持 webkitdirectory）'; rerender(); return; }
        if (!imgs.length) { S.dataNote = '这个文件夹里有 ' + all.length + ' 个文件，但一张图片都没有'; rerender(); return; }
        S.folder = imgs.slice(0, 80).map(function (f) {
          return { name: f.name, kb: Math.round((f.size || 0) / 1024), file: f, url: URL.createObjectURL(f) };
        });
        S.dataNote = '从文件夹读入 ' + S.folder.length + ' 张' + (imgs.length > 80 ? '（只列前 80 张）' : '') + ' —— 点一张即用';
        rerender();
      },
      pickMedia: function () {
        ftList(DIR_GALLERY).then(function (d) {
          var dirs = (d.entries || []).filter(function (e) { return e.kind === 'dir'; });
          var here = (d.entries || []).filter(function (e) { return e.kind === 'file' && isImg(e.name); });
          var pool = dirs.length ? dirs : [{ name: '', path: DIR_GALLERY }];
          var pickDir = pool[Math.floor(Math.random() * pool.length)];
          return ftList(pickDir.path).then(function (d2) {
            var imgs = (d2.entries || []).filter(function (e) { return e.kind === 'file' && isImg(e.name); });
            var all = here.concat(imgs);
            if (!all.length) { S.mediaPicked = ''; S.dataNote = '相册里没取到图片（' + DIR_GALLERY + '）'; applyBackground(); rerender(); return; }
            var pick = all[Math.floor(Math.random() * all.length)];
            S.mediaPicked = ftRawUrl(pick.path);
            S.dataNote = '';
            applyBackground(); rerender();
          });
        }).catch(function (e) {
          S.mediaPicked = '';
          S.dataNote = '实景档取图失败：' + String((e && e.message) || e) + '（已按控制台的做法退回网格档，不假装）';
          S.mode = 'grid'; lsSet(LS.mode, 'grid');
          applyBackground(); rerender();
        });
      },
      setAccent: function (v) { S.accent = v; lsSet(LS.accent, v); applyBackground(); rerender(); },
    };
    return el('div', { className: 'tsnbg-row' },
      el('div', { className: 'tsnbg-head' },
        el('span', { className: 'tsnbg-label' }, '背景'),
        el('span', { className: 'tsnbg-note' }, '复用中控台那一套档位与图片（' + S.modes.length + ' 档）')
      ),
      ModeButtons(S, function (id) {
        S.mode = id; lsSet(LS.mode, id);
        if (id === 'image' && !S.samples.length) loadSamples().then(function () { applyBackground(); checkVisible(); rerender(); });
        applyBackground(); checkVisible(); rerender();
      }),
      el('div', { className: 'tsnbg-desc' }, cur ? cur.name + ' —— ' + cur.desc : ''),
      S.dataNote ? el('div', { className: 'tsnbg-note tsnbg-warn' }, S.dataNote) : null,
      S.visibleNote ? el('div', { className: 'tsnbg-note tsnbg-warn' }, S.visibleNote) : null,
      el('div', { className: 'tsnbg-note' }, S.prefsNote || '偏好会同步到服务器：任何入口（本机 / tailnet 域名 / 手机）打开都一致'),
      S.mode === 'custom' ? CustomEditor(S, function (cfg) { S.custom = cfg; lsSet(LS.custom, JSON.stringify(cfg)); applyBackground(); rerender(); }) : null,
      S.mode === 'image' ? ImagePanel(S, api) : null,
      S.mode === 'media' ? MediaPanel(S, api) : null,
      el('div', { className: 'tsnbg-line tsnbg-tone' }, '主色',
        el('button', { type: 'button', className: 'tsnbg-btn' + (S.accent === 'bg' ? ' on' : ''), onClick: function () { api.setAccent('bg'); } }, '跟随背景'),
        el('button', { type: 'button', className: 'tsnbg-btn' + (S.accent === 'form' ? ' on' : ''), onClick: function () { api.setAccent('form'); } }, '按形态'),
        el('b', { className: 'tsnbg-num' }, S.tone ? '色相 ' + S.tone.h + '° · 饱和 ' + S.tone.s + '%' : '—'),
        el('span', { className: 'tsnbg-note' }, S.toneNote || '')
      )
    );
  }

  /* ── 订阅（行内重绘用；很轻：一个 Set）────────────────────────────── */
  var subs = new Set();
  function subscribe(fn) { subs.add(fn); return function () { subs.delete(fn); }; }

  /* ── 材质（skin v4 批 1）：四档 × 明度 × 透明倍率 ────────────────────────
   * 与背景行**同一槽位、不同 id/order** ⇒ 两行并存、互不覆盖（背景行 order 40 / 材质行 41）。
   * 状态同样写在插件自己的 localStorage 键里（tsnetSkin.*），不碰 DSH 自己的设置存储。
   * 档位值只是"标记"（body[data-tsn-glass]），真正的数值全在 skin.css 的令牌里 —— 单一来源。
   * ★ 令牌声明在 body[data-tsnet-skin]，运行时也**只写 body**（§70.3-1）。 */
  var LM = { glass: 'tsnetSkin.glass', lum: 'tsnetSkin.lum', alphaK: 'tsnetSkin.alphaK', sideFrost: 'tsnetSkin.sideFrost', railH: 'tsnetSkin.railH' };
  var GLASS = [
    { id: 'high', name: '高', desc: '模糊 34px · 透明 38% —— 最通透，背后的结构最清楚' },
    { id: 'mid', name: '中', desc: '模糊 26px · 透明 45% —— 中控台标定档（看得见背后，又不糊成一片）' },
    { id: 'low', name: '低', desc: '模糊 18px · 透明 60% —— 收敛，接近实心' },
    { id: 'off', name: '关', desc: '不模糊 · 96% 实心 —— 对照档（与 DSH 默认最接近，可用来比对）' },
  ];
  var M = {
    glass: lsGet(LM.glass, 'mid'),
    lum: parseFloat(lsGet(LM.lum, '0')) || 0,          // 0–24 (%)
    alphaK: parseFloat(lsGet(LM.alphaK, '1')) || 1,    // 0.5–1.6
    /* 批 8：侧栏真磨砂**默认关** —— 实测照片背景下 backdrop-filter 会把侧栏边缘涂开成暗涂抹（用户反馈"脏"） */
    sideFrost: lsGet(LM.sideFrost, 'off') === 'on' ? 'on' : 'off',
    railH: parseInt(lsGet(LM.railH, '2'), 10) || 2,     // 刻度粗细：2（Codex 规格）/3/4
  };
  if (!GLASS.some(function (g) { return g.id === M.glass; })) M.glass = 'mid';

  var msubs = new Set();
  function mSubscribe(fn) { msubs.add(fn); return function () { msubs.delete(fn); }; }
  function mNotify() { msubs.forEach(function (f) { try { f(); } catch (e) { /* 单行坏了不影响其它 */ } }); }

  function applyMaterial() {
    var root = document.body;
    if (!root) return;
    root.setAttribute('data-tsn-glass', M.glass);
    root.setAttribute('data-tsn-sidebar-frost', M.sideFrost);   // 批 8：侧栏磨砂开关（默认 off）
    root.style.setProperty('--sk-alpha-k', String(M.alphaK));
    root.style.setProperty('--sk-lum-k', M.lum + '%');
  }

  /* 批 7：对话刻度轨的开关与状态（用户问「我刻度呢？」—— 除了把它做显眼，也要能自己开/关，
     并且**如实报出**为什么看不到：空会话不画刻度 / 引擎没起来）。 */
  function railApi() { try { return window.__dshTsnetRail || null; } catch (e) { return null; } }
  function railOn() { var r = railApi(); return r ? r.enabled() : false; }
  function railNote() {
    var r = railApi();
    if (!r) return '刻度引擎没起来（看浏览器 console）';
    if (!r.enabled()) return '已隐藏（点「显示」打开）';
    var st = r.state();
    return st.anchors
      ? '当前 ' + st.anchors + ' 轮 · 点刻度跳转、悬停看预览'
      : '本会话还没有轮次 —— 空会话/新会话不画刻度';
  }

  function MaterialRow() {
    var st = react.useState(0);
    var bump = st[1];
    var rerender = function () { bump(function (n) { return n + 1; }); };
    var off = mSubscribe(rerender);
    // 槽位在切换设置标签页时会重挂载 ⇒ 能退订就退订（没有 useEffect 就退回与背景行同样的行为）
    if (react.useEffect) react.useEffect(function () { return off; }, []);
    var api = {
      setGlass: function (id) { M.glass = id; lsSet(LM.glass, id); applyMaterial(); mNotify(); },
      setLum: function (v) { M.lum = v; lsSet(LM.lum, String(v)); applyMaterial(); mNotify(); },
      setAlphaK: function (v) { M.alphaK = v; lsSet(LM.alphaK, String(v)); applyMaterial(); mNotify(); },
      setRail: function (v) { var r = railApi(); if (r) r.setEnabled(v); mNotify(); },
      /* 批 11：刻度粗细（2/3/4px）。改了要**重建刻度**才吃新值（rail 在 show() 里读这个键），
         所以先落盘再让 rail 重新 reconcile。 */
      setRailH: function (h) {
        M.railH = h; lsSet(LM.railH, String(h));
        var r = railApi();
        if (r) { if (r.setEnabled) r.setEnabled(r.enabled()); }
        mNotify();
      },
      setSideFrost: function (v) { M.sideFrost = v ? 'on' : 'off'; lsSet(LM.sideFrost, M.sideFrost); applyMaterial(); mNotify(); },
    };
    var cur = GLASS.filter(function (g) { return g.id === M.glass; })[0] || GLASS[1];
    return el('div', { className: 'tsnbg-row' },
      el('div', { className: 'tsnbg-head' },
        el('span', { className: 'tsnbg-label' }, '材质'),
        el('span', { className: 'tsnbg-note' }, '亚克力四档 + 明度（数值逐字复用中控台 tokens.css）')
      ),
      el('div', { className: 'tsnbg-modes' }, GLASS.map(function (g) {
        return el('button', {
          key: g.id, type: 'button',
          className: 'tsnbg-mode' + (M.glass === g.id ? ' on' : ''),
          onClick: function () { api.setGlass(g.id); },
        }, g.name);
      })),
      el('div', { className: 'tsnbg-desc' }, cur.name + ' —— ' + cur.desc),
      el('div', { className: 'tsnbg-sub' },
        el('div', { className: 'tsnbg-line' }, '面板透明倍率',
          el('input', {
            type: 'range', className: 'tsnbg-range', min: '0.5', max: '1.6', step: '0.05',
            value: String(M.alphaK),
            onChange: function (e) { api.setAlphaK(parseFloat(e.target.value) || 1); },
          }),
          el('b', { className: 'tsnbg-num' }, '×' + M.alphaK.toFixed(2))
        ),
        el('div', { className: 'tsnbg-line' }, '面板明度',
          el('input', {
            type: 'range', className: 'tsnbg-range', min: '0', max: '24', step: '1',
            value: String(M.lum),
            onChange: function (e) { api.setLum(parseFloat(e.target.value) || 0); },
          }),
          el('b', { className: 'tsnbg-num' }, '+' + M.lum + '%')
        ),
        el('div', { className: 'tsnbg-note' }, '有效不透明 = 档位基线 × 倍率；明度是往"亮/暗"各让一步（暗形态往白、亮形态往黑）')
      ),
      /* 批 7：刻度轨开关。用户问「我刻度呢？」⇒ ① 把轨道做显眼（槽线+加粗）② 给开关与状态 ③ 空会话时如实说明 */
      /* 批 8：侧栏磨砂开关。实测照片背景下"真磨砂"会把侧栏边缘涂开成暗涂抹（用户反馈"脏"）⇒ 默认关；
         想看的可以打开，但界面上把它的代价写清楚，不假装没代价。 */
      el('div', { className: 'tsnbg-line' }, '侧栏磨砂',
        el('button', { type: 'button', className: 'tsnbg-btn' + (M.sideFrost === 'on' ? ' on' : ''), onClick: function () { api.setSideFrost(true); } }, '开'),
        el('button', { type: 'button', className: 'tsnbg-btn' + (M.sideFrost !== 'on' ? ' on' : ''), onClick: function () { api.setSideFrost(false); } }, '关'),
        el('span', { className: 'tsnbg-note' }, '默认关：照片背景下模糊会把侧栏边缘涂成暗涂抹；关着＝只有色凋（更干净）')
      ),
      el('div', { className: 'tsnbg-line tsnbg-tone' }, '对话刻度',
        el('button', { type: 'button', className: 'tsnbg-btn' + (railOn() ? ' on' : ''), onClick: function () { api.setRail(true); } }, '显示'),
        el('button', { type: 'button', className: 'tsnbg-btn' + (!railOn() ? ' on' : ''), onClick: function () { api.setRail(false); } }, '隐藏'),
        el('span', { className: 'tsnbg-note' }, railNote())
      ),
      /* ★ 批 11：刻度粗细（默认 2px ＝ Codex 规格）。为什么给这个开关写在 rail-engine 的注释里：
         Codex 的 2px 立在近黑平面上，我们有照片背景档 —— "2px 够不够看得见"是观感判断，
         而我在本机两个仪器上都判不准（MCP 浏览器 dpr0.5 ⇒ 2px 只剩 1 设备像素）。交给使用者定。 */
      el('div', { className: 'tsnbg-line' }, '刻度粗细',
        [2, 3, 4].map(function (h) {
          return el('button', {
            key: 'h' + h, type: 'button',
            className: 'tsnbg-btn' + ((Number(M.railH) || 2) === h ? ' on' : ''),
            onClick: function () { api.setRailH(h); },
          }, h === 2 ? '细 2px（Codex 规格）' : (h === 3 ? '中 3px' : '粗 4px'));
        }),
        el('span', { className: 'tsnbg-note' }, '放在照片背景上觉得太细就调粗；细档与参照物一致')
      )
    );
  }

  function register(ctx) {
    applyBackground();
    applyMaterial();
    // 偏好跨入口共享：先缓存首屏（本地 __cache 里的整包，秒用），再联网取令牌并与服务器对账
    try {
      var cached = JSON.parse(lsGet(CACHE_KEY, 'null') || 'null');
      if (cached && typeof cached === 'object' && cached.__rev && Number(cached.__rev) > localRev()) {
        applyPrefs(cached);
        S.mode = lsGet(LS.mode, S.mode);
        S.image = lsJson(LS.image, S.image);
        S.custom = lsJson(LS.custom, S.custom);
        S.accent = lsGet(LS.accent, S.accent);
        applyBackground();
        applyMaterial();
      }
    } catch (e) { /* 忽略 */ }
    /* 跨入口偏好同步的**单点开关**：公开构建不烘工作区路径（FT_ROOT 为空）⇒ 整段关闭，
       只在本入口生效，并在设置行**如实写出**这一状态（先量再说 / 界面不许说假话）。 */
    if (FT_ROOT.length) {
      fetch(FT + 'token').then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.token) { FT_TOKEN = d.token; return loadServerPrefs(); }
        return false;
      }).catch(function () { /* 令牌取不到：只在本入口生效，设置行会如实写出来 */ });
    } else {
      S.prefsNote = '跨入口同步未启用（本构建未指定工作区，只在本入口生效）';
    }
    // 别的引擎（刻度轨）改了偏好也能触发同一次同步
    try { window.__dshTsnetSyncPrefs = scheduleSyncPrefs; } catch (e) {}
    var slots = ctx && ctx.get ? ctx.get('slots') : null;
    if (!slots || typeof slots.inject !== 'function') return false;
    slots.inject('settings.general.item', function () {
      return slots.register({ name: 'settings.general.item', id: 'tsnet-background', order: 40 }, BackgroundRow);
    });
    // 材质行：同槽位、order 41（排在背景行之后）。**id 必须不同** —— 同 id 会互相覆盖。
    slots.inject('settings.general.item', function () {
      return slots.register({ name: 'settings.general.item', id: 'tsnet-material', order: 41 }, MaterialRow);
    });
    return true;
  }

  return { register: register, applyBackground: applyBackground, applyMaterial: applyMaterial, state: S };
}
    /*__TSNET_BG_END__*/

    /*__TSNET_RAIL_START__*/
    /* lib/rail-engine.js —— 「对话刻度」轨道（skin v4 批 5，2026-09-28；用户选 B 比例映射/鱼眼）
 *
 * 用户原话：「像 codex 一样在对话界面左侧有"对话刻度"，可以根据这个刻度直接跳转对话」。
 *
 * ★ 三条依据都是**实测**出来的（不是猜的）：
 *   ① 锚点已存在：DSH 给每个流项挂了 `data-chat-flow-kind`。★ **2026-09-28 实测更正**：
 *      用户轮次的 kind 是 **`user`**，**不是 `input-message`** —— 我上一轮把 key 字符串
 *      （形如 `13:input-message89644a0f-…`）里的片段误当成了 kind。实测本机会话里出现的 kind 全集：
 *      `user` · `assistant-step` · `tool-call` · `turn-tail` · `context` · `compaction` ·
 *      `model-retry` · `turn-error`。稳定键仍是 `data-chat-anchor-key`
 *      ⇒ **不解析会话文件、不猜轮次、不碰 React 内部**。
 *      教训一句话：**锚点的判据要现量**（一个字段名看着熟就当真，就会画出一排点不动的刻度）。
 *   ② 位置有地方放：消息列 rect [396,…,748] 而滚动体 [280,…,988] ⇒ 左侧有 **116px 空隙**，
 *      轨道放进去**不动任何既有几何**。
 *   ③ 内容未虚拟化：实测 98 个流项**全在 DOM**，所以 `scrollTop = offsetTop` 这种直接跳转成立。
 *
 * ★ 两条 §70 硬约束（弹层优先于美观）：
 *   · 轨道是**新增的 fixed 叶子**（挂在 body 上，内部装 Shadow DOM）——**不改任何既有元素的包含块**；
 *     实测本机所有 `position: fixed` 弹层都直接挂在 body 下，我们再加一个自己的 fixed 不影响它们。
 *   · 容器 `pointer-events: none`，只有刻度本身 `auto` —— 不许挡住任何可点区域（尤其输入卡与弹层）。
 *
 * ★ 隔离：全部样式写在 **Shadow DOM** 里（借 170★ 的 AhmadHassan-BTed/ScrollToPrompt 验证过的做法）：
 *   我们的轨道样式不外泄、宿主页面的样式也吃不进来。
 *
 * ★ 诚实边界（如实登记，不假装）：
 *   · 锚点数 0（空会话/新会话）时**根本不建轨道**（空目录不上界面）；
 *   · 长会话若哪天被虚拟化，"按 offsetTop 跳转"会失效 —— 那时本引擎会**量不到锚点就不画刻度**，
 *     而不是画一排点不动的假刻度。这条目前是 UNKNOWN（现存最长会话未虚拟化）。
 */
function installRailFeature(opts) {
  var HOST_ID = 'dsh-tsnet-rail-host';
  var ANCHOR_SEL = '[data-chat-flow-kind="user"]';   // ★ 实测：用户轮次的 kind 是 user（不是 input-message）
  var SCROLLER_SEL = '[class*="scrollBody"]';
  var TICK_GAP = 0;          // 刻度间距（垂直定位由锚点比例映射决定；节奏见 RAIL_PITCH）
  /* ★ 批 11（A1）：节奏与我方长度阶梯 —— 单一来源，CSS 里不许再出现具体 px。
     --rail-pitch 10px 是参照物三家的共同声明值（Jaeger KEY_BASE=6/KEY_MAX=26、z953 8/26、Micheng 5px）；
     阶梯 [2.6, 2.0, 1.4, 1.0]×pitch = [26,20,14,10]px，与参照物一致。 */
  var RAIL_PITCH = 10;
  var RAIL_PITCH_MIN = 6;                 // 密集会话的压缩下限
  var HOVER_LADDER = [2.6, 2.0, 1.4, 1.0];
  /* ★ 批 A6（2026-09-29 用户追补三条，全部以实际体验为准）：
     ① 密度：旧版按**内容比例**定位 ⇒ 实测间距桌面 224.3px / 手机 193.7px，且长短会话松紧完全不同。
        改为**等距钢琴键**：以 rail 垂直中心为基准按 pitch 等距排布，超高就压缩到下限。
        取舍（明写）：刻度位置不再对应内容位置（批 5 的"比例映射"作废）；活动刻度仍按滚动位置判定。
     ② 命中：mark 只有 6×2px、且没有命中层 ⇒ 鼠标/手指都按不住。加不可见命中层。
     ③ 形态：触摸设备上 hover 根本不存在（旧版绑 mousemove/mouseleave）⇒ 改 pointer 事件。
        DSH 外壳没有形态标记（实测），所以我们用 matchMedia + maxTouchPoints 判定，
        并在这里写明**为什么**（机制化优先于硬编码断点）。 */
  var PITCH_TOUCH = 44;                   // 手机形态：44 正好等于触控判据，且相邻命中层不重叠
  var HIT_W_DESKTOP = 24, HIT_H_DESKTOP = 12;
  var MOBILE_Q = '(max-width: 640px)';
  function isTouchLike() {
    try { return (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window; } catch (e) { return false; }
  }
  function isMobileForm() {
    try { return window.matchMedia(MOBILE_Q).matches || (isTouchLike() && window.innerWidth <= 900); } catch (e) { return false; }
  }
  var RAIL_W = 16, RAIL_W_LENS = 74;
  var POLL_MS = 800;

  var host = null, root = null, railEl = null, ticks = [], styleEl = null, grooveEl = null, countEl = null, earlierEl = null;
  var anchors = [], keys = '';
  var timer = null, scroller = null, lastActive = -1, lastGeom = '';
  var LS_RAIL = 'tsnetSkin.rail';   // 'off' = 不显示（用户在设置里可关）

  function enabled() {
    try { return localStorage.getItem(LS_RAIL) !== 'off'; } catch (e) { return true; }
  }

  function setEnabled(v) {
    try { localStorage.setItem(LS_RAIL, v ? 'on' : 'off'); } catch (e) {}
    // 刻度开关也进"跨入口共享偏好"（bg-engine 提供 scheduleSyncPrefs；取不到就只在本入口生效）
    try { if (window.__dshTsnetSyncPrefs) window.__dshTsnetSyncPrefs(); } catch (e) {}
    if (!v) { hide(); }
    else { reconcile(true); }
    return !!v;
  }

  // 服务器上保存的偏好到了 ⇒ 跟着切（用户换入口时，刻度的显示/隐藏也应当一致）
  try {
    window.addEventListener('tsnet-prefs', function () {
      try { if (localStorage.getItem(LS_RAIL) !== 'off') { reconcile(true); } else { hide(); } } catch (e) {}
    });
  } catch (e) {}

  var CSS_TEXT = [
    ':host { all: initial; }',
    /* 轨道容器：一条**槽**（1px 竖线）＋ 刻度。槽的作用是"看得见这里有东西" ——
       第一版只有刻度、没有槽，用户反馈「我刻度呢？」（16px 宽 / 3px 高 / 0.52 不透明，确实容易漏看）。 */
    '.rail { position: fixed; pointer-events: none; z-index: 5;',
    '  display: flex; flex-direction: column; justify-content: center;',
    '  transition: width .16s ease; }',
    '.rail.hidden { display: none; }',
    /* ★ 批 9（用户反馈「刻度的风格主色调没有和背景统一」＋「为什么只显示一个」）：
       真因是同一条 —— 旧版把刻度写成**固定青蓝色**（α0.52），压在橙琥珀星图上只有**橙色活动刻度**跳得出来，
       于是看起来"只有一个"、风格也和背景不一路。
       改法：颜色**直接吃背景派生的主色令牌**（`--sk-secondary` 非活动 / `--sk-primary` 活动）——
       自定义属性会继承进 Shadow DOM，引擎按背景求主色时会自动改写这两个令牌 ⇒ 轨道永远跟背景同调。
       另外把刻度加粗、加一圈暗描边（`box-shadow`），保证在亮照片上也读得出。 */
    '.groove { position: absolute; left: 5px; top: 2px; bottom: 2px; width: 1px;',
    '  background: color-mix(in srgb, var(--sk-secondary) 45%, transparent); border-radius: 1px; }',
    '.rail.lens { width: var(--rail-w-lens, 74px) !important; }',
    /* ★ 批 11（A1，Codex 规格）：刻度**恒定 2px 厚、只伸长度**。
       参照物三家独立一致（取证报告 §2）：基长 6px、悬浮离散阶梯 [26,20,14,10]px、节奏 --rail-pitch: 10px。
       旧版是"变胖"（5px→8px、活动 30px），既不像参照物、也让密集会话糊成一片。
       长度全部由 JS 按 --rail-pitch 派生后写进来（**不在这里写死数字**，单一来源在 JS 常量）。
       缓动换成 Codex 那族的收尾曲线，并按无障碍要求补 reduced-motion 降级。 */
    '.tick { pointer-events: auto; cursor: pointer; position: absolute; left: 0;',
    '  width: var(--tick-w); height: var(--tick-h, 2px); border-radius: 1px;',
    '  background: var(--sk-secondary);',
    '  box-shadow: 0 0 0 1px rgba(0,0,0,.45), 0 1px 4px rgba(0,0,0,.35);',
    '  transition: width .16s var(--sk-ease-soft, cubic-bezier(.22,1,.36,1)), background .12s var(--sk-ease, cubic-bezier(.16,1,.3,1)); }',
    /* ★ A6-2：**不可见命中层**（用户："刻度线的触摸判定区太小"）。
       可见 mark 仍是 6×2px（Codex 规格不变），但命中区由 --tick-hit-w/h 决定
       （桌面 24×12、手机 44×44）。负 inset 只是把它铺开，不改 mark 几何、也不裁任何子孙
       （刻度是叶子元素，§70 的禁令针对"可能包含弹层的祖先"，不适用）。 */
    '.tick::after { content: ""; position: absolute; left: 50%; top: 50%;',
    '  width: var(--tick-hit-w, 24px); height: var(--tick-hit-h, 12px);',
    '  transform: translate(-50%, -50%); border-radius: 6px; }',
    '.tick:hover { background: var(--sk-primary); width: var(--tick-w-hover, var(--tick-w)); }',
    '.tick.on { background: var(--sk-primary); width: var(--tick-w-on);',
    '  box-shadow: 0 0 0 1px rgba(0,0,0,.5), 0 0 8px rgba(0,0,0,.45); }',
    /* 鱼眼：**只伸长度**（--near 由 JS 按距离量化成离散阶梯写进 --tick-w-hover） */
    '.lens .tick { width: var(--tick-w-hover, var(--tick-w)); }',
    '@media (prefers-reduced-motion: reduce) { .tick, .rail, .count, .tip { transition: none !important; } }',
    /* 计数：**常驻可见**（用户问「为什么只显示一个」⇒ 界面上直接答"共 N 轮"），悬停时更亮 */
    '.count { position: absolute; left: 14px; top: 0; pointer-events: none;',
    '  font: 11px/1.6 var(--tip-font, system-ui, sans-serif);',
    '  color: color-mix(in srgb, var(--sk-secondary) 85%, transparent);',
    '  text-shadow: 0 1px 3px rgba(0,0,0,.6); white-space: nowrap; transition: opacity .12s ease; }',
    '.rail.lens .count { color: var(--sk-primary); }',
    /* ★ A6-4：手机形态**不画计数**（实拍：它画在 left:14px，压在正文上、还被会话头部遮掉一半）。
       信息不丢：点按刻度时的 tip 里会显示轮次。等距排布后计数也失去"位置即内容"的意义。 */
    '.rail.mobile .count { display: none; }',
    /* A6-5：「更早历史」标记 —— 轨道顶端一小段虚线段，点它＝加载更早（与 DSH 的按钮同一条路）。
       命中区同样放大（手机 44），因为"上面还有历史"这件事本身也该点得到。 */
    '.earlier { position: absolute; left: 0; top: -6px; width: var(--tick-w); height: 3px;',
    '  background: repeating-linear-gradient(90deg, var(--sk-secondary) 0 2px, transparent 2px 4px);',
    '  opacity: .75; cursor: pointer; pointer-events: auto; border-radius: 1px; }',
    '.earlier::after { content: ""; position: absolute; left: 50%; top: 50%;',
    '  width: var(--tick-hit-w, 24px); height: var(--tick-hit-h, 12px); transform: translate(-50%, -50%); }',
    '.earlier:hover { opacity: 1; background: var(--sk-primary); }',
    /* tip：圆角与内边距照 Codex 规格（10px / 10px 12px），排印三档（13/600 · 12 · 11/16） */
    '.tip { position: fixed; pointer-events: none; max-width: 320px; padding: 10px 12px;',
    '  border-radius: 10px; font: 12px/1.5 var(--tip-font, system-ui, sans-serif);',
    '  background: rgba(12,14,18,.94); color: #e8f1f4; border: 1px solid rgba(163,219,235,.18);',
    '  box-shadow: 0 10px 28px rgba(0,0,0,.5); opacity: 0; transition: opacity .16s var(--sk-ease, cubic-bezier(.16,1,.3,1)); }',
    '.tip.on { opacity: 1; }',
    '.tip b { display: block; font-weight: 600; color: color-mix(in srgb, var(--sk-primary) 60%, #ffffff); margin-bottom: 2px; font-size: 13px; }',
  ].join('\n');

  function ensureHost() {
    if (host && host.isConnected) return true;
    if (document.getElementById(HOST_ID)) { host = document.getElementById(HOST_ID); root = host.shadowRoot || host.attachShadow({ mode: 'open' }); return true; }
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;';
    /* ★ A7：把**形态**做成一等公民标记（`body[data-tsn-form]`）供 CSS 消费。
       为什么不用媒体查询：skill §1③ 明写"形态分支用标记、不写媒体查询硬编码断点"；DSH 外壳实测
       没有 data-form/mobile 标记，所以判定只在 `isMobileForm()` **这一处**，CSS 只读这个标记。
       催生它的问题：手机上我们自己的设置控件命中区只有 53×26 / 53×28px（J4 要 ≥44）。 */
    try {
      document.body.setAttribute('data-tsn-form', isMobileForm() ? 'mobile' : 'desktop');
      if (!installRailFeature.__formBound) {
        installRailFeature.__formBound = true;
        window.addEventListener('resize', function () {
          try { document.body.setAttribute('data-tsn-form', isMobileForm() ? 'mobile' : 'desktop'); } catch (e) {}
        }, { passive: true });
      }
    } catch (e) { /* 忽略 */ }
    root = host.attachShadow({ mode: 'open' });
    styleEl = document.createElement('style');
    styleEl.textContent = CSS_TEXT;
    root.appendChild(styleEl);
    railEl = document.createElement('div');
    railEl.className = 'rail';
    root.appendChild(railEl);
    document.body.appendChild(host);
    return true;
  }

  function findScroller() {
    var el = document.querySelector(SCROLLER_SEL);
    return el && el.clientHeight > 120 ? el : null;
  }

  function collect() {
    if (!scroller) return [];
    // 只认滚动体内部的锚点，避免把别处的同名节点算进来
    return Array.prototype.slice.call(scroller.querySelectorAll(ANCHOR_SEL));
  }

  function keyOf(el, i) {
    return String(el.getAttribute('data-chat-anchor-key') || ('#' + i));
  }

  function geom() {
    var r = scroller.getBoundingClientRect();
    return { left: Math.round(r.left), top: Math.round(r.top), h: Math.round(r.height), scrollH: scroller.scrollHeight, scrollTop: scroller.scrollTop };
  }

  /** 建刻度：位置＝该轮在**内容坐标**里的占比（方案 B 比例映射） */
  function build() {
    var g = geom();
    anchors = collect();
    keys = anchors.map(keyOf).join('|');
    railEl.innerHTML = '';
    /* 槽与计数是**常驻件**，不随刻度重建（第一版把它们和刻度一起清掉过 —— 顺序必须对） */
    grooveEl = document.createElement('div'); grooveEl.className = 'groove'; railEl.appendChild(grooveEl);
    countEl = document.createElement('div'); countEl.className = 'count'; railEl.appendChild(countEl);
    ticks = [];
    if (!anchors.length) { hide(); return false; }
    var n = anchors.length;
    /* ★ 批 A5（2026-09-29，用户提问「为什么历史聊天记录不在刻度的计量范围内？」）：
       实测这个会话刻度写「共 4 轮」，而 DOM 里同时存在 **「加载更早」按钮**（+2 个 compaction 标记）
       ⇒ DSH **只分页加载会话尾部**，更早的轮次**根本不在 DOM 里**，刻度既量不到也跳不过去。
       所以旧文案「共 N 轮」是**假话**（skill §10.7：界面在说假话也是缺陷）。
       改法：如实说"当前视图 N 轮"，并在检测到还有更早历史时补一句 ——
       宁可承认不知道总数，也不报一个错的数。 */
    var hasEarlier = false;
    var earlierBtn = null;
    try {
      var btns = document.querySelectorAll('button, a, [role="button"]');
      for (var bi = 0; bi < btns.length; bi++) {
        var tx = (btns[bi].textContent || '').trim();
        if (tx === '加载更早' || /^加载更早|^更早|Load earlier/i.test(tx)) { hasEarlier = true; earlierBtn = btns[bi]; break; }
      }
    } catch (e) { /* 忽略 */ }
    countEl.textContent = '当前视图 ' + n + ' 轮' + (hasEarlier ? '（更早历史未加载）' : '');
    /* ★ A6-5：把"上面还有历史"变成**可操作的东西**（承接用户"为什么历史不在刻度计量范围内"的提问）。
       旧版只改了文案（承认不知道总数）；现在在轨道顶端画一个「更早」标记，点它＝触发 DSH 自己的
       「加载更早」按钮 ⇒ 历史进 DOM ⇒ 下一次 reconcile 时刻度自然变多（刻度数与锚点**同源**，不各算一套）。
       标记只在**确实存在该按钮**时出现（不假装有历史）。 */
    if (earlierBtn) {
      if (!earlierEl) {
        earlierEl = document.createElement('div');
        earlierEl.className = 'earlier';
        earlierEl.title = '上面还有更早历史：点这里加载（与「加载更早」按钮同一条路）';
        earlierEl.addEventListener('click', function (ev) {
          ev.stopPropagation();
          try { earlierBtn.click(); } catch (e) { /* 忽略 */ }
          setTimeout(function () { reconcile(true); }, 1500);
        });
      }
      if (!earlierEl.parentNode) railEl.appendChild(earlierEl);
    } else if (earlierEl && earlierEl.parentNode) {
      earlierEl.parentNode.removeChild(earlierEl);
    }
    /* ★ A6-1：**等距钢琴键**排布（用户："刻度排布太松散了"）。
       旧版用 `pos = top / scrollH` 按内容比例定位 ⇒ 实测间距 224/194px，且长短会话松紧完全不同。
       现在：以 rail 垂直中心为基准、按 pitch 等距排开；总跨度超出可用高度就**按 pitch 压缩**，
       压到 RAIL_PITCH_MIN 为止（再挤就退化为等分整轨，绝不会重叠）。
       取舍明写：刻度位置不再对应内容位置 —— 位置只表达"第几轮"，内容位置由活动高亮表达。 */
    var pitch = isMobileForm() ? PITCH_TOUCH : RAIL_PITCH;
    var avail = Math.max(40, g.h - 24);
    var span = pitch * (n - 1);
    if (span > avail) {
      pitch = Math.max(RAIL_PITCH_MIN, avail / Math.max(1, n - 1));
      span = pitch * (n - 1);
    }
    var center = g.h / 2;
    var y0 = center - span / 2;
    railEl.setAttribute('data-pitch', String(Math.round(pitch)));
    var hitW = isMobileForm() ? PITCH_TOUCH : HIT_W_DESKTOP;
    var hitH = isMobileForm() ? PITCH_TOUCH : HIT_H_DESKTOP;
    railEl.style.setProperty('--tick-hit-w', hitW + 'px');
    railEl.style.setProperty('--tick-hit-h', hitH + 'px');
    if (isMobileForm()) railEl.classList.add('mobile'); else railEl.classList.remove('mobile');
    for (var i = 0; i < n; i++) {
      var el = anchors[i];
      var t = document.createElement('div');
      t.className = 'tick';
      t.style.top = (y0 + i * pitch).toFixed(1) + 'px';
      t.setAttribute('data-i', String(i));
      t.title = '';
      t.addEventListener('click', onTickClick);
      t.addEventListener('pointerenter', onTickEnter);
      t.addEventListener('pointerleave', onTickLeave);
      /* ★ A6-3：触摸设备没有 hover ⇒ 点按也要能出 tip（"禁只有 hover 才能用"） */
      t.addEventListener('pointerdown', onTickEnter);
      railEl.appendChild(t);
      ticks.push({ el: t, anchor: el });
    }
    show(g);
    return true;
  }

  /** 轨道的横坐标：优先待在"侧栏与消息列之间"的空隙里；空隙太小就贴着列左缘（窄屏也必须看得见） */
  function railX(g) {
    var col = scroller ? scroller.querySelector('[class*="_column"]') : null;
    if (!col) return g.left + 8;
    var cl = Math.round(col.getBoundingClientRect().left);
    var gutter = cl - g.left;
    if (gutter >= 30) return g.left + 8;
    return Math.max(g.left + 2, cl - 20);
  }

  function show(g) {
    host.style.display = '';
    railEl.style.left = railX(g) + 'px';
    railEl.style.top = (g.top + 6) + 'px';
    railEl.style.height = (g.h - 12) + 'px';
    railEl.style.width = RAIL_W + 'px';
    railEl.style.setProperty('--rail-w-lens', RAIL_W_LENS + 'px');
    /* ★ 批 11（A1）：刻度的**节奏**在这里声明（Codex 规格），长度全部由它派生：
       --rail-pitch 10px（密集下限 6px）· 基长 = pitch×0.6 = 6px · 活动/最近 = pitch×2.6 = 26px。
       单一来源 ⇒ 调一个数，四种长度一起变；这里不写死任何具体 px。 */
    railEl.style.setProperty('--rail-pitch', RAIL_PITCH + 'px');
    railEl.style.setProperty('--rail-pitch-min', RAIL_PITCH_MIN + 'px');
    railEl.style.setProperty('--tick-w', (RAIL_PITCH * 0.6) + 'px');
    railEl.style.setProperty('--tick-w-on', (RAIL_PITCH * HOVER_LADDER[0]) + 'px');
    /* ★ 批 11：厚度**可调**（默认 2px ＝ Codex 规格）。为什么给开关：
       Codex 的 2px 立在**近黑平面**上；我们有照片背景档，2px 在忙碌照片上会不会太细
       是**观感判断**，而我手里的两个仪器都判不准（MCP 浏览器 dpr0.5 ⇒ 2px 只剩 1 设备像素；
       dpr1 的全新上下文里没有会话 ⇒ 不画刻度）。⇒ 不自作主张，交给使用者：细 2 / 中 3 / 粗 4。 */
    railEl.style.setProperty('--tick-h', (Number(localStorage.getItem('tsnetSkin.railH')) || 2) + 'px');
    /* ★ 批 9：**不再**在这里写死墨色 —— 颜色由 Shadow CSS 直接吃 `--sk-secondary` / `--sk-primary`
       （这两个令牌在 body 上，按背景求主色时被引擎改写，自定义属性天然继承进 Shadow DOM）。
       单一来源 ⇒ 轨道永远跟背景同调，不会有第二处颜色定义漂移。 */
  }

  function hide() { if (host) host.style.display = 'none'; }

  function activeIndex() {
    if (!scroller || !anchors.length) return -1;
    var base = scroller.getBoundingClientRect().top;
    var y = base + 48;   // 视口上部留一点余量：这一条就算"当前轮"
    var idx = -1;
    for (var i = 0; i < anchors.length; i++) {
      var r = anchors[i].getBoundingClientRect();
      if (r.top <= y) idx = i; else break;
    }
    return idx;
  }

  function paintActive() {
    var a = activeIndex();
    if (a === lastActive) return;
    lastActive = a;
    for (var i = 0; i < ticks.length; i++) ticks[i].el.className = 'tick' + (i === a ? ' on' : '');
  }

  function onTickClick(ev) {
    var i = Number(ev.currentTarget.getAttribute('data-i'));
    var t = ticks[i];
    if (!t || !t.anchor || !t.anchor.isConnected) { reconcile(true); return; }   // 找不到就不假装跳到了
    var sc = scroller || findScroller();
    if (!sc) return;
    var top = t.anchor.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    sc.scrollTop = Math.max(0, top - 12);
    lastActive = -1; paintActive();
  }

  function tip(showIt, text, x, y) {
    var el = root.querySelector('.tip');
    if (!el) { el = document.createElement('div'); el.className = 'tip'; root.appendChild(el); }
    if (showIt) { el.innerHTML = text; el.style.left = x + 'px'; el.style.top = y + 'px'; el.classList.add('on'); }
    else el.classList.remove('on');
  }

  function onTickEnter(ev) {
    var i = Number(ev.currentTarget.getAttribute('data-i'));
    var t = ticks[i];
    if (!t) return;
    var txt = (t.anchor.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    var r = ev.currentTarget.getBoundingClientRect();
    tip(true, '<b>第 ' + (i + 1) + ' / ' + ticks.length + ' 轮</b>' + escapeHtml(txt || '（这条内容取不到文字）'), r.right + 12, Math.min(window.innerHeight - 60, r.top - 8));
  }
  function onTickLeave() { tip(false); }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function reconcile(force) {
    if (document.hidden) return;
    if (!enabled()) { hide(); return; }
    scroller = findScroller();
    if (!scroller) { hide(); return; }
    var now = collect();
    var k = now.map(keyOf).join('|');
    var g = geom();
    var gk = g.left + ',' + g.top + ',' + g.h + ',' + g.scrollH;
    if (force || k !== keys || !ticks.length) { if (!build()) return; }
    else if (gk !== lastGeom) { show(g); }
    lastGeom = gk;
    paintActive();
  }

  function onLens(ev) {
    if (!railEl) return;
    railEl.classList.add('lens');
    var rect = railEl.getBoundingClientRect();
    for (var i = 0; i < ticks.length; i++) {
      var r = ticks[i].el.getBoundingClientRect();
      var d = Math.abs((r.top + r.height / 2) - ev.clientY);
      var near = Math.max(0, 1 - d / 90);
      ticks[i].el.style.setProperty('--near', near.toFixed(2));
      /* A1：把"连续 near"量化成**离散阶梯**（Codex 规格 [26,20,14,10]px）——
         连续缩放看起来像"糊开的果冻"，离散阶梯才有"键盘/刻度"的手感。
         阶梯值来自单一来源 HOVER_LADDER × --rail-pitch，不在这里写死 px。 */
      var step = HOVER_LADDER[Math.min(HOVER_LADDER.length - 1, Math.floor((1 - near) * HOVER_LADDER.length))];
      ticks[i].el.style.setProperty('--tick-w-hover', (RAIL_PITCH * step).toFixed(1) + 'px');
    }
  }
  function offLens() {
    if (!railEl) return;
    railEl.classList.remove('lens');
    for (var i = 0; i < ticks.length; i++) ticks[i].el.style.setProperty('--near', '0');
    tip(false);
  }

  function start() {
    ensureHost();
    reconcile(true);
    timer = setInterval(function () { try { reconcile(false); } catch (e) { /* 单次失败不影响页面 */ } }, POLL_MS);
    scroller = findScroller();
    if (scroller) scroller.addEventListener('scroll', paintActive, { passive: true });
    window.addEventListener('resize', function () { reconcile(true); }, { passive: true });
    host.addEventListener('pointermove', onLens, { passive: true });
    host.addEventListener('pointerleave', offLens, { passive: true });
    return true;
  }

  function destroy() {
    if (timer) { clearInterval(timer); timer = null; }
    if (scroller) scroller.removeEventListener('scroll', paintActive);
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null; root = null; railEl = null; ticks = []; anchors = []; keys = ''; lastActive = -1;
    return true;
  }

  return { start: start, destroy: destroy, reconcile: reconcile, setEnabled: setEnabled, enabled: enabled, state: function () { return { anchors: anchors.length, active: lastActive, keys: keys.slice(0, 80), enabled: enabled() }; } };
}
    /*__TSNET_RAIL_END__*/

    function off() {
      try { return window.localStorage && window.localStorage.getItem("tsnetSkin") === "off"; }
      catch (e) { return false; }
    }

    function mount() {
      if (off()) return false;
      if (document.getElementById(STYLE_ID)) return true;
      var st = document.createElement("style");
      st.id = STYLE_ID;
      st.setAttribute("data-plugin-css", "dsh-tsnet-skin-pilot");
      st.textContent = CSS;
      document.head.appendChild(st);
      document.body.setAttribute(ATTR, "");
      return true;
    }

    function unmount() {
      var st = document.getElementById(STYLE_ID);
      if (st && st.parentNode) st.parentNode.removeChild(st);
      document.body.removeAttribute(ATTR);
      document.body.removeAttribute("data-tsn-bg");
      ['--tsn-bg-layer', '--tsn-bg-blur', '--tsn-bg-dim', '--tsn-bg-scale'].forEach(function (k) { document.body.style.removeProperty(k); });
      // 批 5：刻度轨与皮肤同生共死（关皮肤就该连轨道一起消失，不留半截东西）
      try { if (rail) rail.destroy(); } catch (e) {}
    }

    var bg = null;
    var rail = null;
    var registered = false;

    exports.apply = function (ctx) {
      if (!mount()) return;
      window.__dshTsnetSkin = true;
      window.__dshTsnetSkinOff = function () { unmount(); window.__dshTsnetSkin = false; };
      window.__dshTsnetSkinOn = function () { mount(); window.__dshTsnetSkin = true; if (bg) bg.applyBackground(); };
      // 批 5：对话刻度轨（独立引擎，和背景/材质互不依赖；失败也不影响皮肤本体）
      try {
        rail = installRailFeature({});
        rail.start();
        window.__dshTsnetRail = rail;
      } catch (e) {
        try { ctx && ctx.logger && ctx.logger.warn && ctx.logger.warn("[tsnet-rail] 刻度轨启动失败：" + String((e && e.message) || e)); } catch (e2) {}
      }
      try {
        bg = installBackgroundFeature({ react: react });
        registered = bg.register(ctx);
        window.__dshTsnetSkinBg = bg;
        if (!registered) {
          try { ctx && ctx.logger && ctx.logger.warn && ctx.logger.warn("[tsnet-skin] 背景引擎已启动，但 slots 服务不在：设置行未注册（背景仍生效）"); } catch (e) {}
        }
      } catch (e) {
        try { ctx && ctx.logger && ctx.logger.warn && ctx.logger.warn("[tsnet-skin] 背景引擎启动失败：" + String((e && e.message) || e)); } catch (e2) {}
      }
    };
    return module.exports;
  },
});

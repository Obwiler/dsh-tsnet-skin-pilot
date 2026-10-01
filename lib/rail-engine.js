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

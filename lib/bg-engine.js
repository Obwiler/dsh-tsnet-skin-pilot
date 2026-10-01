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
  var FT_ROOT = '__TSNET_WORKSPACE__';
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

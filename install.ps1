#Requires -Version 5.1
<#
install.ps1 —— 把 dsh-tsnet-skin-pilot 装进 DSH profile（幂等、可逆、带验证）

为什么有这个脚本：上一版皮肤是**手工装配**的（junction + 依赖行 + 补丁层三件），
结果三件里任何一件没写进"交付物"，下一个人照装就会得到不一样的结果（D-§7.2 的教训）。
所以这次把装配做成脚本：装一次 = 跑一次；撤一次 = 跑一次带 -Uninstall。

用法：
  pwsh -NoProfile -File plugins\dsh-tsnet-skin-pilot\install.ps1
  pwsh -NoProfile -File plugins\dsh-tsnet-skin-pilot\install.ps1 -Uninstall
  powershell -NoProfile -File ...（Windows PowerShell 5.1 同样支持）

参数：
  -ProfileName  默认 web
  -DshHome      默认取 $env:DSH_HOME（量不到就报错退出，不猜路径）

它做的三件事（都可逆；补丁层是**热生效**的，不需要重启 DSH）：
  ① junction   <profile>\node_modules\dsh-tsnet-skin-pilot → 本插件目录
  ② 依赖行     <profile>\package.json 的 dependencies 里加一行 file: 依赖
  ③ 补丁层     <profile>\cordis.patch.yml 追加 insert 段（用固定标记注释包裹，便于回撤）

验证：脚本结束前把三件的现场各打印一行（存在/指向/命中），调用方刷新页面再看皮肤是否生效。
#>
[CmdletBinding()]
param(
    [string]$ProfileName = 'web',
    [string]$DshHome = $env:DSH_HOME,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$Name = 'dsh-tsnet-skin-pilot'
$MarkerBegin = '# ── BEGIN dsh-tsnet-skin-pilot (managed by install.ps1) ──'
$MarkerEnd = '# ── END dsh-tsnet-skin-pilot ──'

# D2：路径一律从脚本自身位置推导，不硬编码工作区根
$PluginDir = $PSScriptRoot
$RepoRoot = Split-Path (Split-Path $PluginDir -Parent) -Parent

if (-not $DshHome) { throw 'DSH_HOME 量不到：请设置 $env:DSH_HOME 或用 -DshHome 指定（不猜路径）' }
$ProfileDir = Join-Path $DshHome (Join-Path 'profiles' $ProfileName)
if (-not (Test-Path $ProfileDir)) { throw "profile 目录不存在：$ProfileDir" }

$ModulesDir = Join-Path $ProfileDir 'node_modules'
$LinkPath = Join-Path $ModulesDir $Name
$PkgJsonPath = Join-Path $ProfileDir 'package.json'
$PatchPath = Join-Path $ProfileDir 'cordis.patch.yml'
$DepValue = 'file:' + ($PluginDir -replace '\\', '/')

function Write-Utf8NoBom([string]$Path, [string]$Text) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, ($Text -replace "`r`n", "`n"), $enc)
}

function Get-Text([string]$Path) { return [IO.File]::ReadAllText($Path) }

# junction 指向：PS 7 有 .Target/.LinkTarget，Windows PowerShell 5.1 都没有
# ⇒ 用 `dir /AL` 的方括号输出兜底（两个解释器都能跑，D8 的双解释器要求）
function Get-JunctionTarget([string]$Path) {
    $item = Get-Item $Path -Force
    foreach ($p in @('Target', 'LinkTarget')) {
        $v = $null
        try { $v = $item.$p } catch { }
        if ($v) { if ($v -is [array]) { return [string]$v[0] } else { return [string]$v } }
    }
    $parent = Split-Path $Path -Parent
    $leaf = Split-Path $Path -Leaf
    $out = & cmd.exe /c dir /AL "$parent" 2>$null
    foreach ($line in $out) {
        if ($line -match [regex]::Escape($leaf) -and $line -match '\[(.+?)\]') { return $Matches[1] }
    }
    return ''
}

# ── 三件：安装 ────────────────────────────────────────────────────────────────
function Install-Junction {
    if (Test-Path $LinkPath) {
        $item = Get-Item $LinkPath -Force
        if ($item.LinkType -eq 'Junction') {
            $tgt = (Get-JunctionTarget $LinkPath).TrimEnd('\')
            if ($tgt -and ($tgt -ieq $PluginDir.TrimEnd('\'))) { return "已存在且指向正确（跳过）：$tgt" }
            throw "junction 已存在但指向 '$tgt'（不是本插件）—— 不动它，请人工确认"
        }
        throw "$LinkPath 已存在且不是 junction —— 不动它，请人工确认"
    }
    & cmd.exe /c mklink /J "$LinkPath" "$PluginDir" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "mklink 失败（rc=$LASTEXITCODE）" }
    return '已创建'
}

function Install-DepLine {
    $t = Get-Text $PkgJsonPath
    if ($t -match [regex]::Escape('"' + $Name + '"')) { return '依赖行已存在（跳过）' }
    # 在 dependencies 块的第一行之后插入：只碰一行，不重排整个 JSON（避免整篇 diff）
    $lines = $t -split "`n"
    $idx = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\s*"dependencies"\s*:\s*\{') { $idx = $i; break }
    }
    if ($idx -lt 0) { throw 'package.json 里找不到 dependencies 块' }
    $newLine = '    "' + $Name + '": "' + $DepValue + '",'
    $out = @()
    $out += $lines[0..$idx]
    $out += $newLine
    if ($idx + 1 -le $lines.Count - 1) { $out += $lines[($idx + 1)..($lines.Count - 1)] }
    Write-Utf8NoBom $PkgJsonPath ($out -join "`n")
    # 回读断言：写完必须证明它真进去了（§12.4）
    if (-not ((Get-Text $PkgJsonPath) -match [regex]::Escape('"' + $Name + '"'))) { throw '依赖行写入后回读失败' }
    return '已写入'
}

function Install-PatchRow {
    $t = Get-Text $PatchPath
    if ($t -match [regex]::Escape('name: ' + $Name)) { return '补丁层段已存在（跳过）' }
    $block = @()
    $block += ''
    $block += $MarkerBegin
    $block += '# 皮肤 v3 阶段 3 试点（只改浮层 + 侧栏）。删掉本段即卸载（热生效，无需重启 DSH）。'
    $block += '# 源码：' + $PluginDir
    $block += '- insert:'
    $block += '    - id: tsnet-skin-pilot'
    $block += '      name: ' + $Name
    $block += $MarkerEnd
    Write-Utf8NoBom $PatchPath ($t.TrimEnd("`n") + "`n" + ($block -join "`n") + "`n")
    if (-not ((Get-Text $PatchPath) -match [regex]::Escape('name: ' + $Name))) { throw '补丁层写入后回读失败' }
    return '已追加'
}

# ── 三件：卸载 ────────────────────────────────────────────────────────────────
function Uninstall-Junction {
    if (-not (Test-Path $LinkPath)) { return '不存在（跳过）' }
    # 只删链接不动目标：rdir 对 junction 只移除重解析点
    & cmd.exe /c rmdir "$LinkPath" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "rmdir 失败（rc=$LASTEXITCODE）" }
    if (Test-Path (Join-Path $PluginDir 'skin.css')) { return '已移除（插件目录完好）' }
    throw '移除 junction 后插件目录不见了 —— 立即人工检查'
}

function Uninstall-DepLine {
    $t = Get-Text $PkgJsonPath
    if (-not ($t -match [regex]::Escape('"' + $Name + '"'))) { return '依赖行不存在（跳过）' }
    $lines = $t -split "`n"
    $kept = $lines | Where-Object { $_ -notmatch ('^\s*"' + [regex]::Escape($Name) + '"\s*:') }
    Write-Utf8NoBom $PkgJsonPath ($kept -join "`n")
    if ((Get-Text $PkgJsonPath) -match [regex]::Escape('"' + $Name + '"')) { throw '依赖行删除后回读失败' }
    return '已移除'
}

function Uninstall-PatchRow {
    $t = Get-Text $PatchPath
    if (-not ($t -match [regex]::Escape($MarkerBegin))) { return '补丁层段不存在（跳过）' }
    $lines = $t -split "`n"
    $kept = @(); $skipping = $false
    foreach ($l in $lines) {
        if ($l -match [regex]::Escape($MarkerBegin)) { $skipping = $true; continue }
        if ($l -match [regex]::Escape($MarkerEnd)) { $skipping = $false; continue }
        if (-not $skipping) { $kept += $l }
    }
    Write-Utf8NoBom $PatchPath (($kept -join "`n").TrimEnd("`n") + "`n")
    if ((Get-Text $PatchPath) -match [regex]::Escape('name: ' + $Name)) { throw '补丁层删除后回读失败' }
    return '已移除'
}

# ── 跑 ────────────────────────────────────────────────────────────────────────
Write-Host ("dsh-tsnet-skin-pilot  {0}" -f $(if ($Uninstall) { '卸载' } else { '安装' }))
Write-Host ("  插件目录 : {0}" -f $PluginDir)
Write-Host ("  仓库根   : {0}  (由脚本位置推导，未硬编码)" -f $RepoRoot)
Write-Host ("  profile  : {0}" -f $ProfileDir)
Write-Host ''

if ($Uninstall) {
    $r1 = Uninstall-Junction; $r2 = Uninstall-DepLine; $r3 = Uninstall-PatchRow
} else {
    if (-not (Test-Path $PatchPath)) { throw "找不到补丁层文件：$PatchPath" }
    $r1 = Install-Junction; $r2 = Install-DepLine; $r3 = Install-PatchRow
}

Write-Host ("  ① junction : {0}" -f $r1)
Write-Host ("  ② 依赖行   : {0}" -f $r2)
Write-Host ("  ③ 补丁层   : {0}" -f $r3)
Write-Host ''

# 现场验证：三件各打一行事实，而不是"我执行了"
$okLink = (Test-Path $LinkPath)
if ($okLink) { $okLink = ((Get-Item $LinkPath -Force).LinkType -eq 'Junction') }
$okDep = ((Get-Text $PkgJsonPath) -match [regex]::Escape('"' + $Name + '"'))
$okPatch = ((Get-Text $PatchPath) -match [regex]::Escape('name: ' + $Name))
Write-Host ("  现场：junction={0} 依赖行={1} 补丁层={2}" -f $okLink, $okDep, $okPatch)

if ($Uninstall) {
    if ($okLink -or $okDep -or $okPatch) { Write-Host '  结果：卸载未彻底（上面还有 True）'; exit 1 }
    Write-Host '  结果：三件已全部撤除（刷新页面即回默认外观）'
    exit 0
}
if ($okLink -and $okDep -and $okPatch) {
    Write-Host '  结果：装配完成 —— 刷新 DSH 页面即生效（补丁层热生效，不需要重启 DSH）'
    exit 0
}
Write-Host '  结果：装配不完整'
exit 1

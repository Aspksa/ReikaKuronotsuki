param([ValidateSet('check','run')][string]$Step = 'run')
# Reika Kuronotsuki launcher. Saved as UTF-8 WITH BOM so Windows PowerShell 5.1 reads Cyrillic correctly.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$nodeVersion = 'v22.16.0'

function Test-NodeRuntime {
    param([string]$Candidate)
    if (-not $Candidate -or -not (Test-Path -LiteralPath $Candidate -PathType Leaf)) { return $false }
    try {
        $versionText = (& $Candidate -p 'process.versions.node' 2>$null)
        $version = [version]($versionText | Select-Object -First 1)
        return $version -ge [version]'22.13.0'
    } catch { return $false }
}

function Find-Node {
    $local = Join-Path $root 'runtime\node\node.exe'
    if (Test-NodeRuntime -Candidate $local) { return $local }
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd -and (Test-NodeRuntime -Candidate $cmd.Source)) { return $cmd.Source }
    return $null
}

function Install-PortableNode {
    # Node is stored inside the project folder, so the project keeps working from a flash drive.
    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
    $name = "node-$nodeVersion-win-$arch"
    $url = "https://nodejs.org/dist/$nodeVersion/$name.zip"
    $tmp = Join-Path $root 'runtime\download'
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $zip = Join-Path $tmp "$name.zip"
    Write-Host "Node.js 22.13+ не найден (или установлен несовместимый). Скачиваю переносную версию ($name)..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
    $target = Join-Path $root 'runtime\node'
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
    Move-Item -LiteralPath (Join-Path $tmp $name) -Destination $target
    Remove-Item -LiteralPath $tmp -Recurse -Force
}

function Get-NodeOrInstall {
    $node = Find-Node
    if (-not $node) { Install-PortableNode; $node = Find-Node }
    if (-not $node) { throw 'Нужен Node.js 22.13 или новее для встроенной SQLite. Не удалось найти или скачать совместимую версию.' }
    return $node
}

if ($Step -eq 'check') {
    try {
        $node = Get-NodeOrInstall
        Write-Host "Node.js: $node"
        # Install the pinned upstream MemOS SDK directly into the application.
        $sdk = Join-Path $root 'node_modules\@mem-os\sdk\dist\index.js'
        $sourceStamp = Join-Path $root 'vendor\memos\REIKA_UPSTREAM.txt'
        $installedStamp = Join-Path $root 'runtime\memos-vendored-installed.txt'
        if (-not (Test-Path -LiteralPath $sourceStamp)) { throw 'В проекте отсутствует версия исходников MemOS.' }
        $requiredStamp = (Get-Content -LiteralPath $sourceStamp -Raw).Trim()
        $currentStamp = if (Test-Path -LiteralPath $installedStamp) { (Get-Content -LiteralPath $installedStamp -Raw).Trim() } else { '' }
        # Replace a previously installed npm package with the vendored SDK.
        if (-not (Test-Path -LiteralPath $sdk) -or $currentStamp -ne $requiredStamp) {
            if (-not (Test-Path -LiteralPath (Join-Path $root 'vendor\memos\dist\index.js'))) { throw 'Не найдена локальная сборка MemOS. Скачайте актуальную версию проекта с GitHub.' }
            Write-Host 'Устанавливаю встроенную память MemOS...'
            $localNpm = Join-Path $root 'runtime\node\node_modules\npm\bin\npm-cli.js'
            if (Test-Path -LiteralPath $localNpm) {
                & $node $localNpm install --omit=dev --no-audit --no-fund
            } else {
                $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
                if (-not $npm) { throw 'Не найден npm для установки памяти MemOS.' }
                & $npm.Source install --omit=dev --no-audit --no-fund
            }
            if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $sdk)) { throw 'Не удалось установить MemOS. Проверьте подключение к интернету.' }
            Set-Content -LiteralPath $installedStamp -Value $requiredStamp -Encoding ASCII
        }

        & $node (Join-Path $root 'tests\run.js')
        exit $LASTEXITCODE
    } catch {
        Write-Host "Ошибка: $($_.Exception.Message)"
        exit 1
    }
}

# ---- Step: run (hidden window, lives in the system tray next to the clock) ----
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\ReikaKuronotsuki', [ref]$created)
if (-not $created) {
    # Already running: just open the chat again (the running copy leaves its address in %TEMP%).
    $urlFile = Join-Path $env:TEMP 'reika-kuronotsuki.url'
    if (Test-Path -LiteralPath $urlFile) { Start-Process (Get-Content -LiteralPath $urlFile -Raw).Trim(); exit 0 }
    foreach ($port in 8731..8780) {
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -UseBasicParsing -TimeoutSec 1
            if ($r.StatusCode -eq 200) { Start-Process "http://127.0.0.1:$port/"; break }
        } catch { }
    }
    exit 0
}

$node = Get-NodeOrInstall
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $node
$psi.Arguments = '"' + (Join-Path $root 'launcher\boot.js') + '"'
$psi.WorkingDirectory = $root
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardOutput = $true
$psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
$server = [System.Diagnostics.Process]::Start($psi)

$url = $null
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline -and -not $server.HasExited) {
    $line = $server.StandardOutput.ReadLine()
    if ($line -and $line.StartsWith('REIKA_READY ')) {
        $url = ($line.Substring(12) | ConvertFrom-Json).url
        break
    }
}
if (-not $url) {
    [System.Windows.Forms.MessageBox]::Show('Сервер Рэйки не запустился.', 'Reika Kuronotsuki') | Out-Null
    exit 1
}
Set-Content -LiteralPath (Join-Path $env:TEMP 'reika-kuronotsuki.url') -Value $url -Encoding ASCII
# The server prints only a couple of lines at start-up, so the unread pipe can never fill up.

function New-TrayIcon {
    # The project's own icon (several sizes inside); if it is missing, a simple moon is drawn instead.
    $ico = Join-Path $root 'web\assets\logo\windows.ico'
    try { if (Test-Path -LiteralPath $ico) { return New-Object System.Drawing.Icon($ico, 32, 32) } } catch { }
    $bmp = New-Object System.Drawing.Bitmap 32, 32
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(216, 180, 106))), 2, 2, 28, 28)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(23, 20, 29))), 11, 2, 22, 26)
    $g.Dispose()
    return [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = New-TrayIcon
$tray.Text = 'Рэйка Куроноцуки'
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$open = $menu.Items.Add('Открыть чат')
$exit = $menu.Items.Add('Выход')
$tray.ContextMenuStrip = $menu
$tray.Visible = $true

$open.add_Click({ Start-Process $url })
$tray.add_DoubleClick({ Start-Process $url })

$context = New-Object System.Windows.Forms.ApplicationContext
$exit.add_Click({ $context.ExitThread() })

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000
$timer.add_Tick({ if ($server.HasExited) { $context.ExitThread() } })
$timer.Start()

Start-Process $url
$tray.BalloonTipTitle = 'Рэйка'
$tray.BalloonTipText = 'Работаю в трее рядом с часами. Двойной щелчок — открыть чат.'
$tray.ShowBalloonTip(3000)

try {
    [System.Windows.Forms.Application]::Run($context)
} finally {
    Remove-Item -LiteralPath (Join-Path $env:TEMP 'reika-kuronotsuki.url') -ErrorAction SilentlyContinue
    $tray.Visible = $false
    $tray.Dispose()
    if (-not $server.HasExited) { & taskkill.exe /PID $server.Id /T /F | Out-Null }
    $mutex.ReleaseMutex()
}

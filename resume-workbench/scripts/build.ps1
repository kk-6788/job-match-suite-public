$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
foreach ($required in @('index.html','app/app.js','app/core.js','app/render.js','app/resume.css','app/services.js','desktop/main.cjs')) { if (-not (Test-Path -LiteralPath (Join-Path $root $required))) { throw ('缺少构建文件：'+$required) } }
$packageVersion = (Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$shortVersion = ($packageVersion.Split('.')[0..1] -join '.')
$target = Join-Path $root ('outputs\简历工作台-'+$shortVersion+'-Windows')
if (Test-Path -LiteralPath $target) { throw '发布目录已存在。请先将旧发布目录重命名留存，再重新构建。' }
$electronZip = if ($env:RESUME_ELECTRON_ZIP) { Get-Item -LiteralPath $env:RESUME_ELECTRON_ZIP } else { Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'electron\Cache') -Recurse -Filter 'electron-v42.4.0-win32-x64.zip' | Select-Object -First 1 }
if (-not $electronZip) { throw '缺少 Electron 42.4.0 Windows x64 官方运行包。请通过 RESUME_ELECTRON_ZIP 指定下载文件。' }
New-Item -ItemType Directory -Path $target -Force | Out-Null
Expand-Archive -LiteralPath $electronZip.FullName -DestinationPath $target
$appTarget = Join-Path $target 'resources\app'
New-Item -ItemType Directory -Path $appTarget -Force | Out-Null
foreach ($entry in @('index.html','app','vendor','desktop')) { Copy-Item -LiteralPath (Join-Path $root $entry) -Destination $appTarget -Recurse }
(@{name='resume-workbench';version=$packageVersion;main='desktop/main.cjs';private=$true} | ConvertTo-Json) | Set-Content -LiteralPath (Join-Path $appTarget 'package.json') -Encoding utf8
Rename-Item -LiteralPath (Join-Path $target 'electron.exe') -NewName '简历工作台.exe'
@"
简历工作台 $shortVersion · Windows x64 便携版
双击 简历工作台.exe 启动。请保留整个目录，勿只移动 EXE。
无需安装；浏览器版可打开 resources/app/index.html。
数据保存在当前 Windows 用户的应用数据目录，API Key 通过 Windows 系统加密保存。
导出前请使用质量检查并确认个人事实。PDF 采用本机 Chromium 打印，DOCX 为可编辑文档。
此发布未签名；不包含旧客户简历。完整使用说明见原交付的说明文件。
"@ | Set-Content -LiteralPath (Join-Path $target '使用说明.txt') -Encoding utf8
Copy-Item -LiteralPath (Join-Path $root 'README.md') -Destination (Join-Path $target '使用说明.md')
Copy-Item -LiteralPath (Join-Path $root 'docs') -Destination $target -Recurse
Write-Output $target



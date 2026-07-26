param (
    [string]$RepoUrl = "https://github.com/hub-google/monster-arena-web.git"
)

# ── Git 身份（push 需要） ──────────────────────────────────────────────────────
git config --global user.email "deploy@monsterarena.app" | Out-Null
git config --global user.name  "MonsterArena"            | Out-Null

# ── 路徑設定 ──────────────────────────────────────────────────────────────────
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendSrc = Join-Path $ProjectRoot "frontend"
$TempBuild   = "C:\Temp\frontend_build\frontend"
$DistPath    = Join-Path $TempBuild "dist"

# ── Step 1: 同步最新源碼到 Temp（避免 Google Drive EPERM 問題） ───────────────
Write-Host "==== Syncing source to Temp ====" -ForegroundColor Cyan
if (!(Test-Path $TempBuild)) { New-Item -ItemType Directory -Path $TempBuild -Force | Out-Null }

# 複製所有源碼，排除 node_modules 和 dist
robocopy $FrontendSrc $TempBuild /E /XD node_modules dist .git /NP /NFL /NDL | Out-Null
Write-Host "Sync done." -ForegroundColor Green

# ── Step 2: 安裝依賴 & Build ───────────────────────────────────────────────────
Write-Host "==== Installing dependencies ====" -ForegroundColor Cyan
Set-Location $TempBuild
cmd /c "npm install" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "npm install failed!" -ForegroundColor Red; exit 1 }

Write-Host "==== Building ====" -ForegroundColor Cyan
cmd /c "npm run build" 2>&1
if (!(Test-Path $DistPath)) { Write-Host "Build failed! dist not found." -ForegroundColor Red; exit 1 }
Write-Host "Build done." -ForegroundColor Green

# ── Step 3: 部署 dist 到 GitHub Pages (gh-pages branch) ───────────────────────
Write-Host "==== Deploying to GitHub Pages ====" -ForegroundColor Cyan
Set-Location $DistPath

if (Test-Path ".git") { Remove-Item -Recurse -Force ".git" }
git init
git add .
git commit -m "Deploy"
git remote add origin $RepoUrl
git branch -M gh-pages
git push -f origin gh-pages

if ($LASTEXITCODE -eq 0) {
    Write-Host "GitHub Pages deployed!" -ForegroundColor Green
    Write-Host "URL: https://hub-google.github.io/monster-arena-web/" -ForegroundColor Cyan
} else {
    Write-Host "Push failed!" -ForegroundColor Red
    exit 1
}

Set-Location $ProjectRoot
Write-Host "==== All done! ====" -ForegroundColor Green

param (
    [string]$RepoUrl = ""
)

Write-Host "==== Build Frontend ===="
cd frontend
npm install
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "==== Deploy to GitHub Pages ===="
cd dist
git init
git add .
git commit -m "Deploy to GitHub Pages"

if ($RepoUrl -ne "") {
    git remote remove origin 2>$null
    git remote add origin $RepoUrl
    git branch -M gh-pages
    git push -f origin gh-pages
    Write-Host "GitHub Pages Deployed!" -ForegroundColor Green
} else {
    Write-Host "RepoUrl not provided. Please push manually to gh-pages branch." -ForegroundColor Yellow
}

Write-Host "==== Sync Project Source ===="
cd ../../
if (!(Test-Path ".git")) {
    git init
}
git add .
git commit -m "feat: implement 3v3 relay, new breeding, and idle missions"

if ($RepoUrl -ne "") {
    git remote remove origin 2>$null
    git remote add origin $RepoUrl
    git branch -M main
    git push -u origin main
    Write-Host "Project Source Synced!" -ForegroundColor Green
} else {
    Write-Host "Source Commited! RepoUrl not provided. Please push manually." -ForegroundColor Yellow
}

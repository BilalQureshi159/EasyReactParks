# Auto-push commits to GitHub after each local commit.
$ErrorActionPreference = 'SilentlyContinue'
$branch = git rev-parse --abbrev-ref HEAD 2>$null
if (-not $branch) { exit 0 }
$remote = git remote get-url origin 2>$null
if (-not $remote) { exit 0 }
Write-Host "Auto-pushing to origin/$branch..."
git push -u origin $branch 2>$null
if ($LASTEXITCODE -ne 0) { git push origin $branch }

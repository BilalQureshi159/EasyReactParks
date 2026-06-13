# Sets up a private GitHub repo and auto-push on every commit.
#
# Usage (from project folder):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-github.ps1
#
# Or double-click: scripts\setup-github.bat

param(
  [string]$RepoName = "easyticketing",
  [string]$GitHubUser = "",
  [string]$Description = "EasyTicketing private park ticketing platform"
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Set-Location $Root

function Ensure-Gh {
  $gh = Get-Command gh -ErrorAction SilentlyContinue
  if (-not $gh) {
    Write-Host "GitHub CLI (gh) not found."
    Write-Host "Install: winget install GitHub.cli"
    Write-Host "Then close and reopen PowerShell."
    exit 1
  }
}

function Ensure-GhAuth {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  gh auth status 2>&1 | Out-Null
  $authed = ($LASTEXITCODE -eq 0)
  $ErrorActionPreference = $prev

  if (-not $authed) {
    Write-Host ""
    Write-Host "=== GitHub login required ==="
    Write-Host "Follow the prompts. Choose: GitHub.com, HTTPS, Login with browser."
    Write-Host ""
    gh auth login -h github.com -p https -w
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Login failed. Try manually: gh auth login"
      exit 1
    }
  }
}

function Install-AutoPushHook {
  $hookPath = Join-Path $Root ".git\hooks\post-commit"
  $psScript = Join-Path $Root "scripts\git-auto-push.ps1"
  $hookLines = @(
    "#!/bin/sh"
    "exec powershell -NoProfile -ExecutionPolicy Bypass -File `"$psScript`""
  )
  $hookText = ($hookLines -join "`n") + "`n"
  [System.IO.File]::WriteAllText($hookPath, $hookText)
  Write-Host "Installed auto-push hook (runs after each commit)."
}

Ensure-Gh
Ensure-GhAuth

if (-not (Test-Path (Join-Path $Root ".git"))) {
  git init -b main
  Write-Host "Initialized git repository (branch: main)"
}

Install-AutoPushHook

$hasHead = $false
$prev = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
git rev-parse HEAD 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { $hasHead = $true }
$ErrorActionPreference = $prev

if (-not $hasHead) {
  Write-Host "Creating initial commit..."
  git add -A
  git commit -m "Initial commit: EasyTicketing platform"
}

if (-not $GitHubUser) {
  $GitHubUser = gh api user -q .login
}

$remoteUrl = "https://github.com/$GitHubUser/$RepoName.git"
$hasOrigin = $false
$prev = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
git remote get-url origin 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { $hasOrigin = $true }
$ErrorActionPreference = $prev

if (-not $hasOrigin) {
  Write-Host "Creating private repo: $GitHubUser/$RepoName"
  gh repo create $RepoName --private --description $Description --source . --remote origin --push
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Could not create repo automatically."
    Write-Host "1. Open https://github.com/new"
    Write-Host "2. Name: $RepoName, visibility: Private, do NOT add README"
    Write-Host "3. Run these commands:"
    Write-Host "   git remote add origin $remoteUrl"
    Write-Host "   git push -u origin main"
    exit 1
  }
} else {
  $origin = git remote get-url origin
  Write-Host "Remote origin already set: $origin"
  git push -u origin main 2>$null
  if ($LASTEXITCODE -ne 0) {
    git push -u origin master 2>$null
  }
}

Write-Host ""
Write-Host "Done! Private repo: https://github.com/$GitHubUser/$RepoName"
Write-Host "After each commit, changes auto-push to GitHub."
Write-Host "Example: git add ."
Write-Host "         git commit -m ""your message"""

#!/bin/sh
# Auto-push commits to GitHub (private repo). Skips if no remote or push fails (e.g. offline).
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
if [ -z "$branch" ]; then exit 0; fi
if ! git remote get-url origin >/dev/null 2>&1; then exit 0; fi
echo "Auto-pushing to origin/$branch..."
git push -u origin "$branch" 2>/dev/null || git push origin "$branch"

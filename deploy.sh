#!/bin/bash
# Deploy script for ariel-dashboard
# Usage: ./deploy.sh "commit message"

set -e

cd /root/.openclaw/workspace/dashboard

# Git commit and push (auto-deploy handles the rest via GitHub integration)
git add -A
git commit -m "${1:-Update}" || echo "Nothing to commit"
git push origin main

echo "Pushed to GitHub — Cloudflare Pages auto-deploy will build and publish."

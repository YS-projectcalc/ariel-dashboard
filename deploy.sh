#!/bin/bash
# Deploy script for ariel-dashboard
# Usage: ./deploy.sh "commit message"

set -e

# Load Cloudflare credentials
source /root/clawd/funnels/.env

cd /root/clawd/dashboard

# Git commit and push
git add -A
git commit -m "${1:-Update}" || echo "Nothing to commit"
git push origin main

# Build and deploy to Cloudflare
npm run build
npx wrangler pages deploy out --project-name=ariel-dashboard

echo "✅ Deployed to https://ariel-dashboard.pages.dev"

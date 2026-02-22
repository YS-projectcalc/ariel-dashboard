#!/bin/bash
# Run the daily task population and deploy
cd /root/.openclaw/workspace/dashboard
node scripts/populate-today.js
# Commit and push so Cloudflare auto-deploys
cd /root/.openclaw/workspace
git add dashboard/public/status.json
git commit -m "Daily task population for $(TZ=Asia/Jerusalem date +%Y-%m-%d)" --allow-empty 2>/dev/null
git push 2>/dev/null

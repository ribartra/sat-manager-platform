#!/bin/bash
# Hourly deadline reminders (cron, installed by apply-stack.sh). Calls the internal route from
# inside the web container (localhost:3000) with the internal service token; Caddy answers 404 for
# /api/internal/* from outside.
docker exec sat-platform-web-1 node -e "fetch('http://localhost:3000/api/internal/notifications/generate',{method:'POST',headers:{Authorization:'Bearer '+process.env.INTERNAL_INGEST_TOKEN}}).then(async r=>{console.log(new Date().toISOString(),r.status,await r.text());process.exit(r.ok?0:1)}).catch(e=>{console.error(new Date().toISOString(),e.message);process.exit(1)})"

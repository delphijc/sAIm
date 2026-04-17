# Restart Service Monitor Dashboard

---
name: Restart
description: Restart the service monitor dashboard
---

## Workflow

Restarting the Service Monitor Dashboard...

```bash
cd $HOME/.claude/skills/service-monitor-dashboard
./manage.sh stop
sleep 2
./manage.sh dev
```

This will:
1. Stop any running instances
2. Wait 2 seconds for cleanup
3. Start fresh instances of both server and client
4. Display URLs for accessing the dashboard

Once running, visit: **http://localhost:5175**

The dashboard will display real-time metrics for all PAI infrastructure services.

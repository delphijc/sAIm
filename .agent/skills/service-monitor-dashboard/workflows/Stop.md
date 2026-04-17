# Stop Service Monitor Dashboard

---
name: Stop
description: Stop the running service monitor dashboard
---

## Workflow

Stopping the Service Monitor Dashboard...

```bash
cd $HOME/.claude/skills/service-monitor-dashboard
./manage.sh stop
```

This will:
1. Terminate the backend server (port 6000)
2. Terminate the frontend client (port 5175)
3. Clean up process files

The dashboard will no longer be accessible at http://localhost:5175.

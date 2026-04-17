# Start Service Monitor Dashboard

---
name: Start
description: Launch the service monitor dashboard with both server and client
---

## Workflow

Starting the Service Monitor Dashboard...

```bash
cd $HOME/.claude/skills/service-monitor-dashboard
./manage.sh dev
```

This will:
1. Install dependencies (if needed)
2. Start the backend server on port 6000
3. Start the frontend client on port 5175
4. Display URLs for accessing the dashboard

Once running, visit: **http://localhost:5175**

The dashboard will display real-time metrics for all PAI infrastructure services with CPU, memory, restart times, and service control buttons.

Press `Ctrl+C` to stop both services.

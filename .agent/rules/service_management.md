# Service Management Rules

## MANDATORY: start_dashboard.sh (PAI/frontmatter.studio ONLY)
The `start_dashboard.sh` script located in `$HOME/Projects/sam/.agent/task_runner/start_dashboard.sh` is ONLY for the **frontmatter.studio** project (PAI infrastructure).

### frontmatter.studio Commands
- **Start**: `./start_dashboard.sh --start --id <project_id>`
- **Stop**: `./start_dashboard.sh --stop`
- **Restart**: `./start_dashboard.sh --restart`

### Other Projects
For projects OTHER than frontmatter.studio (e.g., rot, realms-of-tomorrow), create a PROJECT-SPECIFIC start script (e.g., `start_rot.sh`) in the project root that handles:
- Frontend server startup/shutdown
- Backend API server startup/shutdown
- Database services (Docker containers, etc.)

Each project should maintain its own service management script following this pattern:
```bash
#!/bin/bash
# Project-specific start/stop/restart logic
# Supports: --start, --stop, --restart
```

**Failure to use the correct script for the project is a violation of project standards.**

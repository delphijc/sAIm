# Storage Management

Manage cookies, localStorage, sessionStorage, and browser storage state.

## Storage State (Save/Restore)

```bash
playwright-cli state-save                  # Auto-named file
playwright-cli state-save my-auth.json     # Named file
playwright-cli state-load my-auth.json     # Restore
```

## Cookies

```bash
playwright-cli cookie-list
playwright-cli cookie-list --domain=example.com
playwright-cli cookie-list --path=/api
playwright-cli cookie-get session_id
playwright-cli cookie-set session abc123
playwright-cli cookie-set session abc123 --domain=example.com --httpOnly --secure --sameSite=Lax
playwright-cli cookie-set remember_me token123 --expires=1735689600
playwright-cli cookie-delete session_id
playwright-cli cookie-clear
```

## Local Storage

```bash
playwright-cli localstorage-list
playwright-cli localstorage-get token
playwright-cli localstorage-set theme dark
playwright-cli localstorage-set user_settings '{"theme":"dark","language":"en"}'
playwright-cli localstorage-delete token
playwright-cli localstorage-clear
```

## Session Storage

```bash
playwright-cli sessionstorage-list
playwright-cli sessionstorage-get form_data
playwright-cli sessionstorage-set step 3
playwright-cli sessionstorage-delete step
playwright-cli sessionstorage-clear
```

## Auth State Reuse Pattern

```bash
# Login and save
playwright-cli open https://app.example.com/login
playwright-cli snapshot
playwright-cli fill e1 "user@example.com"
playwright-cli fill e2 "password123"
playwright-cli click e3
playwright-cli state-save auth.json

# Restore in new session
playwright-cli state-load auth.json
playwright-cli open https://app.example.com/dashboard
```

## Security Notes

- Never commit state files with auth tokens
- Add `*.auth-state.json` to `.gitignore`
- Delete state files after automation completes
- Default in-memory mode is safer for sensitive operations

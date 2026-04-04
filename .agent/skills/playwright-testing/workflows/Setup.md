---
description: Install and configure Playwright for a new or existing project
globs: ""
alwaysApply: false
---

# Setup Workflow -- playwright-testing

## Purpose

Install Playwright, configure it for the project (with SvelteKit-specific settings when applicable), create the directory structure, and generate a baseline smoke test.

## Steps

### Step 1: Detect Project Type

Examine the project to determine:
- Is this a SvelteKit project? Check for `svelte.config.js` or `+page.svelte` files.
- What package manager is in use? Check for `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json`.
- What port does the dev server run on? Check `vite.config.ts` or `svelte.config.js` for server port.
- Is there an existing `playwright.config.ts`? If so, validate it instead of overwriting.

### Step 2: Install Dependencies

```bash
# Using bun (preferred for PAI projects)
bun add -d @playwright/test

# Install browsers
bunx playwright install --with-deps
```

For other package managers:
```bash
# npm
npm install -D @playwright/test
npx playwright install --with-deps

# pnpm
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps
```

### Step 3: Generate Configuration

Create `playwright.config.ts` at the project root. Use the SvelteKit template from `Reference.md` as the base. Key configuration decisions:

- **testDir:** `./e2e` (keep E2E tests separate from unit tests)
- **baseURL:** Match the dev server port from vite config
- **webServer.command:** Use the project's dev command (`bun run dev`, etc.)
- **webServer.cwd:** Point to the SvelteKit app root if it is in a subdirectory
- **fullyParallel:** `true` for speed
- **retries:** `0` locally, `2` in CI
- **reporters:** `html` + `list` locally, `html` + `github` in CI

### Step 4: Create Directory Structure

```bash
mkdir -p e2e/routes
mkdir -p e2e/fixtures
mkdir -p .auth
```

### Step 5: Update .gitignore

Append these entries if they are not already present:

```
# Playwright
test-results/
playwright-report/
.auth/
blob-report/
```

### Step 6: Generate Smoke Test

Create `e2e/smoke.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);  // Page has a title
  });

  test('no console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});
```

### Step 7: Add Package.json Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "PWDEBUG=1 playwright test --headed",
    "test:e2e:chromium": "playwright test --project=chromium",
    "test:e2e:update-snapshots": "playwright test --update-snapshots"
  }
}
```

### Step 8: Verify Installation

```bash
bunx playwright test --project=chromium e2e/smoke.spec.ts
```

Confirm the smoke test passes before declaring setup complete.

## Checklist

- [ ] Dependencies installed (`@playwright/test`)
- [ ] Browsers installed (`playwright install --with-deps`)
- [ ] `playwright.config.ts` created with correct baseURL and webServer
- [ ] `e2e/` directory structure created
- [ ] `.gitignore` updated with Playwright artifacts
- [ ] Smoke test created and passing
- [ ] Package.json scripts added
- [ ] Verified test execution succeeds

---
description: Debug failing or flaky Playwright tests using systematic diagnosis techniques
globs: ""
alwaysApply: false
---

# Debug Workflow -- playwright-testing

## Purpose

Systematically diagnose and fix failing, flaky, or timing-sensitive Playwright tests using traces, screenshots, and progressive debugging techniques.

## Steps

### Step 1: Categorize the Failure

Identify which category the failure falls into:

| Category | Symptoms | Likely Cause |
|----------|----------|--------------|
| **Timeout** | "Timeout 30000ms exceeded" | Element not rendered, wrong locator, slow load |
| **Flaky** | Passes sometimes, fails sometimes | Race condition, animation, network timing |
| **Locator** | "Expected element to be visible" | Wrong selector, element structure changed |
| **Navigation** | "Page closed" or "Target closed" | Navigation occurred during assertion |
| **Network** | Connection refused, ECONNRESET | Dev server not running, port conflict |
| **Auth** | Redirect to login, 401 errors | Missing or expired auth state |

### Step 2: Gather Diagnostic Data

Run the failing test with maximum diagnostic output:

```bash
# Run with trace recording
bunx playwright test failing-test.spec.ts --project=chromium --trace on

# Run in headed mode to watch
bunx playwright test failing-test.spec.ts --project=chromium --headed --slowmo=500

# Run with full debug inspector
PWDEBUG=1 bunx playwright test failing-test.spec.ts --project=chromium --headed
```

After test failure, examine artifacts:
```bash
# View the trace
bunx playwright show-trace test-results/[test-folder]/trace.zip

# Check screenshots
ls test-results/[test-folder]/*.png
```

### Step 3: Apply Targeted Fix

#### Timeout Fixes

```typescript
// PROBLEM: Element takes too long to appear
// FIX: Increase specific assertion timeout (not global)
await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
  timeout: 10_000,
});

// PROBLEM: Page loads data asynchronously
// FIX: Wait for the network call to complete first
await page.waitForResponse(resp =>
  resp.url().includes('/api/data') && resp.status() === 200
);
await expect(page.getByText('Data loaded')).toBeVisible();

// PROBLEM: SvelteKit hydration delay
// FIX: Wait for hydration to complete
await page.waitForLoadState('networkidle');
```

#### Flaky Test Fixes

```typescript
// PROBLEM: CSS animation causes element to not be "visible" yet
// FIX: Wait for animation to complete
await expect(page.getByRole('dialog')).toBeVisible();
// Then interact with content inside

// PROBLEM: Click fires before element is interactive
// FIX: Playwright auto-waits, but ensure the element is enabled
await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();
await page.getByRole('button', { name: 'Submit' }).click();

// PROBLEM: Stale element reference after navigation
// FIX: Re-query the element after navigation
await page.getByRole('link', { name: 'Next' }).click();
await page.waitForURL('/next-page');
// Now query elements on the new page
await expect(page.getByRole('heading')).toBeVisible();
```

#### Locator Fixes

```typescript
// PROBLEM: Multiple elements match
// FIX: Be more specific
await page.getByRole('button', { name: 'Submit' }).first().click();
// OR use a containing element to scope
await page.getByRole('form').getByRole('button', { name: 'Submit' }).click();

// PROBLEM: Element is inside shadow DOM
// FIX: Playwright pierces shadow DOM by default, but verify
await page.locator('my-component').getByRole('button').click();

// PROBLEM: Text content is dynamic
// FIX: Use regex patterns
await expect(page.getByText(/\d+ items? found/)).toBeVisible();
```

#### Network Fixes

```typescript
// PROBLEM: Dev server not ready
// FIX: Verify webServer config in playwright.config.ts
// Ensure url matches the actual dev server URL
// Increase webServer.timeout if build is slow

// PROBLEM: API calls fail in test environment
// FIX: Mock the API calls
await page.route('**/api/**', async (route) => {
  // Return mock data instead of hitting real backend
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: 'mocked' }),
  });
});
```

### Step 4: Verify the Fix

```bash
# Run multiple times to confirm flakiness is resolved
bunx playwright test failing-test.spec.ts --project=chromium --repeat-each=5

# Run the full suite to make sure the fix does not break other tests
bunx playwright test --project=chromium
```

### Step 5: Add Resilience

If the test was flaky, add a comment explaining the fix and why:

```typescript
// This wait is necessary because the chart animation takes ~500ms
// and the data labels are not in the DOM until animation completes.
await expect(page.getByText('Revenue: $1,234')).toBeVisible({ timeout: 5000 });
```

## Debugging CLI Quick Reference

```bash
# Interactive UI mode (best for debugging)
bunx playwright test --ui

# Headed with slow motion
bunx playwright test --headed --slowmo=500

# Debug inspector (step through)
PWDEBUG=1 bunx playwright test --headed

# Generate and view trace
bunx playwright test --trace on
bunx playwright show-trace test-results/*/trace.zip

# Run specific test by title
bunx playwright test -g "should display dashboard"

# Run with verbose logging
DEBUG=pw:api bunx playwright test

# List available tests without running
bunx playwright test --list
```

## Common Error Messages and Solutions

| Error | Solution |
|-------|----------|
| `browserType.launch: Executable doesn't exist` | Run `bunx playwright install --with-deps` |
| `page.goto: net::ERR_CONNECTION_REFUSED` | Dev server not running; check webServer config |
| `locator.click: Target closed` | Page navigated away; wait for navigation first |
| `expect(locator).toBeVisible: Locator resolved to 0 elements` | Wrong locator; use UI mode to inspect |
| `Timeout 30000ms exceeded waiting for expect` | Element never appeared; check page state in trace |
| `strict mode violation: getByRole resolved to N elements` | Locator matches multiple; scope with `.first()` or parent |

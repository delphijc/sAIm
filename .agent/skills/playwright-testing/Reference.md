# playwright-testing Reference Guide

> This is Tier 2 documentation for the playwright-testing skill. It is loaded on-demand when you need detailed information. For quick routing and examples, see `SKILL.md`.

---

## Skill Philosophy

Playwright is the preferred E2E testing framework for PAI projects. This skill codifies battle-tested patterns from real SvelteKit deployments, prioritizing test reliability over speed, accessibility-first locators over brittle selectors, and proper isolation over shared state. Every pattern here has been validated in production CI pipelines.

## Core Methodology

### Locator Priority (Mandatory Order)

Always select locators in this order. Never skip to CSS/XPath unless higher-priority options are impossible:

1. `page.getByRole('button', { name: 'Submit' })` -- semantic, resilient
2. `page.getByLabel('Email address')` -- form fields
3. `page.getByText('Welcome back')` -- visible text
4. `page.getByTestId('checkout-form')` -- explicit test IDs (fallback)
5. `page.locator('input[id="email"]')` -- CSS only when IDs are stable and semantic
6. `page.locator('.class-name')` -- last resort, fragile

### Waiting Strategy

Playwright auto-waits on assertions and actions. Leverage this:

```typescript
// CORRECT: Auto-waits for element to appear and be visible
await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

// CORRECT: Waits for navigation to complete
await page.waitForURL('/dashboard');

// CORRECT: Waits for specific network response
await page.waitForResponse(resp => resp.url().includes('/api/data') && resp.status() === 200);

// WRONG: Hard wait -- flaky and slow
await page.waitForTimeout(3000);
```

### Test Structure Pattern

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Common setup: navigate, seed data, authenticate
    await page.goto('/feature-page');
  });

  test('should display main content on load', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Feature' })).toBeVisible();
  });

  test('should handle user interaction correctly', async ({ page }) => {
    await page.getByRole('button', { name: 'Action' }).click();
    await expect(page.getByText('Success')).toBeVisible();
  });

  test('should show error state on invalid input', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('Invalid email')).toBeVisible();
  });
});
```

## SvelteKit-Specific Patterns

### Configuration for SvelteKit

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,

  expect: {
    timeout: 5_000,
  },

  outputDir: 'test-results/',

  reporter: [
    ['html', { open: 'on-failure', outputFolder: 'playwright-report' }],
    process.env.CI ? ['github'] : ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],

  webServer: [
    {
      command: 'bun run dev',  // or npm run dev
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      cwd: './frontend',  // adjust to SvelteKit root
    },
  ],
});
```

### SvelteKit Load Function Testing

SvelteKit pages with `+page.ts` or `+page.server.ts` load functions need the server running. Playwright's `webServer` config handles this. For testing load function behavior:

```typescript
test('should load data from server load function', async ({ page }) => {
  // Navigate triggers +page.server.ts load
  await page.goto('/dashboard');

  // Verify data loaded by the load function renders
  await expect(page.getByRole('heading', { name: 'My Dashboard' })).toBeVisible();
  await expect(page.getByText(/\d+ items/)).toBeVisible();
});
```

### SvelteKit Form Actions Testing

```typescript
test('should submit form action and handle response', async ({ page }) => {
  await page.goto('/settings');

  await page.getByLabel('Display Name').fill('New Name');
  await page.getByRole('button', { name: 'Save' }).click();

  // Form actions redirect or return data
  await expect(page.getByText('Settings saved')).toBeVisible();
});
```

## API Mocking and Interception

### Route Interception (Mock Backend)

```typescript
test('should display mocked data', async ({ page }) => {
  // Intercept API call and return mock data
  await page.route('**/api/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]),
    });
  });

  await page.goto('/users');
  await expect(page.getByText('Alice')).toBeVisible();
  await expect(page.getByText('Bob')).toBeVisible();
});
```

### Intercept and Modify Responses

```typescript
test('should handle API error gracefully', async ({ page }) => {
  await page.route('**/api/data', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' }),
    });
  });

  await page.goto('/data-page');
  await expect(page.getByText('Something went wrong')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});
```

### Monitor Network Requests

```typescript
test('should send correct payload on form submit', async ({ page }) => {
  const requestPromise = page.waitForRequest(
    (req) => req.url().includes('/api/submit') && req.method() === 'POST'
  );

  await page.goto('/form');
  await page.getByLabel('Name').fill('Test User');
  await page.getByRole('button', { name: 'Submit' }).click();

  const request = await requestPromise;
  const postData = request.postDataJSON();
  expect(postData.name).toBe('Test User');
});
```

## Authentication Patterns

### Reusable Auth State (storageState)

```typescript
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /Sign In/i }).click();

  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: authFile });
});
```

```typescript
// playwright.config.ts -- add setup project and dependency
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      storageState: '.auth/user.json',
    },
    dependencies: ['setup'],
  },
],
```

### Cookie-Based Auth (SvelteKit Sessions)

```typescript
test('should access protected route with session cookie', async ({ context, page }) => {
  // Set session cookie directly
  await context.addCookies([{
    name: 'session_id',
    value: 'valid-test-session-token',
    domain: 'localhost',
    path: '/',
  }]);

  await page.goto('/protected/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
```

## Visual Regression Testing

### Basic Screenshot Comparison

```typescript
test('should match homepage visual snapshot', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixelRatio: 0.01,
  });
});
```

### Component-Level Screenshot

```typescript
test('should match card component snapshot', async ({ page }) => {
  await page.goto('/components');
  const card = page.getByTestId('feature-card');
  await expect(card).toHaveScreenshot('feature-card.png');
});
```

### Update Snapshots

```bash
# Update all snapshots
npx playwright test --update-snapshots

# Update specific test snapshots
npx playwright test homepage.spec.ts --update-snapshots
```

## Debugging Techniques

### UI Mode (Interactive Debugging)

```bash
npx playwright test --ui
```

### Headed Mode with Slowmo

```bash
npx playwright test --headed --slowmo=500
```

### Trace Viewer

```bash
# Generate trace on failure (configured in playwright.config.ts)
npx playwright test

# View trace file
npx playwright show-trace test-results/feature-test-chromium/trace.zip
```

### Debug Mode (Inspector)

```bash
# Opens Playwright Inspector with step-by-step execution
PWDEBUG=1 npx playwright test --headed
```

### Console and Network Logging in Tests

```typescript
test('debug network issues', async ({ page }) => {
  // Log all console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // Log failed requests
  page.on('requestfailed', req =>
    console.log('FAILED:', req.url(), req.failure()?.errorText)
  );

  // Log responses
  page.on('response', resp =>
    console.log('RESPONSE:', resp.url(), resp.status())
  );

  await page.goto('/problematic-page');
});
```

## File Organization

```
project-root/
  e2e/
    auth.setup.ts              # Authentication setup
    auth.spec.ts               # Auth flow tests
    routes/
      dashboard.spec.ts        # Dashboard E2E tests
      settings.spec.ts         # Settings E2E tests
      game/
        map.spec.ts            # Nested route tests
    fixtures/
      test-data.ts             # Shared test data
      custom-fixtures.ts       # Extended test fixtures
  .auth/
    user.json                  # Saved auth state (gitignored)
  playwright.config.ts
  .gitignore                   # Include: .auth/, test-results/, playwright-report/
```

## CI/CD Integration (GitHub Actions)

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2  # or setup-node

      - name: Install dependencies
        run: bun install

      - name: Install Playwright browsers
        run: bunx playwright install --with-deps

      - name: Run E2E tests
        run: bunx playwright test

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

      - name: Upload test artifacts
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results
          path: test-results/
          retention-days: 3
```

## Tool Usage

| Tool | Purpose | When to Use |
|------|---------|-------------|
| Bash | Run Playwright CLI commands | Installing, running tests, updating snapshots |
| Read | Examine existing test files and configs | Before writing new tests or debugging |
| Write/Edit | Create or modify test files | Writing new specs or fixing existing ones |
| WebSearch | Look up latest Playwright API changes | When encountering unfamiliar APIs or errors |

## Common Mistakes to Avoid

1. **Using waitForTimeout:** Replace with proper assertions that auto-wait
2. **Brittle CSS selectors:** Use getByRole/getByLabel/getByText instead
3. **Shared mutable state between tests:** Each test should set up its own state
4. **Not cleaning up route mocks:** Use `page.unroute()` or rely on test isolation
5. **Forgetting webServer config:** SvelteKit needs the dev server running
6. **Testing implementation details:** Test user-visible behavior, not DOM structure
7. **Missing .gitignore entries:** Always ignore test-results/, playwright-report/, .auth/
8. **Not retrying in CI:** Set retries: 2 for CI to handle infrastructure flakiness
9. **Running all browsers locally:** Focus on chromium locally, run all browsers in CI
10. **Ignoring trace files:** The trace viewer is the most powerful debugging tool

## Troubleshooting Quick Reference

| Symptom | Cause | Fix |
|---------|-------|-----|
| Timeout waiting for element | Element not rendered or wrong locator | Use `--ui` mode to inspect, verify locator |
| Tests pass locally, fail in CI | Timing differences, missing deps | Add retries, use `--with-deps` for browser install |
| Flaky test passes sometimes | Race condition or animation | Wait for stable state, use `toBeVisible()` assertions |
| Screenshots differ in CI | Font rendering differences | Use `maxDiffPixelRatio`, run visual tests on Linux only |
| webServer fails to start | Port conflict or build error | Check `reuseExistingServer`, verify dev command works |
| Auth state not persisted | storageState path wrong | Verify `.auth/` directory exists and path is correct |
| Route mocking not working | URL pattern mismatch | Use `**/api/path` glob patterns, check request inspector |

---

**Key Point:** This skill prioritizes test reliability and maintainability above test execution speed. Flaky tests erode team confidence faster than slow tests.

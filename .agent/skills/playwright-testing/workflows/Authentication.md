---
description: Manage authentication and session state in Playwright E2E tests
globs: ""
alwaysApply: false
---

# Authentication Workflow -- playwright-testing

## Purpose

Set up reusable authentication state for Playwright tests to avoid logging in before every test, supporting cookie-based sessions, JWT tokens, and SvelteKit auth patterns.

## Steps

### Step 1: Choose Auth Strategy

| Strategy | Use Case | Complexity |
|----------|----------|------------|
| **storageState** | Standard login flow, cookie/localStorage auth | Low |
| **Direct cookies** | Known session tokens, API-issued tokens | Low |
| **API login** | Programmatic auth without UI | Medium |
| **Global setup** | One-time auth for entire test suite | Medium |

### Step 2: StorageState Pattern (Recommended)

This is the most common and recommended approach. A setup project logs in once and saves the browser state for all other tests.

**Create `e2e/auth.setup.ts`:**

```typescript
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate as regular user', async ({ page }) => {
  // Navigate to login page
  await page.goto('/auth/login');

  // Fill in credentials
  await page.getByLabel('Email').fill('testuser@example.com');
  await page.getByLabel('Password').fill('TestPassword123');
  await page.getByRole('button', { name: /Sign In/i }).click();

  // Wait for successful login (redirect or element)
  await page.waitForURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
```

**Update `playwright.config.ts`:**

```typescript
projects: [
  // Setup project runs first
  {
    name: 'setup',
    testMatch: /.*\.setup\.ts/,
  },

  // Functional tests use saved auth state
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      storageState: '.auth/user.json',
    },
    dependencies: ['setup'],
  },

  // Unauthenticated tests (login page, registration, etc.)
  {
    name: 'chromium-no-auth',
    use: {
      ...devices['Desktop Chrome'],
      // No storageState -- tests run unauthenticated
    },
    testMatch: /.*\.unauth\.spec\.ts/,
  },
],
```

**Ensure `.auth/` is gitignored:**

```
.auth/
```

### Step 3: Multiple User Roles

For applications with different user roles (admin, regular user, etc.):

```typescript
// e2e/auth.setup.ts
import { test as setup } from '@playwright/test';
import path from 'path';

const adminFile = path.join(__dirname, '../.auth/admin.json');
const userFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('AdminPassword123');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL('/admin/dashboard');
  await page.context().storageState({ path: adminFile });
});

setup('authenticate as user', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('UserPassword123');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: userFile });
});
```

**Config with role-based projects:**

```typescript
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'admin-tests',
    use: {
      ...devices['Desktop Chrome'],
      storageState: '.auth/admin.json',
    },
    dependencies: ['setup'],
    testMatch: /.*\.admin\.spec\.ts/,
  },
  {
    name: 'user-tests',
    use: {
      ...devices['Desktop Chrome'],
      storageState: '.auth/user.json',
    },
    dependencies: ['setup'],
    testMatch: /.*\.user\.spec\.ts/,
  },
],
```

### Step 4: Direct Cookie Injection

When you know the session token format (faster than UI login):

```typescript
test.describe('Authenticated dashboard', () => {
  test.beforeEach(async ({ context, page }) => {
    // Inject session cookie directly
    await context.addCookies([
      {
        name: 'session_id',
        value: 'valid-test-session-token-abc123',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,  // false for localhost
        sameSite: 'Lax',
      },
    ]);
  });

  test('should access protected page', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
```

### Step 5: API-Based Authentication

Log in via API to skip the UI entirely:

```typescript
test.describe('Authenticated via API', () => {
  test.beforeEach(async ({ context, page }) => {
    // Log in via API
    const response = await page.request.post('/api/auth/login', {
      data: {
        email: 'testuser@example.com',
        password: 'TestPassword123',
      },
    });

    expect(response.ok()).toBeTruthy();

    // The response sets cookies automatically on the context
    // Or extract token manually:
    const { token } = await response.json();

    // Set token in localStorage or as a cookie
    await context.addCookies([
      {
        name: 'auth_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('should load authenticated content', async ({ page }) => {
    await page.goto('/protected');
    await expect(page.getByText('Welcome')).toBeVisible();
  });
});
```

### Step 6: SvelteKit-Specific Auth

SvelteKit uses `hooks.server.ts` for session management. Common patterns:

```typescript
// For SvelteKit apps using cookies set by hooks.server.ts:
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: 'session',  // Match the cookie name from hooks.server.ts
      value: 'eyJhbGciOiJIUzI1NiJ9...',  // Valid JWT or session token
      domain: 'localhost',
      path: '/',
    },
  ]);
});
```

For SvelteKit apps using Lucia, Auth.js, or similar:

```typescript
// The setup approach works best -- log in via the UI once,
// and the library's cookie management handles the rest.
// storageState captures all cookies set by the auth library.
```

### Step 7: Testing Auth Flows Themselves

Tests for login/logout/registration should NOT use storageState:

```typescript
// e2e/auth-flows.unauth.spec.ts
// This file pattern matches the chromium-no-auth project

test.describe('Login Flow', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByText(/invalid|incorrect/i)).toBeVisible();
  });

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/auth\/login/);
  });
});
```

## Checklist

- [ ] Auth strategy chosen based on app architecture
- [ ] Setup project created for storageState authentication
- [ ] `.auth/` directory added to `.gitignore`
- [ ] Test projects configured with correct `dependencies` and `storageState`
- [ ] Unauthenticated test project created for login/registration tests
- [ ] Multiple user roles handled (if applicable)
- [ ] Auth flow tests (login, logout, registration) run without storageState
- [ ] CI environment has valid test credentials available

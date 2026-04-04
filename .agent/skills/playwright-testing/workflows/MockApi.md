---
description: Mock and intercept API requests in Playwright tests to isolate frontend behavior
globs: ""
alwaysApply: false
---

# MockApi Workflow -- playwright-testing

## Purpose

Intercept, mock, modify, and monitor HTTP requests in Playwright tests to isolate frontend behavior from backend dependencies and test edge cases that are difficult to reproduce with a real API.

## When to Use API Mocking

- Testing error states (500, 404, 403, network failures)
- Testing loading states and slow responses
- Testing specific data shapes without seeding a database
- Running tests without a backend (frontend-only CI)
- Testing race conditions and response ordering

## Steps

### Step 1: Identify API Dependencies

Read the page source to find all `fetch` calls, SvelteKit load functions, or form actions that hit API endpoints. List each endpoint, method, and expected response shape.

### Step 2: Choose Mocking Strategy

| Strategy | Use Case | Code Pattern |
|----------|----------|--------------|
| **Full mock** | Replace entire response | `route.fulfill()` |
| **Modify response** | Alter real response data | `route.fetch()` then modify |
| **Abort request** | Simulate network failure | `route.abort()` |
| **Delay response** | Test loading states | Add delay before `route.fulfill()` |
| **Monitor only** | Assert request was sent | `page.waitForRequest()` |

### Step 3: Implement Mocks

#### Full Mock (Most Common)

```typescript
test('should display user list from API', async ({ page }) => {
  await page.route('**/api/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        users: [
          { id: 1, name: 'Alice', role: 'admin' },
          { id: 2, name: 'Bob', role: 'user' },
        ],
        total: 2,
      }),
    });
  });

  await page.goto('/admin/users');
  await expect(page.getByText('Alice')).toBeVisible();
  await expect(page.getByText('Bob')).toBeVisible();
  await expect(page.getByText('2 users')).toBeVisible();
});
```

#### Error State Mock

```typescript
test('should show error banner on 500', async ({ page }) => {
  await page.route('**/api/users', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' }),
    });
  });

  await page.goto('/admin/users');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText(/something went wrong/i)).toBeVisible();
});
```

#### Network Failure Mock

```typescript
test('should handle network failure gracefully', async ({ page }) => {
  await page.route('**/api/users', async (route) => {
    await route.abort('connectionrefused');
  });

  await page.goto('/admin/users');
  await expect(page.getByText(/unable to connect/i)).toBeVisible();
});
```

#### Slow Response Mock (Loading State)

```typescript
test('should show loading spinner while fetching', async ({ page }) => {
  await page.route('**/api/data', async (route) => {
    // Delay 3 seconds to make loading state visible
    await new Promise(resolve => setTimeout(resolve, 3000));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.goto('/data');

  // Loading state should be visible during delay
  await expect(page.getByText('Loading...')).toBeVisible();

  // After response arrives, loading should disappear
  await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 5000 });
});
```

#### Modify Real Response

```typescript
test('should handle empty results from real API', async ({ page }) => {
  await page.route('**/api/search*', async (route) => {
    const response = await route.fetch();
    const json = await response.json();

    // Override the results to be empty
    await route.fulfill({
      response,
      body: JSON.stringify({ ...json, results: [], total: 0 }),
    });
  });

  await page.goto('/search?q=test');
  await expect(page.getByText('No results found')).toBeVisible();
});
```

#### Monitor Request Payload

```typescript
test('should send correct search parameters', async ({ page }) => {
  const requestPromise = page.waitForRequest(
    (req) => req.url().includes('/api/search') && req.method() === 'GET'
  );

  await page.goto('/search');
  await page.getByLabel('Search').fill('playwright');
  await page.getByRole('button', { name: 'Search' }).click();

  const request = await requestPromise;
  const url = new URL(request.url());
  expect(url.searchParams.get('q')).toBe('playwright');
});
```

### Step 4: Mock Multiple Endpoints

```typescript
test.describe('Dashboard with mocked backend', () => {
  test.beforeEach(async ({ page }) => {
    // Mock all dashboard API dependencies
    await page.route('**/api/user/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, name: 'Test User' }),
      });
    });

    await page.route('**/api/dashboard/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ views: 1234, actions: 56 }),
      });
    });

    await page.route('**/api/notifications', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], unread: 0 }),
      });
    });
  });

  test('should render dashboard with all data', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Test User')).toBeVisible();
    await expect(page.getByText('1,234 views')).toBeVisible();
  });
});
```

### Step 5: SvelteKit-Specific Mocking

SvelteKit `+page.server.ts` load functions run server-side. For those, mock at the HTTP level:

```typescript
// If SvelteKit load function calls an external API:
await page.route('**/external-api.com/data', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ serverData: 'mocked' }),
  });
});

// For SvelteKit form actions, intercept the POST:
await page.route('**/settings?/update', async (route) => {
  if (route.request().method() === 'POST') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ type: 'success', status: 200 }),
    });
  }
});
```

## URL Pattern Reference

| Pattern | Matches |
|---------|---------|
| `**/api/users` | Any URL ending in `/api/users` |
| `**/api/users/*` | `/api/users/123`, `/api/users/abc` |
| `**/api/**` | Any URL with `/api/` in the path |
| `https://external.com/**` | Only external.com requests |
| `**/api/search?q=*` | Search endpoint with query param |

## Checklist

- [ ] All API dependencies for the page are identified
- [ ] Mock data shapes match the real API contract
- [ ] Error states (400, 401, 403, 404, 500) are tested
- [ ] Network failure scenario is tested
- [ ] Loading states are verified (if applicable)
- [ ] Request payloads are asserted for form submissions
- [ ] Mocks are set up in `beforeEach` when shared across tests

---
description: Write comprehensive E2E tests for a page or feature using Playwright best practices
globs: ""
alwaysApply: false
---

# WriteTests Workflow -- playwright-testing

## Purpose

Create thorough, reliable E2E test suites for specific pages or features following accessibility-first locator patterns and proper test isolation.

## Steps

### Step 1: Analyze the Target

Before writing any test, examine:
1. **Route file** -- Read `+page.svelte` (or equivalent) to understand what renders
2. **Load function** -- Read `+page.ts` or `+page.server.ts` to understand data dependencies
3. **Form actions** -- Check for `+page.server.ts` actions
4. **API dependencies** -- Identify fetch calls or API integrations
5. **Interactive elements** -- Buttons, forms, modals, navigation, dropdowns
6. **Error states** -- How does the page handle loading, empty, and error states?

### Step 2: Plan Test Scenarios

Every test suite should cover these categories:

**Mandatory Scenarios:**
- Page loads and renders primary content
- Critical user journey (happy path)
- Form validation (if forms exist)
- Error state handling
- Navigation and routing

**Recommended Scenarios:**
- Empty state rendering
- Loading state visibility
- Accessibility basics (headings, labels, ARIA)
- Keyboard navigation for critical interactions
- Responsive behavior (if Mobile Chrome project is configured)

### Step 3: Write the Test File

File naming convention: `e2e/routes/[route-name].spec.ts`

For nested routes: `e2e/routes/game/map.spec.ts`

**Template:**

```typescript
import { test, expect } from '@playwright/test';

test.describe('[Feature Name]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/route-path');
  });

  // === RENDERING ===

  test('should display page heading and primary content', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Page Title' })).toBeVisible();
  });

  test('should render navigation elements', async ({ page }) => {
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  // === USER INTERACTIONS ===

  test('should handle primary user action', async ({ page }) => {
    await page.getByRole('button', { name: 'Action' }).click();
    await expect(page.getByText('Expected result')).toBeVisible();
  });

  // === FORM HANDLING ===

  test('should validate required fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('Field is required')).toBeVisible();
  });

  test('should submit form with valid data', async ({ page }) => {
    await page.getByLabel('Name').fill('Test User');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('Success')).toBeVisible();
  });

  // === ERROR STATES ===

  test('should display error message on API failure', async ({ page }) => {
    await page.route('**/api/data', (route) =>
      route.fulfill({ status: 500, body: '{"error":"Server Error"}' })
    );
    await page.reload();
    await expect(page.getByText(/error|failed/i)).toBeVisible();
  });

  // === ACCESSIBILITY ===

  test('should have proper heading hierarchy', async ({ page }) => {
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);
  });
});
```

### Step 4: Locator Guidelines

**Always prefer semantic locators:**

```typescript
// BEST: Role-based (resilient to text/styling changes)
page.getByRole('button', { name: 'Save Changes' })
page.getByRole('heading', { name: 'Settings', level: 2 })
page.getByRole('link', { name: 'Home' })
page.getByRole('textbox', { name: 'Search' })
page.getByRole('checkbox', { name: 'Remember me' })
page.getByRole('combobox', { name: 'Country' })
page.getByRole('tab', { name: 'Profile' })
page.getByRole('dialog')
page.getByRole('alert')

// GOOD: Label-based (for form fields)
page.getByLabel('Email address')
page.getByPlaceholder('Enter your name')

// OK: Text-based (for non-interactive content)
page.getByText('No items found')
page.getByText(/\d+ results/)

// FALLBACK: Test IDs (when semantic locators are not possible)
page.getByTestId('complex-widget')

// LAST RESORT: CSS selectors (only for stable, semantic IDs)
page.locator('input[id="email"]')
```

### Step 5: Handle Data Dependencies

If the page requires authenticated state or specific data:

```typescript
// Option A: Mock the API
test.beforeEach(async ({ page }) => {
  await page.route('**/api/user/profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, name: 'Test User', role: 'admin' }),
    })
  );
  await page.goto('/profile');
});

// Option B: Use storageState for auth (configured in playwright.config.ts)
// Tests automatically use authenticated state from setup project
```

### Step 6: Verify Tests Pass

```bash
# Run the specific test file
bunx playwright test e2e/routes/feature.spec.ts --project=chromium

# Run in headed mode to visually verify
bunx playwright test e2e/routes/feature.spec.ts --project=chromium --headed
```

## Test Quality Checklist

- [ ] Each test has a clear, descriptive name starting with "should"
- [ ] Tests are independent (no shared mutable state)
- [ ] No `waitForTimeout` calls
- [ ] Locators follow the priority order (role > label > text > testId > CSS)
- [ ] Error and edge cases are covered
- [ ] API dependencies are mocked or properly isolated
- [ ] Test file is in the correct `e2e/routes/` subdirectory
- [ ] Tests pass in `--project=chromium` mode

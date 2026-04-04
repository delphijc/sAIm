---
description: Set up and manage visual regression testing with Playwright screenshot comparisons
globs: ""
alwaysApply: false
---

# VisualRegression Workflow -- playwright-testing

## Purpose

Configure and maintain visual regression tests using Playwright's built-in screenshot comparison to catch unintended UI changes.

## Steps

### Step 1: Understand Constraints

Visual regression testing has inherent platform differences:
- **Font rendering** differs between macOS, Linux, and Windows
- **Anti-aliasing** varies across operating systems
- **Baseline screenshots** must be generated on the same OS as CI

**Recommendation:** Generate baselines in CI (Linux) and run visual tests only in CI, OR use `maxDiffPixelRatio` to tolerate minor rendering differences.

### Step 2: Configure for Visual Testing

Add visual test project to `playwright.config.ts`:

```typescript
projects: [
  {
    name: 'visual',
    use: {
      ...devices['Desktop Chrome'],
      // Consistent viewport for screenshots
      viewport: { width: 1280, height: 720 },
      // Disable animations for consistent snapshots
      // (add to page via beforeEach)
    },
    testMatch: '**/*.visual.spec.ts',  // separate from functional tests
  },
],
```

### Step 3: Write Visual Tests

Create `e2e/visual/homepage.visual.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Visual Regression: Homepage', () => {
  test.beforeEach(async ({ page }) => {
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });
  });

  test('full page screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('homepage-full.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,  // Allow 1% pixel difference
    });
  });

  test('hero section screenshot', async ({ page }) => {
    await page.goto('/');
    const hero = page.getByTestId('hero-section');
    await expect(hero).toHaveScreenshot('hero-section.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('navigation bar screenshot', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation');
    await expect(nav).toHaveScreenshot('navigation.png');
  });
});
```

### Step 4: Generate Baselines

```bash
# Generate initial baseline screenshots
bunx playwright test --project=visual --update-snapshots

# Baselines are saved to: e2e/visual/homepage.visual.spec.ts-snapshots/
```

### Step 5: Handle Dynamic Content

Mock dynamic content to keep screenshots stable:

```typescript
test('dashboard with mocked data', async ({ page }) => {
  // Freeze time-dependent content
  await page.route('**/api/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        lastUpdated: '2024-01-15T10:00:00Z',
        stats: { users: 1234, revenue: 56789 },
      }),
    });
  });

  // Mock date display
  await page.addInitScript(() => {
    const fixedDate = new Date('2024-01-15T10:00:00Z');
    // @ts-ignore
    Date.now = () => fixedDate.getTime();
  });

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveScreenshot('dashboard.png', {
    maxDiffPixelRatio: 0.01,
  });
});
```

### Step 6: Update Snapshots When Design Changes

```bash
# Update all visual snapshots
bunx playwright test --project=visual --update-snapshots

# Update specific test snapshots
bunx playwright test homepage.visual.spec.ts --project=visual --update-snapshots

# Review changes in git
git diff --stat  # Shows changed snapshot files
```

### Step 7: CI Integration

Add visual tests to CI pipeline:

```yaml
- name: Run visual regression tests
  run: bunx playwright test --project=visual

- name: Upload visual diff artifacts
  uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: visual-diffs
    path: test-results/
    retention-days: 7
```

## Configuration Options

```typescript
await expect(page).toHaveScreenshot('name.png', {
  // Tolerance options (pick one)
  maxDiffPixelRatio: 0.01,     // Allow 1% different pixels
  maxDiffPixels: 100,           // Allow up to 100 different pixels
  threshold: 0.2,               // Per-pixel color difference threshold (0-1)

  // Capture options
  fullPage: true,               // Capture entire scrollable page
  animations: 'disabled',       // Disable CSS animations
  mask: [page.locator('.ad-banner')],  // Mask dynamic regions

  // Comparison options
  stylePath: './e2e/visual/screenshot-styles.css',  // Inject CSS before capture
});
```

## Masking Dynamic Regions

```typescript
test('page with masked dynamic content', async ({ page }) => {
  await page.goto('/profile');

  await expect(page).toHaveScreenshot('profile.png', {
    mask: [
      page.getByTestId('user-avatar'),     // Avatar may differ
      page.getByTestId('last-login-time'),  // Timestamp changes
      page.locator('.ad-slot'),              // Ads are dynamic
    ],
  });
});
```

## File Organization

```
e2e/
  visual/
    homepage.visual.spec.ts
    dashboard.visual.spec.ts
    homepage.visual.spec.ts-snapshots/
      homepage-full-chromium-linux.png    # Auto-generated baselines
      hero-section-chromium-linux.png
```

## Checklist

- [ ] Visual test project configured in `playwright.config.ts`
- [ ] Animations disabled in visual test `beforeEach`
- [ ] Dynamic content mocked or masked
- [ ] Baselines generated on the same OS as CI
- [ ] `maxDiffPixelRatio` set to tolerate minor rendering differences
- [ ] Snapshot files committed to git
- [ ] CI uploads diff artifacts on failure

---
description: Configure Playwright E2E tests for CI/CD pipelines with GitHub Actions
globs: ""
alwaysApply: false
---

# CiCd Workflow -- playwright-testing

## Purpose

Set up reliable Playwright E2E test execution in CI/CD pipelines, with proper caching, artifact management, and failure reporting.

## Steps

### Step 1: Ensure Config is CI-Ready

The `playwright.config.ts` should already handle CI differences:

```typescript
export default defineConfig({
  forbidOnly: !!process.env.CI,       // Fail if .only() is committed
  retries: process.env.CI ? 2 : 0,     // Retry flakes in CI
  workers: process.env.CI ? 1 : undefined,  // Single worker for stability
  reporter: [
    ['html', { open: 'on-failure', outputFolder: 'playwright-report' }],
    process.env.CI ? ['github'] : ['list'],  // GitHub annotations in CI
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    trace: 'on-first-retry',        // Capture trace on retry
    screenshot: 'only-on-failure',   // Screenshots on failure
    video: 'on-first-retry',        // Video on retry
  },
  webServer: [{
    command: 'bun run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,  // Always fresh server in CI
    timeout: 120_000,
  }],
});
```

### Step 2: GitHub Actions Workflow

Create `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: e2e-${{ github.ref }}
  cancel-in-progress: true

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Cache Playwright browsers
        id: playwright-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('bun.lockb') }}

      - name: Install Playwright browsers
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: bunx playwright install --with-deps

      - name: Install Playwright system dependencies
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: bunx playwright install-deps

      - name: Run E2E tests
        run: bunx playwright test

      - name: Upload HTML report
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results
          path: test-results/
          retention-days: 7
```

### Step 3: Sharded Test Execution (Large Suites)

For test suites that take more than 10 minutes, shard across multiple runners:

```yaml
jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        shard: [1/4, 2/4, 3/4, 4/4]

    steps:
      # ... setup steps ...

      - name: Run E2E tests (shard ${{ matrix.shard }})
        run: bunx playwright test --shard=${{ matrix.shard }}

      - name: Upload shard report
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: blob-report-${{ strategy.job-index }}
          path: blob-report/
          retention-days: 1

  merge-reports:
    needs: e2e-tests
    runs-on: ubuntu-latest
    if: ${{ !cancelled() }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2

      - name: Download shard reports
        uses: actions/download-artifact@v4
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true

      - name: Merge reports
        run: bunx playwright merge-reports --reporter html ./all-blob-reports

      - name: Upload merged report
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

For sharded execution, update `playwright.config.ts` reporter:

```typescript
reporter: process.env.CI
  ? [['blob'], ['github']]
  : [['html', { open: 'on-failure' }], ['list']],
```

### Step 4: Separate Visual Regression in CI

```yaml
  visual-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      # ... setup steps ...

      - name: Run visual regression tests
        run: bunx playwright test --project=visual

      - name: Upload visual diffs
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: visual-diffs
          path: test-results/
          retention-days: 7
```

### Step 5: PR Comment with Results (Optional)

```yaml
      - name: Comment test results on PR
        if: github.event_name == 'pull_request' && !cancelled()
        uses: daun/playwright-report-summary@v3
        with:
          report-file: test-results/results.json
```

## CI Optimization Tips

1. **Cache browsers:** The Playwright browser cache step saves 1-2 minutes per run
2. **Single worker in CI:** Prevents resource contention on shared runners
3. **Retries for flakes:** 2 retries catches infrastructure-level flakiness
4. **Concurrency groups:** Cancel previous runs on the same branch to save minutes
5. **Timeout limits:** Set `timeout-minutes` to prevent hung jobs from burning credits
6. **Artifact retention:** 14 days for reports, 7 days for failure artifacts, 1 day for shard blobs

## Checklist

- [ ] `playwright.config.ts` handles `process.env.CI` for reporters, retries, workers
- [ ] GitHub Actions workflow created with proper caching
- [ ] Browser cache key uses lockfile hash for cache invalidation
- [ ] Artifacts uploaded for both success (report) and failure (results)
- [ ] `forbidOnly: !!process.env.CI` prevents `.only()` in main branch
- [ ] `reuseExistingServer: !process.env.CI` ensures fresh server in CI
- [ ] Concurrency group configured to cancel stale runs

---
name: playwright-testing
description: Comprehensive Playwright E2E testing framework for web applications. USE WHEN user wants to set up Playwright, write E2E tests, debug Playwright failures, configure Playwright for SvelteKit, mock API routes in Playwright, run visual regression tests, OR manage Playwright authentication flows.
---

# playwright-testing

End-to-end testing with Playwright for SvelteKit and general web applications. Covers setup, configuration, test patterns, debugging, CI/CD, and advanced techniques.

## Workflow Routing

**When executing a workflow, output this notification:**

```
Running the **WorkflowName** workflow from the **playwright-testing** skill...
```

| Workflow | Trigger | File |
|----------|---------|------|
| **Setup** | "set up Playwright", "install Playwright", "configure Playwright" | `workflows/Setup.md` |
| **WriteTests** | "write E2E test", "create Playwright test", "test this page" | `workflows/WriteTests.md` |
| **Debug** | "Playwright test failing", "debug E2E", "fix flaky test" | `workflows/Debug.md` |
| **MockApi** | "mock API in Playwright", "intercept requests", "stub backend" | `workflows/MockApi.md` |
| **VisualRegression** | "visual regression", "screenshot comparison", "visual testing" | `workflows/VisualRegression.md` |
| **CiCd** | "Playwright in CI", "GitHub Actions Playwright", "CI pipeline E2E" | `workflows/CiCd.md` |
| **Authentication** | "Playwright auth", "session management E2E", "login flow test" | `workflows/Authentication.md` |

## Examples

**Example 1: Set up Playwright for a SvelteKit project**
```
User: "Set up Playwright for my SvelteKit app"
-> Invokes Setup workflow
-> Installs dependencies and browsers
-> Generates playwright.config.ts with SvelteKit webServer
-> Creates directory structure and first smoke test
```

**Example 2: Write E2E tests for a page**
```
User: "Write E2E tests for the login page"
-> Invokes WriteTests workflow
-> Analyzes page structure and interactions
-> Generates spec file with accessibility-first locators
-> Includes positive, negative, and edge case scenarios
```

**Example 3: Debug a flaky Playwright test**
```
User: "My Playwright test keeps timing out intermittently"
-> Invokes Debug workflow
-> Analyzes test for common flakiness patterns
-> Recommends proper waiting strategies
-> Fixes race conditions and timing issues
```

## Key Principles

- **Accessibility-First Locators:** Always prefer getByRole, getByLabel, getByText over CSS selectors
- **No Hard Waits:** Never use waitForTimeout in production tests; use proper assertions and auto-waiting
- **Isolation:** Each test must be independent and not rely on state from other tests
- **Parallel Safe:** Tests should run in fullyParallel mode without conflicts
- **CI Parity:** Local and CI environments must produce consistent results

## Extended Context

For detailed methodology, patterns, and copy-paste examples, see `Reference.md`

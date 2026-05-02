# Test Generation

Generate Playwright test code automatically as you interact with the browser.

## How It Works

Every action performed with `playwright-cli` generates corresponding Playwright TypeScript code in the output. Copy this code directly into test files.

## Example Workflow

```bash
playwright-cli open https://example.com/login
playwright-cli snapshot
# Output: e1 [textbox "Email"], e2 [textbox "Password"], e3 [button "Sign In"]

playwright-cli fill e1 "user@example.com"
# Ran Playwright code:
# await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com');

playwright-cli fill e2 "password123"
# Ran Playwright code:
# await page.getByRole('textbox', { name: 'Password' }).fill('password123');

playwright-cli click e3
# Ran Playwright code:
# await page.getByRole('button', { name: 'Sign In' }).click();
```

## Building a Test File

```typescript
import { test, expect } from '@playwright/test';

test('login flow', async ({ page }) => {
  await page.goto('https://example.com/login');
  await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/.*dashboard/);
});
```

## Best Practices

1. **Explore first:** Take snapshots to understand page structure before recording
2. **Semantic locators:** Generated code uses role-based locators (most resilient)
3. **Add assertions manually:** Generated code captures actions, not expectations

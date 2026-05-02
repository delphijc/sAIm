# Running Playwright Tests

## Run Tests

```bash
PLAYWRIGHT_HTML_OPEN=never npx playwright test
PLAYWRIGHT_HTML_OPEN=never npm run special-test-command
```

## Debug with CLI

Run a failing test with `--debug=cli` to pause and attach interactively:

```bash
PLAYWRIGHT_HTML_OPEN=never npx playwright test --debug=cli &
# Wait for "Debugging Instructions" with session name like "tw-abcdef"
playwright-cli attach tw-abcdef
```

Explore the page with `playwright-cli` commands while the test is paused. Every action generates TypeScript code you can copy into the test.

After finding the fix, stop the background test and rerun to verify.

# Running Custom Playwright Code

Use `run-code` for advanced scenarios not covered by individual CLI commands.

## Syntax

```bash
playwright-cli run-code "async page => { /* code */ }"
playwright-cli run-code --filename=script.js
```

## Geolocation

```bash
playwright-cli run-code "async page => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 37.7749, longitude: -122.4194 });
}"
```

## Media Emulation

```bash
playwright-cli run-code "async page => { await page.emulateMedia({ colorScheme: 'dark' }); }"
playwright-cli run-code "async page => { await page.emulateMedia({ reducedMotion: 'reduce' }); }"
```

## Wait Strategies

```bash
playwright-cli run-code "async page => { await page.waitForLoadState('networkidle'); }"
playwright-cli run-code "async page => { await page.locator('.loading').waitFor({ state: 'hidden' }); }"
playwright-cli run-code "async page => { await page.waitForFunction(() => window.appReady === true); }"
```

## Frames and Iframes

```bash
playwright-cli run-code "async page => {
  const frame = page.locator('iframe#my-iframe').contentFrame();
  await frame.locator('button').click();
}"
```

## File Downloads

```bash
playwright-cli run-code "async page => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download' }).click();
  const download = await downloadPromise;
  await download.saveAs('./downloaded-file.pdf');
  return download.suggestedFilename();
}"
```

## Complex Workflows

```bash
playwright-cli run-code "async page => {
  await page.goto('https://example.com/login');
  await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('secret');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.context().storageState({ path: 'auth.json' });
  return 'Login successful';
}"
```

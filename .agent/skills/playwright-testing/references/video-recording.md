# Video Recording

Capture browser sessions as WebM video for documentation or debugging.

## Basic Recording

```bash
playwright-cli open https://example.com
playwright-cli video-start demo.webm
playwright-cli video-chapter "Getting Started" --description="Opening homepage" --duration=2000
playwright-cli goto https://example.com/features
playwright-cli video-chapter "Features" --description="Exploring features" --duration=2000
playwright-cli click e5
playwright-cli video-stop
```

## Scripted Recording with run-code

For polished recordings with typed text and annotations:

```bash
playwright-cli run-code --filename=record-demo.js
```

```js
// record-demo.js
async page => {
  await page.screencast.start({ path: 'video.webm', size: { width: 1280, height: 800 } });
  await page.goto('https://demo.playwright.dev/todomvc');

  await page.screencast.showChapter('Adding Items', {
    description: 'Adding several todo items.',
    duration: 2000,
  });

  await page.getByRole('textbox', { name: 'What needs to be done?' })
    .pressSequentially('Walk the dog', { delay: 60 });
  await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
  await page.waitForTimeout(1000);

  // Sticky annotation (pointer-events: none, won't block clicks)
  const annotation = await page.screencast.showOverlay(`
    <div style="position: absolute; top: 8px; right: 8px;
      padding: 6px 12px; background: rgba(0,0,0,0.7);
      border-radius: 8px; font-size: 13px; color: white;">
      Item added
    </div>
  `);

  await page.waitForTimeout(1500);
  await annotation.dispose();
  await page.screencast.stop();
}
```

## Overlay API

| Method | Use Case |
|--------|----------|
| `page.screencast.showChapter(title, opts)` | Full-screen chapter card with blurred backdrop |
| `page.screencast.showOverlay(html, opts)` | Custom HTML overlay for callouts/highlights |
| `disposable.dispose()` | Remove a sticky overlay |
| `page.screencast.hideOverlays()` / `showOverlays()` | Toggle all overlays |

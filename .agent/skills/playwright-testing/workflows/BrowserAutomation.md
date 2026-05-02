# Browser Automation Workflow

Automate browser interactions using playwright-cli. This workflow covers navigation, form filling, clicking, screenshots, and data extraction.

## Steps

### Step 1: Open Browser and Navigate

```bash
# Open browser (uses Chromium by default)
playwright-cli open https://target-url.com

# Or with specific browser
playwright-cli open --browser=firefox https://target-url.com
```

### Step 2: Take Snapshot to See Elements

```bash
playwright-cli snapshot
```

The snapshot outputs a compact YAML with element references like:
```
- e1 [textbox "Email"]
- e2 [textbox "Password"]
- e3 [button "Sign In"]
- e5 [link "Forgot password?"]
```

### Step 3: Interact Using Refs

```bash
# Fill form fields
playwright-cli fill e1 "user@example.com"
playwright-cli fill e2 "password123" --submit  # --submit presses Enter

# Click elements
playwright-cli click e3

# Type text (into focused element)
playwright-cli type "search query"
playwright-cli press Enter

# Select dropdown
playwright-cli select e9 "option-value"

# Check/uncheck
playwright-cli check e12
playwright-cli uncheck e12
```

### Step 4: Verify Result

```bash
# Take new snapshot to verify page changed
playwright-cli snapshot

# Or screenshot for visual verification
playwright-cli screenshot --filename=result.png

# Evaluate JS for specific data
playwright-cli eval "document.title"
playwright-cli --raw eval "document.querySelector('.status').textContent"
```

### Step 5: Navigate Further

```bash
playwright-cli goto https://target-url.com/next-page
playwright-cli go-back
playwright-cli go-forward
playwright-cli reload
```

### Step 6: Clean Up

```bash
playwright-cli close
# Or if using named sessions:
playwright-cli close-all
```

## Multi-Session Pattern

For tasks requiring multiple isolated browsers:

```bash
# Session 1: Logged-in user
playwright-cli -s=admin open https://app.com/login
playwright-cli -s=admin snapshot
playwright-cli -s=admin fill e1 "admin@example.com"
playwright-cli -s=admin fill e2 "password" --submit

# Session 2: Public visitor
playwright-cli -s=visitor open https://app.com

# Compare pages
playwright-cli -s=admin screenshot --filename=admin-view.png
playwright-cli -s=visitor screenshot --filename=visitor-view.png

# Clean up
playwright-cli close-all
```

## Data Extraction Pattern

```bash
# Extract structured data
playwright-cli --raw eval "JSON.stringify([...document.querySelectorAll('.item')].map(el => ({
  title: el.querySelector('h2').textContent,
  price: el.querySelector('.price').textContent
})))" > items.json

# Extract all links
playwright-cli --raw eval "JSON.stringify([...document.querySelectorAll('a')].map(a => a.href))" > links.json
```

## Checklist

- [ ] Browser opened and navigated to target URL
- [ ] Snapshot taken before any interaction
- [ ] Element refs used (not CSS selectors) for interactions
- [ ] Result verified via snapshot or screenshot
- [ ] Browser session closed when done

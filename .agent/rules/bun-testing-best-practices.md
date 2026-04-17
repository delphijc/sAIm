# Bun Testing: AI Agent Best Practices & Isolation Rules

## 1. The Core Constraint: Shared Process
Bun's test runner executes files within a **single process** with a shared global module registry. Mocks created with `mock.module()` persist and affect subsequent files.

## 2. Mandatory Cleanup Protocol
Every test file generated MUST implement a cleanup block to restore the global state.

```typescript
import { afterEach, mock } from "bun:test";

afterEach(() => {
  // Restores all mocks and spies to their original implementations
  mock.restore();
});
```

## 3. Module Mocking Strategy (`mock.module`)
* **Zero Side-Effect Rule:** Do not use `mock.module()` inside a `test()` block. Keep it at the top level.
* **Surgical Mocking:** Prefer `spyOn(object, 'method')` over `mock.module()` when only specific functions need to be overridden.
* **Global Singletons:** For dependencies used across the entire suite (e.g., DB drivers), use a `preload` script in `bunfig.toml`.

## 3.1 Dependency Injection for Testing
The cleanest approach avoids mocking entirely by designing for testability:

```typescript
// In production code: export type and accept optional parameter
export type LLMCaller = typeof callLLM;

export class MyService {
  constructor(config?: Config, llmCaller: LLMCaller = callLLM) {
    this.llmCaller = llmCaller;
  }
}

// In tests: inject mock directly, no module mocking needed
const mockCaller = mock(() => Promise.resolve("mocked response"));
const service = new MyService(config, mockCaller);
```

**Benefits:**
- No global state pollution
- Tests are explicit about what's mocked
- Works with Bun's shared process model

## 4. Handling Globals and Singletons
Mocks for `fetch`, `Date`, or `process.env` are the primary source of cross-file failures.

### Env Variable Isolation
```typescript
test("isolated env test", () => {
  const originalVal = process.env.FEATURE_FLAG;
  process.env.FEATURE_FLAG = "true";

  // Bun 1.1+ Lifecycle helper
  onTestFinished(() => {
    process.env.FEATURE_FLAG = originalVal;
  });

  // ... logic
});
```

### Fetch Mocking Template
```typescript
import { test, expect, mock, afterEach } from "bun:test";

const fetchMock = mock();
global.fetch = fetchMock;

afterEach(() => {
  fetchMock.mockClear();
});
```

### Preferred: mockFetcher Parameter Pattern
Instead of mutating `global.fetch`, design functions to accept an optional fetcher:

```typescript
// Production code
export async function callLLM(
  prompt: string,
  messages: Message[],
  config?: Config,
  fetcher: typeof fetch = fetch  // Optional, defaults to real fetch
) {
  const response = await fetcher(url, options);
  // ...
}

// Test code - no global mutation needed
const mockFetcher = mock(() => Promise.resolve(new Response('{"result":"ok"}')));
await callLLM("prompt", [], config, mockFetcher);
expect(mockFetcher).toHaveBeenCalledWith(expectedUrl, expectedOptions);
```

**Why this is better:**
- No `global.fetch` mutation that can leak between tests
- Explicit test setup - easy to see what's mocked
- Parallel test safety

## 5. Agent Generation Checklist
- [ ] Included `mock.restore()` in `afterEach`.
- [ ] Used `onTestFinished` for local resource cleanup.
- [ ] Avoided `mock.module()` for files imported by other tests without a restoration plan.
- [ ] Used unique IDs/Data to avoid collision in shared database/state tests.

## 6. Troubleshooting Command
If tests pass individually but fail in the suite, run:
`bun test --rerun-each 1 --bail 1`

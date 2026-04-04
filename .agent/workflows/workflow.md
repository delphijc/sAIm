# Project Workflow

## Guiding Principles

1. **The Plan is the Source of Truth:** All work must be tracked in `plan.md` [task_runner/frontmatter.studio/conductor/docs/stories/plan.md](task_runner/frontmatter.studio/conductor/docs/stories/plan.md)    
2. **The Tech Stack is Deliberate:** Changes to the tech stack must be documented in `tech-stack.md` [task_runner/frontmatter.studio/conductor/docs/stories/tech-stack.md](task_runner/frontmatter.studio/conductor/docs/stories/tech-stack.md) *before* implementation
3. **Test-Driven Development:** Write unit tests before implementing functionality
4. **High Code Coverage:** Aim for >80% code coverage for all modules
5. **User Experience First:** Every decision should prioritize user experience
6. **Non-Interactive & CI-Aware:** Prefer non-interactive commands. Use `CI=true` for watch-mode tools (tests, linters) to ensure single execution.
7. **Documentation First:** Document changes in `plan.md` before implementation if plan.md does exist create it based on the content of the docs/stories/ folder.
8. **Commit Messages:** Use the following format for commit messages: `feat(ui): Create basic HTML structure for calculator`
9. **Follow the styleguides:** Follow the styleguides for the language you are using found in the docs/styleguides/ folder.
10. **Maintain Dependencies:** When adding new shell utilities, command-line tools, or external dependencies (e.g., `jq`, `bats-core`, `shellcheck`), update [`dependencies.md`](../dependencies.md) with installation instructions and version requirements.
11. **Local Verification & Audit Trail:** All commits must pass the local `.git/hooks/pre-commit` check to ensure TDD compliance and >80% coverage. Every commit MUST be accompanied by a detailed summary attached via the `audit-committer` skill (git notes). Do not use `--no-verify` for code changes.
## Dependencies

All external dependencies required for this project are documented in [`dependencies.md`](../dependencies.md).

**Before starting development:**
1. Review [`dependencies.md`](../dependencies.md) to ensure all required tools are installed
2. Run the verification script to check your environment
3. Install any missing dependencies using the provided instructions

**When adding a new dependency:**
1. Install and test the dependency
2. Add it to [`dependencies.md`](../dependencies.md) under the appropriate category
3. Update installation scripts and verification checks
4. Document minimum version requirements
5. Add troubleshooting guidance
6. Commit the updated `dependencies.md` with your change

## Task Workflow

All tasks follow a strict lifecycle:

### Standard Task Workflow

1. **Select Task:** Choose the next available task from `plan.md` in sequential order

2. **Mark In Progress:** Before beginning work, edit `plan.md` and change the task from `[ ]` to `[~]`

3. **Write Failing Tests (Red Phase):**
   - Create a new test file for the feature or bug fix.
   - Write one or more unit tests that clearly define the expected behavior and acceptance criteria for the task.
   - **CRITICAL:** Run the tests and confirm that they fail as expected. This is the "Red" phase of TDD. Do not proceed until you have failing tests.

4. **Implement to Pass Tests (Green Phase):**
   - Write the minimum amount of application code necessary to make the failing tests pass.
   - Run the test suite again and confirm that all tests now pass. This is the "Green" phase.

5. **Refactor (Optional but Recommended):**
   - With the safety of passing tests, refactor the implementation code and the test code to improve clarity, remove duplication, and enhance performance without changing the external behavior.
   - Rerun tests to ensure they still pass after refactoring.

6. **Verify Coverage:** Run coverage reports using the project's chosen tools. Examples:
   
   **TypeScript (Bun):**
   ```bash
   bun test --coverage
   ```
   
   **Go:**
   ```bash
   go test -cover ./...
   go test -coverprofile=coverage.out ./...
   go tool cover -html=coverage.out
   ```
   
   Target: >80% coverage for new code.

7. **Document Deviations:** If implementation differs from tech stack:
   - **STOP** implementation
   - Update `tech-stack.md` with new design
   - Add dated note explaining the change
   - Resume implementation

8. **Commit Code Changes:**
   - Stage all code changes related to the task.
   - Propose a clear, concise commit message e.g, `feat(ui): Create basic HTML structure for calculator`.
   - Perform the commit.

9. **Attach Task Summary with Git Notes:**
   - **Step 9.1: Get Commit Hash:** Obtain the hash of the *just-completed commit* (`git log -1 --format="%H"`).
   - **Step 9.2: Draft Note Content:** Create a detailed summary for the completed task. This should include the task name, a summary of changes, a list of all created/modified files, and the core "why" for the change.
   - **Step 9.3: Attach Note:** Use the `git notes` command to attach the summary to the commit.
     ```bash
     # The note content from the previous step is passed via the -m flag.
     git notes add -m "<note content>" <commit_hash>
     ```

10. **Get and Record Task Commit SHA:**
    - **Step 10.1: Update Plan:** Read `plan.md`, find the line for the completed task, update its status from `[~]` to `[x]`, and append the first 7 characters of the *just-completed commit's* commit hash.
    - **Step 10.2: Write Plan:** Write the updated content back to `plan.md`.

11. **Commit Plan Update:**
    - **Action:** Stage the modified `plan.md` file.
    - **Action:** Commit this change with a descriptive message (e.g., `conductor(plan): Mark task 'Create user model' as complete`).

12. **Move Complete Epic and Story to Completed Folder:**
    - **Action:** move completed epics and stories form task_runner/frontmatter.studio/conductor/docs/stories/ to task_runner/frontmatter.studio/conductor/docs/completed/ if all tasks for the epic and story are completed and marked as [x].    

### Phase Completion Verification and Checkpointing Protocol

**Trigger:** This protocol is executed immediately after a task is completed that also concludes a phase in `plan.md`.

1.  **Announce Protocol Start:** Inform the user that the phase is complete and the verification and checkpointing protocol has begun.

2.  **Ensure Test Coverage for Phase Changes:**
    -   **Step 2.1: Determine Phase Scope:** To identify the files changed in this phase, you must first find the starting point. Read `plan.md` to find the Git commit SHA of the *previous* phase's checkpoint. If no previous checkpoint exists, the scope is all changes since the first commit.
    -   **Step 2.2: List Changed Files:** Execute `git diff --name-only <previous_checkpoint_sha> HEAD` to get a precise list of all files modified during this phase.
    -   **Step 2.3: Verify and Create Tests:** For each file in the list:
        -   **CRITICAL:** First, check its extension. Exclude non-code files (e.g., `.json`, `.md`, `.yaml`).
        -   For each remaining code file, verify a corresponding test file exists.
        -   If a test file is missing, you **must** create one. Before writing the test, **first, analyze other test files in the repository to determine the correct naming convention and testing style.** The new tests **must** validate the functionality described in this phase's tasks (`plan.md`).

3.  **Execute Automated Tests with Proactive Debugging:**
    -   Before execution, you **must** announce the exact shell command you will use to run the tests.
    -   **Example Announcements:**
        - **TypeScript (Bun):** "I will now run the automated test suite to verify the phase. **Command:** `CI=true bun test`"
        - **Go:** "I will now run the automated test suite to verify the phase. **Command:** `go test ./...`"
    -   Execute the announced command.
    -   If tests fail, you **must** inform the user and begin debugging. You may attempt to propose a fix a **maximum of two times**. If the tests still fail after your second proposed fix, you **must stop**, report the persistent failure, and ask the user for guidance.

4.  **Propose a Detailed, Actionable Manual Verification Plan:**
    -   **CRITICAL:** To generate the plan, first analyze `product.md`, `product-guidelines.md`, `tech-stack.md`, and `plan.md` to determine the user-facing goals of the completed phase.
    -   You **must** generate a step-by-step plan that walks the user through the verification process, including any necessary commands and specific, expected outcomes.
    -   The plan you present to the user **must** follow this format:

        **For a TypeScript (Bun) Frontend Change:**
        ```
        The automated tests have passed. For manual verification, please follow these steps:

        **Manual Verification Steps:**
        1.  **Start the development server with the command:** `bun run dev`
        2.  **Open your browser to:** `http://localhost:5173` (or configured port)
        3.  **Confirm that you see:** The new user profile page, with the user's name and email displayed correctly.
        ```

        **For a TypeScript (Bun) Backend Change:**
        ```
        The automated tests have passed. For manual verification, please follow these steps:

        **Manual Verification Steps:**
        1.  **Ensure the server is running:** `bun run src/server.ts`
        2.  **Execute the following command in your terminal:** `curl -X POST http://localhost:3000/api/jobs -H "Content-Type: application/json" -d '{"name": "test"}'`
        3.  **Confirm that you receive:** A JSON response with a status of `201 Created`.
        4.  **Verify logs:** `jq -r 'select(.job_id == "backend") | .data' logs/stderr.jsonl | tail -n 10`
        ```
        
        **For a Go Backend Change:**
        ```
        The automated tests have passed. For manual verification, please follow these steps:

        **Manual Verification Steps:**
        1.  **Ensure the server is running:** `go run cmd/server/main.go`
        2.  **Execute the following command in your terminal:** `curl -X POST http://localhost:8080/api/v1/users -H "Content-Type: application/json" -d '{"name": "test"}'`
        3.  **Confirm that you receive:** A JSON response with a status of `201 Created`.
        ```
        
        **For a Bash Script Change:**
        ```
        The automated tests have passed. For manual verification, please follow these steps:

        **Manual Verification Steps:**
        1.  **Execute the script with test input:** `./script_name.sh test_input`
        2.  **Verify the output:** Check that stdout matches expected behavior
        3.  **Check exit code:** `echo $?` should be `0` for success
        4.  **Verify JSONL logs (if applicable):** `cat logs/script_output.jsonl | jq -r '.data'`
        ```

5.  **Await Explicit User Feedback:**
    -   After presenting the detailed plan, ask the user for confirmation: "**Does this meet your expectations? Please confirm with yes or provide feedback on what needs to be changed.**"
    -   **PAUSE** and await the user's response. Do not proceed without an explicit yes or confirmation.

6.  **Create Checkpoint Commit:**
    -   Stage all changes. If no changes occurred in this step, proceed with an empty commit.
    -   Perform the commit with a clear and concise message (e.g., `conductor(checkpoint): Checkpoint end of Phase X`).

7.  **Attach Auditable Verification Report using Git Notes:**
    -   **Step 8.1: Draft Note Content:** Create a detailed verification report including the automated test command, the manual verification steps, and the user's confirmation.
    -   **Step 8.2: Attach Note:** Use the `git notes` command and the full commit hash from the previous step to attach the full report to the checkpoint commit.

8.  **Get and Record Phase Checkpoint SHA:**
    -   **Step 7.1: Get Commit Hash:** Obtain the hash of the *just-created checkpoint commit* (`git log -1 --format="%H"`).
    -   **Step 7.2: Update Plan:** Read `plan.md`, find the heading for the completed phase, and append the first 7 characters of the commit hash in the format `[checkpoint: <sha>]`.
    -   **Step 7.3: Write Plan:** Write the updated content back to `plan.md`.

9. **Commit Plan Update:**
    - **Action:** Stage the modified `plan.md` file.
    - **Action:** Commit this change with a descriptive message following the format `conductor(plan): Mark phase '<PHASE NAME>' as complete`.

10.  **Announce Completion:** Inform the user that the phase is complete and the checkpoint has been created, with the detailed verification report attached as a git note.

### Quality Gates

Before marking any task complete, verify:

- [ ] All tests pass
- [ ] Code coverage meets requirements (>80%)
- [ ] Code follows project's code style guidelines (as defined in `styleguides/`)
- [ ] All public functions/methods are documented (JSDoc for TypeScript, GoDoc for Go, inline comments for Bash)
- [ ] Type safety is enforced (TypeScript strict mode, Go type checking)
- [ ] No linting or static analysis errors:
  - **TypeScript (Bun):** `bun run lint` (ESLint/Biome)
  - **Go:** `go vet ./...`, `golangci-lint run`
  - **Bash:** `shellcheck *.sh`
- [ ] Works correctly on mobile (if applicable)
- [ ] Documentation updated if needed
- [ ] No security vulnerabilities introduced

## Development Commands

### Dashboard Management

**Recommended Workflow:**
Always use the helper script to manage all dashboard services (Backend, Frontend, Monitor, Queue) to ensure a clean process tree.

```bash
# Start all services (Backend: 3000, Frontend: 5173)
./task_runner/start_dashboard.sh

# Stop all services gracefully
./task_runner/start_dashboard.sh --stop
```

### Setup

**TypeScript (Bun):**
```bash
# Install dependencies
bun install

# Setup environment
cp .env.example .env
```

**Go:**
```bash
# Download dependencies
go mod download

# Tidy dependencies
go mod tidy

# Verify dependencies
go mod verify
```

**Bash:**
```bash
# Ensure scripts are executable
chmod +x *.sh

# Install shellcheck for linting
brew install shellcheck  # macOS
```

### Daily Development

**TypeScript (Bun) - Frontend:**
```bash
# Start Vite dev server with HMR
bun run dev

# Run tests in watch mode
bun test --watch

# Run tests once (CI mode)
CI=true bun test

# Lint code
bun run lint

# Format code
bun run format
```

**TypeScript (Bun) - Backend:**
```bash
# Start backend server
bun run src/server.ts

# Start with hot reload (using --watch)
bun --watch src/server.ts

# Run backend tests
bun test src/**/*.test.ts
```

**Go:**
```bash
# Run application
go run main.go

# Run with specific package
go run ./cmd/server

# Run tests
go test ./...

# Run tests with verbose output
go test -v ./...

# Run tests with coverage
go test -cover ./...

# Format code
go fmt ./...

# Lint code
go vet ./...
```

**Bash:**
```bash
# Run script
./script_name.sh

# Debug mode (print all commands)
bash -x script_name.sh

# Lint shell scripts
shellcheck script_name.sh

# Lint all shell scripts
shellcheck *.sh
```

### Before Committing

**TypeScript (Bun):**
```bash
# Run all pre-commit checks
bun run format        # Auto-format code
bun run lint          # Check for linting errors
bun run typecheck     # TypeScript type checking
CI=true bun test      # Run all tests once
bun test --coverage   # Verify coverage >80%
```

**Go:**
```bash
# Format all code
go fmt ./...

# Run static analysis
go vet ./...

# Run linter (if golangci-lint installed)
golangci-lint run

# Run all tests with coverage
go test -cover ./...

# Verify coverage threshold
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out
```

**Bash:**
```bash
# Lint all shell scripts
shellcheck *.sh

# Check for common issues
shellcheck -x *.sh  # Follow sourced files
```

**Combined Pre-Commit (All Languages):**
```bash
# TypeScript/Bun checks
bun run format && bun run lint && CI=true bun test

# Go checks
go fmt ./... && go vet ./... && go test ./...

# Bash checks
shellcheck *.sh
```

## Testing Requirements

### Unit Testing

**TypeScript (Bun):**
- Every module must have a corresponding `.test.ts` file
- Use Bun's built-in test runner: `bun test`
- Setup/teardown: `beforeEach()`, `afterEach()`, `beforeAll()`, `afterAll()`
- Mocking: Use `mock()` function or manual mocks
- Example:
  ```typescript
  import { describe, test, expect, beforeEach } from "bun:test";
  
  describe("MyModule", () => {
    beforeEach(() => {
      // Setup
    });
    
    test("should handle success case", () => {
      expect(myFunction()).toBe(expected);
    });
    
    test("should handle failure case", () => {
      expect(() => myFunction()).toThrow();
    });
  });
  ```

**Go:**
- Every package must have a corresponding `*_test.go` file
- Use standard `testing` package: `go test`
- Table-driven tests for multiple cases
- Setup/teardown: `TestMain()` or individual test setup
- Example:
  ```go
  func TestMyFunction(t *testing.T) {
    tests := []struct {
      name    string
      input   string
      want    string
      wantErr bool
    }{
      {"success case", "input", "expected", false},
      {"error case", "bad", "", true},
    }
    
    for _, tt := range tests {
      t.Run(tt.name, func(t *testing.T) {
        got, err := MyFunction(tt.input)
        if (err != nil) != tt.wantErr {
          t.Errorf("error = %v, wantErr %v", err, tt.wantErr)
        }
        if got != tt.want {
          t.Errorf("got %v, want %v", got, tt.want)
        }
      })
    }
  }
  ```

**Bash:**
- Use `bats` (Bash Automated Testing System) for shell script testing
- Test files: `test/*.bats`
- Example:
  ```bash
  #!/usr/bin/env bats
  
  @test "script succeeds with valid input" {
    run ./my_script.sh "valid_input"
    [ "$status" -eq 0 ]
    [ "${lines[0]}" = "Expected output" ]
  }
  
  @test "script fails with invalid input" {
    run ./my_script.sh "invalid"
    [ "$status" -ne 0 ]
  }
  ```

**General Requirements:**
- Mock external dependencies
- Test both success and failure cases
- Test edge cases and boundary conditions
- Maintain >80% code coverage

### Integration Testing
- Test complete user flows
- Verify database transactions
- Test authentication and authorization
- Check form submissions

### Mobile Testing
- Test on actual iPhone when possible
- Use Safari developer tools
- Test touch interactions
- Verify responsive layouts
- Check performance on 3G/4G

## Code Review Process

### Self-Review Checklist
Before requesting review:

1. **Functionality**
   - Feature works as specified
   - Edge cases handled
   - Error messages are user-friendly

2. **Code Quality**
   - Follows style guide
   - DRY principle applied
   - Clear variable/function names
   - Appropriate comments

3. **Testing**
   - Unit tests comprehensive
   - Integration tests pass
   - Coverage adequate (>80%)

4. **Security**
   - No hardcoded secrets
   - Input validation present
   - SQL injection prevented
   - XSS protection in place

5. **Performance**
   - Database queries optimized
   - Images optimized
   - Caching implemented where needed

6. **Mobile Experience**
   - Touch targets adequate (44x44px)
   - Text readable without zooming
   - Performance acceptable on mobile
   - Interactions feel native

## Commit Guidelines

### Message Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests
- `chore`: Maintenance tasks

### Examples
```bash
git commit -m "feat(auth): Add remember me functionality"
git commit -m "fix(posts): Correct excerpt generation for short posts"
git commit -m "test(comments): Add tests for emoji reaction limits"
git commit -m "style(mobile): Improve button touch targets"
```

## Definition of Done

A task is complete when:

1. All code implemented to specification
2. Unit tests written and passing
3. Code coverage meets project requirements
4. Documentation complete (if applicable)
5. Code passes all configured linting and static analysis checks
6. Works beautifully on mobile (if applicable)
7. Implementation notes added to `plan.md`
8. Changes committed with proper message
9. Git note with task summary attached to the commit

## Emergency Procedures

### Critical Bug in Production
1. Create hotfix branch from main
2. Write failing test for bug
3. Implement minimal fix
4. Test thoroughly including mobile
5. Deploy immediately
6. Document in plan.md

### Data Loss
1. Stop all write operations
2. Restore from latest backup
3. Verify data integrity
4. Document incident
5. Update backup procedures

### Security Breach
1. Rotate all secrets immediately
2. Review access logs
3. Patch vulnerability
4. Notify affected users (if any)
5. Document and update security procedures

## Deployment Workflow

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Coverage >80%
- [ ] No linting errors
- [ ] Mobile testing complete
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Backup created

### Deployment Steps
1. Merge feature branch to main
2. Tag release with version
3. Push to deployment service
4. Run database migrations
5. Verify deployment
6. Test critical paths
7. Monitor for errors

### Post-Deployment
1. Monitor analytics
2. Check error logs
3. Gather user feedback
4. Plan next iteration

## Continuous Improvement

- Review workflow weekly
- Update based on pain points
- Document lessons learned
- Optimize for user happiness
- Keep things simple and maintainable

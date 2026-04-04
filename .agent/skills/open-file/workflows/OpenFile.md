# open-file Workflow

Opens a file using the macOS `open` command in its default viewer or editor.

## Execution Steps

1. **Identify the file path** from the user's request
2. **Execute the open command** using Bash
3. **Confirm the file opened** to the user

## Implementation

Use the Bash tool with the `open` command:

```bash
open /path/to/file
```

The `open` command will:
- Detect the file type by extension
- Launch the appropriate default application
- Return immediately without waiting for the application to close

## Error Handling

If the file doesn't exist or can't be opened:
- The `open` command will display a system error dialog
- Report the error to the user

## Example Usage

For opening `/Projects/sam/20260104SundayService.md`:

```bash
open "/Projects/sam/20260104SundayService.md"
```

This will open the file in the system's default markdown viewer/editor.

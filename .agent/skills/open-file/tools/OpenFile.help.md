# open-file Tool Help

## Overview

The open-file tool opens any file using the macOS `open` command, which automatically launches the file in its system default viewer or editor.

## Usage

```bash
bun open-file.ts <filepath>
```

## Arguments

- `<filepath>` - The path to the file you want to open (required)
  - Supports absolute paths: `/Users/username/file.pdf`
  - Supports relative paths: `./document.md`
  - Supports home directory: `~/Downloads/file.xlsx`

- `--help`, `-h` - Display help message

## Examples

### Open a markdown file
```bash
bun open-file.ts /Projects/sam/20260104SundayService.md
```

### Open a file with relative path
```bash
bun open-file.ts ./notes.txt
```

### Open from home directory
```bash
bun open-file.ts ~/Documents/report.pdf
```

## Behavior

- The file opens in the system's default application for that file type
- The command returns immediately (doesn't wait for the application to close)
- If the file doesn't exist, an error message is displayed
- File type is determined by extension

## File Types Supported

Any file type that has a registered default application:
- **Documents**: .md, .txt, .doc, .docx, .pdf
- **Spreadsheets**: .xlsx, .csv, .numbers
- **Images**: .png, .jpg, .gif, .svg
- **Code**: .ts, .py, .js, .html, .css
- **Media**: .mp4, .mp3, .m4a
- **Archives**: .zip, .tar, .tar.gz

## Exit Codes

- `0` - File opened successfully
- `1` - Error (file not found, invalid path, etc.)

## Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "File not found" | The specified file doesn't exist | Check the file path and try again |
| "Error opening file" | The `open` command failed | Try opening the file manually from Finder |

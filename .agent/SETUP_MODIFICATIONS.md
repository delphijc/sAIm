# Setup.sh Modifications Required

## Current Status
- voice-server venv rebuild is in progress
- Setup.sh needs two new functions and a new build step

## Modifications Needed

### 1. New Function: `build_python_sidecar()`
Insert before the `build_whisper()` function (around line 389):

```bash
# ============================================
# Build/Rebuild Python Sidecar venv
# ============================================

build_python_sidecar() {
    local sidecar_dir="$HOME/Projects/voice-server/python-sidecar"

    print_header "Building Python Sidecar venv"

    if [ ! -d "$sidecar_dir" ]; then
        print_error "voice-server not found at $sidecar_dir"
        return 1
    fi

    # Check if rebuild script exists
    if [ ! -f "$sidecar_dir/rebuild-venv.sh" ]; then
        print_error "rebuild-venv.sh not found in $sidecar_dir"
        return 1
    fi

    print_step "Rebuilding Python venv (this may take 5-10 minutes)..."
    cd "$sidecar_dir"
    bash rebuild-venv.sh

    if [ -f "$sidecar_dir/venv/bin/python" ]; then
        print_success "Python sidecar venv built successfully!"
        print_info "Location: $sidecar_dir/venv"
    else
        print_error "Python venv build may have failed"
        return 1
    fi
}
```

### 2. New Step: "Step 5a: Python Sidecar venv"
Insert after Step 5 header (around line 878-882) and BEFORE whisper.cpp build:

```bash
# ============================================
# Step 5a: Python Sidecar venv (TTS Model Server)
# ============================================

print_header "Step 5a: Python Sidecar venv (TTS Model Server)"

if [ -f "$HOME/Projects/voice-server/python-sidecar/venv/bin/python" ]; then
    print_success "Python sidecar venv already built"
    if ask_yes_no "Rebuild Python sidecar venv?" "n"; then
        build_python_sidecar
    fi
elif ask_yes_no "Build Python sidecar venv for TTS?"; then
    build_python_sidecar
else
    print_info "Skipping Python sidecar venv build"
fi

# ============================================
# Step 5b: whisper.cpp (Speech-to-Text)
# ============================================

print_header "Step 5b: whisper.cpp (Speech-to-Text)"
# ... rest of whisper.cpp section
```

### 3. Relabel whisper.cpp section
Change "Step 5: whisper.cpp" to "Step 5b: whisper.cpp"
Change "Step 6: Configure Environment" to "Step 7: Configure Environment"

### 4. Add --build-sidecar flag
Add to the case statement (around line 595):
```bash
    --build-sidecar)
        build_python_sidecar
        exit 0
        ;;
```

### 5. Update Quick Reference
Update the quick reference section (around line 1115) to include:
```bash
echo "  ${CYAN}setup.sh --build-sidecar${NC}        # Build/rebuild python sidecar venv"
```

## Whisper.cpp Issue
The whisper.cpp directory exists but is empty. The `build_whisper()` function should check if the directory is empty and clone if needed. Current code at line 394-396 handles this, but verify it works correctly.

## Testing After Modifications
After applying modifications, test with:
```bash
./setup.sh --build-sidecar    # Rebuild python sidecar
./setup.sh --check             # Verify all installations
```

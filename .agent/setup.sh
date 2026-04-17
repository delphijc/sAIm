#!/bin/bash

# ============================================
# PAI (Personal AI Infrastructure) Setup Script
# ============================================
#
# Cross-platform setup for Linux (Ubuntu/Debian/Mint) and macOS.
# Handles mandatory and optional dependencies, environment configuration,
# external tool compilation, and systemd service installation.
#
# Usage:
#   ./setup.sh                       # Full interactive setup
#   ./setup.sh --check               # Check installed dependencies only
#   ./setup.sh --fix-paths           # Fix hardcoded paths only
#   ./setup.sh --configure-env       # Re-run env wizard (add/keep/skip per var)
#   ./setup.sh --clone-projects      # Clone optional companion projects
#   ./setup.sh --install-services    # Install systemd services only
#   ./setup.sh --install-security-tools  # Install security toolkit only
#   ./setup.sh --build-sidecar       # Build python-sidecar venv only
#   ./setup.sh --build-whisper       # Build whisper.cpp only
#
# Or download and run:
#   git clone https://github.com/yourusername/sAIm.git && cd sam && bash .agent/setup.sh
#
# ============================================

set -e  # Exit on error

# ============================================
# Constants & Colors
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

CHECK="✅"
CROSS="❌"
WARN="⚠️"
INFO="ℹ️"
ROCKET="🚀"
PARTY="🎉"
THINKING="🤔"
WRENCH="🔧"

# Resolve script and project directories
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PAI_PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ============================================
# Helper Functions
# ============================================

print_header() {
    echo ""
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() { echo -e "${GREEN}${CHECK} $1${NC}"; }
print_error()   { echo -e "${RED}${CROSS} $1${NC}"; }
print_warning() { echo -e "${YELLOW}${WARN} $1${NC}"; }
print_info()    { echo -e "${CYAN}${INFO} $1${NC}"; }
print_step()    { echo -e "${BLUE}${WRENCH} $1${NC}"; }

ask_yes_no() {
    local question="$1"
    local default="${2:-y}"
    local prompt="[Y/n]"
    [ "$default" = "n" ] && prompt="[y/N]"

    while true; do
        echo -n -e "${CYAN}${THINKING} $question $prompt: ${NC}"
        read -r response
        response=${response:-$default}
        case "$response" in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

ask_input() {
    local question="$1"
    local default="$2"
    local response

    if [ -n "$default" ]; then
        echo -n -e "${CYAN}${THINKING} $question [$default]: ${NC}"
    else
        echo -n -e "${CYAN}${THINKING} $question: ${NC}"
    fi

    read -r response
    response=$(echo "$response" | xargs)
    echo "${response:-$default}"
}

command_exists() { command -v "$1" >/dev/null 2>&1; }

detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ -f /etc/debian_version ]]; then
        echo "debian"  # Ubuntu, Debian, Mint
    elif [[ -f /etc/redhat-release ]]; then
        echo "redhat"  # Fedora, CentOS, RHEL
    else
        echo "unknown"
    fi
}

pkg_install() {
    local os=$(detect_os)
    case "$os" in
        macos)  brew install "$@" ;;
        debian) sudo apt install -y "$@" ;;
        redhat) sudo dnf install -y "$@" ;;
        *)      print_error "Unsupported OS for auto-install. Install manually: $*"; return 1 ;;
    esac
}

# ============================================
# Fix Hardcoded Paths
# ============================================

fix_hardcoded_paths() {
    local pai_root="${1:-$PAI_PROJECT_ROOT}"
    local target_home="${HOME}"
    local claude_dir="${target_home}/.claude"
    local changes_made=0

    print_header "Fixing Hardcoded Paths"
    print_info "Target HOME: $target_home"
    print_info "PAI root: $pai_root"

    local config_files=(
        "$pai_root/.agent/settings.json"
        "$pai_root/.agent/.mcp.json"
        "$pai_root/.agent/services/install-systemd.sh"
        "$pai_root/.agent/services/watchdog.sh"
        "$pai_root/.agent/scripts/setup-pai-systemd-services.sh"
        "$pai_root/.agent/services/pai-voice-server.service"
        "$pai_root/.agent/services/pai-discord.service"
        "$pai_root/.agent/services/pai-observability.service"
        "$pai_root/.agent/services/awareness-dashboard-client.service"
        "$pai_root/.agent/services/awareness-dashboard-server.service"
        "$pai_root/.agent/services/cyber-alert-mgr-server.service"
        "$pai_root/.agent/services/cyber-alert-mgr-frontend.service"
        "$pai_root/.agent/services/markdown-editor.service"
    )

    # Known home directory patterns to replace
    local old_homes=(
        "/home/obsidium"
        "/home/jaysoncavendish"
        "/Users/delphijc"
        "/Users/daniel"
    )

    # Auto-detect home paths in settings.json
    if [ -f "$pai_root/.agent/settings.json" ]; then
        local detected_home
        detected_home=$(grep -oP '"/home/[^/]+/' "$pai_root/.agent/settings.json" 2>/dev/null | head -1 | tr -d '"' | sed 's|/$||')
        if [ -n "$detected_home" ] && [ "$detected_home" != "$target_home" ]; then
            old_homes+=("$detected_home")
        fi
        detected_home=$(grep -oP '"/Users/[^/]+/' "$pai_root/.agent/settings.json" 2>/dev/null | head -1 | tr -d '"' | sed 's|/$||')
        if [ -n "$detected_home" ] && [ "$detected_home" != "$target_home" ]; then
            old_homes+=("$detected_home")
        fi
    fi

    # Deduplicate
    local unique_homes=()
    for h in "${old_homes[@]}"; do
        local found=0
        for u in "${unique_homes[@]}"; do
            if [ "$h" = "$u" ]; then found=1; break; fi
        done
        [ "$found" -eq 0 ] && unique_homes+=("$h")
    done

    for file in "${config_files[@]}"; do
        [ ! -f "$file" ] && continue
        for old_home in "${unique_homes[@]}"; do
            if grep -q "$old_home" "$file" 2>/dev/null; then
                print_step "Updating $file: $old_home -> $target_home"
                sed -i "s|$old_home|$target_home|g" "$file"
                changes_made=$((changes_made + 1))
            fi
        done
    done

    # Fix deployed ~/.claude/settings.json
    if [ -f "$claude_dir/settings.json" ]; then
        for old_home in "${unique_homes[@]}"; do
            if grep -q "$old_home" "$claude_dir/settings.json" 2>/dev/null; then
                print_step "Updating deployed settings: $claude_dir/settings.json"
                sed -i "s|$old_home|$target_home|g" "$claude_dir/settings.json"
                changes_made=$((changes_made + 1))
            fi
        done
    fi

    # Replace __HOME__ placeholders
    for file in "${config_files[@]}"; do
        if [ -f "$file" ] && grep -q "__HOME__" "$file" 2>/dev/null; then
            print_step "Replacing __HOME__ placeholders in $file"
            sed -i "s|__HOME__|$target_home|g" "$file"
            changes_made=$((changes_made + 1))
        fi
    done

    if [ "$changes_made" -gt 0 ]; then
        print_success "Updated $changes_made file(s) with correct paths"
    else
        print_success "All paths are already correct for $target_home"
    fi
    echo ""
}

# ============================================
# Fix Vite allowedHosts with Current Hostname
# ============================================

fix_vite_allowed_hosts() {
    local pai_root="${1:-$PAI_PROJECT_ROOT}"
    local current_hostname
    current_hostname=$(hostname 2>/dev/null || cat /etc/hostname 2>/dev/null || echo "")

    print_header "Fixing Vite allowedHosts"
    print_info "Detected hostname: ${current_hostname:-<unknown>}"

    if [ -z "$current_hostname" ]; then
        print_warning "Could not detect hostname — skipping Vite allowedHosts update"
        return 0
    fi

    # Find all vite.config.ts files in the PAI project
    local vite_configs=()
    while IFS= read -r f; do
        vite_configs+=("$f")
    done < <(find "$pai_root" -name "vite.config.ts" -not -path "*/node_modules/*" 2>/dev/null)

    if [ ${#vite_configs[@]} -eq 0 ]; then
        print_info "No Vite configs found — nothing to update"
        return 0
    fi

    local changes_made=0
    for config_file in "${vite_configs[@]}"; do
        if ! grep -q "allowedHosts" "$config_file" 2>/dev/null; then
            continue
        fi

        # Check if hostname is already in allowedHosts
        if grep "allowedHosts" "$config_file" | grep -q "'${current_hostname}'\|\"${current_hostname}\""; then
            print_success "  $config_file — already has '$current_hostname'"
            continue
        fi

        # Replace the allowedHosts line, keeping localhost and adding current hostname
        if sed -i.bak "s|allowedHosts: \[.*\]|allowedHosts: ['localhost', '${current_hostname}']|" "$config_file"; then
            rm -f "${config_file}.bak"
            print_step "  Updated $config_file — allowedHosts: ['localhost', '${current_hostname}']"
            changes_made=$((changes_made + 1))
        else
            print_error "  Failed to update $config_file"
        fi
    done

    if [ "$changes_made" -gt 0 ]; then
        print_success "Updated allowedHosts in $changes_made Vite config(s)"
    else
        print_success "All Vite configs already have correct hostname"
    fi
    echo ""
}

# ============================================
# Dependency Check
# ============================================

check_dependencies() {
    print_header "Dependency Check"

    local os=$(detect_os)
    local os_label="Unknown"
    case "$os" in
        macos)  os_label="macOS $(sw_vers -productVersion 2>/dev/null || echo '')" ;;
        debian) os_label="$(lsb_release -ds 2>/dev/null || cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '"')" ;;
        redhat) os_label="$(cat /etc/redhat-release 2>/dev/null)" ;;
    esac
    print_info "Platform: $os_label ($OSTYPE)"
    echo ""

    echo -e "${BLUE}── Mandatory ──${NC}"

    if command_exists bun; then
        print_success "Bun $(bun --version)"
    else
        print_error "Bun — NOT INSTALLED (required)"
    fi

    if command_exists git; then
        print_success "Git $(git --version | awk '{print $3}')"
    else
        print_error "Git — NOT INSTALLED (required)"
    fi

    if command_exists curl; then
        print_success "curl $(curl --version | head -1 | awk '{print $2}')"
    else
        print_error "curl — NOT INSTALLED (required)"
    fi

    echo ""
    echo -e "${BLUE}── Optional: Build Tools (for whisper.cpp) ──${NC}"

    if command_exists cmake; then
        print_success "CMake $(cmake --version | head -1 | awk '{print $3}')"
    else
        print_warning "CMake — not installed (needed for whisper.cpp)"
    fi

    if command_exists gcc; then
        print_success "GCC $(gcc --version | head -1 | grep -oP '\d+\.\d+\.\d+' | head -1)"
    else
        print_warning "GCC — not installed (needed for whisper.cpp)"
    fi

    if command_exists make; then
        print_success "Make installed"
    else
        print_warning "Make — not installed (needed for whisper.cpp)"
    fi

    echo ""
    echo -e "${BLUE}── Optional: Python (for voice sidecar, musicgen) ──${NC}"

    if command_exists python3; then
        print_success "Python $(python3 --version | awk '{print $2}')"
    else
        print_warning "Python3 — not installed"
    fi

    if python3 -m venv --help >/dev/null 2>&1; then
        print_success "python3-venv available"
    else
        print_warning "python3-venv — not available (apt install python3-venv)"
    fi

    echo ""
    echo -e "${BLUE}── Homebrew / Linuxbrew ──${NC}"

    if command_exists brew; then
        print_success "Homebrew/Linuxbrew $(brew --version | head -1 | awk '{print $2}')"
    else
        print_warning "Homebrew/Linuxbrew — not installed (needed for security tools)"
    fi

    echo ""
    echo -e "${BLUE}── Optional: Security Tools ──${NC}"

    for sec_tool in naabu httpx nuclei subfinder nmap; do
        if command_exists "$sec_tool"; then
            print_success "$sec_tool installed"
        else
            print_warning "$sec_tool — not installed (run: setup.sh --install-security-tools)"
        fi
    done

    echo ""
    echo -e "${BLUE}── Optional: Media Tools ──${NC}"

    if command_exists ffmpeg; then
        print_success "ffmpeg $(ffmpeg -version 2>/dev/null | head -1 | awk '{print $3}')"
    else
        print_warning "ffmpeg — not installed (needed for audio conversion)"
    fi

    if command_exists ollama; then
        print_success "Ollama installed"
    else
        print_warning "Ollama — not installed (needed for local LLM inference)"
    fi

    if command_exists fabric; then
        print_success "Fabric installed"
    else
        print_warning "Fabric — not installed (needed for fabric skill patterns)"
    fi

    echo ""
    echo -e "${BLUE}── External Repositories ──${NC}"

    if [ -f "$PAI_PROJECT_ROOT/.agent/tools/whisper.cpp/build/bin/whisper-cli" ]; then
        print_success "whisper.cpp — built and ready"
    elif [ -d "$PAI_PROJECT_ROOT/.agent/tools/whisper.cpp" ]; then
        print_warning "whisper.cpp — cloned but not built (run: setup.sh --build-whisper)"
    else
        print_warning "whisper.cpp — not cloned"
    fi

    if [ -d "$HOME/Projects/voice-server" ]; then
        print_success "voice-server — present at ~/Projects/voice-server"
    else
        print_warning "voice-server — not found at ~/Projects/voice-server"
    fi

    echo ""
    echo -e "${BLUE}── Whisper Models ──${NC}"

    local model_dir="$PAI_PROJECT_ROOT/.agent/tools/whisper.cpp/models"
    if [ -d "$model_dir" ]; then
        local models_found=0
        for model in tiny base small medium large; do
            if [ -f "$model_dir/ggml-${model}.bin" ]; then
                local size=$(du -sh "$model_dir/ggml-${model}.bin" 2>/dev/null | awk '{print $1}')
                print_success "ggml-${model}.bin ($size)"
                models_found=$((models_found + 1))
            fi
        done
        [ "$models_found" -eq 0 ] && print_warning "No production models downloaded (run: download-ggml-model.sh base)"
    else
        print_warning "Models directory not found"
    fi

    echo ""
    echo -e "${BLUE}── Environment Configuration ──${NC}"

    if [ -f "$PAI_PROJECT_ROOT/.agent/.env" ]; then
        print_success ".env file exists"
        # Check key variables (without showing values)
        for var in DISCORD_BOT_TOKEN PERPLEXITY_API_KEY GOOGLE_API_KEY VOICE_PROVIDER; do
            local val=$(grep "^${var}=" "$PAI_PROJECT_ROOT/.agent/.env" 2>/dev/null | cut -d= -f2-)
            if [ -n "$val" ] && [ "$val" != "your_${var,,}_here" ]; then
                print_success "  $var — configured"
            else
                print_warning "  $var — not set"
            fi
        done
    else
        print_warning ".env file missing (copy from .env.example)"
    fi

    echo ""
    echo -e "${BLUE}── Systemd Services ──${NC}"

    if systemctl --user is-enabled pai-infrastructure.target >/dev/null 2>&1; then
        print_success "pai-infrastructure.target — enabled"
    else
        print_warning "pai-infrastructure.target — not enabled"
    fi

    for svc in voice-server python-sidecar observability-dashboard discord-remote-control \
               awareness-dashboard-server awareness-dashboard-client \
               cyber-alert-mgr-server cyber-alert-mgr-frontend markdown-editor; do
        if systemctl --user is-active "$svc" >/dev/null 2>&1; then
            print_success "  $svc — running"
        elif systemctl --user is-enabled "$svc" >/dev/null 2>&1; then
            print_warning "  $svc — enabled but not running"
        else
            print_warning "  $svc — not installed"
        fi
    done

    echo ""
}

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

# ============================================
# Build whisper.cpp
# ============================================

build_whisper() {
    local whisper_dir="$PAI_PROJECT_ROOT/.agent/tools/whisper.cpp"

    print_header "Building whisper.cpp"

    if [ ! -d "$whisper_dir" ]; then
        print_step "Cloning whisper.cpp..."
        git clone https://github.com/ggerganov/whisper.cpp.git "$whisper_dir"
    fi

    # Check build tools
    if ! command_exists cmake; then
        print_error "CMake is required to build whisper.cpp"
        echo ""
        echo "Install with:"
        echo "  Linux:  sudo apt install cmake build-essential"
        echo "  macOS:  brew install cmake"
        return 1
    fi

    if ! command_exists gcc && ! command_exists cc; then
        print_error "A C/C++ compiler is required"
        echo ""
        echo "Install with:"
        echo "  Linux:  sudo apt install build-essential"
        echo "  macOS:  xcode-select --install"
        return 1
    fi

    print_step "Configuring build..."
    cd "$whisper_dir"
    cmake -B build

    local nproc_val
    if command_exists nproc; then
        nproc_val=$(nproc)
    else
        nproc_val=$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
    fi

    print_step "Compiling with $nproc_val threads..."
    cmake --build build --config Release -j"$nproc_val"

    if [ -f "$whisper_dir/build/bin/whisper-cli" ]; then
        print_success "whisper.cpp built successfully!"
        print_info "Binary: $whisper_dir/build/bin/whisper-cli"
    else
        print_error "Build may have failed — whisper-cli not found"
        return 1
    fi

    # Download default model if not present
    if [ ! -f "$whisper_dir/models/ggml-base.bin" ]; then
        echo ""
        if ask_yes_no "Download the 'base' whisper model (~142 MB)?"; then
            print_step "Downloading ggml-base model..."
            bash "$whisper_dir/models/download-ggml-model.sh" base
            print_success "Model downloaded!"
        fi
    else
        print_info "Base model already present"
    fi

    cd "$PAI_PROJECT_ROOT"
    echo ""
}

# ============================================
# Install Systemd User Services
# ============================================

install_services() {
    print_header "Installing Systemd User Services"

    local os=$(detect_os)
    if [ "$os" = "macos" ]; then
        print_warning "systemd is not available on macOS"
        print_info "On macOS, services are started manually or via launchd"
        return 0
    fi

    local systemd_user_dir="$HOME/.config/systemd/user"
    mkdir -p "$systemd_user_dir"

    local services_dir="$PAI_PROJECT_ROOT/.agent/services"
    local target_home="$HOME"

    # Map repo service files to installed unit names
    # Format: ["repo-filename"]="installed-unit-name"
    declare -A svc_map=(
        ["pai-voice-server.service"]="voice-server.service"
        ["pai-discord.service"]="discord-remote-control.service"
        ["pai-observability.service"]="observability-dashboard.service"
        ["awareness-dashboard.target"]="awareness-dashboard.target"
        ["awareness-dashboard-client.service"]="awareness-dashboard-client.service"
        ["awareness-dashboard-server.service"]="awareness-dashboard-server.service"
        ["cyber-alert-mgr-server.service"]="cyber-alert-mgr-server.service"
        ["cyber-alert-mgr-frontend.service"]="cyber-alert-mgr-frontend.service"
        ["markdown-editor.service"]="markdown-editor.service"
    )

    # Generate service files with correct paths using __HOME__ placeholder replacement
    for repo_svc in "${!svc_map[@]}"; do
        local installed_name="${svc_map[$repo_svc]}"
        local src="$services_dir/$repo_svc"

        if [ ! -f "$src" ]; then
            print_warning "Template not found: $src — skipping $installed_name"
            continue
        fi

        print_step "Installing $installed_name..."
        sed "s|__HOME__|$target_home|g; s|/home/obsidium|$target_home|g; s|/Users/delphijc|$target_home|g" \
            "$src" > "$systemd_user_dir/$installed_name"
        print_success "Installed $installed_name"
    done

    # NOTE: python-sidecar.service is intentionally NOT installed here.
    # The python sidecar (port 8889) is managed internally by voice-server as a
    # child process. Installing a separate python-sidecar.service causes a port
    # conflict on 8889 and crash-loops. Only voice-server.service is needed.
    # See: voice-server/docs/CROSTINI_LINUX_FIXES.md — Bug 1

    # Install pai-infrastructure.target
    print_step "Installing pai-infrastructure.target..."
    cat > "$systemd_user_dir/pai-infrastructure.target" << TGTEOF
[Unit]
Description=PAI Infrastructure Services
Documentation=man:systemd.target(5)
Wants=voice-server.service observability-dashboard.service discord-remote-control.service awareness-dashboard.target cyber-alert-mgr-server.service cyber-alert-mgr-frontend.service markdown-editor.service

[Install]
WantedBy=default.target
TGTEOF
    print_success "Installed pai-infrastructure.target"

    # Reload and enable
    print_step "Reloading systemd daemon..."
    systemctl --user daemon-reload

    print_step "Enabling services..."
    systemctl --user enable pai-infrastructure.target 2>/dev/null || true

    for svc in voice-server observability-dashboard discord-remote-control \
               awareness-dashboard awareness-dashboard-server awareness-dashboard-client \
               cyber-alert-mgr-server cyber-alert-mgr-frontend markdown-editor; do
        local unit_file="$systemd_user_dir/${svc}.service"
        local target_file="$systemd_user_dir/${svc}.target"
        if [ -f "$unit_file" ] || [ -f "$target_file" ]; then
            systemctl --user enable "$svc" 2>/dev/null || true
            print_success "Enabled $svc"
        fi
    done

    # Enable lingering so user services start at boot without login
    if command_exists loginctl; then
        print_step "Enabling user lingering for boot-time startup..."
        loginctl enable-linger "$(whoami)" 2>/dev/null || true
        print_success "Lingering enabled"
    fi

    echo ""
    if ask_yes_no "Start all PAI services now?"; then
        systemctl --user start pai-infrastructure.target
        sleep 2

        echo ""
        for svc in voice-server observability-dashboard discord-remote-control \
                   awareness-dashboard-server awareness-dashboard-client \
                   cyber-alert-mgr-server cyber-alert-mgr-frontend markdown-editor; do
            if systemctl --user is-active "$svc" >/dev/null 2>&1; then
                print_success "$svc — running"
            else
                print_warning "$svc — not running (check: journalctl --user -u $svc -n 10)"
            fi
        done
    fi

    echo ""
    print_info "Manage services with:"
    echo "  systemctl --user start|stop|restart <service-name>"
    echo "  systemctl --user status voice-server observability-dashboard discord-remote-control"
    echo "  journalctl --user -u <service-name> -f"
    echo ""
}

# ============================================
# Install macOS LaunchAgent Services
# ============================================

install_macos_services() {
    print_header "Installing macOS LaunchAgent Services"

    local launch_agents="$HOME/Library/LaunchAgents"
    local bin_dir="$HOME/.claude/bin"
    local pai_path="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    local bun_path="$HOME/.bun/bin:$pai_path"
    local brew_path="/opt/homebrew/bin:$bun_path"

    mkdir -p "$launch_agents" "$bin_dir"

    # Helper: write a plist and load it
    install_plist() {
        local label="$1"
        local plist_content="$2"
        local plist_file="$launch_agents/$label.plist"

        echo "$plist_content" > "$plist_file"
        chmod 644 "$plist_file"

        # Unload if already loaded (ignore errors)
        launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true

        launchctl load "$plist_file" 2>/dev/null && \
            print_success "$label — loaded" || \
            print_warning "$label — load failed (check: launchctl list $label)"
    }

    # Helper: write a wrapper script and sign it
    write_wrapper() {
        local name="$1"
        local content="$2"
        local script="$bin_dir/$name"
        printf '%s\n' "$content" > "$script"
        chmod +x "$script"
        # Sign if identity exists
        if security find-identity -v -p codesigning 2>/dev/null | grep -q "1 valid"; then
            codesign -f -s "$(security find-identity -v -p codesigning 2>/dev/null | grep -o '"[^"]*"' | head -1 | tr -d '"')" "$script" 2>/dev/null || true
        fi
    }

    # ── voice-server ──────────────────────────────────────────
    if [ -d "$HOME/Projects/voice-server" ]; then
        write_wrapper "pai-voice-server" "#!/bin/sh
exec $HOME/.bun/bin/bun run $HOME/Projects/voice-server/server.ts \"\$@\""
        install_plist "com.pai.voice-server" "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\"><dict>
    <key>Label</key><string>com.pai.voice-server</string>
    <key>ProgramArguments</key><array><string>$bin_dir/pai-voice-server</string></array>
    <key>WorkingDirectory</key><string>$HOME/Projects/voice-server</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
    <key>StandardOutPath</key><string>$HOME/Library/Logs/pai-voice-server.log</string>
    <key>StandardErrorPath</key><string>$HOME/Library/Logs/pai-voice-server.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>$HOME</string>
        <key>PATH</key><string>$brew_path</string>
    </dict>
</dict></plist>"
    else
        print_info "Skipping voice-server — ~/Projects/voice-server not found"
    fi

    # ── observability-server ──────────────────────────────────
    if [ -d "$HOME/.claude/skills/observability/apps/server" ]; then
        write_wrapper "pai-observability-server" "#!/bin/sh
exec $HOME/.bun/bin/bun src/index.ts \"\$@\""
        install_plist "com.pai.observability-server" "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\"><dict>
    <key>Label</key><string>com.pai.observability-server</string>
    <key>ProgramArguments</key><array><string>$bin_dir/pai-observability-server</string></array>
    <key>WorkingDirectory</key><string>$HOME/.claude/skills/observability/apps/server</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
    <key>StandardOutPath</key><string>$HOME/Library/Logs/pai-observability-server.log</string>
    <key>StandardErrorPath</key><string>$HOME/Library/Logs/pai-observability-server.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>$HOME</string>
        <key>PATH</key><string>$brew_path</string>
        <key>PAI_DIR</key><string>$HOME/.claude</string>
    </dict>
</dict></plist>"
    fi

    # ── observability-client ──────────────────────────────────
    if [ -d "$HOME/.claude/skills/observability/apps/client" ]; then
        write_wrapper "pai-observability-client" "#!/bin/sh
exec $HOME/.bun/bin/bun run dev \"\$@\""
        install_plist "com.pai.observability-client" "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\"><dict>
    <key>Label</key><string>com.pai.observability-client</string>
    <key>ProgramArguments</key><array><string>$bin_dir/pai-observability-client</string></array>
    <key>WorkingDirectory</key><string>$HOME/.claude/skills/observability/apps/client</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
    <key>StandardOutPath</key><string>$HOME/Library/Logs/pai-observability-client.log</string>
    <key>StandardErrorPath</key><string>$HOME/Library/Logs/pai-observability-client.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>$HOME</string>
        <key>PATH</key><string>$brew_path</string>
        <key>PAI_DIR</key><string>$HOME/.claude</string>
    </dict>
</dict></plist>"
    fi

    # ── discord-remote-control ────────────────────────────────
    if [ -d "$HOME/.claude/skills/discord-remote-control/service" ]; then
        write_wrapper "pai-discord-bot" "#!/bin/sh
set -a
[ -f \"$HOME/.claude/.env\" ] && . \"$HOME/.claude/.env\"
set +a
exec $HOME/.bun/bin/bun index.ts \"\$@\""
        install_plist "com.pai.discord-remote-control" "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\"><dict>
    <key>Label</key><string>com.pai.discord-remote-control</string>
    <key>ProgramArguments</key><array><string>$bin_dir/pai-discord-bot</string></array>
    <key>WorkingDirectory</key><string>$HOME/.claude/skills/discord-remote-control/service</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
    <key>StandardOutPath</key><string>$HOME/Library/Logs/pai-discord-bot.log</string>
    <key>StandardErrorPath</key><string>$HOME/Library/Logs/pai-discord-bot.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>$HOME</string>
        <key>PATH</key><string>$brew_path</string>
        <key>PAI_DIR</key><string>$HOME/.claude</string>
    </dict>
</dict></plist>"
    fi

    # ── awareness-server ──────────────────────────────────────
    if [ -d "$HOME/Projects/awareness/dashboard/apps/server" ]; then
        local awareness_db="$HOME/Projects/awareness/data/awareness.db"
        write_wrapper "pai-awareness-server" "#!/bin/sh
exec $HOME/.bun/bin/bun run src/index.ts \"\$@\""
        install_plist "com.pai.awareness-server" "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\"><dict>
    <key>Label</key><string>com.pai.awareness-server</string>
    <key>ProgramArguments</key><array><string>$bin_dir/pai-awareness-server</string></array>
    <key>WorkingDirectory</key><string>$HOME/Projects/awareness/dashboard/apps/server</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
    <key>StandardOutPath</key><string>$HOME/Library/Logs/pai-awareness-server.log</string>
    <key>StandardErrorPath</key><string>$HOME/Library/Logs/pai-awareness-server.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>$HOME</string>
        <key>PATH</key><string>$brew_path</string>
        <key>DASHBOARD_PORT</key><string>4100</string>
        <key>AWARENESS_DB</key><string>$awareness_db</string>
    </dict>
</dict></plist>"
    fi

    # ── awareness-client ──────────────────────────────────────
    if [ -d "$HOME/Projects/awareness/dashboard/apps/client" ]; then
        write_wrapper "pai-awareness-client" "#!/bin/sh
exec $HOME/.bun/bin/bun run dev \"\$@\""
        install_plist "com.pai.awareness-client" "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\"><dict>
    <key>Label</key><string>com.pai.awareness-client</string>
    <key>ProgramArguments</key><array><string>$bin_dir/pai-awareness-client</string></array>
    <key>WorkingDirectory</key><string>$HOME/Projects/awareness/dashboard/apps/client</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
    <key>StandardOutPath</key><string>$HOME/Library/Logs/pai-awareness-client.log</string>
    <key>StandardErrorPath</key><string>$HOME/Library/Logs/pai-awareness-client.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>$HOME</string>
        <key>PATH</key><string>$brew_path</string>
    </dict>
</dict></plist>"
    fi

    # ── cyber-alert-server ────────────────────────────────────
    if [ -d "$HOME/Projects/cyber-alert-mgr/server" ]; then
        write_wrapper "pai-cyber-alert-server" "#!/bin/sh
exec $HOME/.bun/bin/bun run index.js \"\$@\""
        install_plist "com.pai.cyber-alert-server" "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\"><dict>
    <key>Label</key><string>com.pai.cyber-alert-server</string>
    <key>ProgramArguments</key><array><string>$bin_dir/pai-cyber-alert-server</string></array>
    <key>WorkingDirectory</key><string>$HOME/Projects/cyber-alert-mgr/server</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
    <key>StandardOutPath</key><string>$HOME/Library/Logs/pai-cyber-alert-server.log</string>
    <key>StandardErrorPath</key><string>$HOME/Library/Logs/pai-cyber-alert-server.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>$HOME</string>
        <key>PATH</key><string>$brew_path</string>
        <key>PORT</key><string>4200</string>
    </dict>
</dict></plist>"
    fi

    # ── cyber-alert-client ────────────────────────────────────
    if [ -d "$HOME/Projects/cyber-alert-mgr" ]; then
        write_wrapper "pai-cyber-alert-client" "#!/bin/sh
exec $HOME/.bun/bin/bun run dev \"\$@\""
        install_plist "com.pai.cyber-alert-client" "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\"><dict>
    <key>Label</key><string>com.pai.cyber-alert-client</string>
    <key>ProgramArguments</key><array><string>$bin_dir/pai-cyber-alert-client</string></array>
    <key>WorkingDirectory</key><string>$HOME/Projects/cyber-alert-mgr</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
    <key>StandardOutPath</key><string>$HOME/Library/Logs/pai-cyber-alert-client.log</string>
    <key>StandardErrorPath</key><string>$HOME/Library/Logs/pai-cyber-alert-client.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>$HOME</string>
        <key>PATH</key><string>$brew_path</string>
    </dict>
</dict></plist>"
    fi

    # ── markdown-editor ───────────────────────────────────────
    if [ -d "$HOME/Projects/markdown-editor" ]; then
        write_wrapper "pai-markdown-editor" "#!/bin/sh
exec $HOME/.bun/bin/bun run server.ts \"\$@\""
        install_plist "com.pai.markdown-editor" "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\"><dict>
    <key>Label</key><string>com.pai.markdown-editor</string>
    <key>ProgramArguments</key><array><string>$bin_dir/pai-markdown-editor</string></array>
    <key>WorkingDirectory</key><string>$HOME/Projects/markdown-editor</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
    <key>StandardOutPath</key><string>$HOME/Library/Logs/pai-markdown-editor.log</string>
    <key>StandardErrorPath</key><string>$HOME/Library/Logs/pai-markdown-editor.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>$HOME</string>
        <key>PATH</key><string>$brew_path</string>
        <key>PORT</key><string>4444</string>
    </dict>
</dict></plist>"
    fi

    # ── memory backups ────────────────────────────────────────
    write_wrapper "pai-memory-backup-hourly" "#!/bin/sh
exec $HOME/.claude/scripts/backup-memory.sh incremental"
    write_wrapper "pai-memory-backup-daily" "#!/bin/sh
exec $HOME/.claude/scripts/backup-memory.sh full"

    install_plist "com.sam.memory-backup-hourly" "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\"><dict>
    <key>Label</key><string>com.sam.memory-backup-hourly</string>
    <key>ProgramArguments</key><array><string>$bin_dir/pai-memory-backup-hourly</string></array>
    <key>WorkingDirectory</key><string>$HOME/.claude</string>
    <key>StartInterval</key><integer>3600</integer>
    <key>StandardOutPath</key><string>$HOME/Library/Logs/pai-memory-backup.log</string>
    <key>StandardErrorPath</key><string>$HOME/Library/Logs/pai-memory-backup.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>$HOME</string>
        <key>PATH</key><string>$brew_path</string>
    </dict>
</dict></plist>"

    install_plist "com.sam.memory-backup-daily" "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\"><dict>
    <key>Label</key><string>com.sam.memory-backup-daily</string>
    <key>ProgramArguments</key><array><string>$bin_dir/pai-memory-backup-daily</string></array>
    <key>WorkingDirectory</key><string>$HOME/.claude</string>
    <key>StartCalendarInterval</key><dict>
        <key>Hour</key><integer>3</integer>
        <key>Minute</key><integer>0</integer>
    </dict>
    <key>StandardOutPath</key><string>$HOME/Library/Logs/pai-memory-backup.log</string>
    <key>StandardErrorPath</key><string>$HOME/Library/Logs/pai-memory-backup.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>$HOME</string>
        <key>PATH</key><string>$brew_path</string>
    </dict>
</dict></plist>"

    echo ""
    print_info "LaunchAgent services auto-start at login. Logs in ~/Library/Logs/pai-*.log"
    print_info "Manage with: launchctl list | grep com.pai"
    print_info "To stop a service: launchctl bootout gui/\$(id -u)/com.pai.<name>"
    echo ""
}

# ============================================
# Install Security Tools
# ============================================

install_security_tools() {
    print_header "Security Toolkit (Optional)"

    echo "PAI security agents use the ProjectDiscovery toolkit + nmap for:"
    echo "  • naabu     — fast port scanning (preferred)"
    echo "  • httpx     — HTTP probing and tech-stack detection"
    echo "  • nuclei    — template-based vulnerability scanning"
    echo "  • subfinder — passive subdomain enumeration"
    echo "  • nmap      — comprehensive port/service/OS detection"
    echo ""

    if ! command_exists brew; then
        print_error "Homebrew/Linuxbrew is required to install security tools."
        print_info "Install it first, then re-run: setup.sh --install-security-tools"
        return 1
    fi

    local to_install=()
    for tool in naabu httpx nuclei subfinder nmap; do
        if command_exists "$tool"; then
            print_success "$tool — already installed"
        else
            to_install+=("$tool")
        fi
    done

    if [ ${#to_install[@]} -eq 0 ]; then
        print_success "All security tools already installed!"
        return 0
    fi

    echo ""
    print_info "Will install: ${to_install[*]}"
    if ask_yes_no "Install security toolkit?" "n"; then
        print_step "Installing via brew: ${to_install[*]}"
        brew install "${to_install[@]}"
        echo ""
        print_success "Security toolkit installed!"
        echo ""
        print_info "Update templates for nuclei:"
        echo "  nuclei -update-templates"
        echo ""
        print_info "Docs: .agent/wiki/security-tools.md"
    else
        print_info "Skipping security toolkit. Install later: setup.sh --install-security-tools"
    fi
}

# ============================================
# propagate_env — Copy .env to linked locations
# ============================================

propagate_env() {
    local env_file="$1"
    local discord_env="$PAI_PROJECT_ROOT/.agent/.env.discord"
    local awareness_env="$HOME/Projects/awareness/.env"

    echo ""
    print_step "Propagating .env to linked locations..."

    cp "$env_file" "$discord_env"
    chmod 600 "$discord_env"
    print_success "Copied to .agent/.env.discord"

    if [ -d "$HOME/Projects/awareness" ]; then
        cp "$env_file" "$awareness_env"
        chmod 600 "$awareness_env"
        print_success "Copied to ~/Projects/awareness/.env"
    else
        print_info "~/Projects/awareness not found — skipping awareness .env copy"
    fi
}

# ============================================
# configure_env — Per-variable .env wizard
# Supports fresh install and idempotent re-runs.
# For each variable in .env.example:
#   - Already set with real value: [K]eep (default) / [C]hange / [S]kip
#   - Not set or still placeholder:  [A]dd value / [S]kip (default)
# Extra vars in .env not in .env.example are preserved.
# After configuration, propagates to .env.discord and awareness/.env.
# ============================================

configure_env() {
    local env_file="${1:-$PAI_PROJECT_ROOT/.agent/.env}"
    local env_example="${2:-$PAI_PROJECT_ROOT/.agent/.env.example}"

    if [ ! -f "$env_example" ]; then
        print_warning ".env.example not found, skipping env configuration"
        return 0
    fi

    # Create .env if it doesn't exist yet
    if [ ! -f "$env_file" ]; then
        cp "$env_example" "$env_file"
        chmod 600 "$env_file"
        print_success ".env created from template"
    else
        print_info ".env already exists — reviewing each variable..."
    fi

    echo ""
    print_info "For each variable: [K]eep current · [C]hange · [S]kip"
    print_info "New/unset vars:    [A]dd value   · [S]kip (default)"
    echo ""

    local vars_changed=0

    while IFS= read -r line; do
        # Section header lines (# ===...)
        if [[ "$line" == "# =="* ]]; then
            local section_title
            section_title=$(echo "$line" | sed 's/^#[[:space:]]*=\+[[:space:]]*//' | sed 's/[[:space:]]*=\+[[:space:]]*$//' | xargs)
            [ -n "$section_title" ] && echo -e "\n${BLUE}  ─── ${section_title} ───${NC}"
            continue
        fi

        # Skip blank lines and comment lines silently
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^[[:space:]]*# ]] && continue

        # Variable lines: KEY=value
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)= ]]; then
            local key="${BASH_REMATCH[1]}"

            # Get current value (handles KEY= with empty value)
            local current_val
            current_val=$(grep -m1 "^${key}=" "$env_file" 2>/dev/null | cut -d= -f2-)
            local in_env=false
            grep -q "^${key}=" "$env_file" 2>/dev/null && in_env=true

            # Detect placeholder values (not yet configured)
            local is_placeholder=false
            if [[ "$current_val" =~ ^your_ ]] || [[ "$current_val" =~ _here$ ]] || [ -z "$current_val" ]; then
                is_placeholder=true
            fi

            # Mask display for secrets
            local display_val="$current_val"
            if [[ "$key" =~ (TOKEN|KEY|SECRET|PASSWORD|PASS) ]] && [ "$is_placeholder" = false ]; then
                display_val="${current_val:0:4}****"
            fi

            local choice
            if [ "$in_env" = true ] && [ "$is_placeholder" = false ]; then
                # Already configured with a real value — default: keep
                echo -n -e "  ${CYAN}${key}${NC} = ${display_val}  [K/c/s]: "
                read -r choice </dev/tty
                choice="${choice:-k}"
            else
                # Not set or still a placeholder — default: skip
                echo -n -e "  ${CYAN}${key}${NC}  (not configured)  [a/S]: "
                read -r choice </dev/tty
                choice="${choice:-s}"
            fi

            case "${choice,,}" in
                c|change|a|add)
                    echo -n -e "    Enter value for ${key}: "
                    local new_val
                    read -r new_val </dev/tty
                    if [ -n "$new_val" ]; then
                        if [ "$in_env" = true ]; then
                            sed -i "s|^${key}=.*|${key}=${new_val}|" "$env_file"
                        else
                            echo "${key}=${new_val}" >> "$env_file"
                        fi
                        vars_changed=$((vars_changed + 1))
                        print_success "    Updated ${key}"
                    else
                        print_info "    Skipped (empty input)"
                    fi
                    ;;
                s|skip)
                    ;;
                *)
                    # keep — no change
                    ;;
            esac
        fi
    done < "$env_example"

    chmod 600 "$env_file"
    echo ""
    if [ "$vars_changed" -gt 0 ]; then
        print_success ".env updated ($vars_changed variable(s) changed)"
    else
        print_info ".env unchanged"
    fi

    propagate_env "$env_file"
}

# ============================================
# clone_companion_projects — Optional PAI sibling repos
# All projects are optional. realms-of-tomorrow is excluded.
# Idempotent: skips repos that already exist at destination.
# ============================================

clone_companion_projects() {
    local projects_dir="${1:-$HOME/Projects}"

    # Ensure ~/Projects exists
    mkdir -p "$projects_dir"

    # PAI companion repos: "name|url|description"
    # realms-of-tomorrow is intentionally excluded (not a PAI component)
    local companions=(
        "awareness|https://github.com/yourusername/awareness.git|Alert monitoring dashboard — integrates with Sam's security feeds"
        "voice-server|https://github.com/yourusername/voice-server.git|Voice server HTTP API — powers Sam's text-to-speech responses"
        "chatterbox|https://github.com/yourusername/chatterbox.git|Local TTS model — free offline voice synthesis for voice-server"
        "cyber-alert-mgr|https://github.com/yourusername/cyber-alert-mgr.git|Cyber alert management — security event tracking and triage"
        "markdown-editor|https://github.com/yourusername/markdown-editor.git|Web-based markdown editor — integrated with Sam's file system"
        "jay-gentic|https://github.com/yourusername/jay-gentic.git|Genetic algorithm experiments — AI research companion"
        "nlm|https://github.com/tmc/nlm.git|Node language model utilities — LLM tooling library (third-party)"
    )

    print_header "Step 3.5: Companion Projects"
    echo "The following optional projects work alongside Sam."
    echo "All are optional. Skip any you don't need."
    echo ""

    local cloned=0
    local skipped=0
    local already=0

    for entry in "${companions[@]}"; do
        local name url desc
        name="${entry%%|*}"
        url="${entry#*|}"
        url="${url%%|*}"
        desc="${entry##*|}"

        local dest="$projects_dir/$name"

        if [ -d "$dest/.git" ]; then
            print_success "$name — already cloned ($dest)"
            already=$((already + 1))
        else
            echo ""
            echo -e "  ${CYAN}${name}${NC} — ${desc}"
            echo -e "  ${BLUE}${url}${NC}"
            if ask_yes_no "  Clone $name?" "y"; then
                print_step "Cloning $name..."
                git clone "$url" "$dest"
                print_success "$name cloned to $dest"
                cloned=$((cloned + 1))
            else
                print_info "  Skipped $name"
                skipped=$((skipped + 1))
            fi
        fi
    done

    echo ""
    print_info "Companion projects: $already already present, $cloned cloned, $skipped skipped"
    [ "$cloned" -gt 0 ] && print_info "Re-run 'setup.sh --clone-projects' anytime to clone skipped projects"
}

# ============================================
# Handle Flags (standalone modes)
# ============================================

case "${1:-}" in
    --fix-paths)
        fix_hardcoded_paths
        fix_vite_allowed_hosts
        exit 0
        ;;
    --check)
        check_dependencies
        exit 0
        ;;
    --build-whisper)
        build_whisper
        exit 0
        ;;
    --build-sidecar)
        build_python_sidecar
        exit 0
        ;;
    --install-services)
        if [ "$(detect_os)" = "macos" ]; then
            install_macos_services
        else
            install_services
        fi
        exit 0
        ;;
    --install-security-tools)
        install_security_tools
        exit 0
        ;;
    --configure-env)
        configure_env
        exit 0
        ;;
    --clone-projects)
        clone_companion_projects
        exit 0
        ;;
esac

# ============================================
# Full Interactive Setup
# ============================================

clear
echo -e "${PURPLE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   PAI - Personal AI Infrastructure Setup              ║
║                                                       ║
║   Welcome! Let's get you set up in a few minutes.    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

OS_TYPE=$(detect_os)
echo ""
echo "This script will:"
echo "  • Check your system for prerequisites ($(detect_os))"
echo "  • Install any missing software (with your permission)"
echo "  • Download or update PAI"
echo "  • Build external tools (whisper.cpp)"
echo "  • Configure your environment"
echo "  • Install systemd services (Linux) or provide manual instructions (macOS)"
echo "  • Test everything to make sure it works"
echo ""

if ! ask_yes_no "Ready to get started?"; then
    echo ""
    echo "No problem! When you're ready, just run this script again."
    exit 0
fi

# ============================================
# Step 1: Check Prerequisites
# ============================================

print_header "Step 1: Checking Prerequisites"

print_step "Detecting platform..."
case "$OS_TYPE" in
    macos)
        macos_version=$(sw_vers -productVersion)
        print_success "Running macOS $macos_version"
        ;;
    debian)
        distro=$(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '"')
        print_success "Running $distro"
        ;;
    redhat)
        distro=$(cat /etc/redhat-release 2>/dev/null)
        print_success "Running $distro"
        ;;
    *)
        print_warning "Unrecognized OS: $OSTYPE"
        if ! ask_yes_no "Continue anyway?"; then exit 1; fi
        ;;
esac

# Check mandatory deps
HAS_GIT=false; HAS_BUN=false; HAS_CURL=false

print_step "Checking for Git..."
if command_exists git; then
    print_success "Git $(git --version | awk '{print $3}')"
    HAS_GIT=true
else
    print_warning "Git is not installed"
fi

print_step "Checking for Bun..."
if command_exists bun; then
    print_success "Bun $(bun --version)"
    HAS_BUN=true
else
    print_warning "Bun is not installed"
fi

print_step "Checking for curl..."
if command_exists curl; then
    print_success "curl installed"
    HAS_CURL=true
else
    print_warning "curl is not installed"
fi

# Check optional deps
print_step "Checking optional tools..."
HAS_CMAKE=false; HAS_GCC=false; HAS_PYTHON=false; HAS_FFMPEG=false

command_exists cmake   && HAS_CMAKE=true  && print_success "CMake $(cmake --version | head -1 | awk '{print $3}')"
command_exists gcc     && HAS_GCC=true    && print_success "GCC installed"
command_exists python3 && HAS_PYTHON=true && print_success "Python $(python3 --version | awk '{print $2}')"
command_exists ffmpeg  && HAS_FFMPEG=true && print_success "ffmpeg installed"

# Check for Homebrew (macOS) or Linuxbrew (Linux) — required for security tools
print_step "Checking for Homebrew/Linuxbrew..."
HAS_BREW=false
if command_exists brew; then
    print_success "Homebrew/Linuxbrew $(brew --version | head -1 | awk '{print $2}')"
    HAS_BREW=true
elif [ -f "/home/linuxbrew/.linuxbrew/bin/brew" ]; then
    eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
    print_success "Linuxbrew found at /home/linuxbrew/.linuxbrew"
    HAS_BREW=true
elif [ -f "/opt/homebrew/bin/brew" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    print_success "Homebrew found at /opt/homebrew"
    HAS_BREW=true
else
    print_warning "Homebrew/Linuxbrew not installed (needed for security tools and other packages)"
fi

# Check security tools
print_step "Checking security tools..."
HAS_NAABU=false; HAS_HTTPX=false; HAS_NUCLEI=false; HAS_SUBFINDER=false; HAS_NMAP=false
command_exists naabu    && HAS_NAABU=true    && print_success "naabu installed"
command_exists httpx    && HAS_HTTPX=true    && print_success "httpx installed"
command_exists nuclei   && HAS_NUCLEI=true   && print_success "nuclei installed"
command_exists subfinder && HAS_SUBFINDER=true && print_success "subfinder installed"
command_exists nmap     && HAS_NMAP=true     && print_success "nmap installed"

# ============================================
# Step 2: Install Missing Software
# ============================================

print_header "Step 2: Installing Missing Software"

# Homebrew / Linuxbrew (required for security tools and other packages)
if [ "${HAS_BREW:-false}" = false ]; then
    if [ "$OS_TYPE" = "macos" ]; then
        if ask_yes_no "Install Homebrew? (required for security tools and package management)"; then
            print_step "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            [ -f "/opt/homebrew/bin/brew" ] && eval "$(/opt/homebrew/bin/brew shellenv)"
            [ -f "/usr/local/bin/brew" ] && eval "$(/usr/local/bin/brew shellenv)"
            print_success "Homebrew installed!"
            HAS_BREW=true
        fi
    else
        if ask_yes_no "Install Linuxbrew? (required for security tools — naabu, httpx, nuclei, nmap)"; then
            print_step "Installing Linuxbrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
            # Add to shell config for persistence
            echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> "${SHELL_CONFIG:-$HOME/.bashrc}"
            print_success "Linuxbrew installed!"
            HAS_BREW=true
        else
            print_info "Skipping Linuxbrew. Security tools will not be available."
        fi
    fi
fi

# Git
if [ "$HAS_GIT" = false ]; then
    if ask_yes_no "Install Git? (required)"; then
        print_step "Installing Git..."
        pkg_install git
        print_success "Git installed!"
        HAS_GIT=true
    else
        print_error "Git is required. Exiting."
        exit 1
    fi
fi

# Bun
if [ "$HAS_BUN" = false ]; then
    if ask_yes_no "Install Bun? (required — fast JavaScript runtime)"; then
        print_step "Installing Bun..."
        curl -fsSL https://bun.sh/install | bash
        export PATH="$HOME/.bun/bin:$PATH"
        print_success "Bun installed!"
        HAS_BUN=true
    else
        print_error "Bun is required. Exiting."
        exit 1
    fi
fi

# curl
if [ "$HAS_CURL" = false ]; then
    print_step "Installing curl..."
    pkg_install curl
    print_success "curl installed!"
fi

# Build tools (optional)
if [ "$HAS_CMAKE" = false ] || [ "$HAS_GCC" = false ]; then
    echo ""
    print_info "Build tools (cmake, gcc) are needed to compile whisper.cpp for audio transcription."
    if ask_yes_no "Install build tools?" "y"; then
        print_step "Installing build tools..."
        case "$OS_TYPE" in
            debian) sudo apt install -y build-essential cmake ;;
            macos)  brew install cmake; xcode-select --install 2>/dev/null || true ;;
            redhat) sudo dnf install -y gcc gcc-c++ cmake make ;;
        esac
        HAS_CMAKE=true; HAS_GCC=true
        print_success "Build tools installed!"
    fi
fi

# Python
if [ "$HAS_PYTHON" = false ]; then
    if ask_yes_no "Install Python 3? (needed for voice sidecar and musicgen)" "n"; then
        print_step "Installing Python 3..."
        case "$OS_TYPE" in
            debian) sudo apt install -y python3 python3-venv python3-pip ;;
            macos)  brew install python3 ;;
            redhat) sudo dnf install -y python3 python3-pip ;;
        esac
        print_success "Python 3 installed!"
        HAS_PYTHON=true
    fi
fi

# ffmpeg
if [ "$HAS_FFMPEG" = false ]; then
    if ask_yes_no "Install ffmpeg? (needed for audio format conversion)" "n"; then
        print_step "Installing ffmpeg..."
        pkg_install ffmpeg
        print_success "ffmpeg installed!"
    fi
fi

# ============================================
# Step 3: Choose Installation Directory
# ============================================

print_header "Step 3: PAI Installation Location"

# Detect if we're already running from a cloned repo
if [ -d "$PAI_PROJECT_ROOT/.git" ]; then
    PAI_DIR="$PAI_PROJECT_ROOT"
    print_success "PAI already installed at: $PAI_DIR"
else
    echo "Where would you like to install PAI?"
    echo ""
    echo "  1) $HOME/Projects/sam (recommended)"
    echo "  2) $HOME/PAI"
    echo "  3) Custom location"
    echo ""

    choice=$(ask_input "Enter your choice (1-3)" "1")

    case $choice in
        1) PAI_DIR="$HOME/Projects/sam" ;;
        2) PAI_DIR="$HOME/PAI" ;;
        3) PAI_DIR=$(ask_input "Enter custom path" "$HOME/Projects/sam") ;;
        *) PAI_DIR="$HOME/Projects/sam" ;;
    esac

    if [ -d "$PAI_DIR/.git" ]; then
        print_info "PAI is already installed at $PAI_DIR"
        if ask_yes_no "Update to the latest version?"; then
            print_step "Updating PAI..."
            cd "$PAI_DIR" && git pull
            print_success "PAI updated!"
        fi
    else
        print_step "Cloning PAI from GitHub..."
        mkdir -p "$(dirname "$PAI_DIR")"
        git clone https://github.com/yourusername/sAIm.git "$PAI_DIR"
        print_success "PAI downloaded!"
    fi
fi

# ============================================
# Step 3.5: Clone Companion Projects
# ============================================

clone_companion_projects "$HOME/Projects"

# ============================================
# Step 4: Install Node Dependencies
# ============================================

print_header "Step 4: Installing Node Dependencies"

# Discord Remote Control
local_drc="$PAI_DIR/.agent/skills/discord-remote-control/service"
if [ -f "$local_drc/package.json" ]; then
    print_step "Installing Discord Remote Control dependencies..."
    cd "$local_drc" && bun install
    print_success "Discord Remote Control dependencies installed"
fi

# Observability Dashboard Client
local_obs_client="$PAI_DIR/.agent/skills/observability/apps/client"
if [ -f "$local_obs_client/package.json" ]; then
    print_step "Installing Observability Dashboard client dependencies..."
    cd "$local_obs_client" && bun install
    print_success "Observability Dashboard client dependencies installed"
fi

# Observability Dashboard Server
local_obs_server="$PAI_DIR/.agent/skills/observability/apps/server"
if [ -f "$local_obs_server/package.json" ]; then
    print_step "Installing Observability Dashboard server dependencies..."
    cd "$local_obs_server" && bun install
    print_success "Observability Dashboard server dependencies installed"
fi

cd "$PAI_DIR"

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
# Step 5b: Build whisper.cpp
# ============================================

print_header "Step 5b: whisper.cpp (Speech-to-Text)"

if [ -f "$PAI_DIR/.agent/tools/whisper.cpp/build/bin/whisper-cli" ]; then
    print_success "whisper.cpp is already built"
    if ! ask_yes_no "Rebuild whisper.cpp?" "n"; then
        echo ""
    else
        build_whisper
    fi
elif [ "$HAS_CMAKE" = true ] && [ "$HAS_GCC" = true ]; then
    if ask_yes_no "Build whisper.cpp for audio transcription?"; then
        build_whisper
    else
        print_info "Skipping whisper.cpp build"
    fi
else
    print_warning "Cannot build whisper.cpp — missing cmake or gcc"
    print_info "Install build tools and re-run: setup.sh --build-whisper"
fi

# ============================================
# Step 6: Configure Environment
# ============================================

print_header "Step 6: Configuring Environment"

# Detect shell
if [ -n "$ZSH_VERSION" ] || [ "$(basename "$SHELL")" = "zsh" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
    SHELL_NAME="zsh"
else
    SHELL_CONFIG="$HOME/.bashrc"
    SHELL_NAME="bash"
fi
print_info "Shell: $SHELL_NAME ($SHELL_CONFIG)"

# Shell environment variables
if grep -q "PAI_DIR" "$SHELL_CONFIG" 2>/dev/null; then
    print_info "PAI environment variables already in $SHELL_CONFIG"
    SHOULD_ADD_CONFIG=false

    if ask_yes_no "Update them?" "n"; then
        sed -i.bak '/# ========== PAI Configuration ==========/,/# =========================================/d' "$SHELL_CONFIG"
        SHOULD_ADD_CONFIG=true
    fi
else
    SHOULD_ADD_CONFIG=true
fi

if [ "$SHOULD_ADD_CONFIG" = true ]; then
    AI_NAME=$(ask_input "What would you like to call your AI assistant?" "Sam")

    cat >> "$SHELL_CONFIG" << EOF

# ========== PAI Configuration ==========
# Personal AI Infrastructure
# Added by PAI setup script on $(date)
export PAI_DIR="$PAI_DIR"
export PAI_HOME="\$HOME"
export DA="$AI_NAME"
# =========================================

EOF

    print_success "Environment variables added to $SHELL_CONFIG"
fi

export PAI_DIR="$PAI_DIR"
export PAI_HOME="$HOME"

# ============================================
# Step 7: Configure Environment Variables
# ============================================

print_header "Step 7: Configuring Environment Variables"

ENV_FILE="$PAI_PROJECT_ROOT/.agent/.env"
ENV_EXAMPLE="$PAI_PROJECT_ROOT/.agent/.env.example"
configure_env "$ENV_FILE" "$ENV_EXAMPLE"

# ============================================
# Step 8: Claude Code Integration
# ============================================

print_header "Step 8: Claude Code Integration"

if ask_yes_no "Are you using Claude Code?"; then
    mkdir -p "$HOME/.claude"

    print_step "Copying PAI configuration to ~/.claude..."
    for dir in hooks skills commands Tools; do
        if [ -d "$PAI_DIR/.claude/$dir" ]; then
            cp -r "$PAI_DIR/.claude/$dir" "$HOME/.claude/"
            print_success "Copied $dir/"
        fi
    done

    if [ -f "$PAI_DIR/.claude/settings.json" ]; then
        cp "$PAI_DIR/.claude/settings.json" "$HOME/.claude/settings.json"
        USER_HOME="${HOME:-$(eval echo ~)}"
        sed -i "s|__HOME__|${USER_HOME}|g" "$HOME/.claude/settings.json"
        print_success "Updated settings.json with path: ${USER_HOME}"
    fi

    # Copy .env to ~/.claude/.env for services that reference it
    if [ -f "$ENV_FILE" ] && [ ! -f "$HOME/.claude/.env" ]; then
        ln -sf "$ENV_FILE" "$HOME/.claude/.env"
        print_success "Linked .env to ~/.claude/.env"
    fi

    echo ""
    print_info "Get Claude Code from: https://claude.ai/code"
else
    print_info "Skipping Claude Code integration"
fi

# ============================================
# Step 9: Install Systemd Services (Linux only)
# ============================================

if [ "$OS_TYPE" != "macos" ]; then
    print_header "Step 9: Systemd Services"

    echo "PAI includes background services that auto-restart on failure:"
    echo "  • voice-server (port 8888) — Text-to-speech API"
    echo "  • python-sidecar (port 8889) — Chatterbox TTS model"
    echo "  • observability-dashboard (port 5172) — Agent monitoring"
    echo "  • discord-remote-control — Discord bot interface"
    echo ""

    if ask_yes_no "Install and enable systemd user services?"; then
        install_services
    else
        print_info "Skipping service installation. Run later: setup.sh --install-services"
    fi
else
    print_header "Step 9: LaunchAgent Services (macOS)"

    echo "PAI includes LaunchAgent services that auto-start at login:"
    echo "  • voice-server (port 8888) — Text-to-speech API"
    echo "  • observability-dashboard (ports 4000/5172) — Agent monitoring"
    echo "  • discord-remote-control — Discord bot interface"
    echo "  • awareness-dashboard (ports 4100/5173) — Situational awareness"
    echo "  • cyber-alert-mgr (ports 4200/5174) — Cyber alert management"
    echo "  • markdown-editor (port 4444) — Web-based markdown viewer"
    echo "  • memory-backup (hourly/daily) — Automatic memory snapshots"
    echo ""
    echo "Named wrapper scripts in ~/.claude/bin/ give services meaningful names"
    echo "in System Settings > General > Login Items & Extensions."
    echo ""

    if ask_yes_no "Install and load LaunchAgent services?"; then
        install_macos_services
    else
        print_info "Skipping LaunchAgent installation. Run later: setup.sh --install-services"
    fi
fi

# ============================================
# Step 10: Fabric (Optional)
# ============================================

print_header "Step 10: Fabric AI Patterns (Optional)"

echo "Fabric is an AI prompting framework with 248+ patterns."
echo "PAI executes patterns natively, but the CLI is needed to download/update them."
echo ""

if ask_yes_no "Install Fabric?" "n"; then
    print_step "Installing Fabric..."
    curl -sSL https://raw.githubusercontent.com/danielmiessler/fabric/main/install.sh | bash
    export PATH="$HOME/.local/bin:$PATH"

    if command_exists fabric; then
        print_step "Downloading patterns..."
        fabric -U
        print_success "Fabric installed with patterns!"
    else
        print_warning "Fabric may need a shell restart. Then run: fabric -U"
    fi
else
    print_info "Skipping Fabric. Install later from: https://github.com/danielmiessler/fabric"
fi

# ============================================
# Step 10.5: Security Toolkit (Optional)
# ============================================

if [ "${HAS_BREW:-false}" = true ]; then
    install_security_tools
else
    print_header "Step 10.5: Security Toolkit"
    print_warning "Homebrew/Linuxbrew not available — skipping security tools."
    print_info "Install brew first, then run: setup.sh --install-security-tools"
fi

# ============================================
# Step 11: Fix Hardcoded Paths & Hostnames
# ============================================

fix_hardcoded_paths "$PAI_DIR"
fix_vite_allowed_hosts "$PAI_DIR"

# ============================================
# Step 12: Verify Installation
# ============================================

print_header "Step 12: Verifying Installation"
check_dependencies

# ============================================
# Complete!
# ============================================

print_header "${PARTY} Installation Complete! ${PARTY}"

echo -e "${GREEN}"
cat << "EOF"
┌─────────────────────────────────────────────────────┐
│                                                     │
│   🎉 PAI is ready to use! 🎉                       │
│                                                     │
└─────────────────────────────────────────────────────┘
EOF
echo -e "${NC}"

echo ""
echo "Quick reference:"
echo "  ${CYAN}source $SHELL_CONFIG${NC}                   # Reload environment"
echo "  ${CYAN}setup.sh --check${NC}                       # Check all dependencies"
echo "  ${CYAN}setup.sh --configure-env${NC}               # Re-run env wizard (add/keep/skip per variable)"
echo "  ${CYAN}setup.sh --clone-projects${NC}              # Clone optional PAI companion projects"
echo "  ${CYAN}setup.sh --build-sidecar${NC}               # Build/rebuild python sidecar venv"
echo "  ${CYAN}setup.sh --build-whisper${NC}               # Build/rebuild whisper.cpp"
echo "  ${CYAN}setup.sh --install-services${NC}            # Install/reinstall systemd services"
echo "  ${CYAN}setup.sh --install-security-tools${NC}      # Install security toolkit (naabu, httpx, nuclei, subfinder, nmap)"
echo "  ${CYAN}setup.sh --fix-paths${NC}                   # Fix hardcoded paths after migration"
echo ""

print_header "Resources"
echo "  📖 Dependencies: $PAI_DIR/.agent/DEPENDENCIES.md"
echo "  📖 README: $PAI_DIR/README.md"
echo "  🌐 GitHub: https://github.com/yourusername/sAIm"
echo ""

echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${ROCKET} Welcome to PAI! ${ROCKET}${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

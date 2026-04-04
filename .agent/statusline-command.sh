#!/bin/bash
#
# PAI Statusline - Customizable status display for Claude Code
#
# CUSTOMIZATION:
#   - This script sources ${PAI_DIR}/.env for API keys and configuration
#   - Set PAI_SIMPLE_COLORS=1 in settings.json env for basic ANSI colors
#     (fixes display issues on some terminals)
#   - To add features requiring API keys (e.g., quotes), add keys to .env
#   - Comment out any printf lines you don't want displayed
#
# LINES DISPLAYED:
#   1. Greeting: DA name, model, directory, capabilities count
#   2. MCPs: Active MCP servers with names
#   3. Tokens: Daily usage and cost (requires ccusage)
#
# ENVIRONMENT VARIABLES (set in settings.json env section):
#   DA            - Your assistant's name (default: "Assistant")
#   DA_COLOR      - Name color: purple|blue|green|cyan|yellow|red|orange
#   PAI_SIMPLE_COLORS - Set to "1" to use basic terminal colors
#

# Source .env for API keys and custom configuration
claude_env="${PAI_DIR:-$HOME/.claude}/.env"
[ -f "$claude_env" ] && source "$claude_env"

# Read JSON input from stdin
input=$(cat)

# Get Digital Assistant configuration from environment
DA_NAME="${DA:-Assistant}"  # Assistant name
DA_COLOR="${DA_COLOR:-purple}"  # Color for the assistant name

# Extract data from JSON input
current_dir=$(echo "$input" | jq -r '.workspace.current_dir')
model_name=$(echo "$input" | jq -r '.model.display_name')
cc_version=$(echo "$input" | jq -r '.version // "unknown"')

# Get directory name
dir_name=$(basename "$current_dir")

# Cache file and lock file for ccusage data
CACHE_FILE="/tmp/.claude_ccusage_cache"
LOCK_FILE="/tmp/.claude_ccusage.lock"
CACHE_AGE=30   # 30 seconds for more real-time updates

# Count items from specified directories
claude_dir="${PAI_DIR:-$HOME/.claude}"
commands_count=0
mcps_count=0
fobs_count=0
fabric_count=0

# Count commands (optimized - direct ls instead of find)
if [ -d "$claude_dir/Commands" ]; then
    commands_count=$(ls -1 "$claude_dir/Commands/"*.md 2>/dev/null | wc -l | tr -d ' ')
fi

# Count MCPs from both settings.json and .mcp.json
mcp_names_raw=""
mcps_count=0

# Check settings.json for .mcpServers (legacy)
if [ -f "$claude_dir/settings.json" ]; then
    mcp_data=$(jq -r '.mcpServers | keys | join(" "), length' "$claude_dir/settings.json" 2>/dev/null)
    if [ -n "$mcp_data" ] && [ "$mcp_data" != "null" ]; then
        mcp_names_raw=$(echo "$mcp_data" | head -1)
        mcps_count=$(echo "$mcp_data" | tail -1)
    fi
fi

# Check .mcp.json (current Claude Code default)
if [ -f "$claude_dir/.mcp.json" ]; then
    mcp_json_data=$(jq -r '.mcpServers | keys | join(" "), length' "$claude_dir/.mcp.json" 2>/dev/null)
    if [ -n "$mcp_json_data" ] && [ "$mcp_json_data" != "null" ]; then
        mcp_json_names=$(echo "$mcp_json_data" | head -1)
        mcp_json_count=$(echo "$mcp_json_data" | tail -1)

        # Combine with settings.json results
        if [ -n "$mcp_names_raw" ]; then
            mcp_names_raw="$mcp_names_raw $mcp_json_names"
        else
            mcp_names_raw="$mcp_json_names"
        fi
        mcps_count=$((mcps_count + mcp_json_count))
    fi
fi

# Count Services (optimized - count .md files directly)
services_dir="${HOME}/Projects/FoundryServices/Services"
if [ -d "$services_dir" ]; then
    fobs_count=$(ls -1 "$services_dir/"*.md 2>/dev/null | wc -l | tr -d ' ')
fi

# Count Fabric patterns (optimized - count subdirectories)
fabric_patterns_dir="${HOME}/.config/fabric/patterns"
if [ -d "$fabric_patterns_dir" ]; then
    # Count immediate subdirectories only
    fabric_count=$(find "$fabric_patterns_dir" -maxdepth 1 -type d -not -path "$fabric_patterns_dir" 2>/dev/null | wc -l | tr -d ' ')
fi

# Get cached ccusage data - SAFE VERSION without background processes
daily_tokens=""
daily_cost=""

# Check if cache exists and load it
if [ -f "$CACHE_FILE" ]; then
    # Always load cache data first (if it exists)
    source "$CACHE_FILE"
fi

# If cache is stale, missing, or we have no data, update it SYNCHRONOUSLY with timeout
cache_needs_update=false
if [ ! -f "$CACHE_FILE" ] || [ -z "$daily_tokens" ]; then
    cache_needs_update=true
elif [ -f "$CACHE_FILE" ]; then
    # Cross-platform: get file modification time
    file_mtime=""
    if command -v gstat >/dev/null 2>&1; then
        file_mtime=$(gstat -c%Y "$CACHE_FILE" 2>/dev/null)
    elif stat -c%Y "$CACHE_FILE" >/dev/null 2>&1; then
        file_mtime=$(stat -c%Y "$CACHE_FILE" 2>/dev/null)
    else
        file_mtime=$(stat -f%m "$CACHE_FILE" 2>/dev/null)
    fi
    cache_age=$(($(date +%s) - ${file_mtime:-0}))
    if [ $cache_age -ge $CACHE_AGE ]; then
        cache_needs_update=true
    fi
fi

if [ "$cache_needs_update" = true ]; then
    # Try to acquire lock (non-blocking)
    if mkdir "$LOCK_FILE" 2>/dev/null; then
        # We got the lock - update cache with timeout
        if command -v bunx >/dev/null 2>&1; then
            # Run ccusage with a timeout (5 seconds for faster updates)
            # Check if gtimeout is available (macOS), otherwise try timeout (Linux)
            if command -v gtimeout >/dev/null 2>&1; then
                ccusage_output=$(gtimeout 5 bunx ccusage 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | grep "│ Total" | head -1)
            elif command -v timeout >/dev/null 2>&1; then
                ccusage_output=$(timeout 5 bunx ccusage 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | grep "│ Total" | head -1)
            else
                # Fallback without timeout (but faster than before)
                ccusage_output=$(bunx ccusage 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | grep "│ Total" | head -1)
            fi

            if [ -n "$ccusage_output" ]; then
                # Extract input/output tokens, removing commas and ellipsis
                daily_input=$(echo "$ccusage_output" | awk -F'│' '{print $4}' | sed 's/[^0-9]//g' | head -c 10)
                daily_output=$(echo "$ccusage_output" | awk -F'│' '{print $5}' | sed 's/[^0-9]//g' | head -c 10)
                # Extract cost, keep the dollar sign
                daily_cost=$(echo "$ccusage_output" | awk -F'│' '{print $9}' | sed 's/^ *//;s/ *$//')

                if [ -n "$daily_input" ] && [ -n "$daily_output" ]; then
                    daily_total=$((daily_input + daily_output))
                    daily_tokens=$(printf "%'d" "$daily_total" 2>/dev/null || echo "$daily_total")

                    # Write to cache file (properly escape dollar sign)
                    echo "daily_tokens=\"$daily_tokens\"" > "$CACHE_FILE"
                    # Use printf to properly escape the dollar sign in the cost
                    printf "daily_cost=\"%s\"\n" "${daily_cost//$/\\$}" >> "$CACHE_FILE"
                    # Add timestamp for debugging
                    echo "cache_updated=\"$(date)\"" >> "$CACHE_FILE"
                fi
            fi
        fi

        # Always remove lock when done
        rmdir "$LOCK_FILE" 2>/dev/null
    else
        # Someone else is updating - check if lock is stale (older than 30 seconds)
        if [ -d "$LOCK_FILE" ]; then
            # Cross-platform: get directory modification time
            lock_mtime=""
            if command -v gstat >/dev/null 2>&1; then
                lock_mtime=$(gstat -c%Y "$LOCK_FILE" 2>/dev/null)
            elif stat -c%Y "$LOCK_FILE" >/dev/null 2>&1; then
                lock_mtime=$(stat -c%Y "$LOCK_FILE" 2>/dev/null)
            else
                lock_mtime=$(stat -f%m "$LOCK_FILE" 2>/dev/null)
            fi
            lock_age=$(($(date +%s) - ${lock_mtime:-0}))
            if [ $lock_age -gt 30 ]; then
                # Stale lock - remove it and try again
                rmdir "$LOCK_FILE" 2>/dev/null
            fi
        fi

        # Just use cached data if available
        if [ -f "$CACHE_FILE" ]; then
            source "$CACHE_FILE"
        fi
    fi
fi

# Tokyo Night Storm Color Scheme
BACKGROUND='\033[48;2;36;40;59m'
BRIGHT_PURPLE='\033[38;2;187;154;247m'
BRIGHT_BLUE='\033[38;2;122;162;247m'
DARK_BLUE='\033[38;2;100;140;200m'
BRIGHT_GREEN='\033[38;2;158;206;106m'
DARK_GREEN='\033[38;2;130;170;90m'
BRIGHT_ORANGE='\033[38;2;255;158;100m'
BRIGHT_RED='\033[38;2;247;118;142m'
BRIGHT_CYAN='\033[38;2;125;207;255m'
BRIGHT_MAGENTA='\033[38;2;187;154;247m'
BRIGHT_YELLOW='\033[38;2;224;175;104m'

# Map DA_COLOR to actual ANSI color code
case "$DA_COLOR" in
    "purple") DA_DISPLAY_COLOR='\033[38;2;147;112;219m' ;;
    "blue") DA_DISPLAY_COLOR="$BRIGHT_BLUE" ;;
    "green") DA_DISPLAY_COLOR="$BRIGHT_GREEN" ;;
    "cyan") DA_DISPLAY_COLOR="$BRIGHT_CYAN" ;;
    "magenta") DA_DISPLAY_COLOR="$BRIGHT_MAGENTA" ;;
    "yellow") DA_DISPLAY_COLOR="$BRIGHT_YELLOW" ;;
    "red") DA_DISPLAY_COLOR="$BRIGHT_RED" ;;
    "orange") DA_DISPLAY_COLOR="$BRIGHT_ORANGE" ;;
    *) DA_DISPLAY_COLOR='\033[38;2;147;112;219m' ;;  # Default to purple
esac

# Line-specific colors
LINE1_PRIMARY="$BRIGHT_PURPLE"
LINE1_ACCENT='\033[38;2;160;130;210m'
MODEL_PURPLE='\033[38;2;138;99;210m'

LINE2_PRIMARY="$DARK_BLUE"
LINE2_ACCENT='\033[38;2;110;150;210m'

LINE3_PRIMARY="$DARK_GREEN"
LINE3_ACCENT='\033[38;2;140;180;100m'
COST_COLOR="$LINE3_ACCENT"
TOKENS_COLOR='\033[38;2;169;177;214m'

SEPARATOR_COLOR='\033[38;2;140;152;180m'
DIR_COLOR='\033[38;2;135;206;250m'

# MCP colors
MCP_DAEMON="$BRIGHT_BLUE"
MCP_STRIPE="$LINE2_ACCENT"
MCP_DEFAULT="$LINE2_PRIMARY"

# Reset includes explicit background clear for terminal compatibility
RESET='\033[0m\033[49m'

# Simple colors mode - set PAI_SIMPLE_COLORS=1 if you have terminal display issues
if [ "${PAI_SIMPLE_COLORS:-0}" = "1" ]; then
    # Use basic ANSI colors instead of 24-bit RGB for terminal compatibility
    BRIGHT_PURPLE='\033[35m'
    BRIGHT_BLUE='\033[34m'
    DARK_BLUE='\033[34m'
    BRIGHT_GREEN='\033[32m'
    DARK_GREEN='\033[32m'
    BRIGHT_ORANGE='\033[33m'
    BRIGHT_RED='\033[31m'
    BRIGHT_CYAN='\033[36m'
    BRIGHT_MAGENTA='\033[35m'
    BRIGHT_YELLOW='\033[33m'
    # Override derived colors
    DA_DISPLAY_COLOR='\033[35m'
    LINE1_PRIMARY='\033[35m'
    LINE1_ACCENT='\033[35m'
    MODEL_PURPLE='\033[35m'
    LINE2_PRIMARY='\033[34m'
    LINE2_ACCENT='\033[34m'
    LINE3_PRIMARY='\033[32m'
    LINE3_ACCENT='\033[32m'
    COST_COLOR='\033[32m'
    TOKENS_COLOR='\033[37m'
    SEPARATOR_COLOR='\033[37m'
    DIR_COLOR='\033[36m'
    MCP_DAEMON='\033[34m'
    MCP_STRIPE='\033[34m'
    MCP_DEFAULT='\033[34m'
fi

# Format MCP names efficiently
mcp_names_formatted=""
for mcp in $mcp_names_raw; do
    case "$mcp" in
        "daemon") formatted="${MCP_DAEMON}Daemon${RESET}" ;;
        "stripe") formatted="${MCP_STRIPE}Stripe${RESET}" ;;
        "httpx") formatted="${MCP_DEFAULT}HTTPx${RESET}" ;;
        "brightdata") formatted="${MCP_DEFAULT}bright-data${RESET}" ;;
        "naabu") formatted="${MCP_DEFAULT}Naabu${RESET}" ;;
        "apify") formatted="${MCP_DEFAULT}Apify${RESET}" ;;
        "content") formatted="${MCP_DEFAULT}Content${RESET}" ;;
        "Ref") formatted="${MCP_DEFAULT}Ref${RESET}" ;;
        "pai") formatted="${MCP_DEFAULT}Foundry${RESET}" ;;
        "playwright") formatted="${MCP_DEFAULT}Playwright${RESET}" ;;
        *) formatted="${MCP_DEFAULT}${mcp^}${RESET}" ;;
    esac

    if [ -z "$mcp_names_formatted" ]; then
        mcp_names_formatted="$formatted"
    else
        mcp_names_formatted="$mcp_names_formatted${SEPARATOR_COLOR}, ${formatted}"
    fi
done

# Helper function to count Mondays between two dates (optimized)
count_mondays() {
    local start_date="$1"
    local end_date="$2"

    # Convert dates to seconds since epoch (cross-platform)
    local start_seconds
    local end_seconds
    if command -v gdate >/dev/null 2>&1; then
        # macOS with GNU coreutils
        start_seconds=$(gdate -d "$start_date" +%s 2>/dev/null)
        end_seconds=$(gdate -d "$end_date" +%s 2>/dev/null)
    elif date -d "2020-01-01" +%s >/dev/null 2>&1; then
        # Linux with GNU date
        start_seconds=$(date -d "$start_date" +%s 2>/dev/null)
        end_seconds=$(date -d "$end_date" +%s 2>/dev/null)
    else
        # macOS native date (try -j first, then fallback)
        start_seconds=$(date -jf "%Y-%m-%d" "$start_date" +%s 2>/dev/null)
        end_seconds=$(date -jf "%Y-%m-%d" "$end_date" +%s 2>/dev/null)
    fi

    if [ -z "$start_seconds" ] || [ -z "$end_seconds" ]; then
        echo "0"
        return
    fi

    # Get day of week for start date (1 = Monday, cross-platform)
    local start_dow
    if command -v gdate >/dev/null 2>&1; then
        start_dow=$(gdate -d "@$start_seconds" +%u 2>/dev/null)
    elif date -d "@1234567890" +%u >/dev/null 2>&1; then
        start_dow=$(date -d "@$start_seconds" +%u 2>/dev/null)
    else
        start_dow=$(date -j -f "%s" "$start_seconds" +%u 2>/dev/null)
    fi

    # Calculate total days in range
    local total_days=$(( (end_seconds - start_seconds) / 86400 + 1 ))

    # Calculate Mondays: each week has 1 Monday
    local complete_weeks=$((total_days / 7))
    local remaining_days=$((total_days % 7))
    local monday_count=$complete_weeks

    # Check remaining days for additional Monday
    local current_dow=$start_dow
    for ((i=0; i<remaining_days; i++)); do
        if [ "$current_dow" = "1" ]; then
            ((monday_count++))
            break
        fi
        current_dow=$((current_dow % 7 + 1))
    done

    echo "$monday_count"
}

# Helper function to create a progress bar
make_progress_bar() {
    local current=$1
    local total=$2
    local width=${3:-20}

    if [ "$total" -eq 0 ]; then
        echo "[empty]"
        return
    fi

    local percentage=$((current * 100 / total))
    local filled=$((width * current / total))
    local empty=$((width - filled))

    local bar=""
    for ((i=0; i<filled; i++)); do bar+="█"; done
    for ((i=0; i<empty; i++)); do bar+="░"; done

    echo "[${bar}] ${percentage}% (${current}/${total})"
}

# Calculate context usage percentage from Claude Code's context_window data
context_percentage=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
if [ -z "$context_percentage" ] || [ "$context_percentage" = "null" ]; then context_percentage=0; fi

# Extract current context tokens for display
current_input_tokens=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // 0')
current_cache_creation=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0')
current_cache_read=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0')
context_tokens=$((current_input_tokens + current_cache_creation + current_cache_read))
context_window_size=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')

context_bar=$(make_progress_bar "$context_percentage" "100" 15)

# Get current date
today=$(date +%Y-%m-%d)
today_year=$(date +%Y)

# Calculate Mondays for each period
mondays_1987_2031=$(count_mondays "1987-01-01" "2031-12-31")
mondays_1987_today=$(count_mondays "1987-01-01" "$today")

mondays_1968_2060=$(count_mondays "1968-01-01" "2060-12-31")
mondays_1968_today=$(count_mondays "1968-01-01" "$today")

mondays_2026_2060=$(count_mondays "2026-01-01" "2060-12-31")
mondays_2026_today=$(count_mondays "2026-01-01" "$today")

bar1=$(make_progress_bar "$mondays_1987_today" "$mondays_1987_2031" 12)
bar2=$(make_progress_bar "$mondays_1968_today" "$mondays_1968_2060" 12)

# For 2026-2060: use minimum 10% threshold for visual bar, but show actual counts
mondays_2026_pct=$((mondays_2026_today * 100 / mondays_2026_2060))
mondays_2026_visual_pct=$mondays_2026_pct
if [ "$mondays_2026_visual_pct" -lt 10 ]; then mondays_2026_visual_pct=10; fi
# Build bar with 10% minimum threshold
bar_width=12
filled=$((bar_width * mondays_2026_visual_pct / 100))
empty=$((bar_width - filled))
bar3_visual=""
for ((i=0; i<filled; i++)); do bar3_visual+="█"; done
for ((i=0; i<empty; i++)); do bar3_visual+="░"; done
bar3="[${bar3_visual}] ${mondays_2026_pct}% (${mondays_2026_today}/${mondays_2026_2060})"

# Progress meter color (using awesome blue from MCP line)
METER_COLOR="$DARK_BLUE"
METER_ACCENT="$LINE2_ACCENT"

# Output the full 3-line statusline
# LINE 1 - Greeting with CC version
printf "👋 ${DA_DISPLAY_COLOR}\"${DA_NAME} here, ready to go...\"${RESET} ${MODEL_PURPLE}Running CC ${cc_version}${RESET}${LINE1_PRIMARY} with ${MODEL_PURPLE}🧠 ${model_name}${RESET}${LINE1_PRIMARY} in ${DIR_COLOR}📁 ${dir_name}${RESET}\n"

# LINE 2 - BLUE theme with MCP names and Fabric patterns
if [ "$fabric_count" -gt 0 ]; then
    printf "${LINE2_PRIMARY}🔌 MCPs${RESET}${LINE2_PRIMARY}${SEPARATOR_COLOR}: ${RESET}${mcp_names_formatted}${LINE2_PRIMARY}  📚 Fabric Patterns${RESET}${LINE2_PRIMARY}${SEPARATOR_COLOR}: ${RESET}${LINE2_ACCENT}${fabric_count}${RESET}\n"
else
    printf "${LINE2_PRIMARY}🔌 MCPs${RESET}${LINE2_PRIMARY}${SEPARATOR_COLOR}: ${RESET}${mcp_names_formatted}${RESET}\n"
fi

# LINE 3 - GREEN theme with tokens and cost (show cached or N/A)
# If we have cached data but it's empty, still show N/A
tokens_display="${daily_tokens:-N/A}"
cost_display="${daily_cost:-N/A}"
if [ -z "$daily_tokens" ]; then tokens_display="N/A"; fi
if [ -z "$daily_cost" ]; then cost_display="N/A"; fi

printf "${LINE3_PRIMARY}💎 Total Tokens${RESET}${LINE3_PRIMARY}${SEPARATOR_COLOR}: ${RESET}${LINE3_ACCENT}${tokens_display}${RESET}${LINE3_PRIMARY}  Total Cost${RESET}${LINE3_PRIMARY}${SEPARATOR_COLOR}: ${RESET}${COST_COLOR}${cost_display}${RESET}\n"

# LINE 4 - Context usage meter (using actual context window percentage)
echo -e "${METER_COLOR}📊 Context Usage${RESET}${METER_COLOR}${SEPARATOR_COLOR}: ${RESET}${METER_ACCENT}${context_bar}${RESET}"

# LINE 5 - Mondays 1987-2031
echo -e "${METER_COLOR}📅 Mondays (1987-2031)${RESET}${METER_COLOR}${SEPARATOR_COLOR}: ${RESET}${METER_ACCENT}${bar1}${RESET}"

# LINE 6 - Mondays 1968-2060
echo -e "${METER_COLOR}📅 Mondays (1968-2060)${RESET}${METER_COLOR}${SEPARATOR_COLOR}: ${RESET}${METER_ACCENT}${bar2}${RESET}"

# LINE 7 - Mondays remaining 2026-2060
echo -e "${METER_COLOR}📅 Mondays Remaining (2026-2060)${RESET}${METER_COLOR}${SEPARATOR_COLOR}: ${RESET}${METER_ACCENT}${bar3}${RESET}"
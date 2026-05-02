#!/usr/bin/env bash
# .agent/utils/bootstrap.sh
# Defensive PAI_DIR bootstrap for all scripts and hooks
# Sources the central .env file with safety checks

# Only source if PAI_DIR is not already set
if [[ -z "${PAI_DIR:-}" ]]; then
    # Tier 1: Check HOME/.claude/.env
    if [[ -f "${HOME}/.claude/.env" ]]; then
        set -a
        # shellcheck source=/dev/null
        source "${HOME}/.claude/.env"
        set +a
    else
        # Tier 2: Fallback - set PAI_DIR manually based on HOME
        PAI_DIR="${HOME}/.claude"
        export PAI_DIR
    fi
fi

# Final verification
if [[ -z "${PAI_DIR:-}" ]]; then
    echo "FATAL: PAI_DIR not set and bootstrap failed" >&2
    echo "  HOME=${HOME}" >&2
    echo "  Expected path: ${HOME}/.claude/.env" >&2
    return 1 2>/dev/null || exit 1
fi

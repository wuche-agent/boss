#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

# All Hermes profiles
HERMES_PROFILES="default athrun"

# Preferred profile for the AI assistant
PREFERRED_PROFILE="default"

log() { echo "[start.sh] $*"; }
err() { echo "[start.sh] ERROR: $*" >&2; }

hermes_port() {
  case "$1" in
    default)  echo 8641 ;;
    athrun)   echo 8642 ;;
    *) err "Unknown Hermes profile: $1"; exit 1 ;;
  esac
}

# ─── 1. Redis ────────────────────────────────────────────────────────────────

install_redis_from_source() {
  log "Attempting to build Redis from source (redis.io)..."
  local tmpdir
  tmpdir="$(mktemp -d)"
  if curl -sf https://download.redis.io/redis-stable.tar.gz | tar xz --strip-components=1 -C "$tmpdir"; then
    make -C "$tmpdir" -j4 2>&1 | tail -3
    cp "$tmpdir/src/redis-server" /opt/homebrew/bin/redis-server 2>/dev/null \
      || cp "$tmpdir/src/redis-server" /usr/local/bin/redis-server 2>/dev/null \
      || { err "Cannot install redis-server: no writable bin dir. Put $tmpdir/src/redis-server in PATH manually."; exit 1; }
    cp "$tmpdir/src/redis-cli" /opt/homebrew/bin/redis-cli 2>/dev/null \
      || cp "$tmpdir/src/redis-cli" /usr/local/bin/redis-cli 2>/dev/null || true
    log "Redis built and installed from source."
  else
    err "Cannot reach download.redis.io. Install Redis manually: brew install redis"
    exit 1
  fi
}

start_redis() {
  if redis-cli ping &>/dev/null; then
    log "Redis already running."
    return
  fi

  log "Redis not running. Attempting to start..."

  if ! command -v redis-server &>/dev/null; then
    # Try brew first (handles upgrades and services), fall back to source build
    if command -v brew &>/dev/null; then
      if ! HOMEBREW_NO_AUTO_UPDATE=1 brew list redis &>/dev/null 2>&1; then
        log "Redis not installed. Installing via Homebrew (this may take a minute)..."
        HOMEBREW_NO_AUTO_UPDATE=1 brew install redis 2>&1 | tail -3 \
          || install_redis_from_source
      fi
    else
      install_redis_from_source
    fi
  fi

  # Start via brew services if available, otherwise daemonize directly
  if command -v brew &>/dev/null && HOMEBREW_NO_AUTO_UPDATE=1 brew list redis &>/dev/null 2>&1; then
    HOMEBREW_NO_AUTO_UPDATE=1 brew services start redis 2>&1 | tail -2
  else
    redis-server --daemonize yes --logfile /tmp/redis.log
  fi

  # Wait up to 5 s for Redis to come up
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if redis-cli ping &>/dev/null; then
      log "Redis started."
      return
    fi
    sleep 0.5
  done
  err "Redis did not respond after starting."
  exit 1
}

# ─── 2. Hermes ───────────────────────────────────────────────────────────────

find_hermes_python() {
  for dir in \
    "${HERMES_AGENT_DIR:-}" \
    "$HOME/Documents/claw/hermes-agent" \
    "$HOME/hermes-agent" \
    "/opt/hermes-agent" \
  ; do
    [ -z "$dir" ] && continue
    py="$dir/.venv/bin/python"
    if [ -x "$py" ]; then
      echo "$py"
      return
    fi
  done
  echo ""
}

start_hermes_profile() {
  local profile="$1"
  local port
  port="$(hermes_port "$profile")"

  if curl -sf --connect-timeout 1 "http://localhost:$port/v1/models" &>/dev/null; then
    log "Hermes [$profile] already running on port $port."
    return
  fi

  log "Starting Hermes [$profile] on port $port..."

  local py
  py="$(find_hermes_python)"

  if [ -z "$py" ]; then
    err "Cannot find hermes-agent Python. Set HERMES_AGENT_DIR env var to the hermes-agent root."
    err "Example: HERMES_AGENT_DIR=/path/to/hermes-agent $0"
    exit 1
  fi

  local logfile="/tmp/hermes-${profile}.log"
  nohup "$py" -m hermes_cli.main --profile "$profile" gateway run --replace \
    > "$logfile" 2>&1 &
  local pid=$!
  log "  PID $pid, log: $logfile"

  # Wait up to 15 s for the port to open
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
    if curl -sf --connect-timeout 0.5 "http://localhost:$port/v1/models" &>/dev/null; then
      log "  Hermes [$profile] ready."
      return
    fi
    sleep 0.5
  done
  err "Hermes [$profile] did not become ready within 15 s. Check: $logfile"
  exit 1
}

start_all_hermes_profiles() {
  for profile in $HERMES_PROFILES; do
    start_hermes_profile "$profile"
  done
}

# ─── 3. Update .env if Hermes vars are missing/default ───────────────────────

ensure_hermes_env() {
  [ -f "$ENV_FILE" ] || touch "$ENV_FILE"

  local current_url current_model preferred_port
  preferred_port="$(hermes_port "$PREFERRED_PROFILE")"
  current_url=$(grep -E '^HERMES_BASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
  current_model=$(grep -E '^HERMES_MODEL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)

  if [ -z "$current_url" ] || [ "$current_url" = "http://localhost:11434/v1" ]; then
    local url="http://localhost:${preferred_port}/v1"
    if grep -qE '^HERMES_BASE_URL=' "$ENV_FILE"; then
      sed -i '' "s|^HERMES_BASE_URL=.*|HERMES_BASE_URL=$url|" "$ENV_FILE"
    else
      echo "HERMES_BASE_URL=$url" >> "$ENV_FILE"
    fi
    log "Set HERMES_BASE_URL=$url"
  else
    log "HERMES_BASE_URL: $current_url"
  fi

  if [ -z "$current_model" ] || [ "$current_model" = "hermes3" ]; then
    if grep -qE '^HERMES_MODEL=' "$ENV_FILE"; then
      sed -i '' "s|^HERMES_MODEL=.*|HERMES_MODEL=${PREFERRED_PROFILE}|" "$ENV_FILE"
    else
      echo "HERMES_MODEL=${PREFERRED_PROFILE}" >> "$ENV_FILE"
    fi
    log "Set HERMES_MODEL=${PREFERRED_PROFILE}"
  else
    log "HERMES_MODEL: $current_model"
  fi
}

# ─── 4. Main ─────────────────────────────────────────────────────────────────

main() {
  log "=== DingTalk AI Assistant Startup ==="

  start_redis
  start_all_hermes_profiles
  ensure_hermes_env

  log "=== All dependencies ready. Starting assistant... ==="
  cd "$PROJECT_DIR"
  exec npm start
}

main "$@"

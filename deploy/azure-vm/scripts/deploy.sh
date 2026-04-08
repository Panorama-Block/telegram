#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/telegram-gateway}"
RELEASE_DIR="${APP_DIR}/current"
COMPOSE_FILE="${RELEASE_DIR}/docker-compose.yml"
ENV_FILE="${RELEASE_DIR}/.env.production"
CADDY_SOURCE="${RELEASE_DIR}/Caddyfile"
CADDY_RENDERED=""

require_file() {
  local path="$1"
  if [[ ! -f "${path}" ]]; then
    echo "required file not found: ${path}" >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "required environment variable is missing: ${name}" >&2
    exit 1
  fi
}

read_env_file_value() {
  local file_path="$1"
  local var_name="$2"

  python3 - "$file_path" "$var_name" <<'PY'
import sys

file_path, var_name = sys.argv[1], sys.argv[2]

with open(file_path, "r", encoding="utf-8") as f:
    for raw_line in f:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        if key.startswith("export "):
            key = key[len("export "):].strip()

        if key != var_name:
            continue

        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]

        print(value, end="")
        break
PY
}

cleanup() {
  if [[ -n "${CADDY_RENDERED}" && -f "${CADDY_RENDERED}" ]]; then
    rm -f "${CADDY_RENDERED}"
  fi
}

render_caddyfile() {
  local template_path="$1"
  local output_path="$2"

  python3 - "$template_path" "$output_path" <<'PY'
import os
import re
import sys

template_path, output_path = sys.argv[1], sys.argv[2]
pattern = re.compile(r"\{\$([A-Z0-9_]+)\}")

with open(template_path, "r", encoding="utf-8") as f:
    content = f.read()

def replace(match):
    name = match.group(1)
    value = os.environ.get(name)
    if value is None:
        raise SystemExit(f"missing template variable: {name}")
    return value

rendered = pattern.sub(replace, content)

with open(output_path, "w", encoding="utf-8") as f:
    f.write(rendered)
PY
}

trap cleanup EXIT

require_file "${COMPOSE_FILE}"
require_file "${ENV_FILE}"
require_file "${CADDY_SOURCE}"

APP_DOMAIN="$(read_env_file_value "${ENV_FILE}" "APP_DOMAIN")"
LETSENCRYPT_EMAIL="$(read_env_file_value "${ENV_FILE}" "LETSENCRYPT_EMAIL")"
GHCR_USERNAME="${GHCR_USERNAME:-$(read_env_file_value "${ENV_FILE}" "GHCR_USERNAME")}"
GHCR_PASSWORD="${GHCR_PASSWORD:-$(read_env_file_value "${ENV_FILE}" "GHCR_PASSWORD")}"
GHCR_REGISTRY="${GHCR_REGISTRY:-$(read_env_file_value "${ENV_FILE}" "GHCR_REGISTRY")}"

export APP_DOMAIN LETSENCRYPT_EMAIL GHCR_USERNAME GHCR_PASSWORD GHCR_REGISTRY

require_env "APP_DOMAIN"
require_env "LETSENCRYPT_EMAIL"

if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_PASSWORD:-}" ]]; then
  echo "${GHCR_PASSWORD}" | docker login "${GHCR_REGISTRY:-ghcr.io}" -u "${GHCR_USERNAME}" --password-stdin
fi

CADDY_RENDERED="$(mktemp "${RELEASE_DIR}/Caddyfile.rendered.XXXXXX")"
render_caddyfile "${CADDY_SOURCE}" "${CADDY_RENDERED}"
sudo -n install -m 0644 "${CADDY_RENDERED}" /etc/caddy/Caddyfile
sudo -n caddy validate --config /etc/caddy/Caddyfile
sudo -n systemctl enable caddy
if sudo -n systemctl is-active --quiet caddy; then
  sudo -n systemctl reload caddy
else
  sudo -n systemctl start caddy
fi

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans
docker image prune -af --filter "until=168h" || true

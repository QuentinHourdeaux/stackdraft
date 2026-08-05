#!/usr/bin/env bash
set -uo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$repo_root"

current_uid="${EUID:-$(id -u)}"
current_gid="$(id -g)"

repository_safe=1
docker_ready=0
development_ready=0

git_hooks_status="BLOCKED"
git_hooks_detail="Git hooks were not configured."
dev_dir_status="BLOCKED"
dev_dir_detail="Development data directory was not checked."
prod_dir_status="BLOCKED"
prod_dir_detail="Production data directory was not checked."
docker_status="BLOCKED"
docker_detail="Docker workflow was not checked."
deno_status="BLOCKED"
deno_detail="Development workflow was not checked."
dev_database_status="BLOCKED"
dev_database_detail="Development database was not migrated."
prod_database_status="BLOCKED"
prod_database_detail="Production database was not migrated."

print_row() {
  local status="$1"
  local label="$2"
  local detail="$3"

  printf '  %-12s %-24s %s\n' "$status" "$label" "$detail"
}

print_report() {
  local repository_status="OK"
  local repository_detail="Repository preparation completed safely."

  if [[ "$repository_safe" -ne 1 ]]; then
    repository_status="BLOCKED"
    repository_detail="Resolve the repository errors above and rerun setup."
  fi

  printf '\nStackdraft setup report\n'
  print_row "$repository_status" "Repository" "$repository_detail"
  print_row "$git_hooks_status" "Git hooks" "$git_hooks_detail"
  print_row "$dev_dir_status" "data/dev" "$dev_dir_detail"
  print_row "$prod_dir_status" "data/prod" "$prod_dir_detail"
  print_row "$deno_status" "Development workflow" "$deno_detail"
  print_row "$dev_database_status" "Development database" "$dev_database_detail"
  print_row "$docker_status" "Docker workflow" "$docker_detail"
  print_row "$prod_database_status" "Production database" "$prod_database_detail"

  printf '\nNext commands\n'
  if [[ "$docker_ready" -eq 1 ]]; then
    printf '  Docker:      docker compose up --build\n'
  else
    printf '  Docker:      unavailable; resolve the BLOCKED checks above\n'
  fi

  if [[ "$development_ready" -eq 1 ]]; then
    printf '  Development: deno task dev\n'
  else
    printf '  Development: unavailable; resolve the BLOCKED checks above\n'
  fi
}

run_quiet() {
  local label="$1"
  shift

  local log_file
  log_file="$(mktemp "${TMPDIR:-/tmp}/stackdraft-setup.XXXXXX")" || {
    printf '%s failed: could not create a temporary log file.\n' "$label" >&2
    return 1
  }

  if "$@" >"$log_file" 2>&1; then
    rm "$log_file"
    return 0
  fi

  printf '\n%s failed. Last 40 lines of output:\n' "$label" >&2
  tail -n 40 "$log_file" >&2
  rm "$log_file"
  return 1
}

owner_uid() {
  local path="$1"

  if [[ "$(uname -s)" == "Darwin" ]]; then
    stat -f '%u' "$path"
  else
    stat -c '%u' "$path"
  fi
}

prepare_data_directory() {
  local path="$1"
  local created=0

  prepared_status="BLOCKED"
  prepared_detail="Directory preparation failed."
  prepared_ready=0

  if [[ -e "$path" && ! -d "$path" ]]; then
    prepared_detail="$path exists but is not a directory."
    return
  fi

  if [[ ! -d "$path" ]]; then
    if ! mkdir -p "$path"; then
      prepared_detail="Could not create $path."
      return
    fi
    created=1
  fi

  local path_owner
  if ! path_owner="$(owner_uid "$path")"; then
    prepared_detail="Could not determine the owner of $path."
    return
  fi

  if [[ "$path_owner" != "$current_uid" ]]; then
    prepared_detail="$path is owned by UID $path_owner; run: sudo chown -R $current_uid:$current_gid '$path'"
    return
  fi

  if [[ ! -w "$path" ]]; then
    prepared_detail="$path is not writable; restore user write permission and rerun setup."
    return
  fi

  prepared_ready=1
  if [[ "$created" -eq 1 ]]; then
    prepared_status="CHANGED"
    prepared_detail="Created $path with user-owned permissions."
  else
    prepared_status="OK"
    prepared_detail="$path is user-owned and writable."
  fi
}

verify_database_file() {
  local path="$1"

  verified_database_detail=""

  if [[ ! -f "$path" ]]; then
    verified_database_detail="$path was not created."
    return 1
  fi

  local database_owner
  if ! database_owner="$(owner_uid "$path")"; then
    verified_database_detail="Could not determine the owner of $path."
    return 1
  fi

  if [[ "$database_owner" != "$current_uid" ]]; then
    verified_database_detail="$path is owned by UID $database_owner instead of $current_uid."
    return 1
  fi

  if [[ ! -w "$path" ]]; then
    verified_database_detail="$path is not writable by the current user."
    return 1
  fi

  verified_database_detail="$path exists with user-owned writable permissions."
  return 0
}

printf 'Stackdraft post-clone setup\n'

if [[ "$current_uid" -eq 0 ]]; then
  repository_safe=0
  git_hooks_detail="Setup stopped before making changes."
  dev_dir_detail="Setup stopped before making changes."
  prod_dir_detail="Setup stopped before making changes."
  printf 'Setup must not run as root or through sudo. Rerun it as your normal user.\n' >&2
  print_report
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  repository_safe=0
  printf 'Git is required to verify this checkout and configure its hooks.\n' >&2
  print_report
  exit 1
fi

git_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$git_root" || "$(cd -- "$git_root" 2>/dev/null && pwd -P)" != "$repo_root" ]]; then
  repository_safe=0
  printf 'Setup must run from the Stackdraft Git worktree containing this script.\n' >&2
  print_report
  exit 1
fi

dev_database_existed=0
prod_database_existed=0
[[ -e data/dev/stackdraft.sqlite ]] && dev_database_existed=1
[[ -e data/prod/stackdraft.sqlite ]] && prod_database_existed=1

prepare_data_directory "data/dev"
dev_dir_status="$prepared_status"
dev_dir_detail="$prepared_detail"
dev_dir_ready="$prepared_ready"
if [[ "$dev_dir_ready" -ne 1 ]]; then
  repository_safe=0
fi

prepare_data_directory "data/prod"
prod_dir_status="$prepared_status"
prod_dir_detail="$prepared_detail"
prod_dir_ready="$prepared_ready"
if [[ "$prod_dir_ready" -ne 1 ]]; then
  repository_safe=0
fi

configured_hooks="$(git config --local --get core.hooksPath 2>/dev/null || true)"
if [[ "$configured_hooks" == ".githooks" ]]; then
  git_hooks_status="OK"
  git_hooks_detail="core.hooksPath already points to .githooks."
elif run_quiet "Git hook setup" bash scripts/setup-git-hooks.sh; then
  git_hooks_status="CHANGED"
  git_hooks_detail="Enabled the tracked hooks in .githooks."
else
  repository_safe=0
  git_hooks_detail="Could not configure core.hooksPath."
fi

if command -v deno >/dev/null 2>&1; then
  deno_version="$(deno --version 2>/dev/null | awk 'NR == 1 { print $2 }')"
  if [[ "$deno_version" != "2.9.1" ]]; then
    deno_detail="Found Deno ${deno_version:-unknown}; install Deno 2.9.1: https://docs.deno.com/runtime/getting_started/installation/"
  elif [[ "$dev_dir_ready" -ne 1 ]]; then
    deno_detail="Deno 2.9.1 is available, but data/dev is blocked."
  elif ! run_quiet "Locked dependency installation" deno install --frozen; then
    deno_detail="Deno 2.9.1 is available, but locked dependency installation failed."
  elif ! run_quiet "Development database migration" deno task db:migrate:dev; then
    deno_detail="Deno 2.9.1 and locked dependencies are ready, but the development database migration failed."
    dev_database_detail="Migration failed; stop any development process using the database and rerun setup."
  elif verify_database_file "data/dev/stackdraft.sqlite"; then
    deno_status="OK"
    deno_detail="Deno 2.9.1 and locked dependencies are ready."
    if [[ "$dev_database_existed" -eq 1 ]]; then
      dev_database_status="CURRENT"
    else
      dev_database_status="INITIALIZED"
    fi
    dev_database_detail="$verified_database_detail"
    development_ready=1
  else
    deno_detail="Deno 2.9.1 and locked dependencies are ready, but the development database is not usable."
    dev_database_detail="$verified_database_detail"
  fi
else
  deno_detail="Deno is not installed; install 2.9.1 for development: https://docs.deno.com/runtime/getting_started/installation/"
fi

if command -v docker >/dev/null 2>&1; then
  if ! run_quiet "Docker Compose check" docker compose version; then
    docker_detail="Docker is installed, but the Compose plugin is unavailable."
  elif ! run_quiet "Docker daemon check" docker info; then
    docker_detail="Docker is installed, but its daemon is unreachable without elevated privileges."
  elif ! run_quiet "Compose configuration validation" docker compose config --quiet; then
    docker_detail="Docker is available, but compose.yaml is invalid."
  elif [[ "$prod_dir_ready" -ne 1 ]]; then
    docker_detail="Docker is available, but data/prod is blocked."
  else
    active_services=""
    if ! active_services="$(docker compose ps \
      --status running \
      --status paused \
      --status restarting \
      --services 2>/dev/null)"; then
      docker_detail="Docker and Compose are available, but active-service state could not be determined."
    elif grep -Fxq "stackdraft" <<< "$active_services"; then
      docker_detail="Docker and Compose are available, but Stackdraft is currently active."
      prod_database_detail="Stackdraft is running, paused, or restarting; stop it and rerun setup before migrating from a second container."
    elif ! run_quiet "Production image build" docker compose build stackdraft; then
      docker_detail="Docker and Compose are available, but the production image build failed."
    elif ! run_quiet \
      "Production database migration" \
      docker compose run --rm --no-deps stackdraft \
      deno run \
      --allow-env \
      --allow-read=/app,/data \
      --allow-write=/data \
      api/commands/db.ts migrate; then
      docker_detail="Docker, Compose, and the production image are ready, but the production database migration failed."
      prod_database_detail="Migration failed; inspect the bounded output above and rerun setup."
    elif verify_database_file "data/prod/stackdraft.sqlite"; then
      docker_status="OK"
      docker_detail="Docker, Compose, and the production image are ready."
      if [[ "$prod_database_existed" -eq 1 ]]; then
        prod_database_status="CURRENT"
      else
        prod_database_status="INITIALIZED"
      fi
      prod_database_detail="$verified_database_detail"
      docker_ready=1
    else
      docker_detail="Docker, Compose, and the production image are ready, but the production database is not usable."
      prod_database_detail="$verified_database_detail"
    fi
  fi
else
  docker_detail="Docker is not installed; install it for production use: https://docs.docker.com/get-started/get-docker/"
fi

print_report

if [[ "$repository_safe" -eq 1 ]] && { [[ "$docker_ready" -eq 1 ]] || [[ "$development_ready" -eq 1 ]]; }; then
  exit 0
fi

exit 1

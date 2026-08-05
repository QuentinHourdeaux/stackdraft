#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$repo_root"

run_id="${GITHUB_RUN_ID:-$$}"
run_attempt="${GITHUB_RUN_ATTEMPT:-0}"
image_tag="stackdraft-ci-verify:${run_id}-${run_attempt}"
container_name="stackdraft-ci-verify-${run_id}-${run_attempt}"
data_directory="$(mktemp -d "${TMPDIR:-/tmp}/stackdraft-docker-verify.XXXXXX")"

cleanup() {
  local exit_code="$?"

  if [[ "$exit_code" -ne 0 ]] && docker container inspect "$container_name" >/dev/null 2>&1; then
    printf '\nContainer logs (last 200 lines):\n' >&2
    docker logs --tail 200 "$container_name" >&2 || true
  fi

  if docker container inspect "$container_name" >/dev/null 2>&1; then
    docker stop --time 10 "$container_name" >/dev/null 2>&1 || true
    docker rm "$container_name" >/dev/null 2>&1 || true
  fi

  docker image rm "$image_tag" >/dev/null 2>&1 || true

  case "$data_directory" in
    "${TMPDIR:-/tmp}"/stackdraft-docker-verify.*)
      rm -rf "$data_directory"
      ;;
    *)
      printf 'Refusing to remove unexpected temporary directory: %s\n' "$data_directory" >&2
      ;;
  esac
}

trap cleanup EXIT

docker build --tag "$image_tag" .
docker run \
  --detach \
  --name "$container_name" \
  --mount "type=bind,src=$data_directory,dst=/data" \
  "$image_tag" >/dev/null

health_status="starting"
for ((_attempt = 1; _attempt <= 30; _attempt += 1)); do
  container_status="$(docker inspect --format '{{.State.Status}}' "$container_name")"
  health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container_name")"

  if [[ "$health_status" == "healthy" ]]; then
    break
  fi

  if [[ "$container_status" != "running" || "$health_status" == "unhealthy" ]]; then
    break
  fi

  sleep 2
done

if [[ "$health_status" != "healthy" ]]; then
  printf 'Container did not become healthy; final health status: %s\n' "$health_status" >&2
  exit 1
fi

database_path="$data_directory/stackdraft.sqlite"
if [[ ! -f "$database_path" ]]; then
  printf 'Container became healthy but did not create %s.\n' "$database_path" >&2
  exit 1
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  database_uid="$(stat -f '%u' "$database_path")"
  directory_uid="$(stat -f '%u' "$data_directory")"
else
  database_uid="$(stat -c '%u' "$database_path")"
  directory_uid="$(stat -c '%u' "$data_directory")"
fi

if [[ "$database_uid" != "$directory_uid" || "$database_uid" != "$(id -u)" ]]; then
  printf 'Database UID %s does not match the runner/data-directory UID %s.\n' "$database_uid" "$directory_uid" >&2
  exit 1
fi

if [[ ! -w "$database_path" ]]; then
  printf 'Database exists with the expected UID but is not writable by the runner.\n' >&2
  exit 1
fi

container_logs="$(docker logs "$container_name" 2>&1)"
if grep -q 'app_startup_failed' <<< "$container_logs"; then
  printf 'Container logs contain an application startup failure.\n' >&2
  exit 1
fi

printf 'Docker runtime verification passed: healthy container and user-owned SQLite database.\n'

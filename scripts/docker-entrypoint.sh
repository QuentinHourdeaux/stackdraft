#!/bin/sh
set -eu

if [ "$(id -u)" -eq 0 ]; then
  data_owner=$(stat -c '%u:%g' /data)
  data_uid=${data_owner%:*}
  data_gid=${data_owner#*:}

  # Docker Desktop presents bind mounts as root-owned while still allowing the
  # image's deno user to write. Native Linux preserves the host directory's
  # owner, so run with that identity to keep the bind mount writable without
  # changing ownership of the user's data directory.
  if [ "$data_uid" -eq 0 ]; then
    data_uid=$(id -u deno)
    data_gid=$(id -g deno)
  fi

  exec setpriv \
    --reuid="$data_uid" \
    --regid="$data_gid" \
    --clear-groups \
    "$@"
fi

exec "$@"

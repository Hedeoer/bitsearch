#!/bin/sh
set -eu

APP_USER="bitsearch"
DATA_DIR="${BITSEARCH_DATA_DIR:-/app/data}"

if [ "$(id -u)" -eq 0 ]; then
  mkdir -p "$DATA_DIR"
  chown -R "$APP_USER:$APP_USER" "$DATA_DIR"
  exec su-exec "$APP_USER" "$0" "$@"
fi

if [ ! -w "$DATA_DIR" ]; then
  echo "Data directory is not writable: $DATA_DIR" >&2
  exit 1
fi

exec "$@"

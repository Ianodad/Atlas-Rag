#!/usr/bin/env sh

load_env_file() {
  env_file_path="${1:-.env}"

  if [ ! -f "$env_file_path" ]; then
    return 0
  fi

  while IFS= read -r raw_line || [ -n "$raw_line" ]; do
    case "$raw_line" in
      "" | \#*)
        continue
        ;;
      export\ *)
        raw_line="${raw_line#export }"
        ;;
    esac

    key="${raw_line%%=*}"
    value="${raw_line#*=}"

    case "$key" in
      "" | *[!A-Za-z0-9_]*)
        continue
        ;;
    esac

    export "$key=$value"
  done < "$env_file_path"
}

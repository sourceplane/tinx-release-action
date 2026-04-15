#!/usr/bin/env bash
set -euo pipefail

install_dir=""
version=""

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    -b)
      install_dir="$2"
      shift 2
      ;;
    *)
      version="$1"
      shift
      ;;
  esac
done

if [[ -z "$install_dir" ]]; then
  echo "missing goreleaser install dir" >&2
  exit 1
fi

install -m 0755 "$GITHUB_WORKSPACE/test/fixtures/fake-goreleaser" "$install_dir/goreleaser"
if [[ -n "${GORELEASER_TEST_LOG:-}" ]]; then
  printf '%s %s\n' "$install_dir" "$version" >> "$GORELEASER_TEST_LOG"
fi
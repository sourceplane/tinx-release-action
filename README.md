# tinx-release-action

Node-based GitHub Action to run `tinx release` with push support.

## Inputs

- `registry` (required): OCI target for `--push`, for example `ghcr.io/sourceplane/torkflow:v0.0.1`
- `delegate-goreleaser` (optional, default `false`): adds `--delegate-goreleaser`
- `goreleaser-version` (optional, default `latest`): GoReleaser version to install when delegate mode is enabled
- `goreleaser-install-url` (optional, default `https://goreleaser.com/static/run`): GoReleaser installer script URL
- `working-directory` (optional, default `.`)
- `tinx-version` (optional, default `v0.1.4`)
- `install-url` (optional, default official `install.sh` URL)

## Usage

```yaml
- uses: sourceplane/tinx-release-action@v1
  with:
    registry: ghcr.io/sourceplane/torkflow:v0.0.1
    delegate-goreleaser: true
```

This maps to:

```bash
tinx release --delegate-goreleaser --push ghcr.io/sourceplane/torkflow:v0.0.1
```

When `delegate-goreleaser` is `true`, this action also ensures `goreleaser` is installed before running `tinx release`. If script install fails, it falls back to downloading the release asset directly (similar to `goreleaser-action`).

When `delegate-goreleaser` is `false`, the command is:

```bash
tinx release --push ghcr.io/sourceplane/torkflow:v0.0.1
```

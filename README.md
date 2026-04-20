# kiox-release-action

Node-based GitHub Action to run the current `kiox release` CLI.

The action installs `kiox`, optionally installs `goreleaser` when delegation is enabled, and forwards the current release flags for build, package, and optional OCI push workflows.

## Usage

### Build, package, and push

```yaml
- uses: sourceplane/kiox-release-action@v1
  with:
    push: ghcr.io/sourceplane/torkflow:v0.0.1
    delegate-goreleaser: true
```

This maps to:

```bash
kiox release --manifest kiox.yaml --output oci --dist dist --delegate-goreleaser --push ghcr.io/sourceplane/torkflow:v0.0.1
```

### Local package only

```yaml
- uses: sourceplane/kiox-release-action@v1
  with:
    manifest: kiox.yaml
    output: oci
    dist: dist
```

### Custom build inputs

```yaml
- uses: sourceplane/kiox-release-action@v1
  with:
    push: ghcr.io/acme/provider:v1.2.3
    main: ./cmd/provider
    tag: v1.2.3
    delegate-goreleaser: true
    goreleaser-config: .goreleaser.yaml
```

## Inputs

| Name | Default | Description |
|------|---------|-------------|
| `push` | — | OCI target for `--push`, for example `ghcr.io/sourceplane/torkflow:v0.0.1` |
| `registry` | — | Deprecated alias for `push` |
| `manifest` | `kiox.yaml` | Path to the kiox provider manifest |
| `output` | `oci` | Output OCI image layout directory |
| `dist` | `dist` | Build output directory used before packaging |
| `main` | — | Go main package to build |
| `skip-build` | `false` | Adds `--skip-build` |
| `tag` | — | OCI tag to write into the layout index |
| `plain-http` | `false` | Adds `--plain-http` for registry push flows |
| `delegate-goreleaser` | `false` | Adds `--delegate-goreleaser` |
| `goreleaser-config` | — | Path to `.goreleaser.yml` or `.goreleaser.yaml` |
| `goreleaser-version` | `latest` | GoReleaser version to install when delegation is enabled |
| `goreleaser-install-url` | `https://goreleaser.com/static/run` | GoReleaser installer script URL |
| `working-directory` | `.` | Working directory used when running `kiox release` |
| `kiox-version` | `latest` | kiox version to install |
| `install-url` | official `install.sh` URL | Override for the kiox installer script URL |

## Outputs

| Name | Description |
|------|-------------|
| `kiox-version` | Installed kiox version string |

## Notes

- `push` is optional. If you omit it, the action packages into the local OCI layout only.
- `registry` is still accepted for compatibility, but `push` is the preferred input name.
- When `delegate-goreleaser` is `true`, the action ensures `goreleaser` is available before invoking `kiox release`.
- If the GoReleaser install script fails, the action falls back to downloading the release asset directly.

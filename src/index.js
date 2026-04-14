const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

async function runCmd(command, args, options = {}) {
  await exec.exec(command, args, {
    failOnStdErr: false,
    ignoreReturnCode: false,
    ...options,
  });
}

async function capture(command, args, options = {}) {
  const result = await exec.getExecOutput(command, args, {
    ignoreReturnCode: false,
    silent: true,
    ...options,
  });
  return result.stdout.trim();
}

function normalizeGoReleaserVersion(version) {
  if (!version || version === 'latest') {
    return 'latest';
  }
  if (version === 'nightly') {
    return 'nightly';
  }
  if (/^v/.test(version)) {
    return version;
  }
  if (/^\d/.test(version)) {
    return `v${version}`;
  }
  return version;
}

function resolvePushRef(push, registry) {
  if (push && registry) {
    throw new Error("Use either 'push' or the deprecated 'registry' input, not both.");
  }
  if (registry) {
    core.warning("Input 'registry' is deprecated; use 'push' instead.");
  }
  return push || registry;
}

async function resolveLatestGoReleaserTag() {
  const response = await fetch('https://goreleaser.com/static/releases.json');
  if (!response.ok) {
    throw new Error(`failed to resolve latest goreleaser tag: ${response.status}`);
  }
  const releases = await response.json();
  if (!Array.isArray(releases) || releases.length === 0 || !releases[0].tag_name) {
    throw new Error('invalid releases payload from goreleaser.com/static/releases.json');
  }
  return releases[0].tag_name;
}

function goreleaserFilenameForCurrentPlatform() {
  let arch;
  switch (os.arch()) {
    case 'x64':
      arch = 'x86_64';
      break;
    case 'x32':
      arch = 'i386';
      break;
    case 'arm64':
      arch = 'arm64';
      break;
    case 'arm':
      arch = 'armv7';
      break;
    default:
      arch = os.arch();
      break;
  }

  const platform = os.platform() === 'win32' ? 'Windows' : os.platform() === 'darwin' ? 'Darwin' : 'Linux';
  const ext = os.platform() === 'win32' ? 'zip' : 'tar.gz';
  return `goreleaser_${platform}_${arch}.${ext}`;
}

async function installGoReleaserFromRelease({ version, installDir }) {
  const requested = normalizeGoReleaserVersion(version);
  const tag = requested === 'latest' ? await resolveLatestGoReleaserTag() : requested;
  const filename = goreleaserFilenameForCurrentPlatform();
  const downloadUrl = `https://github.com/goreleaser/goreleaser/releases/download/${tag}/${filename}`;

  const archivePath = path.join(process.env.RUNNER_TEMP || os.tmpdir(), filename);
  await runCmd('bash', ['-lc', `set -euo pipefail\ncurl -fL ${JSON.stringify(downloadUrl)} -o ${JSON.stringify(archivePath)}`]);

  if (os.platform() === 'win32') {
    throw new Error('windows goreleaser fallback install is not supported yet');
  }

  await runCmd('bash', ['-lc', `set -euo pipefail\ntar -xzf ${JSON.stringify(archivePath)} -C ${JSON.stringify(installDir)}`]);
  await runCmd('bash', ['-lc', `set -euo pipefail\nchmod +x ${JSON.stringify(path.join(installDir, 'goreleaser'))}`]);
}

async function ensureGoReleaserInstalled({ version, installUrl }) {
  const existing = await exec.getExecOutput('bash', ['-lc', 'command -v goreleaser'], {
    ignoreReturnCode: true,
    silent: true,
  });
  if (existing.exitCode === 0 && existing.stdout.trim() !== '') {
    return;
  }

  const installDir = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'goreleaser-bin');
  await fsp.mkdir(installDir, { recursive: true });
  core.addPath(installDir);

  const shellScript = `set -euo pipefail\ncurl -fsSL ${JSON.stringify(installUrl)} | bash -s -- -b ${JSON.stringify(installDir)} ${JSON.stringify(version)}`;
  try {
    await runCmd('bash', ['-lc', shellScript]);
  } catch {
    core.info('GoReleaser script install failed, falling back to release asset download.');
    await installGoReleaserFromRelease({ version, installDir });
  }

  const installed = await exec.getExecOutput('bash', ['-lc', `test -x ${JSON.stringify(path.join(installDir, 'goreleaser'))} && echo ok`], {
    ignoreReturnCode: true,
    silent: true,
  });
  if (installed.exitCode !== 0) {
    throw new Error(`failed to install goreleaser in ${installDir}`);
  }
}

async function installTinx({ version, installUrl }) {
  const installDir = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'tinx-bin');
  await fsp.mkdir(installDir, { recursive: true });

  core.exportVariable('TINX_INSTALL_DIR', installDir);
  core.exportVariable('TINX_BIN', path.join(installDir, 'tinx'));
  core.addPath(installDir);

  const shellScript = `set -euo pipefail\nexport TINX_INSTALL_DIR=${JSON.stringify(installDir)}\nexport TINX_VERSION=${JSON.stringify(version)}\ncurl -fsSL ${JSON.stringify(installUrl)} | bash`;
  await runCmd('bash', ['-lc', shellScript]);

  const tinxBin = path.join(installDir, 'tinx');
  await fsp.access(tinxBin, fs.constants.X_OK);

  const resolvedVersion = await capture(tinxBin, ['version']);
  core.setOutput('tinx-version', resolvedVersion);
  core.info(`tinx ${resolvedVersion} installed -> ${tinxBin}`);
  return tinxBin;
}

async function runRelease({
  tinxBin,
  workingDirectory,
  manifest,
  output,
  dist,
  mainPackage,
  skipBuild,
  tag,
  push,
  plainHTTP,
  delegateGoreleaser,
  goreleaserConfig,
}) {
  const args = ['release'];

  if (manifest) {
    args.push('--manifest', manifest);
  }
  if (output) {
    args.push('--output', output);
  }
  if (dist) {
    args.push('--dist', dist);
  }
  if (mainPackage) {
    args.push('--main', mainPackage);
  }
  if (skipBuild) {
    args.push('--skip-build');
  }
  if (tag) {
    args.push('--tag', tag);
  }
  if (push) {
    args.push('--push', push);
  }
  if (plainHTTP) {
    args.push('--plain-http');
  }
  if (delegateGoreleaser) {
    args.push('--delegate-goreleaser');
  }
  if (goreleaserConfig) {
    args.push('--goreleaser-config', goreleaserConfig);
  }

  await runCmd(tinxBin, args, { cwd: workingDirectory });
}

async function main() {
  try {
    const push = core.getInput('push');
    const registry = core.getInput('registry');
    const delegateGoreleaser = core.getBooleanInput('delegate-goreleaser');
    const goreleaserVersion = core.getInput('goreleaser-version') || 'latest';
    const goreleaserInstallUrl = core.getInput('goreleaser-install-url') || 'https://goreleaser.com/static/run';
    const workingDirectoryInput = core.getInput('working-directory') || '.';
    const tinxVersion = core.getInput('tinx-version') || 'latest';
    const installUrl = core.getInput('install-url') || 'https://raw.githubusercontent.com/sourceplane/tinx/main/install.sh';
    const manifest = core.getInput('manifest') || 'tinx.yaml';
    const output = core.getInput('output') || 'oci';
    const dist = core.getInput('dist') || 'dist';
    const mainPackage = core.getInput('main');
    const skipBuild = core.getBooleanInput('skip-build');
    const tag = core.getInput('tag');
    const plainHTTP = core.getBooleanInput('plain-http');
    const goreleaserConfig = core.getInput('goreleaser-config');

    const workingDirectory = path.resolve(process.cwd(), workingDirectoryInput);
    const pushRef = resolvePushRef(push, registry);

    const tinxBin = await installTinx({ version: tinxVersion, installUrl });

    if (delegateGoreleaser && !skipBuild) {
      await ensureGoReleaserInstalled({
        version: goreleaserVersion,
        installUrl: goreleaserInstallUrl,
      });
    }

    await runRelease({
      tinxBin,
      workingDirectory,
      manifest,
      output,
      dist,
      mainPackage,
      skipBuild,
      tag,
      push: pushRef,
      plainHTTP,
      delegateGoreleaser,
      goreleaserConfig,
    });
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

main();

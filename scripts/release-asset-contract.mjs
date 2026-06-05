export const checksumManifestName = 'axis_SHA256SUMS';

export const desktopReleaseTargets = [
  { platform: 'macos', arch: 'arm64', extension: 'dmg' },
  { platform: 'macos', arch: 'x64', extension: 'dmg' },
  { platform: 'windows', arch: 'x64', extension: 'exe' },
  { platform: 'linux', arch: 'x64', extension: 'AppImage' }
];

export const cliReleaseTargetPublicIds = {
  'darwin-arm64': 'macos-arm64',
  'darwin-x64': 'macos-x64',
  'linux-arm64': 'linux-arm64',
  'linux-x64': 'linux-x64',
  'windows-arm64': 'windows-arm64',
  'windows-x64': 'windows-x64'
};

export function cliReleaseAssetName(version, releaseTarget) {
  const publicId = cliReleaseTargetPublicIds[releaseTarget.id];
  if (!publicId) {
    throw new Error(`No public CLI release id for ${releaseTarget.id}.`);
  }
  return `axis-cli-${version}-${publicId}.${releaseTarget.archiveExtension}`;
}

export function desktopReleaseAssetName(version, platform, arch, extension) {
  return `axis-desktop-${version}-${platform}-${arch}.${extension}`;
}

export function expectedReleaseAssets(version) {
  return [
    ...desktopReleaseTargets.map((target) => desktopReleaseAssetName(version, target.platform, target.arch, target.extension)),
    `axis-cli-${version}-macos-arm64.tar.gz`,
    `axis-cli-${version}-macos-x64.tar.gz`,
    `axis-cli-${version}-linux-arm64.tar.gz`,
    `axis-cli-${version}-linux-x64.tar.gz`,
    `axis-cli-${version}-windows-arm64.zip`,
    `axis-cli-${version}-windows-x64.zip`,
    checksumManifestName
  ];
}

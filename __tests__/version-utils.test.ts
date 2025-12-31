import { describe, it, expect } from '@jest/globals';
import { stripVersionPrefix, formatBranchName } from '../src/version-utils.js';

describe('stripVersionPrefix', () => {
  it('strips v prefix from version string', () => {
    expect(stripVersionPrefix('v0.1.1')).toBe('0.1.1');
  });

  it('strips V prefix (uppercase) from version string', () => {
    expect(stripVersionPrefix('V1.2.3')).toBe('1.2.3');
  });

  it('handles version without prefix', () => {
    expect(stripVersionPrefix('0.1.1')).toBe('0.1.1');
  });

  it('only strips first v character', () => {
    expect(stripVersionPrefix('v1.0.0-v2')).toBe('1.0.0-v2');
  });

  it('handles empty string', () => {
    expect(stripVersionPrefix('')).toBe('');
  });

  it('handles complex semver versions', () => {
    expect(stripVersionPrefix('v1.2.3-alpha.1+build.123')).toBe('1.2.3-alpha.1+build.123');
  });
});

describe('formatBranchName', () => {
  it('formats branch name with package and version', () => {
    expect(formatBranchName('my-package', 'v0.1.1')).toBe('chore/my-package-v0.1.1');
  });

  it('formats branch name with version without v prefix', () => {
    expect(formatBranchName('my-package', '0.1.1')).toBe('chore/my-package-0.1.1');
  });

  it('sanitizes special characters in package name', () => {
    expect(formatBranchName('my@package!name', 'v0.1.1')).toBe('chore/my-package-name-v0.1.1');
  });

  it('sanitizes special characters in version', () => {
    expect(formatBranchName('package', 'v1.0.0+build')).toBe('chore/package-v1.0.0-build');
  });

  it('handles package names with underscores', () => {
    expect(formatBranchName('gnome_shell_extension', 'v1.0.0')).toBe(
      'chore/gnome_shell_extension-v1.0.0'
    );
  });

  it('handles complex package names', () => {
    expect(formatBranchName('gnome-shell-extension-elgato-lights', 'v0.1.2')).toBe(
      'chore/gnome-shell-extension-elgato-lights-v0.1.2'
    );
  });
});

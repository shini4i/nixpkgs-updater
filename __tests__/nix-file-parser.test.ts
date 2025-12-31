import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseNixFile, updateNixFile } from '../src/nix-file-parser.js';
import type { NixUpdateData } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'default.nix');
const FIXTURE_CONTENT = fs.readFileSync(FIXTURE_PATH, 'utf-8');

describe('parseNixFile', () => {
  it('extracts owner from Nix file', () => {
    const data = parseNixFile(FIXTURE_CONTENT);
    expect(data.owner).toBe('shini4i');
  });

  it('extracts repo from Nix file', () => {
    const data = parseNixFile(FIXTURE_CONTENT);
    expect(data.repo).toBe('gnome-shell-extension-elgato-lights');
  });

  it('extracts version from Nix file', () => {
    const data = parseNixFile(FIXTURE_CONTENT);
    expect(data.version).toBe('0.1.1');
  });

  it('extracts rev from Nix file', () => {
    const data = parseNixFile(FIXTURE_CONTENT);
    expect(data.rev).toBe('v0.1.1');
  });

  it('extracts hash (sha256 format) from Nix file', () => {
    const data = parseNixFile(FIXTURE_CONTENT);
    expect(data.hash).toBe('sha256-MIOCHZ0kS30mhYPHdIAkVlmZm6dA6sDfQ8Nul6Zbt4s=');
  });

  it('extracts hash from modern SRI format (hash = ...)', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "1.0.0";
      rev = "v1.0.0";
      hash = "sha256-ModernHashValue=";
    }`;
    const data = parseNixFile(content);
    expect(data.hash).toBe('sha256-ModernHashValue=');
  });

  it('does not match outputHash field', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "1.0.0";
      rev = "v1.0.0";
      outputHash = "sha256-OutputHashValue=";
    }`;
    expect(() => parseNixFile(content)).toThrow('Could not find hash or sha256 in Nix file');
  });

  it('does not match cargoHash field', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "1.0.0";
      rev = "v1.0.0";
      cargoHash = "sha256-CargoHashValue=";
    }`;
    expect(() => parseNixFile(content)).toThrow('Could not find hash or sha256 in Nix file');
  });

  it('extracts hash when outputHash is also present', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "1.0.0";
      rev = "v1.0.0";
      hash = "sha256-CorrectHash=";
      outputHash = "sha256-ShouldNotMatch=";
    }`;
    const data = parseNixFile(content);
    expect(data.hash).toBe('sha256-CorrectHash=');
  });

  it('extracts sha256 when cargoSha256 is also present', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "1.0.0";
      rev = "v1.0.0";
      sha256 = "sha256-CorrectHash=";
      cargoSha256 = "sha256-ShouldNotMatch=";
    }`;
    const data = parseNixFile(content);
    expect(data.hash).toBe('sha256-CorrectHash=');
  });

  it('throws error when owner is missing', () => {
    const content = `{ fetchFromGitHub }: { repo = "test"; }`;
    expect(() => parseNixFile(content)).toThrow('Could not find owner in Nix file');
  });

  it('throws error when repo is missing', () => {
    const content = `{ fetchFromGitHub }: { owner = "test"; }`;
    expect(() => parseNixFile(content)).toThrow('Could not find repo in Nix file');
  });

  it('throws error when version is missing', () => {
    const content = `{ fetchFromGitHub }: { owner = "test"; repo = "test"; rev = "v1.0.0"; }`;
    expect(() => parseNixFile(content)).toThrow('Could not find version in Nix file');
  });

  it('throws error when rev is missing', () => {
    const content = `{ fetchFromGitHub }: { owner = "test"; repo = "test"; version = "1.0.0"; }`;
    expect(() => parseNixFile(content)).toThrow('Could not find rev in Nix file');
  });

  it('throws error when hash/sha256 is missing', () => {
    const content = `{ fetchFromGitHub }: { owner = "test"; repo = "test"; version = "1.0.0"; rev = "v1.0.0"; }`;
    expect(() => parseNixFile(content)).toThrow('Could not find hash or sha256 in Nix file');
  });

  it('throws error for invalid owner with leading hyphen', () => {
    const content = `{ owner = "-invalid"; repo = "test"; version = "1.0.0"; rev = "v1.0.0"; sha256 = "sha256-test="; }`;
    expect(() => parseNixFile(content)).toThrow('Invalid GitHub owner format');
  });

  it('throws error for invalid owner with trailing hyphen', () => {
    const content = `{ owner = "invalid-"; repo = "test"; version = "1.0.0"; rev = "v1.0.0"; sha256 = "sha256-test="; }`;
    expect(() => parseNixFile(content)).toThrow('Invalid GitHub owner format');
  });

  it('throws error for owner with special characters', () => {
    const content = `{ owner = "user@evil"; repo = "test"; version = "1.0.0"; rev = "v1.0.0"; sha256 = "sha256-test="; }`;
    expect(() => parseNixFile(content)).toThrow('Invalid GitHub owner format');
  });

  it('throws error for repo ending with .git', () => {
    const content = `{ owner = "valid"; repo = "repo.git"; version = "1.0.0"; rev = "v1.0.0"; sha256 = "sha256-test="; }`;
    expect(() => parseNixFile(content)).toThrow('Invalid GitHub repository format');
  });

  it('throws error for repo with special characters', () => {
    const content = `{ owner = "valid"; repo = "repo/path"; version = "1.0.0"; rev = "v1.0.0"; sha256 = "sha256-test="; }`;
    expect(() => parseNixFile(content)).toThrow('Invalid GitHub repository format');
  });

  it('accepts valid owner with hyphens', () => {
    const content = `{ owner = "my-valid-user"; repo = "test"; version = "1.0.0"; rev = "v1.0.0"; sha256 = "sha256-test="; }`;
    const data = parseNixFile(content);
    expect(data.owner).toBe('my-valid-user');
  });

  it('accepts valid repo with dots and underscores', () => {
    const content = `{ owner = "user"; repo = "my_repo.nix"; version = "1.0.0"; rev = "v1.0.0"; sha256 = "sha256-test="; }`;
    const data = parseNixFile(content);
    expect(data.repo).toBe('my_repo.nix');
  });

  it('detects revUsesVersion when rev contains ${version}', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "0.5.1";
      rev = "v\${version}";
      hash = "sha256-test=";
    }`;
    const data = parseNixFile(content);
    expect(data.revUsesVersion).toBe(true);
    expect(data.rev).toBe('v${version}');
  });

  it('detects revUsesVersion is false for literal rev', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "0.5.1";
      rev = "v0.5.1";
      hash = "sha256-test=";
    }`;
    const data = parseNixFile(content);
    expect(data.revUsesVersion).toBe(false);
  });

  it('detects hasVendorHash for buildGoModule packages', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "0.5.1";
      rev = "v0.5.1";
      hash = "sha256-source=";
      vendorHash = "sha256-vendor=";
    }`;
    const data = parseNixFile(content);
    expect(data.hasVendorHash).toBe(true);
  });

  it('detects hasVendorHash is false for simple packages', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "0.5.1";
      rev = "v0.5.1";
      hash = "sha256-source=";
    }`;
    const data = parseNixFile(content);
    expect(data.hasVendorHash).toBe(false);
  });

  it('detects hasVendorHash with lib.fakeHash value', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "0.5.1";
      rev = "v0.5.1";
      hash = "sha256-source=";
      vendorHash = lib.fakeHash;
    }`;
    const data = parseNixFile(content);
    expect(data.hasVendorHash).toBe(true);
  });

  it('does not detect vendorHash in comments', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "0.5.1";
      rev = "v0.5.1";
      hash = "sha256-source=";
      # vendorHash = "sha256-test="; # commented out
    }`;
    const data = parseNixFile(content);
    expect(data.hasVendorHash).toBe(false);
  });

  it('detects revUsesVersion with bare version interpolation', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "0.5.1";
      rev = "\${version}";
      hash = "sha256-test=";
    }`;
    const data = parseNixFile(content);
    expect(data.revUsesVersion).toBe(true);
    expect(data.rev).toBe('${version}');
  });

  it('detects revUsesVersion with refs/tags format', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "0.5.1";
      rev = "refs/tags/v\${version}";
      hash = "sha256-test=";
    }`;
    const data = parseNixFile(content);
    expect(data.revUsesVersion).toBe(true);
    expect(data.rev).toBe('refs/tags/v${version}');
  });
});

describe('updateNixFile', () => {
  const updates: NixUpdateData = {
    version: '0.2.0',
    rev: 'v0.2.0',
    hash: 'sha256-NEWHASHVALUE123456789=',
  };

  it('updates version field', () => {
    const updated = updateNixFile(FIXTURE_CONTENT, updates);
    expect(updated).toContain('version = "0.2.0"');
    expect(updated).not.toContain('version = "0.1.1"');
  });

  it('updates rev field', () => {
    const updated = updateNixFile(FIXTURE_CONTENT, updates);
    expect(updated).toContain('rev = "v0.2.0"');
    expect(updated).not.toContain('rev = "v0.1.1"');
  });

  it('updates sha256 field (legacy format)', () => {
    const updated = updateNixFile(FIXTURE_CONTENT, updates);
    expect(updated).toContain('sha256 = "sha256-NEWHASHVALUE123456789="');
    expect(updated).not.toContain('sha256 = "sha256-MIOCHZ0kS30mhYPHdIAkVlmZm6dA6sDfQ8Nul6Zbt4s="');
  });

  it('updates hash field (modern SRI format)', () => {
    const modernContent = `{
      owner = "test";
      repo = "test";
      version = "1.0.0";
      rev = "v1.0.0";
      hash = "sha256-OldHash=";
    }`;
    const updated = updateNixFile(modernContent, updates);
    expect(updated).toContain('hash = "sha256-NEWHASHVALUE123456789="');
    expect(updated).not.toContain('hash = "sha256-OldHash="');
  });

  it('does not modify outputHash when updating hash', () => {
    const contentWithOutputHash = `{
      owner = "test";
      repo = "test";
      version = "1.0.0";
      rev = "v1.0.0";
      hash = "sha256-SourceHash=";
      outputHash = "sha256-OutputHashShouldNotChange=";
    }`;
    const updated = updateNixFile(contentWithOutputHash, updates);
    expect(updated).toContain('hash = "sha256-NEWHASHVALUE123456789="');
    expect(updated).toContain('outputHash = "sha256-OutputHashShouldNotChange="');
  });

  it('does not modify cargoHash when updating sha256', () => {
    const contentWithCargoHash = `{
      owner = "test";
      repo = "test";
      version = "1.0.0";
      rev = "v1.0.0";
      sha256 = "sha256-SourceHash=";
      cargoHash = "sha256-CargoHashShouldNotChange=";
    }`;
    const updated = updateNixFile(contentWithCargoHash, updates);
    expect(updated).toContain('sha256 = "sha256-NEWHASHVALUE123456789="');
    expect(updated).toContain('cargoHash = "sha256-CargoHashShouldNotChange="');
  });

  it('does not modify vendorHash when updating hash', () => {
    const contentWithVendorHash = `{
      owner = "test";
      repo = "test";
      version = "1.0.0";
      rev = "v1.0.0";
      hash = "sha256-SourceHash=";
      vendorHash = "sha256-VendorHashShouldNotChange=";
    }`;
    const updated = updateNixFile(contentWithVendorHash, updates);
    expect(updated).toContain('hash = "sha256-NEWHASHVALUE123456789="');
    expect(updated).toContain('vendorHash = "sha256-VendorHashShouldNotChange="');
  });

  it('skips rev update when skipRevUpdate option is true', () => {
    const contentWithVersionRef = `{
      owner = "test";
      repo = "test";
      version = "1.0.0";
      rev = "v\${version}";
      hash = "sha256-OldHash=";
    }`;
    const updated = updateNixFile(contentWithVersionRef, updates, { skipRevUpdate: true });
    expect(updated).toContain('version = "0.2.0"');
    expect(updated).toContain('rev = "v${version}"'); // rev should be unchanged
    expect(updated).toContain('hash = "sha256-NEWHASHVALUE123456789="');
  });

  it('updates rev when skipRevUpdate is false (default)', () => {
    const content = `{
      owner = "test";
      repo = "test";
      version = "1.0.0";
      rev = "v1.0.0";
      hash = "sha256-OldHash=";
    }`;
    const updated = updateNixFile(content, updates);
    expect(updated).toContain('version = "0.2.0"');
    expect(updated).toContain('rev = "v0.2.0"');
    expect(updated).toContain('hash = "sha256-NEWHASHVALUE123456789="');
  });

  it('preserves pname field', () => {
    const updated = updateNixFile(FIXTURE_CONTENT, updates);
    expect(updated).toContain('pname = "gnome-shell-extension-elgato-lights"');
  });

  it('preserves owner field', () => {
    const updated = updateNixFile(FIXTURE_CONTENT, updates);
    expect(updated).toContain('owner = "shini4i"');
  });

  it('preserves repo field', () => {
    const updated = updateNixFile(FIXTURE_CONTENT, updates);
    expect(updated).toContain('repo = "gnome-shell-extension-elgato-lights"');
  });

  it('preserves fetchFromGitHub structure', () => {
    const updated = updateNixFile(FIXTURE_CONTENT, updates);
    expect(updated).toContain('fetchFromGitHub');
  });

  it('preserves meta section', () => {
    const updated = updateNixFile(FIXTURE_CONTENT, updates);
    expect(updated).toContain('description = "GNOME Shell extension for Elgato Key Lights"');
  });

  it('parses updated content correctly', () => {
    const updated = updateNixFile(FIXTURE_CONTENT, updates);
    const parsed = parseNixFile(updated);

    expect(parsed.version).toBe('0.2.0');
    expect(parsed.rev).toBe('v0.2.0');
    expect(parsed.hash).toBe('sha256-NEWHASHVALUE123456789=');
    expect(parsed.owner).toBe('shini4i');
    expect(parsed.repo).toBe('gnome-shell-extension-elgato-lights');
  });
});

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

  it('extracts sha256 from Nix file', () => {
    const data = parseNixFile(FIXTURE_CONTENT);
    expect(data.sha256).toBe('sha256-MIOCHZ0kS30mhYPHdIAkVlmZm6dA6sDfQ8Nul6Zbt4s=');
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
    const content = `{ fetchFromGitHub }: { owner = "test"; repo = "test"; }`;
    expect(() => parseNixFile(content)).toThrow('Could not find version in Nix file');
  });

  it('throws error when rev is missing', () => {
    const content = `{ fetchFromGitHub }: { owner = "test"; repo = "test"; version = "1.0.0"; }`;
    expect(() => parseNixFile(content)).toThrow('Could not find rev in Nix file');
  });

  it('throws error when sha256 is missing', () => {
    const content = `{ fetchFromGitHub }: { owner = "test"; repo = "test"; version = "1.0.0"; rev = "v1.0.0"; }`;
    expect(() => parseNixFile(content)).toThrow('Could not find sha256 in Nix file');
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
});

describe('updateNixFile', () => {
  const updates: NixUpdateData = {
    version: '0.2.0',
    rev: 'v0.2.0',
    sha256: 'sha256-NEWHASHVALUE123456789=',
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

  it('updates sha256 field', () => {
    const updated = updateNixFile(FIXTURE_CONTENT, updates);
    expect(updated).toContain('sha256 = "sha256-NEWHASHVALUE123456789="');
    expect(updated).not.toContain('sha256 = "sha256-MIOCHZ0kS30mhYPHdIAkVlmZm6dA6sDfQ8Nul6Zbt4s="');
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
    expect(parsed.sha256).toBe('sha256-NEWHASHVALUE123456789=');
    expect(parsed.owner).toBe('shini4i');
    expect(parsed.repo).toBe('gnome-shell-extension-elgato-lights');
  });
});

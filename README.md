# nixpkgs-updater

[![codecov](https://codecov.io/gh/shini4i/nixpkgs-updater/graph/badge.svg?token=W7SNF25BXV)](https://codecov.io/gh/shini4i/nixpkgs-updater)

A GitHub Action that automates updating Nix packages in a centralized repository when a new version is released in a source repository.

## Features

- Automatically updates `version`, `rev`, and hash fields in Nix package files
- Supports both modern `hash` (SRI format) and legacy `sha256` fields
- Supports `buildGoModule` packages with `vendorHash`
- Handles `rev = "v${version}"` pattern (Nix interpolation)
- Creates or updates pull requests with version bumps
- Uses `nix-prefetch-github` for accurate hash calculation
- Supports updating existing PRs when re-triggered

## Usage

### Prerequisites

1. A centralized nixpkgs repository with packages in `pkgs/<package-name>/default.nix`
2. A GitHub token with push access to the target repository
3. Nix installed in the workflow (use `cachix/install-nix-action`)

### Basic Example

Add this workflow to your source repository:

```yaml
name: Update Nixpkgs

on:
  push:
    tags:
      - 'v*'

jobs:
  update-nixpkgs:
    runs-on: ubuntu-latest
    steps:
      - name: Install Nix
        uses: cachix/install-nix-action@v31

      - name: Update nixpkgs
        uses: shini4i/nixpkgs-updater@v1
        with:
          package-name: my-package
          version: ${{ github.ref_name }}
          target-repo: owner/nixpkgs
          github-token: ${{ secrets.NIXPKGS_TOKEN }}
```

### Inputs

| Input | Description | Required |
|-------|-------------|----------|
| `package-name` | Name of the package directory in `pkgs/<package-name>` | Yes |
| `version` | New version to update to (e.g., `v0.1.2` or `0.1.2`) | Yes |
| `target-repo` | Target nixpkgs repository in `owner/repo` format | Yes |
| `github-token` | GitHub token with push access to target repository | Yes |

### Outputs

| Output | Description |
|--------|-------------|
| `pr-url` | URL of the created or updated pull request |
| `pr-number` | Number of the created or updated pull request |
| `branch-name` | Name of the branch created |

### Expected Nix File Format

The action expects package files at `pkgs/<package-name>/default.nix`. It supports both modern and legacy hash formats:

**Modern format (recommended):**

```nix
{ lib, fetchFromGitHub }:

let
  src = fetchFromGitHub {
    owner = "owner";
    repo = "my-package";
    rev = "v0.1.0";
    hash = "sha256-...";  # SRI format
  };
in
mkDerivation {
  pname = "my-package";
  version = "0.1.0";
  inherit src;
  # ...
}
```

**Legacy format:**

```nix
{ stdenv, fetchFromGitHub }:

stdenv.mkDerivation rec {
  pname = "my-package";
  version = "0.1.0";

  src = fetchFromGitHub {
    owner = "owner";
    repo = "my-package";
    rev = "v0.1.0";
    sha256 = "sha256-...";
  };

  # ...
}
```

The action will update:
- `version` field (strips `v` prefix if present)
- `rev` field (keeps original format)
- `hash` or `sha256` field (automatically detects which format is used)

## Version Handling

The action automatically handles version prefixes:
- Input `v1.0.0` → `version = "1.0.0"`, `rev = "v1.0.0"`
- Input `1.0.0` → `version = "1.0.0"`, `rev = "1.0.0"`

## buildGoModule Support

The action supports Go packages built with `buildGoModule`:

```nix
{ lib, buildGoModule, fetchFromGitHub }:

buildGoModule rec {
  pname = "my-go-package";
  version = "0.1.0";

  src = fetchFromGitHub {
    owner = "owner";
    repo = "my-go-package";
    rev = "v${version}";  # Nix interpolation
    hash = "sha256-...";
  };

  vendorHash = "sha256-...";  # Go dependencies hash
}
```

### Special Handling

**`rev = "v${version}"` pattern:**
When the `rev` field uses Nix interpolation (e.g., `"v${version}"`), the action will skip updating the `rev` field since it automatically updates when the `version` changes.

**`vendorHash` field:**
The `vendorHash` cannot be pre-calculated without running `nix build`. When the action detects a `vendorHash` field, it will:
- Update `version` and source `hash` as normal
- **Not** modify the `vendorHash`
- Add a warning in the PR description with manual update instructions

If Go dependencies have changed in the new version, you'll need to update `vendorHash` manually:
1. Set `vendorHash = "";` or `vendorHash = lib.fakeHash;`
2. Run `nix build .#<package-name>`
3. Copy the correct hash from the error message
4. Update `vendorHash` with the correct value

If dependencies haven't changed, the existing `vendorHash` should still work.

## PR Behavior

- Creates a new branch: `chore/<package-name>` (version-independent)
- PR title format: `bump <package-name> version to <version>`
- If a PR already exists from the same branch, it will be updated with the new version
- This allows subsequent version releases to update the existing PR instead of creating new ones

## Token Permissions

The action requires a GitHub Personal Access Token (PAT) with push access to the target repository.

### Option 1: Fine-grained Personal Access Token (Recommended)

1. Go to [GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Click "Generate new token"
3. Configure:
   - **Token name**: `nixpkgs-updater` (or any descriptive name)
   - **Expiration**: Choose based on your security requirements
   - **Repository access**: Select "Only select repositories" → choose your target nixpkgs repository
   - **Permissions**:
     - **Contents**: Read and write (for cloning and pushing branches)
     - **Pull requests**: Read and write (for creating/updating PRs)
4. Click "Generate token" and copy the token
5. Add it as a secret in your source repository: Settings → Secrets → Actions → New repository secret → name it `NIXPKGS_TOKEN`

### Option 2: Classic Personal Access Token

1. Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Configure:
   - **Note**: `nixpkgs-updater`
   - **Expiration**: Choose based on your security requirements
   - **Scopes**: Select `repo` (Full control of private repositories)
4. Click "Generate token" and copy the token
5. Add it as a secret in your source repository: Settings → Secrets → Actions → New repository secret → name it `NIXPKGS_TOKEN`

> **Note**: Fine-grained tokens are recommended as they follow the principle of least privilege.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint

# Build
npm run build

# Run all checks
npm run all
```

### Development Environment

This project uses Nix flakes for a reproducible development environment:

```bash
# Enter development shell
nix develop

# Or with direnv
direnv allow
```

## License

MIT

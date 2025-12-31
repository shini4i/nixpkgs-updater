# nixpkgs-updater

A GitHub Action that automates updating Nix packages in a centralized repository when a new version is released in a source repository.

## Features

- Automatically updates `version`, `rev`, and `sha256` fields in Nix package files
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

The action expects package files at `pkgs/<package-name>/default.nix` with this structure:

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

  # ... rest of derivation
}
```

The action will update:
- `version` field (strips `v` prefix if present)
- `rev` field (keeps original format)
- `sha256` field (recalculated using `nix-prefetch-github`)

## Version Handling

The action automatically handles version prefixes:
- Input `v1.0.0` → `version = "1.0.0"`, `rev = "v1.0.0"`
- Input `1.0.0` → `version = "1.0.0"`, `rev = "1.0.0"`

## PR Behavior

- Creates a new branch: `chore/<package-name>-<version>`
- PR title format: `bump <package-name> version to <version>`
- If a PR already exists from the same branch, it will be updated instead

## Token Permissions

The GitHub token needs the following permissions on the target repository:
- `repo` scope (for pushing branches and creating PRs)

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

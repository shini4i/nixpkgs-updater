{
  description = "nixpkgs-updater - GitHub Action for updating Nix flakes";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Node.js 24
            nodejs_24

            # Nix tools for hash prefetching
            nix-prefetch-github

            # Git for operations
            git
          ];

          shellHook = ''
            echo "nixpkgs-updater development environment"
            echo "Node.js: $(node --version)"
            echo "npm: $(npm --version)"
            echo "nix-prefetch-github: available"
          '';
        };
      }
    );
}

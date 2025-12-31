{ stdenv, fetchFromGitHub }:

stdenv.mkDerivation rec {
  pname = "gnome-shell-extension-elgato-lights";
  version = "0.1.1";

  src = fetchFromGitHub {
    owner = "shini4i";
    repo = "gnome-shell-extension-elgato-lights";
    rev = "v0.1.1";
    sha256 = "sha256-MIOCHZ0kS30mhYPHdIAkVlmZm6dA6sDfQ8Nul6Zbt4s=";
  };

  dontBuild = true;

  installPhase = ''
    runHook preInstall
    mkdir -p $out/share/gnome-shell/extensions/elgato-lights@shini4i
    cp -r . $out/share/gnome-shell/extensions/elgato-lights@shini4i
    runHook postInstall
  '';

  meta = with lib; {
    description = "GNOME Shell extension for Elgato Key Lights";
    homepage = "https://github.com/shini4i/gnome-shell-extension-elgato-lights";
    license = licenses.gpl3Plus;
    platforms = platforms.linux;
  };
}

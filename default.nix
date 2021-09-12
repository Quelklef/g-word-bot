{ pkgs ? import <nixpkgs> {} }:

let

npmlock2nix =
  let src = builtins.fetchGit {
        url = "https://github.com/tweag/npmlock2nix";
        rev = "8ada8945e05b215f3fffbd10111f266ea70bb502";
      };
  in import src { inherit pkgs; };

node_modules = npmlock2nix.node_modules { src = ./.; };

in pkgs.stdenv.mkDerivation {
  name = "g-word-bot";
  src = ./.;

  installPhase = ''
    mkdir $out
    cp -r ${node_modules}/node_modules $out/
    cp $src/g-word-bot.js $out/index.js
    echo "${pkgs.nodejs}/bin/node $out/index.js" > $out/run.sh
    chmod +x $out/run.sh
  '';
}

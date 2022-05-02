{}:

let

inherit (import ./pins.nix) pkgs npmlock2nix nodejs;

node_modules = npmlock2nix.node_modules { src = ./.; };

in pkgs.stdenv.mkDerivation {
  name = "g-word-bot";
  src = ./.;

  installPhase = ''
    mkdir $out
    cp -r ${node_modules}/node_modules $out/
    cp $src/g-word-bot.js $out/index.js
    echo "${nodejs}/bin/node $out/index.js" > $out/run.sh
    chmod +x $out/run.sh
  '';

  shellHook = ''
    export G_WORD_BOT_TOKEN=${(import <secrets>).g-word-bot-telegram-token-devt};
    export PATH="${nodejs}/bin:$PATH"
  '';
}

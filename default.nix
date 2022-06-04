{}:

let

inherit (import ./pins.nix) pkgs npmlock2nix nodejs;

node_modules = let
  src = pkgs.stdenv.mkDerivation {
      name = "g-word-bot-node-modules-src-fixup";
      src = ./.;
      installPhase = ''
        mkdir -p $out
        cp $src/package{,-lock}.json $out
        sed -i $out/package-lock.json \
            -e 's|git+ssh://git@github.com/quelklef/skim.git|github:quelklef/skim|' \
            -e 's|VhwvUmfou+KgEGb5JHHCurbMwaxko4NE0xhkEiHBJpTCzUyyx/UmrVUonC7qq3Hcqa5WU4u20KqcjOdbgsBrIA==|lD62QNhuSfsSCZqvYe3DQuweCZnmhJgjesRfVv4QDgBpQmqcSh6ScHTqfs89HiZZqWqugrUHOzFcBWwNmkYXHw==|'
        # yuck!
      '';
    };
  in npmlock2nix.node_modules { inherit src; };

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
    export G_WORD_BOT_JOURNAL_LOC=./log.jsona
    export PATH="${nodejs}/bin:$PATH"
  '';
}

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
            -e 's|N6xdM6/R9AmNgYZPaF6xiHWoh1DubAiDfM6VkLqXjtcDVqYism+ETO4eNtQV7aKUX2b3ZJ2XDf7/w7G8zbtfBA==|tRInJr5wJD21o+zlqdmdLhgEUxf9L1KY/G8cGlZVB3tpI15mpqtZMqSKkDJVaEy3I4lR2lOcWNIALVj14+wSEg==|'
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

{ token }:

{
  systemd.services.g-word-bot = {
    description = "G-word bot";
    after = [ "network.target" ];
    wantedBy = [ "default.target" ];
    script = ''
      export G_WORD_BOT_TOKEN=$(cat /run/keys/g-word-bot-telegram-token)
      export G_WORD_BOT_LEGACY_STATEFILE_LOC=/var/lib/g-word-bot-state.json
      export G_WORD_BOT_JOURNAL_LOC=/var/lib/g-word-bot-journal.jsona
      ${import ./default.nix {}}/run.sh
    '';
    serviceConfig = {
      Type = "simple";
      Restart = "always";
    };
  };

  deployment.keys.g-word-bot-telegram-token.text = token;
}

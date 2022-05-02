{ token }:

{
  systemd.services.g-word-bot = {
    description = "G-word bot";
    after = [ "network.target" ];
    wantedBy = [ "default.target" ];
    script = ''
      export G_WORD_BOT_TOKEN=$(cat /run/keys/g-word-bot-telegram-token)
      ${import ./default.nix {}}/run.sh
    '';
    serviceConfig = {
      Type = "simple";
      Restart = "always";
    };
  };

  deployment.keys.g-word-bot-telegram-token.text = token;
}

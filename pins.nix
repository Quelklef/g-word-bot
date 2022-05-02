rec {

pkgs =
  let fetched = builtins.fetchGit {
        url = "https://github.com/NixOS/nixpkgs";
        rev = "7e89775a9e618fd494558b2e78f510e9e4ec6b27";
      };
  in import fetched {};

npmlock2nix =
  let src = builtins.fetchGit {
        url = "https://github.com/tweag/npmlock2nix";
        rev = "dd2897c3a6e404446704a63f40b9a29fa0acf752";
      };
  in import src { inherit pkgs; };

nodejs = pkgs.nodejs-17_x;

}

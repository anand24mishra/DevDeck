# Template: replace VERSION and SHA256 with values from the verified, published release.
# Do not install or submit this template to a tap until both values have been replaced.
cask "devdeck" do
  version "VERSION"
  sha256 "SHA256"

  url "https://github.com/anand24mishra/DevDeck/releases/download/v#{version}/DevDeck-#{version}-universal.dmg"
  name "DevDeck"
  desc "Local development processes, ports, and containers by project"
  homepage "https://github.com/anand24mishra/DevDeck"

  depends_on macos: ">= :ventura"
  app "DevDeck.app"

  zap trash: "~/Library/Application Support/devdeck"
end

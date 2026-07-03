window.HaxurApp = {
  init() {
    HaxurTikTokConnector.init();
    HaxurGameEngine.render();
    HaxurEvents.add("HAXUR V4 Core betöltve");
  },

  start() {
    HaxurGameEngine.start();
  },

  stop() {
    HaxurGameEngine.stop();
  },

  testGift() {
    const names = ["HaxurFan", "BossViewer", "TapLegend", "GiftKing", "LiveHero"];
    const gifts = ["rose", "heart", "galaxy", "lion", "universe"];

    const username = HaxurUtils.randomFrom(names);
    const gift = HaxurUtils.randomFrom(gifts);

    HaxurGameEngine.addGift(username, gift, 1);
  },

  testTap() {
    const names = ["HaxurFan", "BossViewer", "TapLegend", "GiftKing", "LiveHero"];
    const username = HaxurUtils.randomFrom(names);

    HaxurGameEngine.addTap(username, 100);
  },

  testChat() {
    const names = ["HaxurFan", "BossViewer", "TapLegend", "GiftKing", "LiveHero"];
    const commands = ["!join", "!red", "!blue", "!tap", "!score"];

    const username = HaxurUtils.randomFrom(names);
    const command = HaxurUtils.randomFrom(commands);

    HaxurGameEngine.handleChat(username, command);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  HaxurApp.init();
});
window.HaxurHud = {
    update(state) {
        HaxurUtils.setText("gameName", state.currentGameName);
        HaxurUtils.setText("statusText", state.gameActive ? "ÉLŐ JÁTÉK" : "VÁRAKOZÁS");
        HaxurUtils.setText("roundText", `Kör: ${state.round}/${state.maxRounds}`);
        HaxurUtils.setText("timerText", `${state.countdown}s`);
        HaxurUtils.setText("redScore", state.teams.red.score);
        HaxurUtils.setText("blueScore", state.teams.blue.score);
        HaxurUtils.setText("viewerBox", `Játékosok: ${Object.keys(state.players).length}`);
        HaxurUtils.setText("comboBox", `Combo: ${state.combo}x`);
        HaxurUtils.setText("lastGiftBox", `Utolsó gift: ${state.lastGift || "nincs"}`);
    },

    setCenter(title, text) {
        HaxurUtils.setText("mainGameTitle", title);
        HaxurUtils.setText("mainGameText", text);
    }
};
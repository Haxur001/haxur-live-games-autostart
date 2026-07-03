window.HaxurGameEngine = {
    state: {
        gameActive: false,
        roundActive: false,
        currentGameName: "GIFT BATTLE",
        round: 0,
        maxRounds: 10,
        roundTime: 45,
        countdown: 45,
        timer: null,
        combo: 0,
        lastGift: "",
        players: {},
        teams: {
            red: { name: "RED TEAM", score: 0 },
            blue: { name: "BLUE TEAM", score: 0 }
        },
        giftValues: {
            rose: 1,
            heart: 3,
            finger_heart: 5,
            perfume: 10,
            cap: 20,
            galaxy: 100,
            lion: 500,
            universe: 1000
        }
    },

    start() {
        this.reset();
        this.state.gameActive = true;
        this.state.round = 1;
        this.state.countdown = this.state.roundTime;
        this.state.roundActive = true;

        HaxurEvents.add("Játék elindult");
        HaxurHud.setCenter("GIFT BATTLE", "Küldj giftet és szerezz pontot");
        this.startTimer();
        this.render();
    },

    stop() {
        this.state.gameActive = false;
        this.state.roundActive = false;

        if (this.state.timer) {
            clearInterval(this.state.timer);
            this.state.timer = null;
        }

        HaxurEvents.add("Játék leállítva");
        HaxurHud.setCenter("HAXUR ARENA", "Játék megállítva");
        this.render();
    },

    reset() {
        if (this.state.timer) {
            clearInterval(this.state.timer);
        }

        this.state.round = 0;
        this.state.countdown = this.state.roundTime;
        this.state.combo = 0;
        this.state.lastGift = "";
        this.state.players = {};
        this.state.teams.red.score = 0;
        this.state.teams.blue.score = 0;
    },

    startTimer() {
        if (this.state.timer) {
            clearInterval(this.state.timer);
        }

        this.state.timer = setInterval(() => {
            if (!this.state.gameActive || !this.state.roundActive) return;

            this.state.countdown -= 1;

            if (this.state.countdown <= 0) {
                this.endRound();
                return;
            }

            this.render();
        }, 1000);
    },

    endRound() {
        this.state.roundActive = false;

        const winner = this.getTopPlayer();

        if (winner) {
            HaxurEvents.add(`Kör nyertese: ${winner.name}, ${winner.score} pont`);
            HaxurHud.setCenter("KÖR VÉGE", `${winner.name} vezet`);
        } else {
            HaxurEvents.add("Kör vége, nincs játékos");
            HaxurHud.setCenter("KÖR VÉGE", "Nincs győztes");
        }

        if (this.state.round >= this.state.maxRounds) {
            this.finishGame();
            return;
        }

        setTimeout(() => {
            this.nextRound();
        }, 4000);

        this.render();
    },

    nextRound() {
        if (!this.state.gameActive) return;

        this.state.round += 1;
        this.state.countdown = this.state.roundTime;
        this.state.roundActive = true;

        HaxurEvents.add(`${this.state.round}. kör indul`);
        HaxurHud.setCenter("GIFT BATTLE", "Mehetnek a giftek");
        this.render();
    },

    finishGame() {
        this.state.gameActive = false;
        this.state.roundActive = false;

        if (this.state.timer) {
            clearInterval(this.state.timer);
            this.state.timer = null;
        }

        const winner = this.getTopPlayer();

        if (winner) {
            HaxurEvents.add(`Végső győztes: ${winner.name}`);
            HaxurHud.setCenter("GYŐZTES", `${winner.name}, ${winner.score} pont`);
        } else {
            HaxurEvents.add("Játék vége, nincs győztes");
            HaxurHud.setCenter("JÁTÉK VÉGE", "Nincs játékos");
        }

        this.render();
    },

    getPlayer(username) {
        const name = HaxurUtils.cleanName(username);

        if (!this.state.players[name]) {
            const team = Object.keys(this.state.players).length % 2 === 0 ? "red" : "blue";

            this.state.players[name] = {
                name,
                score: 0,
                gifts: 0,
                taps: 0,
                team
            };

            HaxurEvents.add(`${name} belépett a játékba`);
        }

        return this.state.players[name];
    },

    addScore(username, points, reason) {
        const player = this.getPlayer(username);

        player.score += points;

        if (player.team === "red") {
            this.state.teams.red.score += points;
        } else {
            this.state.teams.blue.score += points;
        }

        HaxurEvents.add(`${player.name} +${points} pont, ${reason}`);
        HaxurEffects.pulse();
        this.render();
    },

    addGift(username, giftName, count = 1) {
        const cleanGift = this.cleanGiftName(giftName);
        const value = this.state.giftValues[cleanGift] || 2;
        const total = value * count;

        const player = this.getPlayer(username);
        player.gifts += count;

        this.state.combo += 1;
        this.state.lastGift = `${player.name}: ${giftName}`;

        this.addScore(player.name, total, giftName);
    },

    addTap(username, count = 1) {
        const player = this.getPlayer(username);
        player.taps += count;

        const points = Math.max(1, Math.floor(count / 10));

        this.addScore(player.name, points, "tap");
    },

    handleChat(username, message) {
        const text = String(message || "").toLowerCase().trim();
        const player = this.getPlayer(username);

        if (text === "!join") {
            HaxurEvents.add(`${player.name} csatlakozott`);
            this.render();
            return;
        }

        if (text === "!red") {
            this.movePlayerToTeam(player.name, "red");
            return;
        }

        if (text === "!blue") {
            this.movePlayerToTeam(player.name, "blue");
            return;
        }

        if (text === "!tap") {
            this.addTap(player.name, 10);
            return;
        }

        if (text === "!score") {
            HaxurEvents.add(`${player.name} pontja: ${player.score}`);
            return;
        }
    },

    movePlayerToTeam(username, team) {
        const player = this.getPlayer(username);

        if (player.team === team) return;

        if (player.team === "red") {
            this.state.teams.red.score -= player.score;
        } else {
            this.state.teams.blue.score -= player.score;
        }

        player.team = team;

        if (team === "red") {
            this.state.teams.red.score += player.score;
        } else {
            this.state.teams.blue.score += player.score;
        }

        HaxurEvents.add(`${player.name} átállt: ${team.toUpperCase()} TEAM`);
        this.render();
    },

    getTopPlayer() {
        const players = Object.values(this.state.players);

        if (players.length === 0) return null;

        return players.sort((a, b) => b.score - a.score)[0];
    },

    cleanGiftName(name) {
        return String(name || "rose")
            .toLowerCase()
            .replaceAll(" ", "_")
            .replaceAll("-", "_");
    },

    render() {
        HaxurHud.update(this.state);
        HaxurLeaderboard.render(this.state.players);
    }
};
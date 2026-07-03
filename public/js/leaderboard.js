window.HaxurLeaderboard = {
    render(players) {
        const box = document.getElementById("leaderboard");
        if (!box) return;

        const list = Object.values(players)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        if (list.length === 0) {
            box.innerHTML = '<div class="emptyRow">Még nincs játékos</div>';
            return;
        }

        box.innerHTML = list.map((player, index) => {
            return `
        <div class="leaderRow popIn">
          <div class="leaderRank">#${index + 1}</div>
          <div class="leaderName">${player.name}</div>
          <div class="leaderScore">${player.score}</div>
        </div>
      `;
        }).join("");
    }
};
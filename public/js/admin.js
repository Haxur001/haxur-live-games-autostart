async function post(url, body = {}) {
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function hostPower(action) { post("/host-power", { action }); }
function testAnswer(answer) { post("/test-answer", { name: "TesztJatekos", answer }); }
function testGift() {
  post("/test-gift", { name: "GiftJatekos", giftName: document.getElementById("giftName").value || "Galaxy", value: Number(document.getElementById("giftValue").value || 10) });
}
function testViewerBoss() {
  post("/test-viewer-boss", { name: "ViewerBossTeszt", giftName: document.getElementById("giftName").value || "Galaxy", profilePictureUrl: "" });
}
function sendQuestion() {
  post("/set-question", {
    question: document.getElementById("question").value || "Teszt kérdés?",
    answers: {
      A: document.getElementById("a").value || "A",
      B: document.getElementById("b").value || "B",
      C: document.getElementById("c").value || "C",
      D: document.getElementById("d").value || "D"
    },
    correct: document.getElementById("correct").value,
    damage: Number(document.getElementById("damage").value || 50),
    wrongHeal: Number(document.getElementById("wrongHeal").value || 25)
  });
}

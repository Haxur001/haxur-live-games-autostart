const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const { TikTokLiveConnection, WebcastEvent } = require("tiktok-live-connector");

let openBrowser = null;
try { openBrowser = require("open"); } catch {}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8")); }
  catch { return fallback; }
}

function writeJson(file, data) {
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(data, null, 2), "utf8");
}

let CONFIG = readJson("config.json", {});
let questions = readJson("questions.json", []);
let giftRewards = readJson("giftRewards.json", {});
let viewerBossGifts = readJson("viewerBossGifts.json", {});
let save = readJson(CONFIG.saveFile || "scores.json", { scores: {}, gifters: {}, host: { power: 0, legend: 0, energy: 0, gifts: 0 } });

let scores = save.scores || {};
let gifters = save.gifters || {};
let host = save.host || { power: 0, legend: 0, energy: 0, gifts: 0 };
let events = [];
let answered = new Set();
let questionIndex = 0;
let timer = null;
let lootTimer = null;
let viewerBossTimer = null;

let questionActive = false;
let showAnswer = false;
let timeLeft = CONFIG.questionTime || 30;
let currentQuestion = questions[0] || { question: "Nincs kérdés.", answers: { A: "A", B: "B", C: "C", D: "D" }, correct: "A", damage: 50, wrongHeal: 25 };

function makeBoss() {
  const hp = Number(CONFIG.boss?.baseHp || 1000);
  return { name: CONFIG.boss?.name || "HAXUR BOSS", level: 1, hp, maxHp: hp, image: CONFIG.boss?.image || "images/bosses/haxur.png", type: "system", ownerId: null, skill: "" };
}

let boss = makeBoss();
let savedBoss = null;
let nextBoss = { name: "HAXUR NIGHTMARE", hp: Number(CONFIG.boss?.baseHp || 1000) + Number(CONFIG.boss?.hpIncreasePerLevel || 1000) };
let combo = { count: 0, multiplier: 1, lastHitName: "", lastDamage: 0, critical: false };
let loot = { active: false, timeLeft: 0, claimed: {}, lastWinner: "", message: "" };
let bossSkill = { active: false, type: "", title: "", message: "", triggered75: false, triggered50: false, triggered25: false };
let hostMode = { doubleDamage: false, rage: false, winnerShow: false, message: "" };
let playerBoss = { active: false, ownerId: null, ownerName: "", level: 1, hp: 0, maxHp: 0, attackers: {}, message: "" };
let viewerBoss = { active: false, ownerId: null, ownerName: "", image: "", giftName: "", skill: "", hp: 0, maxHp: 0, timeLeft: 0, durationSeconds: 0, attackers: {}, message: "" };

function saveData() { writeJson(CONFIG.saveFile || "scores.json", { scores, gifters, host }); }

function addEvent(text) {
  events.unshift({ time: new Date().toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" }), text });
  events = events.slice(0, 10);
}

function titleFor(level) {
  if (level >= 50) return "HAXUR GOD";
  if (level >= 30) return "LEGEND";
  if (level >= 20) return "BOSS SLAYER";
  if (level >= 10) return "WARRIOR";
  if (level >= 5) return "FIGHTER";
  return "ROOKIE";
}

function ensurePlayer(id, name) {
  if (!scores[id]) scores[id] = { name: name || id, points: 0, xp: 0, level: 1, title: "ROOKIE", damageMultiplier: 1, multiplierUntil: 0, healBlockUntil: 0, bossWins: 0, playerBossKills: 0, viewerBossKills: 0, viewerBossWins: 0 };
  if (name) scores[id].name = name;
  scores[id].points = Number(scores[id].points || 0);
  scores[id].xp = Number(scores[id].xp || 0);
  scores[id].level = Math.floor(scores[id].xp / 100) + 1;
  scores[id].title = titleFor(scores[id].level);
  return scores[id];
}

function addXp(id, amount) {
  const p = ensurePlayer(id);
  const old = p.level;
  p.xp += Number(amount || 0);
  p.level = Math.floor(p.xp / 100) + 1;
  p.title = titleFor(p.level);
  if (p.level > old) addEvent(p.name + " szintet lépett! LVL " + p.level);
}

function topScores() { return Object.values(scores).sort((a, b) => Number(b.points || 0) - Number(a.points || 0)).slice(0, 10); }
function topGifters() { return Object.values(gifters).sort((a, b) => Number(b.gifts || 0) - Number(a.gifts || 0)).slice(0, 3); }

function update() {
  io.emit("update", { question: currentQuestion, scores: topScores(), gifters: topGifters(), answeredCount: answered.size, timeLeft, questionActive, showAnswer, boss, nextBoss, bossSkill, loot, host, hostMode, events, combo, playerBoss, viewerBoss });
}

function findGift(map, name) {
  const clean = String(name || "").trim().toLowerCase();
  return Object.entries(map).find(([k]) => k.trim().toLowerCase() === clean);
}

function healBoss(amount) {
  boss.hp = Math.min(boss.maxHp, boss.hp + Number(amount || 0));
  if (playerBoss.active) playerBoss.hp = boss.hp;
  if (viewerBoss.active) viewerBoss.hp = boss.hp;
}

function addAttacker(list, id, name, dmg, owner) {
  if (!id || id === owner) return;
  if (!list[id]) list[id] = { name: name || id, damage: 0 };
  list[id].damage += dmg;
}

function damageBoss(amount, attackerId, attackerName) {
  const dmg = Math.max(0, Math.floor(Number(amount || 0)));
  if (!dmg) return;
  boss.hp = Math.max(0, boss.hp - dmg);

  if (viewerBoss.active) {
    viewerBoss.hp = boss.hp;
    addAttacker(viewerBoss.attackers, attackerId, attackerName, dmg, viewerBoss.ownerId);
    if (boss.hp <= 0) defeatViewerBoss();
    saveData(); update(); return;
  }

  if (playerBoss.active) {
    playerBoss.hp = boss.hp;
    addAttacker(playerBoss.attackers, attackerId, attackerName, dmg, playerBoss.ownerId);
    if (boss.hp <= 0) defeatPlayerBoss();
    saveData(); update(); return;
  }

  if (boss.hp > 0) checkBossSkill();

  if (boss.hp <= 0) {
    addEvent("Boss legyőzve! Minden játékos jutalmat kapott.");
    for (const id in scores) { scores[id].points += Number(CONFIG.rewards?.bossKillPoints || 10); addXp(id, Number(CONFIG.rewards?.bossKillXp || 50)); }
    host.legend += 1;
    boss.level += 1;
    boss.maxHp += Number(CONFIG.boss?.hpIncreasePerLevel || 1000);
    boss.hp = boss.maxHp;
    boss.name = (CONFIG.boss?.name || "HAXUR BOSS") + " LVL " + boss.level;
    nextBoss.hp = boss.maxHp + Number(CONFIG.boss?.hpIncreasePerLevel || 1000);
    combo = { count: 0, multiplier: 1, lastHitName: "", lastDamage: 0, critical: false };
    hostMode.message = "BOSS LEGYŐZVE";
    resetBossSkill();
    openLoot();
  }

  saveData(); update();
}

function checkBossSkill() {
  const p = boss.hp / boss.maxHp * 100;
  if (p <= 75 && !bossSkill.triggered75) { bossSkill.triggered75 = true; triggerSkill("electric", "ELECTRIC SHOCK", "A Boss megrázta az arénát!"); }
  if (p <= 50 && !bossSkill.triggered50) { bossSkill.triggered50 = true; triggerSkill("fire", "FIRE STORM", "Tűzvihar indult!"); }
  if (p <= 25 && !bossSkill.triggered25) { bossSkill.triggered25 = true; triggerSkill("death", "DEATH ZONE", "Nincs kegyelem!"); }
}

function resetBossSkill() { bossSkill = { active: false, type: "", title: "", message: "", triggered75: false, triggered50: false, triggered25: false }; }

function triggerSkill(type, title, message) {
  bossSkill.active = true; bossSkill.type = type; bossSkill.title = title; bossSkill.message = message;
  addEvent(title + " aktiválva!");
  if (type === "electric") timeLeft = Math.max(8, timeLeft - 5);
  if (type === "fire") hostMode.rage = true;
  if (type === "death") hostMode.doubleDamage = false;
  update();
  setTimeout(() => { bossSkill.active = false; bossSkill.type = ""; bossSkill.title = ""; bossSkill.message = ""; if (type === "fire") hostMode.rage = false; update(); }, 3500);
}

function playerMultiplier(id) {
  const p = scores[id];
  if (!p) return 1;
  if (Date.now() > Number(p.multiplierUntil || 0)) { p.damageMultiplier = 1; p.multiplierUntil = 0; return 1; }
  return Number(p.damageMultiplier || 1);
}

function calcDamage(id, base) {
  combo.count += 1;
  combo.multiplier = combo.count >= 10 ? 3 : combo.count >= 5 ? 2 : combo.count >= 3 ? 1.5 : 1;
  combo.critical = Math.random() < 0.15;
  let dmg = Number(base || 50) * combo.multiplier;
  if (combo.critical) dmg *= 3;
  if (hostMode.doubleDamage) dmg *= 2;
  dmg *= playerMultiplier(id);
  combo.lastDamage = Math.max(1, Math.floor(dmg));
  return combo.lastDamage;
}

function wrongAnswer(id, name) {
  combo.count = 0; combo.multiplier = 1; combo.critical = false;
  const p = ensurePlayer(id, name);
  if (Date.now() <= Number(p.healBlockUntil || 0)) { addEvent(p.name + " rossz választ adott, de heal block aktív."); return; }
  const heal = Number(currentQuestion.wrongHeal || CONFIG.boss?.wrongAnswerHeal || 25);
  healBoss(heal);
  addEvent(p.name + " rossz választ adott. Boss +" + heal + " HP.");
}

function handleAnswer(id, name, answer) {
  const clean = String(answer || "").trim().toUpperCase();
  if (clean === "LOOT") { claimLoot(id, name); return; }
  if (clean === "BOSS") { startPlayerBoss(id, name); return; }
  if (!questionActive) return;
  if (!["A", "B", "C", "D"].includes(clean)) return;
  if (answered.has(id)) return;
  answered.add(id);
  const p = ensurePlayer(id, name);

  if (clean === currentQuestion.correct) {
    const dmg = calcDamage(id, currentQuestion.damage || 50);
    p.points += combo.critical ? Number(CONFIG.rewards?.criticalPoints || 3) : Number(CONFIG.rewards?.correctAnswerPoints || 1);
    addXp(id, combo.critical ? Number(CONFIG.rewards?.criticalXp || 30) : Number(CONFIG.rewards?.correctAnswerXp || 10));
    host.energy += 1;
    combo.lastHitName = p.name;
    if (host.energy % 10 === 0) host.power += 1;
    damageBoss(dmg, id, p.name);
    addEvent(p.name + " helyes választ adott. Boss -" + dmg + " HP.");
  } else {
    wrongAnswer(id, p.name);
  }
  saveData(); update();
}

function applyGiftReward(id, name, giftName, value) {
  const p = ensurePlayer(id, name);
  const match = findGift(giftRewards, giftName);

  if (!match) {
    p.points += value; addXp(id, value * 5);
    combo.lastDamage = value * 10; combo.critical = value >= 10; combo.lastHitName = p.name;
    damageBoss(combo.lastDamage, id, p.name);
    addEvent(p.name + " ajándékot küldött: " + giftName);
    return;
  }

  const reward = match[1];
  if (reward.points) p.points += Number(reward.points);
  if (reward.xp) addXp(id, Number(reward.xp));
  if (reward.damage) { combo.lastDamage = Number(reward.damage); combo.critical = combo.lastDamage >= 500; combo.lastHitName = p.name; damageBoss(combo.lastDamage, id, p.name); }
  if (reward.multiplier && reward.damageMultiplierSeconds) { p.damageMultiplier = Number(reward.multiplier); p.multiplierUntil = Date.now() + Number(reward.damageMultiplierSeconds) * 1000; }
  if (reward.healBlockSeconds) p.healBlockUntil = Date.now() + Number(reward.healBlockSeconds) * 1000;
  addEvent(p.name + " gift rewardot kapott: " + (reward.message || giftName));
}

function avatar(data) { return data?.user?.profilePictureUrl || data?.user?.profilePicture?.url || data?.user?.avatarThumb || ""; }

function handleGift(id, name, giftName, repeatCount, diamondCount, profileUrl) {
  const value = Math.max(1, Number(diamondCount || repeatCount || 1));
  if (!gifters[id]) gifters[id] = { name: name || id, gifts: 0 };
  gifters[id].name = name || id; gifters[id].gifts += value;
  host.gifts += value; host.energy += value; host.power += Math.floor(value / 5);
  const vb = findGift(viewerBossGifts, giftName);
  if (vb && CONFIG.viewerBoss?.enabled) startViewerBoss(id, name, profileUrl, giftName, vb[1]);
  else applyGiftReward(id, name, giftName, value);
  saveData(); update();
}

function openLoot() {
  clearInterval(lootTimer);
  loot = { active: true, timeLeft: 10, claimed: {}, lastWinner: "", message: "LOOT CHEST AKTÍV! Írd be: LOOT" };
  addEvent("LOOT CHEST megjelent!");
  lootTimer = setInterval(() => {
    loot.timeLeft -= 1;
    if (loot.timeLeft <= 0) { clearInterval(lootTimer); loot.active = false; loot.timeLeft = 0; loot.message = "LOOT CHEST LEZÁRVA"; addEvent("LOOT CHEST lezárva."); }
    update();
  }, 1000);
  update();
}

function claimLoot(id, name) {
  if (!loot.active || loot.claimed[id]) return;
  const p = ensurePlayer(id, name);
  loot.claimed[id] = true; loot.lastWinner = p.name; loot.message = p.name + " lootot nyitott!";
  p.points += Number(CONFIG.rewards?.lootPoints || 5); addXp(id, Number(CONFIG.rewards?.lootXp || 40));
  addEvent(p.name + " lootot nyitott!");
  saveData(); update();
}

function startPlayerBoss(id, name) {
  if (!CONFIG.playerBoss?.enabled || viewerBoss.active) return;
  const p = ensurePlayer(id, name);
  if (p.level < Number(CONFIG.playerBoss.minLevel || 10)) { addEvent(p.name + " még nem elég erős Player Bossnak."); update(); return; }
  const hp = Number(CONFIG.playerBoss.baseHp || 1000) + p.level * Number(CONFIG.playerBoss.hpPerLevel || 250);
  playerBoss = { active: true, ownerId: id, ownerName: p.name, level: p.level, hp, maxHp: hp, attackers: {}, message: p.name + " PLAYER BOSS lett!" };
  boss = { name: p.name + " PLAYER BOSS", level: p.level, hp, maxHp: hp, image: CONFIG.boss?.image || "images/bosses/haxur.png", type: "player", ownerId: id, skill: "PLAYER POWER" };
  resetBossSkill(); addEvent(p.name + " átvette a Boss szerepet!"); update();
}

function startTopPlayerBoss() {
  const top = Object.entries(scores).map(([id, p]) => ({ id, p })).filter(x => x.p.level >= Number(CONFIG.playerBoss.minLevel || 10)).sort((a, b) => b.p.points - a.p.points)[0];
  if (!top) { addEvent("Nincs elég erős játékos Player Bossnak."); update(); return; }
  startPlayerBoss(top.id, top.p.name);
}

function defeatPlayerBoss() {
  for (const id in playerBoss.attackers) { const a = playerBoss.attackers[id]; const p = ensurePlayer(id, a.name); p.points += Number(CONFIG.playerBoss.rewardPoints || 25); p.playerBossKills += 1; addXp(id, Number(CONFIG.playerBoss.rewardXp || 150)); }
  addEvent(playerBoss.ownerName + " Player Boss legyőzve!");
  playerBoss = { active: false, ownerId: null, ownerName: "", level: 1, hp: 0, maxHp: 0, attackers: {}, message: "" };
  boss = makeBoss(); openLoot();
}

function saveBoss() { if (!viewerBoss.active) savedBoss = { boss: { ...boss }, playerBoss: JSON.parse(JSON.stringify(playerBoss)), nextBoss: { ...nextBoss } }; }
function restoreBoss() { if (savedBoss) { boss = { ...savedBoss.boss }; playerBoss = JSON.parse(JSON.stringify(savedBoss.playerBoss)); nextBoss = { ...savedBoss.nextBoss }; } else boss = makeBoss(); savedBoss = null; resetBossSkill(); }

function startViewerBoss(id, name, profile, giftName, cfg) {
  clearInterval(viewerBossTimer); saveBoss();
  const p = ensurePlayer(id, name);
  const hp = Number(cfg.hp || 1500);
  const duration = Number(cfg.durationSeconds || 20);
  const image = profile || CONFIG.boss?.image || "images/bosses/haxur.png";
  viewerBoss = { active: true, ownerId: id, ownerName: p.name, image, giftName, skill: cfg.skill || "VIEWER POWER", hp, maxHp: hp, timeLeft: duration, durationSeconds: duration, attackers: {}, message: cfg.message || "Viewer Boss érkezett" };
  playerBoss = { active: false, ownerId: null, ownerName: "", level: 1, hp: 0, maxHp: 0, attackers: {}, message: "" };
  boss = { name: p.name + " VIEWER BOSS", level: p.level, hp, maxHp: hp, image, type: "viewer", ownerId: id, skill: viewerBoss.skill };
  hostMode.message = p.name + " VIEWER BOSS ÉRKEZETT";
  addEvent(p.name + " Viewer Boss lett!");
  triggerSkill("electric", viewerBoss.skill, viewerBoss.message);
  viewerBossTimer = setInterval(() => { viewerBoss.timeLeft -= 1; if (viewerBoss.timeLeft <= 0) { finishViewerBoss(); return; } update(); }, 1000);
  update();
}

function finishViewerBoss() {
  if (!viewerBoss.active) return;
  clearInterval(viewerBossTimer);
  const p = scores[viewerBoss.ownerId];
  if (p) { p.points += 30; p.viewerBossWins += 1; addXp(viewerBoss.ownerId, 200); }
  addEvent(viewerBoss.ownerName + " megvédte a trónt!");
  viewerBoss = { active: false, ownerId: null, ownerName: "", image: "", giftName: "", skill: "", hp: 0, maxHp: 0, timeLeft: 0, durationSeconds: 0, attackers: {}, message: "" };
  restoreBoss(); saveData(); update();
}

function defeatViewerBoss() {
  for (const id in viewerBoss.attackers) { const a = viewerBoss.attackers[id]; const p = ensurePlayer(id, a.name); p.points += 15; p.viewerBossKills += 1; addXp(id, 100); }
  addEvent(viewerBoss.ownerName + " Viewer Boss legyőzve!");
  viewerBoss = { active: false, ownerId: null, ownerName: "", image: "", giftName: "", skill: "", hp: 0, maxHp: 0, timeLeft: 0, durationSeconds: 0, attackers: {}, message: "" };
  restoreBoss(); openLoot();
}

function startQuestion() {
  clearInterval(timer);
  timeLeft = Number(CONFIG.questionTime || 30);
  questionActive = true; showAnswer = false; answered.clear();
  combo = { count: 0, multiplier: 1, lastHitName: "", lastDamage: 0, critical: false };
  addEvent("Új kérdés indult."); update();
  timer = setInterval(() => { timeLeft -= 1; if (timeLeft <= 0) { clearInterval(timer); timeLeft = 0; questionActive = false; showAnswer = true; addEvent("Idő lejárt."); } update(); }, 1000);
}

function nextQuestion() {
  if (!questions.length) { addEvent("Nincs betöltött kérdés."); update(); return; }
  currentQuestion = questions[questionIndex];
  questionIndex = (questionIndex + 1) % questions.length;
  startQuestion();
}

const tiktok = new TikTokLiveConnection(CONFIG.tiktokUsername || "haxur001", {});

tiktok.connect().then(() => { console.log("TikTok Live csatlakozva: @" + CONFIG.tiktokUsername); addEvent("TikTok Live csatlakozva."); update(); }).catch(err => { console.log("TikTok hiba:", err.message || err); addEvent("TikTok kapcsolat nem aktív."); update(); });

tiktok.on(WebcastEvent.CHAT, data => { if (data.comment && data.user) handleAnswer(data.user.uniqueId, data.user.nickname || data.user.uniqueId, data.comment); });
tiktok.on(WebcastEvent.GIFT || "gift", data => {
  if (!data.user) return;
  const repeatEnd = data.repeatEnd ?? data.repeat_end;
  const giftType = data.giftType ?? data.gift?.type;
  if (giftType === 1 && repeatEnd === false) return;
  handleGift(data.user.uniqueId, data.user.nickname || data.user.uniqueId, data.giftName || data.gift?.name || "Gift", data.repeatCount || data.repeat_count || 1, data.diamondCount || data.gift?.diamond_count || data.gift?.diamondCount || data.repeatCount || 1, avatar(data));
});

app.post("/next-question", (req, res) => { nextQuestion(); res.json({ ok: true }); });
app.post("/reload-questions", (req, res) => { questions = readJson("questions.json", []); addEvent("Kérdések újratöltve."); update(); res.json({ ok: true }); });
app.post("/reload-gifts", (req, res) => { giftRewards = readJson("giftRewards.json", {}); viewerBossGifts = readJson("viewerBossGifts.json", {}); addEvent("Gift beállítások újratöltve."); update(); res.json({ ok: true }); });
app.post("/set-question", (req, res) => { currentQuestion = req.body; startQuestion(); res.json({ ok: true }); });
app.post("/stop", (req, res) => { clearInterval(timer); questionActive = false; showAnswer = true; update(); res.json({ ok: true }); });
app.post("/open-loot", (req, res) => { openLoot(); res.json({ ok: true }); });
app.post("/test-loot", (req, res) => { claimLoot("loot_" + Date.now(), req.body.name || "LootJatekos"); res.json({ ok: true }); });
app.post("/test-skill", (req, res) => { triggerSkill("electric", "ELECTRIC SHOCK", "Teszt Boss Skill aktiválva!"); res.json({ ok: true }); });
app.post("/test-answer", (req, res) => { handleAnswer("test_" + Date.now(), req.body.name || "TesztJatekos", req.body.answer || "A"); res.json({ ok: true }); });
app.post("/test-gift", (req, res) => { const value = Number(req.body.value || 10); handleGift("gift_" + Date.now(), req.body.name || "GiftJatekos", req.body.giftName || "Galaxy", value, value, req.body.profilePictureUrl || ""); res.json({ ok: true }); });
app.post("/test-viewer-boss", (req, res) => { const match = findGift(viewerBossGifts, req.body.giftName || "Galaxy"); if (match) startViewerBoss("viewerboss_test", req.body.name || "ViewerBossTeszt", "", req.body.giftName || "Galaxy", match[1]); res.json({ ok: !!match }); });
app.post("/stop-viewer-boss", (req, res) => { finishViewerBoss(); res.json({ ok: true }); });
app.post("/test-player-boss", (req, res) => { const p = ensurePlayer("playerboss_test", "PlayerBossTeszt"); p.level = Number(CONFIG.playerBoss?.minLevel || 10); p.xp = (p.level - 1) * 100; p.points = 100; startPlayerBoss("playerboss_test", p.name); res.json({ ok: true }); });

app.post("/host-power", (req, res) => {
  const action = req.body.action;
  if (action === "double") { hostMode.doubleDamage = !hostMode.doubleDamage; hostMode.message = hostMode.doubleDamage ? "DUPLA SEBZÉS AKTÍV" : "DUPLA SEBZÉS KI"; }
  if (action === "rage") { hostMode.rage = !hostMode.rage; hostMode.message = hostMode.rage ? "HOST RAGE AKTÍV" : "HOST RAGE KI"; }
  if (action === "heal") { healBoss(250); hostMode.message = "BOSS +250 HP"; }
  if (action === "damage") { combo.lastDamage = 250; combo.critical = true; combo.lastHitName = "HOST"; damageBoss(250, "HOST", "HOST"); hostMode.message = "HOST STRIKE -250 HP"; }
  if (action === "winner") { hostMode.winnerShow = true; hostMode.message = "HAXUR POWER AKTIVÁLVA"; }
  if (action === "playerboss") startTopPlayerBoss();
  if (hostMode.message) addEvent(hostMode.message);
  saveData(); update(); res.json({ ok: true });
});

app.post("/reset", (req, res) => {
  clearInterval(timer); clearInterval(lootTimer); clearInterval(viewerBossTimer);
  scores = {}; gifters = {}; host = { power: 0, legend: 0, energy: 0, gifts: 0 }; events = []; answered.clear();
  boss = makeBoss(); combo = { count: 0, multiplier: 1, lastHitName: "", lastDamage: 0, critical: false };
  loot = { active: false, timeLeft: 0, claimed: {}, lastWinner: "", message: "" };
  bossSkill = { active: false, type: "", title: "", message: "", triggered75: false, triggered50: false, triggered25: false };
  hostMode = { doubleDamage: false, rage: false, winnerShow: false, message: "" };
  playerBoss = { active: false, ownerId: null, ownerName: "", level: 1, hp: 0, maxHp: 0, attackers: {}, message: "" };
  viewerBoss = { active: false, ownerId: null, ownerName: "", image: "", giftName: "", skill: "", hp: 0, maxHp: 0, timeLeft: 0, durationSeconds: 0, attackers: {}, message: "" };
  questionActive = false; showAnswer = false; timeLeft = Number(CONFIG.questionTime || 30);
  saveData(); addEvent("Teljes játék resetelve."); update(); res.json({ ok: true });
});

io.on("connection", socket => {
  socket.emit("update", { question: currentQuestion, scores: topScores(), gifters: topGifters(), answeredCount: answered.size, timeLeft, questionActive, showAnswer, boss, nextBoss, bossSkill, loot, host, hostMode, events, combo, playerBoss, viewerBoss });
});

server.listen(3000, async () => {
  console.log("Fut: http://localhost:3000");
  console.log("Admin: http://localhost:3000/admin.html");
  if (CONFIG.autoOpenOverlay && openBrowser) openBrowser("http://localhost:3000");
  if (CONFIG.autoOpenAdmin && openBrowser) openBrowser("http://localhost:3000/admin.html");
  if (CONFIG.autoStartFirstQuestion) nextQuestion();
});

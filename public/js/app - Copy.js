const $ = id => document.getElementById(id);

function setBossHp(current, max) {
  const percent = Math.max(0, Math.min(100, current / max * 100));
  $("hpFill").style.width = percent + "%";
  $("hpText").innerText = current + " / " + max;
}

function showDamage(amount) {
  const el = $("damagePop");
  el.innerText = "-" + amount + " HP";
  el.classList.remove("damage-show");
  void el.offsetWidth;
  el.classList.add("damage-show");
}

function showEffect(text) {
  const el = $("bigEffect");
  el.innerText = text;
  el.classList.remove("effect-show");
  void el.offsetWidth;
  el.classList.add("effect-show");
}

window.HAXUR_UI = {
  setBossHp,
  showDamage,
  showEffect
};

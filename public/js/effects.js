window.HaxurEffects = {
    pulse() {
        const hud = document.getElementById("hudRoot");
        if (!hud) return;

        hud.classList.remove("hudPulse");
        void hud.offsetWidth;
        hud.classList.add("hudPulse");
    }
};
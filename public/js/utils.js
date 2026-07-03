window.HaxurUtils = {
    getEl(id) {
        return document.getElementById(id);
    },

    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    },

    setHtml(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = value;
    },

    cleanName(name) {
        if (!name) return "Viewer";
        return String(name).replace("@", "").trim() || "Viewer";
    },

    randomFrom(list) {
        return list[Math.floor(Math.random() * list.length)];
    },

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
};
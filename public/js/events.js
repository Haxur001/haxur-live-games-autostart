window.HaxurEvents = {
    maxItems: 8,

    add(message) {
        const feed = document.getElementById("eventFeed");
        if (!feed) return;

        const item = document.createElement("div");
        item.className = "feedItem popIn";
        item.textContent = message;

        feed.prepend(item);

        while (feed.children.length > this.maxItems) {
            feed.removeChild(feed.lastChild);
        }
    },

    clear() {
        const feed = document.getElementById("eventFeed");
        if (!feed) return;

        feed.innerHTML = '<div class="feedItem">Várakozás...</div>';
    }
};
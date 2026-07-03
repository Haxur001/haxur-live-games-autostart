window.HaxurTikTokConnector = {
    connected: false,

    init() {
        window.addEventListener("tiktokGift", event => {
            const data = event.detail || {};

            HaxurGameEngine.addGift(
                data.username || data.user || "Viewer",
                data.giftName || data.gift || "rose",
                data.repeatCount || data.count || 1
            );
        });

        window.addEventListener("tiktokLike", event => {
            const data = event.detail || {};

            HaxurGameEngine.addTap(
                data.username || data.user || "Viewer",
                data.likeCount || data.count || 1
            );
        });

        window.addEventListener("tiktokChat", event => {
            const data = event.detail || {};

            HaxurGameEngine.handleChat(
                data.username || data.user || "Viewer",
                data.comment || data.message || ""
            );
        });

        this.connected = true;
        HaxurEvents.add("TikTok Connector készen áll");
    }
};
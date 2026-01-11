// content.js (Debug Version)

// 1. injected.js をページに注入
const s = document.createElement('script');
s.src = chrome.runtime.getURL('injected.js');
s.onload = function() {
    this.remove();
    console.log("Creating link to page... (injected.js loaded)");
};
(document.head || document.documentElement).appendChild(s);

// 2. 拡張機能（Popup）からの連絡を待つ
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // ログ：Popupから連絡が来たか？
    console.log("📨 [Content] Received message from Popup:", request.action);

    if (request.action === "getDebugInfo") {
        
        // ★修正点：聞き耳を立ててから、呼びかける（順番を逆にしました）
        // 先にリスナーを作らないと、返事が速すぎた時に聞き逃すことがあります。
        
        const handler = (event) => {
            // ログ：ページ内（injected.js）から返事が来たか？
            if (event.data.type === "EVIDENCE_RES") {
                console.log("📦 [Content] Received data from Page. Relaying to Popup...");
                
                // リスナー解除
                window.removeEventListener("message", handler);
                
                // Popupへ返信
                sendResponse(event.data.payload);
            }
        };

        // 聞き耳セット
        window.addEventListener("message", handler);

        // ページ内（injected.js）へ「データ頂戴」と叫ぶ
        console.log("📣 [Content] Asking Page for evidence...");
        window.postMessage({ type: "EVIDENCE_REQ" }, "*");

        return true; // 非同期で返事をするための約束
    }
});
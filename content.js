// injected.js をページスコープで実行するために注入する。
// 理由: content script とページスコープは分離されているため、
// ページの実行コンテキストで動くコード（DOM やページ内変数にアクセスするもの）は
// 明示的に注入する必要がある。onloadで要素を削除して副作用を最小化する。
const s = document.createElement('script');
s.src = chrome.runtime.getURL('injected.js');
s.onload = function() {
    this.remove();
    console.log("Creating link to page... (injected.js loaded)");
};
(document.head || document.documentElement).appendChild(s);

// Popup からのリクエストを受け、ページ(injected)へブリッジする
// 注意: postMessage はクロスオリジンのやり取りになるため、
//       受信側で origin チェックができる設計にすること。
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // デバッグログ: どのアクションが来たか把握しやすくする
    console.log("📨 [Content] Received message from Popup:", request.action);

    if (request.action === "getDebugInfo") {
        
        // ここでの重要点:
        // - 先に window.message イベントを登録してから postMessage すること。
        //   そうしないと injected が即時応答した場合に受け取れない (race)。
        // - sendResponse を非同期で使うために `return true` を返す。
        const handler = (event) => {
            // 必要であれば event.origin を検証する
            if (event.data && event.data.type === "EVIDENCE_RES") {
                console.log("📦 [Content] Received data from Page. Relaying to Popup...");
                // 単発受け取りなのでリスナーは解除する
                window.removeEventListener("message", handler);
                // popup にデータを返す（非同期）
                sendResponse(event.data.payload);
            }
        };

        window.addEventListener("message", handler);

        // injected にデータ取得を要求する。origin は信頼できる相手のみ許可すること。
        console.log("📣 [Content] Asking Page for evidence...");
        window.postMessage({ type: "EVIDENCE_REQ" }, "*");

        return true; // sendResponse を非同期で使う合図
    }
});
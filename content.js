// content.js
// 外部ファイルとして injected.js を読み込ませる（これでCSP回避）

const s = document.createElement('script');
s.src = chrome.runtime.getURL('injected.js');
s.onload = function() {
    this.remove(); // 読み込み終わったらタグは消す
};
(document.head || document.documentElement).appendChild(s);


// ▼拡張機能との連絡係▼
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getDebugInfo") {
        window.postMessage({ type: "EVIDENCE_REQ" }, "*");
        
        const handler = (event) => {
            if (event.data.type === "EVIDENCE_RES") {
                window.removeEventListener("message", handler);
                sendResponse(event.data.payload);
            }
        };
        window.addEventListener("message", handler);
        return true; 
    }
});
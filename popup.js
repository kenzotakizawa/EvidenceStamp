// --- DOM要素 ---
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const snapBtn = document.getElementById('snapBtn');
const previewBtn = document.getElementById('previewBtn');
const resultImage = document.getElementById('resultImage');
const loadingText = document.getElementById('loadingMessage');
const spinner = document.getElementById('spinner');
const statusText = document.getElementById('statusText');

let finalDataUrl = null;

// HTML側で renderer.js が先に読み込まれているので、そのまま使える
const renderer = new EvidenceRenderer();

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    runEvidenceCapture();
});

snapBtn.addEventListener('click', runEvidenceCapture);

// --- メインフロー ---
async function runEvidenceCapture() {
    resetUI(); 

    try {
        const tabs = await chrome.tabs.query({active: true, lastFocusedWindow: true});
        
        if (tabs.length === 0) {
            throw new Error("対象のタブが見つかりません");
        }
        
        const tab = tabs[0];
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("応答がありません (Timeout)")), 3000)
        );

        const sendPromise = new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id, {action: "getDebugInfo"}, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (!response) {
                    reject(new Error("空の応答が返ってきました"));
                } else {
                    resolve(response);
                }
            });
        });

        const logs = await Promise.race([sendPromise, timeoutPromise]);

        statusText.textContent = "capturing screen...";
        loadingText.textContent = "Processing image...";
        captureAndRender(logs, tab.windowId);

    } catch (e) {
        console.error("Capture Failed:", e);
        let msg = e.message;
        if (msg.includes("Receiving end does not exist") || msg.includes("message port closed")) {
            msg = "ページをリロードしてください\n(Content Script未ロード)";
        }
        handleError(msg);
    }
}

function captureAndRender(logs, windowId) {
    chrome.tabs.captureVisibleTab(windowId, {format: "png"}, (dataUrl) => {
        if (chrome.runtime.lastError) {
            handleError("撮影失敗: " + chrome.runtime.lastError.message);
            return;
        }
        const img = new Image();
        img.onload = () => {
            try {
                // 職人に依頼
                finalDataUrl = renderer.render(img, logs);
                showResult(finalDataUrl);
            } catch (renderError) {
                handleError("描画エラー: " + renderError.message);
            }
        };
        img.src = dataUrl;
    });
}

// --- UI操作ヘルパー ---
function resetUI() {
    resultImage.style.display = 'none';
    downloadBtn.style.display = 'none';
    copyBtn.style.display = 'none';
    previewBtn.style.display = 'none';
    snapBtn.style.display = 'none';
    
    spinner.style.display = 'block';
    loadingText.style.display = 'block';
    loadingText.textContent = "Connecting to page...";
    statusText.textContent = "initializing...";
}

function showResult(url) {
    resultImage.src = url;
    spinner.style.display = 'none';
    loadingText.style.display = 'none';
    resultImage.style.display = 'block';
    statusText.textContent = "Ready";
    downloadBtn.style.display = 'inline-block';
    copyBtn.style.display = 'inline-block';
    snapBtn.style.display = 'inline-block';
    previewBtn.style.display = 'inline-block';
}

function handleError(msg) {
    spinner.style.display = 'none';
    loadingText.innerText = "⚠️ " + msg;
    statusText.textContent = "Error";
    snapBtn.style.display = 'block';
}

// --- ボタンイベント ---
downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = finalDataUrl;
    a.download = `evidence_${Date.now()}.png`;
    a.click();
});

copyBtn.addEventListener('click', async () => {
    try {
        const response = await fetch(finalDataUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "✅ Copied";
        setTimeout(() => copyBtn.textContent = originalText, 2000);
    } catch (err) {
        alert("Copy failed: " + err);
    }
});

previewBtn.addEventListener('click', () => {
    if (!finalDataUrl) return;
    chrome.storage.local.set({ "previewData": finalDataUrl }, () => {
        chrome.tabs.create({ url: "preview.html" });
    });
});
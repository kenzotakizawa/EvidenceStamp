// popup.js
// Controller 層: UI イベントと background/content コミュニケーションを扱う。
// 中堅向けメモ: UI は軽量に保ち、重い処理（描画など）は renderer に委譲する。

// タイムアウト時間 (ms)
// 補足: 3秒は短めに設定。ネットワークやページの遅延がある場合は UX との兼ね合いで調整する。
const TIMEOUT_MS = 3000;

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
    // デバッグ情報出力を強化
    const debugInfo = {
        uiLang: chrome.i18n.getUILanguage(),
        navigatorLang: navigator.language,
        effectiveLang: chrome.i18n.getMessage("@@ui_locale"),
        appName: chrome.i18n.getMessage("appName")
    };
    console.group("Evidence Stamp i18n Debug");
    console.log("Chrome UI Language:", debugInfo.uiLang);
    console.log("Navigator Language:", debugInfo.navigatorLang);
    console.log("Resolved UI Locale (@@ui_locale):", debugInfo.effectiveLang);
    console.log("Fetched appName:", debugInfo.appName);
    console.groupEnd();

    localizeUI();
    runEvidenceCapture();
});

function localizeUI() {
    // data-i18n 属性を持つ要素を置換
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            el.textContent = message;
        } else {
            console.warn(`[Evidence Stamp] i18n key not found: ${key}`);
        }
    });

    // data-i18n-title 属性を持つ要素の title を置換
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            el.title = message;
        } else {
            console.warn(`[Evidence Stamp] i18n title key not found: ${key}`);
        }
    });
}

snapBtn.addEventListener('click', runEvidenceCapture);

// --- メインフロー ---
async function runEvidenceCapture() {
    resetUI();

    try {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

        if (tabs.length === 0) {
            throw new Error(chrome.i18n.getMessage("errorTabNotFound"));
        }

        const tab = tabs[0];

        // 特殊なページ（chrome:// や拡張機能ページ）では動作しないためチェック
        if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:") || tab.url.includes("chrome.google.com/webstore")) {
            throw new Error(chrome.i18n.getMessage("errorReloadPage")); // または専用のメッセージ
        }

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(chrome.i18n.getMessage("errorNoResponse"))), TIMEOUT_MS)
        );

        const sendPromise = new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id, { action: "getDebugInfo" }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (!response) {
                    reject(new Error(chrome.i18n.getMessage("errorEmptyResponse")));
                } else {
                    resolve(response);
                }
            });
        });

        const logs = await Promise.race([sendPromise, timeoutPromise]);

        statusText.textContent = chrome.i18n.getMessage("statusCapturing");
        loadingText.textContent = chrome.i18n.getMessage("statusProcessing");
        captureAndRender(logs, tab.windowId);

    } catch (e) {
        console.error("Capture Failed:", e);
        let msg = e.message;
        const msgLower = msg.toLowerCase();

        // 接続エラー（Content Script未ロード、または特殊ページ）の判定を強化
        if (msgLower.includes("receiving end does not exist") ||
            msgLower.includes("message port closed") ||
            msgLower.includes("could not establish connection")) {
            msg = chrome.i18n.getMessage("errorReloadPage");
        }
        handleError(msg);
    }
}

function captureAndRender(logs, windowId) {
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError) {
            handleError(chrome.i18n.getMessage("errorCaptureFailed") + chrome.runtime.lastError.message);
            return;
        }
        const img = new Image();
        img.onload = () => {
            try {
                // 描画処理は外部の責務 (EvidenceRenderer) に委譲
                // 中堅向け: renderer.render は重い処理なので例外をハンドルする
                finalDataUrl = renderer.render(img, logs);
                showResult(finalDataUrl);
            } catch (renderError) {
                handleError(chrome.i18n.getMessage("errorRenderFailed") + renderError.message);
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
    loadingText.textContent = chrome.i18n.getMessage("statusConnecting");
    statusText.textContent = chrome.i18n.getMessage("statusInitializing");
}

function showResult(url) {
    resultImage.src = url;
    spinner.style.display = 'none';
    loadingText.style.display = 'none';
    resultImage.style.display = 'block';
    statusText.textContent = chrome.i18n.getMessage("statusReady");
    downloadBtn.style.display = 'inline-block';
    copyBtn.style.display = 'inline-block';
    snapBtn.style.display = 'inline-block';
    previewBtn.style.display = 'inline-block';
}

function handleError(msg) {
    spinner.style.display = 'none';
    loadingText.innerText = "⚠️ " + msg;
    statusText.textContent = chrome.i18n.getMessage("statusError");
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
        copyBtn.textContent = chrome.i18n.getMessage("btnCopied");
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
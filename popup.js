// --- DOM要素の取得 ---
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const snapBtn = document.getElementById('snapBtn');
const previewBtn = document.getElementById('previewBtn'); // ★追加
const resultImage = document.getElementById('resultImage');
const loadingText = document.getElementById('loadingMessage');
const spinner = document.getElementById('spinner');
const statusText = document.getElementById('statusText');

let finalDataUrl = null;

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    runEvidenceCapture();
});

// リトライボタン
snapBtn.addEventListener('click', runEvidenceCapture);

// ★ CSS変数を取得するヘルパー関数
function getCssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
}

// --- メイン処理 ---
async function runEvidenceCapture() {
    // UIリセット
    resultImage.style.display = 'none';
    downloadBtn.style.display = 'none';
    copyBtn.style.display = 'none';
    previewBtn.style.display = 'none'; // プレビューも隠す
    snapBtn.style.display = 'none';
    
    spinner.style.display = 'block';
    loadingText.style.display = 'block';
    loadingText.textContent = "initializing...";
    statusText.textContent = "initializing...";

    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        // Content Scriptへデータ要求
        chrome.tabs.sendMessage(tab.id, {action: "getDebugInfo"}, (logs) => {
            if (chrome.runtime.lastError || !logs) {
                handleError("エラー: ページをリロードしてください");
                return;
            }
            statusText.textContent = "capturing screen...";
            loadingText.textContent = "Processing image...";
            generateEvidenceImage(logs);
        });
    } catch (e) {
        handleError("接続エラー: " + e.message);
    }
}

function handleError(msg) {
    spinner.style.display = 'none';
    loadingText.textContent = msg;
    statusText.textContent = "Connection Error";
    snapBtn.style.display = 'block'; // リトライボタン表示
}

function generateEvidenceImage(data) {
    chrome.tabs.captureVisibleTab(null, {format: "png"}, (dataUrl) => {
        const img = new Image();
        img.onload = () => {
            drawDynamicCanvas(img, data);
        };
        img.src = dataUrl;
    });
}

// ★ キャンバス描画のメインロジック
function drawDynamicCanvas(img, data) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // --- 1. 色・フォント設定の読み込み ---
    const colorBg = getCssVar('--cv-bg-color');
    const colorPanel = getCssVar('--cv-panel-color');
    const colorTextMain = getCssVar('--cv-text-main');
    const colorTextSub = getCssVar('--cv-text-sub');
    const colorAccent = getCssVar('--cv-accent');
    const colorError = getCssVar('--cv-error');     // 赤
    const colorSuccess = getCssVar('--cv-success'); // 緑
    const colorLine = getCssVar('--cv-line');
    
    // ログ種類ごとの色（CSS変数がない場合は直接指定）
    const colorLogAction = "#4fc3f7"; // 水色（操作）
    const colorLogNetwork = "#ffb74d"; // オレンジ（通信）
    
    const fontMain = "bold 24px " + getCssVar('--cv-font-main');
    const fontLabel = "16px " + getCssVar('--cv-font-code');
    const fontValue = "14px " + getCssVar('--cv-font-code');
    const lineHeight = 20;

    // --- 2. レイアウト計算（描画前に高さを決定する） ---
    const padding = 24;
    const panelWidth = (img.width / 2) - (padding * 1.5); // 左右パネルの幅

    // A. 左パネル（環境情報）の高さ計算
    ctx.font = fontValue;
    const urlLines = wrapText(ctx, data.url, panelWidth - 30);
    const uaLines = wrapText(ctx, data.userAgent, panelWidth - 30);
    
    // 行数 * 高さ + 余白
    let leftHeight = 0;
    leftHeight += (1 + urlLines.length) * lineHeight + 10; // URL
    leftHeight += (1 + uaLines.length) * lineHeight + 10; // UA
    leftHeight += (1 + 1) * lineHeight + 10; // Viewport
    leftHeight += 40; // パディング等

    // B. 右パネル（ログ）の高さ計算
    let rightHeight = 40; // ヘッダー分
    const timeline = data.errors || [];
    
    if (timeline.length > 0) {
        timeline.forEach(item => {
            // プレフィックスを含めた文字数で計算
            let prefix = "";
            if (item.type === 'Console') prefix = "[ERR] ";
            else if (item.type === 'Network') prefix = "[NET] ";
            else if (item.type === 'Action') prefix = "[ACT] ";

            // PCのロケール（日本ならJST）に合わせて時刻文字列を作る
const time = new Date(item.time).toLocaleTimeString([], { hour12: false });
            const fullText = `${prefix}${time} ${item.message}`;
            
            const lines = wrapText(ctx, fullText, panelWidth - 30);
            rightHeight += (lines.length * lineHeight) + 8; // 行数分 + ログ間の隙間
        });
    } else {
        rightHeight += 60; // ログなしメッセージ分
    }

    // C. 最終的なフッターの高さを決定（左右の高い方に合わせる）
    const maxPanelHeight = Math.max(leftHeight, rightHeight, 150);
    const headerAreaHeight = 80;
    const footerHeight = headerAreaHeight + maxPanelHeight + padding;

    // --- 3. キャンバスサイズ確定・描画開始 ---
    canvas.width = img.width;
    canvas.height = img.height + footerHeight;

    // スクショ描画
    ctx.drawImage(img, 0, 0);

    // フッター背景
    ctx.fillStyle = colorBg;
    ctx.fillRect(0, img.height, canvas.width, footerHeight);

    let y = img.height + padding;

    // --- 4. ヘッダーエリア描画 ---
    ctx.fillStyle = colorAccent;
    ctx.fillRect(padding, y, 4, 24);
    
    ctx.fillStyle = colorTextMain;
    ctx.font = fontMain;
    ctx.textBaseline = "top";
    ctx.fillText("SYSTEM DIAGNOSTICS REPORT", padding + 15, y);
    
    const dateStr = new Date().toLocaleString();
    ctx.font = "18px " + getCssVar('--cv-font-code');
    ctx.fillStyle = colorTextSub;
    const dateWidth = ctx.measureText(dateStr).width;
    ctx.fillText(dateStr, canvas.width - padding - dateWidth, y + 4);

    y += 50; // パネル開始位置へ

    // --- 5. パネル枠描画 ---
    // 左パネル背景
    ctx.fillStyle = colorPanel;
    ctx.fillRect(padding, y, panelWidth, maxPanelHeight);
    ctx.strokeStyle = colorLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, y, panelWidth, maxPanelHeight);

    // 右パネル背景
    const rightX = padding + panelWidth + padding;
    ctx.fillStyle = colorPanel;
    ctx.fillRect(rightX, y, panelWidth, maxPanelHeight);
    ctx.strokeRect(rightX, y, panelWidth, maxPanelHeight);

    // --- 6. 左パネル（情報）中身描画 ---
    let ly = y + 15;
    let lx = padding + 15;
    
    // URL
    ctx.font = fontLabel;
    ctx.fillStyle = colorTextSub;
    ctx.fillText("TARGET URL:", lx, ly);
    ly += lineHeight;
    
    ctx.font = fontValue;
    ctx.fillStyle = colorTextMain;
    urlLines.forEach(line => {
        ctx.fillText(line, lx, ly);
        ly += lineHeight;
    });
    ly += 10;

    // UserAgent
    ctx.font = fontLabel;
    ctx.fillStyle = colorTextSub;
    ctx.fillText("BROWSER / OS:", lx, ly);
    ly += lineHeight;
    
    ctx.font = fontValue;
    ctx.fillStyle = colorTextMain;
    uaLines.forEach(line => {
        ctx.fillText(line, lx, ly);
        ly += lineHeight;
    });
    ly += 10;

    // Viewport
    ctx.font = fontLabel;
    ctx.fillStyle = colorTextSub;
    ctx.fillText("VIEWPORT:", lx, ly);
    ly += lineHeight;
    ctx.font = fontValue;
    ctx.fillStyle = colorTextMain;
    ctx.fillText(data.viewport, lx, ly);


    // --- 7. 右パネル（ログ）中身描画 ---
    let ry = y + 15;
    let rx = rightX + 15;

    // エラーがあるか判定（ConsoleかNetworkのエラーが含まれているか）
    const hasError = timeline.some(t => t.type === 'Console' || t.type === 'Network');

    ctx.font = "bold 16px sans-serif";
    if (hasError) {
        ctx.fillStyle = colorError;
        ctx.fillText(`⚠ DETECTED ISSUES (${timeline.length})`, rx, ry);
    } else {
        ctx.fillStyle = colorSuccess;
        ctx.fillText("✔ NO ERRORS (Actions Only)", rx, ry);
    }
    
    ry += 30;
    ctx.font = fontValue; // 14px Consolas

    if (timeline.length > 0) {
        timeline.forEach(item => {
            // ★種類によって色とプレフィックスを変える
            let logColor = colorTextMain;
            let prefix = "";

            if (item.type === 'Console') {
                logColor = colorError;  // 赤
                prefix = "[ERR] ";
            } else if (item.type === 'Network') {
                logColor = colorLogNetwork; // オレンジ
                prefix = "[NET] ";
            } else if (item.type === 'Action') {
                logColor = colorLogAction;  // 水色
                prefix = "[ACT] ";
            }

            ctx.fillStyle = logColor;

            const time = item.time.split('T')[1].split('.')[0];
            const fullText = `${prefix}${time} ${item.message}`;
            
            // 自動改行して描画
            const lines = wrapText(ctx, fullText, panelWidth - 30);
            
            lines.forEach(line => {
                ctx.fillText(line, rx, ry);
                ry += lineHeight;
            });
            ry += 8; // ログごとの間隔
        });
    } else {
        ctx.fillStyle = "#666";
        ctx.fillText("No logs captured yet.", rx, ry);
        ry += 20;
        ctx.fillText("Network status appears normal.", rx, ry);
    }

    // --- 8. 完了処理（表示・保存準備） ---
    finalDataUrl = canvas.toDataURL("image/png");
    resultImage.src = finalDataUrl;
    
    spinner.style.display = 'none';
    loadingText.style.display = 'none';
    resultImage.style.display = 'block';
    
    statusText.textContent = "Ready";
    
    // 全ボタンを表示
    downloadBtn.style.display = 'inline-block';
    copyBtn.style.display = 'inline-block';
    snapBtn.style.display = 'inline-block';
    previewBtn.style.display = 'inline-block'; // ★プレビューボタン表示
}

// ★ 長文を自動で改行して配列にするヘルパー関数
function wrapText(ctx, text, maxWidth) {
    const words = text.split(''); // 1文字ずつ分割（日本語対応）
    let lines = [];
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + word).width;
        if (width < maxWidth) {
            currentLine += word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

// --- ボタンイベント ---

// 保存
downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = finalDataUrl;
    a.download = `evidence_${Date.now()}.png`;
    a.click();
});

// コピー
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

// ★ プレビュー (新規追加)
previewBtn.addEventListener('click', () => {
    if (!finalDataUrl) return;
    
    // 画像データをストレージに保存してからタブを開く
    chrome.storage.local.set({ "previewData": finalDataUrl }, () => {
        chrome.tabs.create({ url: "preview.html" });
    });
});
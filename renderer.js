// 責務：データを受け取り、一枚の画像（DataURL）を返却することだけ。
// ★ポイント: export を削除して、普通のクラス定義にします
class EvidenceRenderer {
    constructor() {
        // 初期化時にスタイル情報を取得（キャッシュしておく）
        this.styles = this._loadStyles();
    }

    /**
     * スタイル定義（CSS変数）を読み込む
     */
    _loadStyles() {
        const getVar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
        
        return {
            bg: getVar('--cv-bg-color') || '#121212',
            panel: getVar('--cv-panel-color') || '#1e1e1e',
            textMain: getVar('--cv-text-main') || '#ffffff',
            textSub: getVar('--cv-text-sub') || '#aaaaaa',
            accent: getVar('--cv-accent') || '#00bcd4',
            error: getVar('--cv-error') || '#ff5252',
            success: getVar('--cv-success') || '#4caf50',
            line: getVar('--cv-line') || '#333333',
            fontMain: "bold 24px " + (getVar('--cv-font-main') || 'sans-serif'),
            fontLabel: "16px " + (getVar('--cv-font-code') || 'monospace'),
            fontValue: "14px " + (getVar('--cv-font-code') || 'monospace'),
            // ログ種類ごとの色
            logAction: "#4fc3f7",
            logNetwork: "#ffb74d"
        };
    }

    /**
     * メイン処理：画像とログデータを合成してDataURLを返す
     */
    render(img, data) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const s = this.styles; // 短縮用

        // --- レイアウト計算 ---
        const padding = 24;
        const panelWidth = (img.width / 2) - (padding * 1.5);
        const lineHeight = 20;

        // A. 左パネル高さ計算
        ctx.font = s.fontValue;
        const urlLines = this._wrapText(ctx, data.url || "", panelWidth - 30);
        const uaLines = this._wrapText(ctx, data.userAgent || "", panelWidth - 30);
        
        let leftHeight = 0;
        leftHeight += (1 + urlLines.length) * lineHeight + 10;
        leftHeight += (1 + uaLines.length) * lineHeight + 10;
        leftHeight += (1 + 1) * lineHeight + 10; 
        leftHeight += 40;

        // B. 右パネル高さ計算
        let rightHeight = 40;
        const timeline = data.errors || [];
        
        if (timeline.length > 0) {
            timeline.forEach(item => {
                const prefixMap = { 'Console': "[ERR] ", 'Network': "[NET] ", 'Action': "[ACT] " };
                const prefix = prefixMap[item.type] || "";
                const time = item.time ? new Date(item.time).toLocaleTimeString([], { hour12: false }) : "";
                const fullText = `${prefix}${time} ${item.message}`;
                
                const lines = this._wrapText(ctx, fullText, panelWidth - 30);
                rightHeight += (lines.length * lineHeight) + 8; 
            });
        } else {
            rightHeight += 60;
        }

        const maxPanelHeight = Math.max(leftHeight, rightHeight, 150);
        const headerAreaHeight = 80;
        const footerHeight = headerAreaHeight + maxPanelHeight + padding;

        // --- 描画実行 ---
        canvas.width = img.width;
        canvas.height = img.height + footerHeight;

        // スクショ描画
        ctx.drawImage(img, 0, 0);

        // フッター背景
        ctx.fillStyle = s.bg;
        ctx.fillRect(0, img.height, canvas.width, footerHeight);

        let y = img.height + padding;

        // ヘッダー
        ctx.fillStyle = s.accent;
        ctx.fillRect(padding, y, 4, 24);
        
        ctx.fillStyle = s.textMain;
        ctx.font = s.fontMain;
        ctx.textBaseline = "top";
        ctx.fillText("SYSTEM DIAGNOSTICS REPORT", padding + 15, y);
        
        const dateStr = new Date().toLocaleString();
        // フォント取得のフォールバックを追加
        const fontCode = getComputedStyle(document.body).getPropertyValue('--cv-font-code') || 'monospace';
        ctx.font = "18px " + fontCode.trim();
        
        ctx.fillStyle = s.textSub;
        const dateWidth = ctx.measureText(dateStr).width;
        ctx.fillText(dateStr, canvas.width - padding - dateWidth, y + 4);

        y += 50;

        // 左パネル（環境情報）
        this._drawPanelBox(ctx, padding, y, panelWidth, maxPanelHeight);
        
        let ly = y + 15;
        let lx = padding + 15;
        
        this._drawLabelValue(ctx, "TARGET URL:", urlLines, lx, ly, lineHeight);
        ly += (urlLines.length + 1) * lineHeight + 10;

        this._drawLabelValue(ctx, "BROWSER / OS:", uaLines, lx, ly, lineHeight);
        ly += (uaLines.length + 1) * lineHeight + 10;

        this._drawLabelValue(ctx, "VIEWPORT:", [data.viewport], lx, ly, lineHeight);


        // 右パネル（ログ）
        const rightX = padding + panelWidth + padding;
        this._drawPanelBox(ctx, rightX, y, panelWidth, maxPanelHeight);

        let ry = y + 15;
        let rx = rightX + 15;
        const hasError = timeline.some(t => t.type === 'Console' || t.type === 'Network');

        ctx.font = "bold 16px sans-serif";
        if (hasError) {
            ctx.fillStyle = s.error;
            ctx.fillText(`⚠ DETECTED ISSUES (${timeline.length})`, rx, ry);
        } else {
            ctx.fillStyle = s.success;
            ctx.fillText("✔ NO ERRORS (Actions Only)", rx, ry);
        }
        ry += 30;

        ctx.font = s.fontValue;

        if (timeline.length > 0) {
            timeline.forEach(item => {
                let logColor = s.textMain;
                let prefix = "";

                if (item.type === 'Console') {
                    logColor = s.error;
                    prefix = "[ERR] ";
                } else if (item.type === 'Network') {
                    logColor = s.logNetwork;
                    prefix = "[NET] ";
                } else if (item.type === 'Action') {
                    logColor = s.logAction;
                    prefix = "[ACT] ";
                }

                ctx.fillStyle = logColor;
                const time = item.time ? item.time.split('T')[1].split('.')[0] : "";
                const fullText = `${prefix}${time} ${item.message}`;
                
                const lines = this._wrapText(ctx, fullText, panelWidth - 30);
                
                lines.forEach(line => {
                    ctx.fillText(line, rx, ry);
                    ry += lineHeight;
                });
                ry += 8;
            });
        } else {
            ctx.fillStyle = "#666";
            ctx.fillText("No logs captured yet.", rx, ry);
        }

        return canvas.toDataURL("image/png");
    }

    // --- 内部ヘルパー ---

    _drawPanelBox(ctx, x, y, w, h) {
        ctx.fillStyle = this.styles.panel;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = this.styles.line;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
    }

    _drawLabelValue(ctx, label, lines, x, y, lh) {
        ctx.font = this.styles.fontLabel;
        ctx.fillStyle = this.styles.textSub;
        ctx.fillText(label, x, y);
        y += lh;
        
        ctx.font = this.styles.fontValue;
        ctx.fillStyle = this.styles.textMain;
        lines.forEach(line => {
            ctx.fillText(line, x, y);
            y += lh;
        });
    }

    _wrapText(ctx, text, maxWidth) {
        const words = String(text).split(''); // String変換で安全策
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
}
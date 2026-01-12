// EvidenceRenderer: 入力データを画像に合成して DataURL を返す責務に限定する
class EvidenceRenderer {
    constructor() {
        this.styles = this._loadStyles();
        
        this.LAYOUT = {
            PADDING: 24,           // 全体の余白
            LINE_HEIGHT: 20,       // 行間
            HEADER_HEIGHT: 80,     // タイトルエリアの高さ
            PANEL_GAP: 15,         // パネル内のアイテム間隔
            PANEL_PADDING_Y: 15,   // パネル内部の縦余白
            PANEL_PADDING_X: 15,   // パネル内部の横余白
            ACCENT_BAR_WIDTH: 4,   // アクセント棒の太さ
            ACCENT_BAR_HEIGHT: 24, // アクセント棒の高さ
            FOOTER_EXTRA: 40,      // フッターの予備スペース
            MIN_PANEL_HEIGHT: 150  // パネルの最低高さ
        };
    }

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
            logAction: "#4fc3f7",
            logNetwork: "#ffb74d"
        };
    }

    render(img, data) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const s = this.styles;
        const L = this.LAYOUT;

        const panelWidth = (img.width / 2) - (L.PADDING * 1.5);
        
        ctx.font = s.fontValue;

        const urlLines = this._wrapText(ctx, data.url || "", panelWidth - 30);
        const uaLines = this._wrapText(ctx, data.userAgent || "", panelWidth - 30);
        const storageKeys = Object.keys(data.storage || {});
        const inputLines = data.inputs || [];
        
        // 左パネル高さを計算
        let leftHeight = 0;
        leftHeight += (1 + urlLines.length) * L.LINE_HEIGHT + L.PANEL_GAP;
        leftHeight += (1 + uaLines.length) * L.LINE_HEIGHT + L.PANEL_GAP;
        leftHeight += (1 + 1) * L.LINE_HEIGHT + L.PANEL_GAP; 
        
        // 追加情報（Storage/Inputs）の高さ加算
        if (storageKeys.length > 0) {
            leftHeight += (1 + storageKeys.length) * L.LINE_HEIGHT + L.PANEL_GAP;
        }
        if (inputLines.length > 0) {
            leftHeight += (1 + inputLines.length) * L.LINE_HEIGHT + L.PANEL_GAP;
        }

        leftHeight += L.FOOTER_EXTRA;

        // 右パネル（ログ）高さ計算
        let rightHeight = L.FOOTER_EXTRA;
        const timeline = data.errors || [];
        
        if (timeline.length > 0) {
            timeline.forEach(item => {
                const prefixMap = { 'Console': "[ERR] ", 'Network': "[NET] ", 'Action': "[ACT] " };
                const prefix = prefixMap[item.type] || "";
                const time = item.time ? new Date(item.time).toLocaleTimeString([], { hour12: false }) : "";
                const fullText = `${prefix}${time} ${item.message}`;
                
                const lines = this._wrapText(ctx, fullText, panelWidth - 30);
                rightHeight += (lines.length * L.LINE_HEIGHT) + 8;
            });
        } else {
            rightHeight += 60;
        }

        const maxPanelHeight = Math.max(leftHeight, rightHeight, L.MIN_PANEL_HEIGHT);
        const footerHeight = L.HEADER_HEIGHT + maxPanelHeight + L.PADDING;

        // 描画実行
        canvas.width = img.width;
        canvas.height = img.height + footerHeight;

        ctx.drawImage(img, 0, 0);

        // フッター背景
        ctx.fillStyle = s.bg;
        ctx.fillRect(0, img.height, canvas.width, footerHeight);

        let y = img.height + L.PADDING;

        // ヘッダー
        ctx.fillStyle = s.accent;
        ctx.fillRect(L.PADDING, y, L.ACCENT_BAR_WIDTH, L.ACCENT_BAR_HEIGHT);
        
        ctx.fillStyle = s.textMain;
        ctx.font = s.fontMain;
        ctx.textBaseline = "top";
        ctx.fillText("SYSTEM DIAGNOSTICS REPORT", L.PADDING + 15, y);
        
        const dateStr = new Date().toLocaleString();
        const fontCode = getComputedStyle(document.body).getPropertyValue('--cv-font-code') || 'monospace';
        ctx.font = "18px " + fontCode.trim();
        
        ctx.fillStyle = s.textSub;
        const dateWidth = ctx.measureText(dateStr).width;
        ctx.fillText(dateStr, canvas.width - L.PADDING - dateWidth, y + 4);

        y += 50; 

        // 左パネル描画
        this._drawPanelBox(ctx, L.PADDING, y, panelWidth, maxPanelHeight);
        
        let ly = y + L.PANEL_PADDING_Y;
        let lx = L.PADDING + L.PANEL_PADDING_X;
        
        this._drawLabelValue(ctx, "TARGET URL:", urlLines, lx, ly, L.LINE_HEIGHT);
        ly += (urlLines.length + 1) * L.LINE_HEIGHT + L.PANEL_GAP;

        this._drawLabelValue(ctx, "BROWSER / OS:", uaLines, lx, ly, L.LINE_HEIGHT);
        ly += (uaLines.length + 1) * L.LINE_HEIGHT + L.PANEL_GAP;

        this._drawLabelValue(ctx, "VIEWPORT:", [data.viewport], lx, ly, L.LINE_HEIGHT);
        ly += (1 + 1) * L.LINE_HEIGHT + L.PANEL_GAP;

        // Storage情報の描画
        if (storageKeys.length > 0) {
            const storageLines = storageKeys.map(k => `${k}: ${data.storage[k]}`);
            this._drawLabelValue(ctx, "LOCAL STORAGE:", storageLines, lx, ly, L.LINE_HEIGHT);
            ly += (storageLines.length + 1) * L.LINE_HEIGHT + L.PANEL_GAP;
        }

        // 入力データの描画
        if (inputLines.length > 0) {
            this._drawLabelValue(ctx, "INPUT VALUES:", inputLines, lx, ly, L.LINE_HEIGHT);
            ly += (inputLines.length + 1) * L.LINE_HEIGHT + L.PANEL_GAP;
        }

        // 右パネル
        const rightX = L.PADDING + panelWidth + L.PADDING;
        this._drawPanelBox(ctx, rightX, y, panelWidth, maxPanelHeight);

        let ry = y + L.PANEL_PADDING_Y;
        let rx = rightX + L.PANEL_PADDING_X;
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
                if (item.type === 'Console') { logColor = s.error; prefix = "[ERR] "; }
                else if (item.type === 'Network') { logColor = s.logNetwork; prefix = "[NET] "; }
                else if (item.type === 'Action') { logColor = s.logAction; prefix = "[ACT] "; }

                ctx.fillStyle = logColor;
                const time = item.time ? item.time.split('T')[1].split('.')[0] : "";
                const fullText = `${prefix}${time} ${item.message}`;
                
                const lines = this._wrapText(ctx, fullText, panelWidth - 30);
                
                lines.forEach(line => {
                    ctx.fillText(line, rx, ry);
                    ry += L.LINE_HEIGHT;
                });
                ry += 8;
            });
        } else {
            ctx.fillStyle = "#666";
            ctx.fillText("No logs captured yet.", rx, ry);
        }

        return canvas.toDataURL("image/png");
    }

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
        const words = String(text).split('');
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
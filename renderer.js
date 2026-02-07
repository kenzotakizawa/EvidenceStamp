class EvidenceRenderer {
    constructor() {
        this.styles = this._loadStyles();
        this.LAYOUT = {
            PADDING: 24,
            LINE_HEIGHT: 20,
            HEADER_HEIGHT: 80,
            PANEL_GAP: 15,
            PANEL_PADDING_Y: 15,
            PANEL_PADDING_X: 15,
            ACCENT_BAR_WIDTH: 4,
            ACCENT_BAR_HEIGHT: 24,
            FOOTER_EXTRA: 40,
            MIN_PANEL_HEIGHT: 150
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

        // --- 1. データの正規化 ---
        ctx.font = s.fontValue; // 重要: 測定前にフォントを設定
        const processLines = (inputData, width, isObject = false) => {
            let lines = [];
            if (!inputData) return lines;
            if (isObject) {
                Object.keys(inputData).forEach(k => {
                    const val = inputData[k] !== null ? inputData[k] : 'null';
                    lines.push(...this._wrapText(ctx, `${k}: ${val}`, width));
                });
            } else if (Array.isArray(inputData)) {
                inputData.forEach(text => lines.push(...this._wrapText(ctx, text, width)));
            } else {
                lines.push(...this._wrapText(ctx, String(inputData), width));
            }
            return lines;
        };

        const timeline = data.errors || [];

        // --- 2. レイアウトの決定 (Intelligent Layout) ---
        // ログの量（行数）を見積もって、2カラムで行けるか判断する
        const estimatedLogLines = timeline.reduce((acc, item) => {
            return acc + this._wrapText(ctx, item.message, (img.width / 2) - 60).length;
        }, 0);

        const isSingleColumn = (img.width < 700) || (estimatedLogLines > 15);
        const panelWidth = isSingleColumn ? (img.width - L.PADDING * 2) : (img.width / 2) - (L.PADDING * 1.5);

        // --- 3. コンテンツ準備 ---
        const urlLines = processLines(data.url, panelWidth - 30);
        const uaLines = processLines(data.userAgent, panelWidth - 30);
        const vpLines = processLines(data.viewport, panelWidth - 30);
        const storageLines = processLines(data.storage, panelWidth - 30, true);
        const inputLines = processLines(data.inputs, panelWidth - 30);

        const rightLogLines = [];
        timeline.forEach(item => {
            let icon = "🌐";
            let color = s.textMain;
            if (item.type === 'Console') {
                if (item.message.includes('[Uncaught]') || item.message.includes('[Captured Error]')) {
                    icon = "🚫";
                    color = s.error;
                } else if (item.message.includes('[Captured Warn]')) {
                    icon = "⚠️";
                    color = s.logNetwork;
                } else {
                    icon = "💻";
                }
            } else if (item.type === 'Network') {
                icon = "📡";
                color = s.logNetwork;
            } else if (item.type === 'Action') {
                icon = "🖱️";
                color = s.logAction;
            }

            const time = item.time ? new Date(item.time).toLocaleTimeString([], { hour12: false }) : "";
            const prefix = `${icon} ${time} `;

            // 重要: プレフィックスの幅を測定し、残りの幅でコンテンツを折り返す
            const prefixWidth = ctx.measureText(prefix).width;
            const contentWidth = panelWidth - L.PANEL_PADDING_X * 2 - prefixWidth - 10;
            const wrapped = this._wrapText(ctx, item.message, contentWidth);

            rightLogLines.push({ lines: wrapped, type: item.type, color, prefix, indentWidth: prefixWidth });
        });

        // --- 4. 高さ計算 ---
        const calcPanelHeight = (lineArrays) => {
            let h = L.PANEL_PADDING_Y * 2;
            lineArrays.forEach(lines => {
                if (lines.length > 0) h += (lines.length + 1) * L.LINE_HEIGHT + L.PANEL_GAP;
            });
            return Math.max(h, L.MIN_PANEL_HEIGHT);
        };

        const leftHeight = calcPanelHeight([urlLines, uaLines, vpLines, storageLines, inputLines]);
        const rightHeight = L.PANEL_PADDING_Y * 2 + 30 + rightLogLines.reduce((acc, item) => acc + (item.lines.length * L.LINE_HEIGHT) + 8, 0);

        let footerContentHeight;
        if (isSingleColumn) {
            footerContentHeight = leftHeight + L.PADDING + rightHeight;
        } else {
            footerContentHeight = Math.max(leftHeight, rightHeight);
        }

        const footerHeight = L.HEADER_HEIGHT + footerContentHeight + L.PADDING;

        // --- 5. 描画 ---
        canvas.width = img.width;
        canvas.height = img.height + footerHeight;
        ctx.drawImage(img, 0, 0);

        ctx.fillStyle = s.bg;
        ctx.fillRect(0, img.height, canvas.width, footerHeight);

        let y = img.height + L.PADDING;

        // ヘッダー
        ctx.fillStyle = s.accent;
        ctx.fillRect(L.PADDING, y, L.ACCENT_BAR_WIDTH, L.ACCENT_BAR_HEIGHT);
        ctx.fillStyle = s.textMain;
        ctx.textBaseline = "top";
        const titleText = chrome.i18n.getMessage("reportTitle") || "Evidence Stamp";
        ctx.font = `bold ${img.width < 500 ? 18 : 24}px ${s.fontMain.split(' ').pop()}`;
        ctx.fillText(titleText, L.PADDING + 15, y);

        if (img.width > 500) {
            ctx.font = "16px monospace";
            ctx.fillStyle = s.textSub;
            const dateStr = new Date().toLocaleString();
            ctx.fillText(dateStr, canvas.width - L.PADDING - ctx.measureText(dateStr).width, y + 4);
        }

        y += 50;
        const startY = y;

        // 左パネル
        this._drawPanelBox(ctx, L.PADDING, y, panelWidth, leftHeight);
        let ly = y + L.PANEL_PADDING_Y;
        let lx = L.PADDING + L.PANEL_PADDING_X;

        const drawSection = (label, lines) => {
            if (lines.length === 0) return;
            this._drawLabelValue(ctx, label, lines, lx, ly, L.LINE_HEIGHT);
            ly += (lines.length + 1) * L.LINE_HEIGHT + L.PANEL_GAP;
        };

        drawSection(chrome.i18n.getMessage("labelUrl") || "URL", urlLines);
        drawSection(chrome.i18n.getMessage("labelUA") || "User Agent", uaLines);
        drawSection(chrome.i18n.getMessage("labelViewport") || "Viewport", vpLines);
        drawSection(chrome.i18n.getMessage("labelStorage") || "Storage", storageLines);
        drawSection(chrome.i18n.getMessage("labelInputs") || "Inputs", inputLines);

        // 描画位置の更新
        if (isSingleColumn) {
            y += leftHeight + L.PADDING;
        } else {
            lx = L.PADDING + panelWidth + L.PADDING;
        }

        // 右パネル
        this._drawPanelBox(ctx, lx, isSingleColumn ? y : startY, panelWidth, rightHeight);
        let ry = (isSingleColumn ? y : startY) + L.PANEL_PADDING_Y;
        let rx = lx + L.PANEL_PADDING_X;

        const hasError = timeline.some(t => t.type === 'Console' || t.type === 'Network');
        ctx.font = "bold 16px sans-serif";
        if (hasError) {
            ctx.fillStyle = s.error;
            ctx.fillText(chrome.i18n.getMessage("issuesDetected", [String(timeline.length)]) || `Issues: ${timeline.length}`, rx, ry);
        } else {
            ctx.fillStyle = s.success;
            ctx.fillText(chrome.i18n.getMessage("noErrors") || "No Errors", rx, ry);
        }
        ry += 30;

        ctx.font = s.fontValue;
        if (rightLogLines.length > 0) {
            rightLogLines.forEach(item => {
                ctx.fillStyle = item.color;
                // 最初の一行にプレフィックス（アイコン＋時間）を表示
                ctx.fillText(item.prefix + item.lines[0], rx, ry);
                ry += L.LINE_HEIGHT;
                // 二行目以降はインデントして表示
                const indent = item.indentWidth;
                for (let i = 1; i < item.lines.length; i++) {
                    ctx.fillText(item.lines[i], rx + indent, ry);
                    ry += L.LINE_HEIGHT;
                }
                ry += 8;
            });
        } else {
            ctx.fillStyle = "#666";
            ctx.fillText(chrome.i18n.getMessage("noLogs") || "No Logs", rx, ry);
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
        if (!text) return [""];
        const str = String(text);

        // maxWidth が異常な値の場合のセーフティ
        const safeMaxWidth = Math.max(maxWidth, 50);

        const chars = str.split('');
        let lines = [];
        let currentLine = "";

        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > safeMaxWidth && currentLine !== "") {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines.length > 0 ? lines : [""];
    }
}
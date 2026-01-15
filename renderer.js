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

        // パネル幅の計算（スマホなどの狭い画面に対応するため、最低幅を保証）
        const minPanelWidth = 300; 
        let panelWidth = (img.width / 2) - (L.PADDING * 1.5);
        if (panelWidth < minPanelWidth) {
            // 画像が狭すぎる場合は、パネル幅を画像幅全体に合わせる（シングルカラム化の準備）
            // ※今回は簡易的に、幅計算の安全マージンだけ確保
            panelWidth = Math.max(panelWidth, 100); 
        }

        ctx.font = s.fontValue;

        // --- 1. データの正規化と折り返し計算 ---

        // 汎用ヘルパー: データを文字列配列に変換して折り返す
        const processLines = (inputData, isObject = false) => {
            let lines = [];
            if (!inputData) return lines;

            if (isObject) {
                // オブジェクト { key: val } の場合
                Object.keys(inputData).forEach(k => {
                    const val = inputData[k] !== null ? inputData[k] : 'null';
                    const raw = `${k}: ${val}`;
                    lines.push(...this._wrapText(ctx, raw, panelWidth - 30));
                });
            } else if (Array.isArray(inputData)) {
                // 配列 ["text"] の場合
                inputData.forEach(text => {
                    lines.push(...this._wrapText(ctx, text, panelWidth - 30));
                });
            } else {
                // 文字列の場合
                lines.push(...this._wrapText(ctx, String(inputData), panelWidth - 30));
            }
            return lines;
        };

        const urlLines = processLines(data.url);
        const uaLines = processLines(data.userAgent);
        const vpLines = processLines(data.viewport); // ★修正: Viewportも折り返し計算対象に
        
        // Inputデータが配列でもオブジェクトでも対応できるように修正
        let inputLines = [];
        if (Array.isArray(data.inputs)) {
            inputLines = processLines(data.inputs);
        } else if (typeof data.inputs === 'object') {
            inputLines = processLines(data.inputs, true);
        }

        const storageLines = processLines(data.storage, true);

        // --- 2. 左パネル高さ計算 ---
        const calcHeight = (lineArrays) => {
            let h = 0;
            lineArrays.forEach(lines => {
                if (lines.length > 0) {
                    h += L.LINE_HEIGHT; // ラベル分
                    h += lines.length * L.LINE_HEIGHT; // 値分
                    h += L.PANEL_GAP;
                }
            });
            return h;
        };

        let leftHeight = calcHeight([urlLines, uaLines, vpLines, storageLines, inputLines]) + L.FOOTER_EXTRA;

        // --- 3. 右パネル高さ計算 ---
        let rightHeight = L.FOOTER_EXTRA;
        const timeline = data.errors || [];
        const rightLogLines = []; // 描画用に計算結果を保持

        if (timeline.length > 0) {
            timeline.forEach(item => {
                const prefixMap = { 'Console': "[ERR] ", 'Network': "[NET] ", 'Action': "[ACT] " };
                const prefix = prefixMap[item.type] || "";
                const time = item.time ? new Date(item.time).toLocaleTimeString([], { hour12: false }) : "";
                const fullText = `${prefix}${time} ${item.message}`;
                
                const lines = this._wrapText(ctx, fullText, panelWidth - 30);
                // 色分け描画用に情報を保存
                rightLogLines.push({ lines, type: item.type });
                
                rightHeight += (lines.length * L.LINE_HEIGHT) + 8; // +8はログ間のマージン
            });
        } else {
            rightHeight += 60;
        }

        const maxPanelHeight = Math.max(leftHeight, rightHeight, L.MIN_PANEL_HEIGHT);
        const footerHeight = L.HEADER_HEIGHT + maxPanelHeight + L.PADDING;

        // --- 4. 描画開始 ---
        canvas.width = img.width;
        canvas.height = img.height + footerHeight;

        ctx.drawImage(img, 0, 0);

        // フッター背景
        ctx.fillStyle = s.bg;
        ctx.fillRect(0, img.height, canvas.width, footerHeight);

        let y = img.height + L.PADDING;

        // --- ヘッダー（スマホ対応修正） ---
        ctx.fillStyle = s.accent;
        ctx.fillRect(L.PADDING, y, L.ACCENT_BAR_WIDTH, L.ACCENT_BAR_HEIGHT);
        
        ctx.fillStyle = s.textMain;
        ctx.textBaseline = "top";

        // タイトルのフォントサイズ調整
        const titleText = "SYSTEM DIAGNOSTICS REPORT";
        let titleSize = 24;
        if (img.width < 500) titleSize = 18; // スマホ幅なら小さく
        ctx.font = `bold ${titleSize}px ${s.fontMain.split(' ').pop()}`;
        ctx.fillText(titleText, L.PADDING + 15, y);
        
        // 日付の衝突回避
        const dateStr = new Date().toLocaleString();
        const dateFontCode = getComputedStyle(document.body).getPropertyValue('--cv-font-code') || 'monospace';
        ctx.font = "18px " + dateFontCode.trim();
        const dateWidth = ctx.measureText(dateStr).width;
        
        // 画面幅が十分ある場合のみ日付を表示
        if (img.width > 500) {
            ctx.fillStyle = s.textSub;
            ctx.fillText(dateStr, canvas.width - L.PADDING - dateWidth, y + 4);
        }

        y += 50; 

        // --- 左パネル描画 ---
        this._drawPanelBox(ctx, L.PADDING, y, panelWidth, maxPanelHeight);
        
        let ly = y + L.PANEL_PADDING_Y;
        let lx = L.PADDING + L.PANEL_PADDING_X;
        
        // ヘルパー関数で順次描画
        const drawSection = (label, lines) => {
            if (lines.length === 0) return;
            this._drawLabelValue(ctx, label, lines, lx, ly, L.LINE_HEIGHT);
            ly += (lines.length + 1) * L.LINE_HEIGHT + L.PANEL_GAP;
        };

        drawSection("TARGET URL:", urlLines);
        drawSection("BROWSER / OS:", uaLines);
        drawSection("VIEWPORT:", vpLines);
        drawSection("LOCAL STORAGE:", storageLines);
        drawSection("INPUT VALUES:", inputLines);

        // --- 右パネル描画 ---
        const rightX = L.PADDING + panelWidth + L.PADDING;
        // 右パネルが画面外にはみ出る場合は描画位置調整（超狭い画面対策）
        const safeRightX = (rightX + panelWidth > canvas.width) ? (canvas.width - panelWidth - L.PADDING) : rightX;
        
        this._drawPanelBox(ctx, safeRightX, y, panelWidth, maxPanelHeight);

        let ry = y + L.PANEL_PADDING_Y;
        let rx = safeRightX + L.PANEL_PADDING_X;
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

        if (rightLogLines.length > 0) {
            rightLogLines.forEach(item => {
                let logColor = s.textMain;
                if (item.type === 'Console') logColor = s.error;
                else if (item.type === 'Network') logColor = s.logNetwork;
                else if (item.type === 'Action') logColor = s.logAction;

                ctx.fillStyle = logColor;
                
                item.lines.forEach(line => {
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
        // null/undefined対策
        if (text === null || text === undefined) return [""];
        
        const str = String(text);
        const words = str.split(''); // 日本語も考慮して1文字ずつ分割
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
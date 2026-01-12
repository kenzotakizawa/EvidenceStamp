(function() {
    // Diagnostics agent loaded into page context.
    // 実行コンテキスト: ページの JS スコープで動作するため、ページ側の副作用を
    // 最小限に抑える設計にすること（グローバル変更は極力避ける）。
    console.log("Diagnostics agent loaded"); 

    const MAX_LOGS = 40;
    const STORAGE_KEY = "debug_evidence_timeline";
    const timeline = []; 
    
    // 元の console メソッドを保持（復帰やデバッグ用）
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    // 再入防止フラグ: console.error のラップで再帰を防ぐために使用
    let isCapturingLog = false;

    // 過去ログの復元（sessionStorage を簡易スナップショット用に使用）
    try {
        const savedData = sessionStorage.getItem(STORAGE_KEY);
        if (savedData) {
            const parsed = JSON.parse(savedData);
            if (Array.isArray(parsed)) {
                parsed.forEach(item => timeline.push(item));
                addLog('Action', '--- Page Reload / Init ---');
            }
        }
    } catch (e) { }

    // ログ追加ヘルパー
    function addLog(type, message) {
        if (message.length > 500) message = message.substring(0, 500) + "...";

        const newItem = {
            type: type,
            message: message,
            time: new Date().toISOString()
        };

        timeline.push(newItem);
        if (timeline.length > MAX_LOGS) timeline.shift();

        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(timeline));
        } catch (e) { }
    }

    // ユーザー操作の監視
    // 注意: ここでキャプチャする値はプライバシーに敏感なので、パスワードは除外する。
    function monitorUserActions() {
        document.addEventListener('click', (e) => {
            const el = e.target;
            const label = getElementLabel(el);
            const text = (el.innerText || el.value || "").substring(0, 20).replace(/\n/g, "");
            addLog('Action', `[Click] ${label}${text ? ` "${text}"` : ""}`);
        }, true);

        document.addEventListener('change', (e) => {
            const el = e.target;
            if (el.type === 'password') {
                addLog('Action', `[Input] ***** (Password field)`);
            } else {
                addLog('Action', `[Input] ${getElementLabel(el)} changed`);
            }
        }, true);
    }

    // SPA ナビゲーションの監視
    // 補足: history.pushState を上書きしているため、互換性の問題が出ないよう
    // 元の関数を保持して apply すること。
    function monitorHistory() {
        const originalPushState = history.pushState;
        history.pushState = function(...args) {
            const newUrl = (args[2] && typeof args[2] === 'string') ? args[2] : 'new-url';
            addLog('Action', `--- SPA Nav: ${newUrl} ---`);
            return originalPushState.apply(this, args);
        };
        window.addEventListener('popstate', () => {
            addLog('Action', `--- SPA Nav: (Back/Forward) -> ${location.pathname} ---`);
        });
    }

    function getElementLabel(el) {
        let str = el.tagName.toLowerCase();
        if (el.id) str += `#${el.id}`;
        if (el.className && typeof el.className === 'string') {
            const classes = el.className.split(' ').filter(c => c.trim().length > 0);
            if (classes.length > 0) str += `.${classes.join('.')}`;
        }
        return str;
    }

    // ネットワーク呼び出しの監視 (fetch / XMLHttpRequest)
    // NOTE: ここでラップするとページの挙動に影響する可能性があるため、
    // エラー時にのみログするなど非侵襲を心がける。
    function monitorNetwork() {
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            try {
                const response = await originalFetch.apply(this, args);
                if (!response.ok) {
                    const url = (typeof args[0] === 'string') ? args[0] : (args[0].url || 'Unknown');
                    addLog('Network', `[${response.status}] ${url}`);
                }
                return response;
            } catch (error) {
                addLog('Network', `[Failed] Fetch Error`);
                throw error;
            }
        };

        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(method, url) {
            // 内部プロパティに URL を保持（デバッグ用途）
            this._targetUrl = url;
            return originalOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function() {
            this.addEventListener('load', function() {
                if (this.status >= 400) {
                    addLog('Network', `[${this.status}] ${this._targetUrl}`);
                }
            });
            return originalSend.apply(this, arguments);
        };
    }

    // console.error をラップして内部に記録する
    // 重要: originalConsoleError をそのまま呼ぶとページ側で再捕捉され、
    // 再帰的にこのハンドラが呼ばれるケースがあるため注意（isCapturingLog で防止）。
    console.error = function(...args) {
        if (isCapturingLog) return;
        isCapturingLog = true;

        try {
            // ページの挙動を壊さない目的で、ここでは originalConsoleWarn にフォールバックして出力する。
            // 開発時は originalConsoleError を直接呼ぶオプションを検討して良い。
            originalConsoleWarn.apply(console, ["[Captured Error]", ...args]);

            const message = args.map(a => {
                if (typeof a === 'object' && a !== null) {
                    if (a instanceof Error) return `Error: ${a.message}`;
                    try { return JSON.stringify(a); } catch (e) { return '[Obj]'; }
                }
                return String(a);
            }).join(' ');

            addLog('Console', message);

        } catch (e) {
            // ログ処理中の失敗はここで握りつぶす（二次障害防止）
        } finally {
            isCapturingLog = false;
        }
    };

    // 監視を開始する（明示的に呼ぶことでユニットテスト時に抑止可能）
    monitorUserActions();
    monitorHistory();
    monitorNetwork();

    // ページ外からのデータ要求へ応答するためのハンドラ
    // ここではページ内スナップショット（ログ・ストレージ・フォーム）を返す。
    window.addEventListener("message", (event) => {
        if (event.data.type === "EVIDENCE_REQ") {
            
            // localStorage/sessionStorage のスナップショット取得
            const getStorageSnapshot = (storage) => {
                const data = {};
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    if (key === STORAGE_KEY) continue;
                    
                    let val = storage.getItem(key) || "";
                    if (val.length > 500) val = val.substring(0, 500) + "...(cut)";
                    data[key] = val;
                }
                return data;
            };

            // フォーム入力のスナップショット（パスワードは除外）
            const getFormSnapshot = () => {
                const inputs = document.querySelectorAll('input, select, textarea');
                const forms = [];
                inputs.forEach(el => {
                    if (el.type === 'password') return;
                    if (el.value && el.value.trim() !== "") {
                        let label = el.id || el.name || el.className || el.tagName;
                        let val = el.value;
                        if (val.length > 500) val = val.substring(0, 500) + "...(cut)";
                        forms.push(`${label}: ${val}`);
                    }
                });
                return forms;
            };

            // 応答は postMessage で返す。受信側は必要に応じて origin を検証すること。
            window.postMessage({
                type: "EVIDENCE_RES",
                payload: {
                    errors: timeline, 
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    viewport: window.innerWidth + 'x' + window.innerHeight,
                    storage: getStorageSnapshot(localStorage),
                    inputs: getFormSnapshot()
                }
            }, "*");
        }
    });

})();
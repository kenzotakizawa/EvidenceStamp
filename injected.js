(function () {
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

        // 同一アクションの集約ロジック
        const lastItem = timeline[timeline.length - 1];
        if (lastItem && lastItem.type === type && lastItem.message.startsWith(message)) {
            // 前回のメッセージに "(xN)" とついているか、あるいはメッセージ自体が同じ場合
            const match = lastItem.message.match(/\(x(\d+)\)$/);
            if (match) {
                const count = parseInt(match[1]) + 1;
                lastItem.message = `${message} (x${count})`;
                lastItem.time = new Date().toISOString(); // 時刻を最新に更新
            } else if (lastItem.message === message) {
                lastItem.message = `${message} (x2)`;
                lastItem.time = new Date().toISOString();
            } else {
                // メッセージが完全一致しない（集約対象外）場合は新規追加へ
                createNewLogItem(type, message);
            }
        } else {
            createNewLogItem(type, message);
        }

        if (timeline.length > MAX_LOGS) timeline.shift();

        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(timeline));
        } catch (e) { }
    }

    function createNewLogItem(type, message) {
        const newItem = {
            type: type,
            message: message,
            time: new Date().toISOString()
        };
        timeline.push(newItem);
    }

    // ユーザー操作の監視
    function monitorUserActions() {
        document.addEventListener('click', (e) => {
            const el = e.target;
            const label = getElementLabel(el);
            const text = (el.innerText || el.value || "").substring(0, 20).replace(/\n/g, "").trim();
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
    function monitorHistory() {
        const originalPushState = history.pushState;
        history.pushState = function (...args) {
            const newUrl = (args[2] && typeof args[2] === 'string') ? args[2] : 'new-url';
            addLog('Action', `--- SPA Nav: ${newUrl} ---`);
            return originalPushState.apply(this, args);
        };
        window.addEventListener('popstate', () => {
            addLog('Action', `--- SPA Nav: (Back/Forward) -> ${location.pathname} ---`);
        });
    }

    function getElementLabel(el) {
        if (!el) return "unknown";
        const tag = el.tagName.toLowerCase();

        // 単体要素の最も有力な識別子を特定する
        const getBaseSelector = (target) => {
            const testId = target.getAttribute('data-testid') || target.getAttribute('data-cy') || target.getAttribute('data-qa');
            if (testId) return `[testid="${testId}"]`;
            if (target.name) return `${target.tagName.toLowerCase()}[name="${target.name}"]`;

            const aria = target.getAttribute('aria-label') || target.getAttribute('role');
            if (aria) return `${target.tagName.toLowerCase()}[${aria}]`;

            if (target.id && !target.id.includes('__')) return `#${target.id}`;

            let sel = target.tagName.toLowerCase();
            if (target.className && typeof target.className === 'string') {
                const classes = target.className.split(' ').filter(c => c.trim().length > 0).slice(0, 2);
                if (classes.length > 0) sel += `.${classes.join('.')}`;
            }
            return sel;
        };

        // 親要素のコンテキスト
        const getParentLabel = (target) => {
            let p = target.parentElement;
            while (p && p !== document.body) {
                const pTestId = p.getAttribute('data-testid') || p.getAttribute('data-cy');
                if (pTestId) return `[testid="${pTestId}"]`;
                if (p.id && !p.id.includes('__')) return `#${p.id}`;
                p = p.parentElement;
            }
            return "";
        };

        const base = getBaseSelector(el);
        const parent = getParentLabel(el);

        return parent ? `${parent} > ${base}` : base;
    }

    // ネットワーク呼び出しの監視
    function monitorNetwork() {
        const originalFetch = window.fetch;
        window.fetch = async function (...args) {
            try {
                const response = await originalFetch.apply(this, args);
                if (!response.ok) {
                    const url = (typeof args[0] === 'string') ? args[0] : (args[0].url || 'Unknown');
                    addLog('Network', `[${response.status}] ${url}`);
                }
                return response;
            } catch (error) {
                // エラーの詳細化
                let msg = "[Failed] ";
                if (!navigator.onLine) msg += "Offline/Network Down";
                else if (error.name === 'AbortError') msg += "Request Aborted";
                else if (error.message.includes('CORS')) msg += "CORS Policy Blocked";
                else msg += error.message || "Fetch Error";

                addLog('Network', `[ERR] ${msg}`);
                throw error;
            }
        };

        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function (method, url) {
            this._targetUrl = url;
            return originalOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function () {
            this.addEventListener('load', function () {
                if (this.status >= 400) {
                    addLog('Network', `[${this.status}] ${this._targetUrl}`);
                }
            });
            this.addEventListener('error', function () {
                addLog('Network', `[ERR] XHR Network Error on ${this._targetUrl}`);
            });
            return originalSend.apply(this, arguments);
        };
    }

    // エラーハンドラの登録 (window.onerror / unhandledrejection)
    function monitorErrors() {
        window.addEventListener('error', (event) => {
            const msg = event.error ? event.error.message : event.message;
            addLog('Console', `[Uncaught] ${msg}`);
        });

        window.addEventListener('unhandledrejection', (event) => {
            const msg = event.reason ? (event.reason.message || String(event.reason)) : 'Promise Rejected';
            addLog('Console', `[Promise] ${msg}`);
        });

        // console.error と console.warn をラップ
        const wrapLog = (methodName, prefix) => {
            const original = console[methodName];
            console[methodName] = function (...args) {
                if (isCapturingLog) return;
                isCapturingLog = true;
                try {
                    const message = args.map(a => {
                        if (typeof a === 'object' && a !== null) {
                            if (a instanceof Error) return `Error: ${a.message}`;
                            try { return JSON.stringify(a); } catch (e) { return '[Obj]'; }
                        }
                        return String(a);
                    }).join(' ');
                    addLog('Console', message);
                } catch (e) {
                } finally {
                    isCapturingLog = false;
                }
            };
        };

        wrapLog('error', 'Error');
        wrapLog('warn', 'Warn');
    }

    // 監視を開始する
    monitorUserActions();
    monitorHistory();
    monitorNetwork();
    monitorErrors();

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
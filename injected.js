(function() {
    console.log("★★★ SPY FILE LOADED (Final Solution) ★★★"); 

    const MAX_LOGS = 40;
    const STORAGE_KEY = "debug_evidence_timeline";
    const timeline = []; 
    
    // ブラウザ本来のコンソール機能を確保
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    // 再入防止フラグ
    let isCapturingLog = false;

    // --- 0. 過去ログ復元 ---
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

    // --- ログ追加ヘルパー ---
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

    // --- 1. User Actions 監視 ---
    function spyUserActions() {
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

    // --- 2. SPA Navigation 監視 ---
    function spyHistory() {
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

    // --- 3. Network 監視 ---
    function spyNetwork() {
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
            this._spyUrl = url;
            return originalOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function() {
            this.addEventListener('load', function() {
                if (this.status >= 400) {
                    addLog('Network', `[${this.status}] ${this._spyUrl}`);
                }
            });
            return originalSend.apply(this, arguments);
        };
    }

    // --- 4. Console Error 監視（★ここが解決策） ---
    console.error = function(...args) {
        if (isCapturingLog) return;
        isCapturingLog = true;

        try {
            // 【対策】本来の赤色エラー(originalConsoleError)は呼ばない！
            // 代わりに黄色(warn)で出力して、サイト側の監視網をすり抜ける。
            originalConsoleWarn.apply(console, ["⚠️ [Error Caught by Spy]", ...args]);

            // 内部ログには「Console Error」として記録する（証拠は残る）
            const message = args.map(a => {
                if (typeof a === 'object' && a !== null) {
                    if (a instanceof Error) return `Error: ${a.message}`;
                    try { return JSON.stringify(a); } catch (e) { return '[Obj]'; }
                }
                return String(a);
            }).join(' ');

            addLog('Console', message);

        } catch (e) {
            // 無視
        } finally {
            isCapturingLog = false;
        }
    };

    // 全監視スタート
    spyUserActions();
    spyHistory();
    spyNetwork();

    // --- 5. データ送信 ---
    window.addEventListener("message", (event) => {
        if (event.data.type === "EVIDENCE_REQ") {
            window.postMessage({
                type: "EVIDENCE_RES",
                payload: {
                    errors: timeline, 
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    viewport: window.innerWidth + 'x' + window.innerHeight
                }
            }, "*");
        }
    });

})();
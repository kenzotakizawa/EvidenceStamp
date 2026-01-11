(function() {
    // 起動確認ログ（バージョンが分かるように変更）
    console.log("★★★ SPY FILE LOADED (SPA & Persistent) ★★★"); 

    const MAX_LOGS = 40; // ログ保存数
    const STORAGE_KEY = "debug_evidence_timeline"; // 保存用のキー
    const timeline = []; 
    const originalConsoleError = console.error;

    // --- 0. 過去のログを復元する処理 ---
    try {
        const savedData = sessionStorage.getItem(STORAGE_KEY);
        if (savedData) {
            const parsed = JSON.parse(savedData);
            if (Array.isArray(parsed)) {
                parsed.forEach(item => timeline.push(item));
                // リロードや別タブで開いた場合の区切り線
                addLog('Action', '--- Page Reload / Init ---');
            }
        }
    } catch (e) {
        console.error("Failed to load logs from storage", e);
    }

    // --- ログ追加用ヘルパー (保存機能付き) ---
    function addLog(type, message) {
        const newItem = {
            type: type, // 'Console', 'Network', 'Action'
            message: message,
            time: new Date().toISOString()
        };

        timeline.push(newItem);
        
        // 古いログを捨てる
        if (timeline.length > MAX_LOGS) timeline.shift();

        // SessionStorageに保存（ページ遷移対策）
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(timeline));
        } catch (e) {
            // 容量オーバーなどは無視
        }
    }

    // ==========================================
    // 1. User Actions の監視 (クリック & 入力)
    // ==========================================
    function spyUserActions() {
        document.addEventListener('click', (e) => {
            const el = e.target;
            const label = getElementLabel(el);
            const text = (el.innerText || el.value || "").substring(0, 20).replace(/\n/g, "");
            const textInfo = text ? ` "${text}"` : "";
            
            addLog('Action', `[Click] ${label}${textInfo}`);
        }, true);

        document.addEventListener('change', (e) => {
            const el = e.target;
            if (el.type === 'password') {
                addLog('Action', `[Input] ***** (Password field)`);
            } else {
                const label = getElementLabel(el);
                addLog('Action', `[Input] ${label} changed`);
            }
        }, true);
    }

    // ==========================================
    // 2. SPA Navigation の監視 (New!)
    // ==========================================
    function spyHistory() {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        // A. pushState (Next.js / React Router等が使用)
        history.pushState = function(...args) {
            const newUrl = (args[2] && typeof args[2] === 'string') ? args[2] : 'new-url';
            addLog('Action', `--- SPA Nav: ${newUrl} ---`);
            return originalPushState.apply(this, args);
        };

        // B. replaceState (URL書き換え)
        history.replaceState = function(...args) {
            // ノイズになる場合もあるが、デバッグ用として一応記録する
            // 必要なければコメントアウト可
            // const newUrl = (args[2] && typeof args[2] === 'string') ? args[2] : 'new-url';
            // addLog('Action', `[Nav] Replace -> ${newUrl}`); 
            return originalReplaceState.apply(this, args);
        };

        // C. ブラウザの「戻る/進む」ボタン検知
        window.addEventListener('popstate', () => {
            addLog('Action', `--- SPA Nav: (Back/Forward) -> ${location.pathname} ---`);
        });
    }

    // 要素ラベル生成ヘルパー
    function getElementLabel(el) {
        let str = el.tagName.toLowerCase();
        if (el.id) str += `#${el.id}`;
        if (el.className && typeof el.className === 'string') {
            const classes = el.className.split(' ').filter(c => c.trim().length > 0);
            if (classes.length > 0) str += `.${classes.join('.')}`;
        }
        return str;
    }

    // ==========================================
    // 3. Network Error の監視
    // ==========================================
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

    // ==========================================
    // 4. Console Error の監視
    // ==========================================
    console.error = function(...args) {
        originalConsoleError.apply(console, args);
        const message = args.map(a => {
            try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } 
            catch(e) { return '[Obj]'; }
        }).join(' ');
        addLog('Console', message.substring(0, 300));
    };

    // 全監視スタート
    spyUserActions();
    spyHistory(); // ★SPA監視を開始
    spyNetwork();

    // ==========================================
    // 5. データ送信
    // ==========================================
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
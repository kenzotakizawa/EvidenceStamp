# Evidence Stamp 🛡️

**The All-in-One Bug Reporting Tool for Chrome**
*One click to capture console logs, network errors, storage state, and user actions.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest_V3-blue)](https://developer.chrome.com/docs/extensions/mv3/)
[![Vanilla JS](https://img.shields.io/badge/Built%20with-Vanilla_JS-f7df1e)](https://developer.mozilla.org/ja/docs/Web/JavaScript)

> **[日本語の解説は下にあります (Scroll down for Japanese)](#-概要-overview)**

---

## 🇺🇸 Overview

**Evidence Stamp** is a Chrome extension designed to preserve "evidence" for bug reporting with a single click.

When non-developer members (CS, QA, Testers) encounter a bug, this tool automatically captures the **Console Logs**, **Network Errors**, **User Actions**, and **Storage State** that engineers need for investigation, and "burns" them directly into a screenshot.

This eliminates unproductive back-and-forth communication like "I can't reproduce it" or "Please provide environment details" between engineers and reporters.

## ✨ Key Features

### 1. Automatic Diagnostic Recording
Simultaneously with screen capture, the following information is retrieved and visualized:
* **Console Logs**: JavaScript errors and warnings (with infinite loop prevention).
* **Network Status**: API communication logs for 4xx/5xx errors.
* **User Actions**: Operation history such as clicks and inputs (last 40 events).
* **Storage & State**: Snapshots of LocalStorage and current form input values.

### 2. Full SPA Support
By hooking into the History API (`pushState`), it accurately tracks screen transitions in Single Page Applications (SPA) built with React, Vue, Next.js, etc.

### 3. Security & Privacy
* **100% Local Execution**: No log data is ever sent to external servers.
* **Data Protection**: Password input fields (`type="password"`) are automatically masked.
* **No Login Required**: Available immediately after installation without any SaaS contracts or account registration.

## 🛠 Tech Stack & Architecture

Built entirely with **Vanilla JS (ES2020+)**, without using any frameworks like React or Vue.
This eliminates the build process and achieves lightweight, high-speed performance.

* **Architecture**:
    * **Renderer Pattern**: Separation of drawing logic via the `EvidenceRenderer` class to improve maintainability.
    * **Diagnostics Agent**: Injection of an agent script (`injected.js`) into the page context to retrieve internal information inaccessible from the outside.
    * **Robustness**: Implemented safety mechanisms to prevent infinite loops (howling) by monitoring `console.error`.

## 🚀 Roadmap
* [ ] Migration to TypeScript (Enhancing type safety)
* [ ] Automatic redaction of sensitive information (e.g., credit card numbers)
* [ ] Implementation of E2E tests using Playwright

## 📦 Installation

Currently, this is a preview version prior to Chrome Web Store release.

1.  Clone or download this repository.
    ```bash
    git clone [https://github.com/YourUsername/evidence-stamp.git](https://github.com/YourUsername/evidence-stamp.git)
    ```
2.  Open Chrome and enter `chrome://extensions/` in the URL bar.
3.  Turn on **"Developer mode"** in the top right corner.
4.  Click **"Load unpacked"** and select the downloaded folder.

---

## 🇯🇵 概要 (Overview)

**Evidence Stamp** は、Webシステムのバグ報告に必要な「証拠（エビデンス）」をワンクリックで保全するChrome拡張機能です。

開発者ではないメンバー（CS、QA、テスター）がバグに遭遇した際、エンジニアが調査に必要とする**「コンソールログ」「通信エラー」「操作履歴」「ストレージ状態」**を、自動的にスクリーンショットに焼き込みます（Burn-in）。

これにより、「再現しません」「環境情報をください」といったエンジニアと報告者の間のコミュニケーションコストを削減します。

## ✨ 主な機能

### 1. 診断情報の全自動記録
画面キャプチャと同時に、以下の情報を取得して画像化します。
* **Console Logs**: JSエラーや警告（無限ループ防止機能付き）
* **Network Status**: 4xx/5xx エラーのAPI通信ログ
* **User Actions**: クリック、入力などの操作履歴（直近40件）
* **Storage & State**: LocalStorageのスナップショットと、入力中のフォーム値

### 2. SPA完全対応
History API (`pushState`) をフックすることで、React/Vue/Next.js などのSPA（シングルページアプリケーション）における画面遷移も正確に追跡します。

### 3. セキュリティ & プライバシー
* **完全ローカル動作**: ログデータは外部サーバーに一切送信されません。
* **機密情報の保護**: パスワード入力欄 (`type="password"`) は自動的にマスクされます。
* **ログイン不要**: SaaS契約やアカウント登録なしで、インストール後すぐに利用可能です。

## 🛠 技術スタックと設計思想

フレームワーク（React/Vue）を使用せず、**Vanilla JS (ES2020+)** のみで構築しています。
これにより、ビルドプロセスを排除し、軽量かつ高速な動作を実現しました。

* **Architecture**:
    * **Renderer Pattern**: `EvidenceRenderer` クラスにより描画ロジックを分離し、保守性を向上。
    * **Diagnostics Agent**: ページコンテキストに介入するエージェント (`injected.js`) を注入し、外部からでは取れない内部情報を取得。
    * **Robustness**: `console.error` の監視による無限ループ（ハウリング）を防止する安全装置を実装。

## 🚀 今後のロードマップ
* [ ] TypeScriptへの完全移行 (型安全性の強化)
* [ ] 機密情報の自動黒塗り機能 (クレジットカード番号など)
* [ ] PlaywrightによるE2Eテストの導入

## 📦 インストール方法

現状はChromeウェブストア公開前のプレビュー版です。

1.  このリポジトリをクローンまたはダウンロードします。
    ```bash
    git clone [https://github.com/YourUsername/evidence-stamp.git](https://github.com/YourUsername/evidence-stamp.git)
    ```
2.  Chromeを開き、URLバーに `chrome://extensions/` と入力します。
3.  右上の **「デベロッパーモード」** をONにします。
4.  **「パッケージ化されていない拡張機能を読み込む」** をクリックし、フォルダを選択します。

---

## 🔒 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

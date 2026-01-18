/**
 * help.js
 * Extracted from help.html to comply with Content Security Policy (V3)
 */
(function () {
    const uiLang = chrome.i18n.getUILanguage();
    console.log(`[Evidence Stamp Help] UI Language: ${uiLang}`);

    const langCode = uiLang.split('-')[0];
    if (langCode === 'ja') {
        document.body.classList.remove('lang-en');
        document.body.classList.add('lang-ja');
        document.title = "Evidence Stamp ヘルプ";
    } else {
        document.body.classList.remove('lang-ja');
        document.body.classList.add('lang-en');
        document.title = "Evidence Stamp Help";
    }
})();

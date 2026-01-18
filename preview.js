// ストレージから画像データを読み込んで表示する
chrome.storage.local.get("previewData", (result) => {
    if (result.previewData) {
        document.getElementById("previewImg").src = result.previewData;
    } else {
        alert(chrome.i18n.getMessage("errorNoPreviewData"));
    }
});

document.title = chrome.i18n.getMessage("previewTitle");
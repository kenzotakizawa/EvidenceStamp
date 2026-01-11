// ストレージから画像データを読み込んで表示する
chrome.storage.local.get("previewData", (result) => {
    if (result.previewData) {
        document.getElementById("previewImg").src = result.previewData;
    } else {
        alert("画像の読み込みに失敗しました。もう一度撮影してください。");
    }
});
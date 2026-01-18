// YouTube URLから動画IDを抽出する関数
window.extractVideoId = function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// URLパラメータにデータをエンコード（LZ-string圧縮を使用）
window.encodeToUrl = function encodeToUrl(data) {
    try {
        // dataがオブジェクトか配列かで判定
        const dataToEncode = Array.isArray(data) ? { references: data } : data;
        const jsonString = JSON.stringify(dataToEncode);
        // LZ-stringで圧縮してBase64エンコード（URI safe）
        const compressed = LZString.compressToEncodedURIComponent(jsonString);
        const url = new URL(window.location.href);
        url.searchParams.set('data', compressed);
        window.history.replaceState({}, '', url);
    } catch (e) {
        console.error('Failed to encode URL data', e);
    }
}

// URLパラメータからデータをデコード
window.decodeFromUrl = function decodeFromUrl() {
    const url = new URL(window.location.href);
    const data = url.searchParams.get('data');
    if (data) {
        try {
            // LZ-string圧縮データをデコード
            const decompressed = LZString.decompressFromEncodedURIComponent(data);
            if (decompressed) {
                const parsed = JSON.parse(decompressed);
                // 新形式（オブジェクト）か旧形式（配列）かを判定
                if (Array.isArray(parsed)) {
                    // 旧形式：配列のまま返す（互換性）
                    return parsed;
                } else {
                    // 新形式：オブジェクトを返す
                    return parsed;
                }
            }
            // 旧形式（非圧縮）との互換性のためフォールバック
            return JSON.parse(decodeURIComponent(atob(data)));
        } catch (e) {
            console.error('Failed to decode URL data', e);
        }
    }
    return null;
}

// 時間文字列を秒数に変換（1:06 → 66秒）
window.parseTimeString = function parseTimeString(input) {
    if (typeof input === 'number') return input;
    
    const str = String(input).trim();
    
    // 「分:秒」形式をチェック (例: "1:06", "0:45", "12:30.5")
    const timeMatch = str.match(/^(\d+):([0-5]?\d(?:\.\d+)?)$/);
    if (timeMatch) {
        const minutes = parseInt(timeMatch[1], 10);
        const seconds = parseFloat(timeMatch[2]);
        return minutes * 60 + seconds;
    }
    
    // 通常の数値として解析
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
}

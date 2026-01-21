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

// Google DriveのURLからファイルIDを抽出する関数
window.extractGoogleDriveFileId = function extractGoogleDriveFileId(url) {
    const patterns = [
        /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// Google DriveのURLを直リンク（Direct Link）に変換
// 注: 動画ファイルの場合は /uc?export=view の方が適している
window.convertGoogleDriveToDirectLink = function convertGoogleDriveToDirectLink(url) {
    const fileId = extractGoogleDriveFileId(url);
    if (!fileId) return null;
    
    // 動画ファイルの場合は export=view を使用（ストリーミング再生に対応）
    // export=download はダウンロードを強制するため、大きなファイルで問題が発生する可能性がある
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

// Google Driveの埋め込み用URL（iframe用）を生成
window.convertGoogleDriveToEmbedLink = function convertGoogleDriveToEmbedLink(url) {
    const fileId = extractGoogleDriveFileId(url);
    if (!fileId) return null;
    
    // iframe埋め込み用のpreview URLを使用
    // これが最も確実にGoogle Drive動画を表示できる方法
    return `https://drive.google.com/file/d/${fileId}/preview`;
}

// URLの種類を判定する関数
window.detectUrlType = function detectUrlType(url) {
    if (!url) return 'unknown';
    
    // YouTube判定
    if (extractVideoId(url)) {
        return 'youtube';
    }
    
    // Google Drive判定
    if (extractGoogleDriveFileId(url)) {
        return 'googledrive';
    }
    
    // 画像URL判定（拡張子チェック）
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)) {
        return 'image';
    }
    
    // 動画URL判定（拡張子チェック）
    if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) {
        return 'video';
    }
    
    return 'unknown';
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

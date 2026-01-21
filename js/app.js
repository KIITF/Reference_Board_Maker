window.App = function App() {
    const [references, setReferences] = React.useState([]);
    const [shareUrl, setShareUrl] = React.useState('');
    const [showOverlay, setShowOverlay] = React.useState(() => {
        const saved = localStorage.getItem('showOverlay');
        return saved ? JSON.parse(saved) : false;
    }); // デフォルトOFF
    const [showSettings, setShowSettings] = React.useState(false); // 設定メニュー表示状態
    const [enableStillImage, setEnableStillImage] = React.useState(() => {
        const saved = localStorage.getItem('enableStillImage');
        return saved ? JSON.parse(saved) : false;
    }); // 静止画有効フラグ（デフォルトOFF）
    const [enableCardAudio, setEnableCardAudio] = React.useState(() => {
        const saved = localStorage.getItem('enableCardAudio');
        return saved ? JSON.parse(saved) : false;
    }); // カード再生時の音声有効フラグ（デフォルトOFF）
    const [draggedIndex, setDraggedIndex] = React.useState(null);
    const [dragOverIndex, setDragOverIndex] = React.useState(null);
    const [hoveredRowIndex, setHoveredRowIndex] = React.useState(null);
    const [showFormAtIndex, setShowFormAtIndex] = React.useState(null);
    const [reinitTrigger, setReinitTrigger] = React.useState(0); // 再初期化トリガー
    const [globalMessage, setGlobalMessage] = React.useState(''); // 全体のメッセージ
    const [standardColumns, setStandardColumns] = React.useState([
        { id: 'location', name: '制作楽曲との対応箇所', fixed: false },
        { id: 'memo', name: '参考内容', fixed: false }
    ]); // 標準カラム
    const [customColumns, setCustomColumns] = React.useState([]); // カスタムカラム [{id, name}]
    const [showResetModal, setShowResetModal] = React.useState(false); // リセット確認モーダル
    const [notificationModal, setNotificationModal] = React.useState({ show: false, message: '' }); // 通知モーダル
    const [confirmModal, setConfirmModal] = React.useState({ show: false, message: '', onConfirm: null }); // 確認モーダル
    const [inputModal, setInputModal] = React.useState({ show: false, message: '', defaultValue: '', onConfirm: null }); // 入力モーダル
    const [shareMessage, setShareMessage] = React.useState(''); // 共有メッセージ
    const isResettingRef = React.useRef(false); // リセット中フラグ
    const previewTogglePlayRef = React.useRef(null);

    // 設定をlocalStorageに保存
    React.useEffect(() => {
        localStorage.setItem('showOverlay', JSON.stringify(showOverlay));
    }, [showOverlay]);

    React.useEffect(() => {
        localStorage.setItem('enableStillImage', JSON.stringify(enableStillImage));
    }, [enableStillImage]);

    React.useEffect(() => {
        localStorage.setItem('enableCardAudio', JSON.stringify(enableCardAudio));
    }, [enableCardAudio]);

    // URLパラメータからデータを読み込む
    React.useEffect(() => {
        const urlData = decodeFromUrl();
        if (urlData) {
            if (urlData.references && urlData.references.length > 0) {
                // order番号でソート（order番号がない場合は配列の順番を使用）
                const refsWithOrder = urlData.references.map((ref, idx) => ({
                    ...ref,
                    order: ref.order !== undefined ? ref.order : idx + 1
                }));
                const sorted = refsWithOrder.sort((a, b) => (a.order || 0) - (b.order || 0));
                setReferences(sorted);
            }
            if (urlData.globalMessage) {
                setGlobalMessage(urlData.globalMessage);
            }
            if (urlData.standardColumns) {
                setStandardColumns(urlData.standardColumns);
            }
            if (urlData.customColumns) {
                setCustomColumns(urlData.customColumns);
            }
        } else if (urlData && urlData.length > 0) {
            // 旧フォーマット対応
            const refsWithOrder = urlData.map((ref, idx) => ({
                ...ref,
                order: ref.order !== undefined ? ref.order : idx + 1
            }));
            setReferences(refsWithOrder);
        }
        
        // スクロール位置を復元
        const savedScrollY = sessionStorage.getItem('scrollPosition');
        if (savedScrollY) {
            setTimeout(() => {
                window.scrollTo(0, parseInt(savedScrollY, 10));
                sessionStorage.removeItem('scrollPosition');
            }, 100);
        }
    }, []);

    // スペースキーでプレビュー再生/停止（ブラウザのスクロールを防止）
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            // スペースキーが押され、かつ入力フィールド内でない場合
            if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                e.preventDefault(); // ブラウザのスクロールを防止
                
                // プレビュープレイヤーのみを再生/停止
                if (previewTogglePlayRef.current) {
                    previewTogglePlayRef.current();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 設定メニューを外側クリックで閉じる
    React.useEffect(() => {
        const handleClickOutside = (e) => {
            if (showSettings && !e.target.closest('.settings-menu') && !e.target.closest('.settings-button')) {
                setShowSettings(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showSettings]);

    // データが変更されたらURLを更新
    React.useEffect(() => {
        // リセット中はURL更新をスキップ
        if (isResettingRef.current) return;
        
        if (references.length > 0 || globalMessage || standardColumns.length > 0 || customColumns.length > 0) {
            const data = {
                references: references,
                globalMessage: globalMessage,
                standardColumns: standardColumns,
                customColumns: customColumns
            };
            encodeToUrl(data);
            setShareUrl(window.location.href);
        }
    }, [references, globalMessage, standardColumns, customColumns]);

    // 横スクロール同期
    React.useEffect(() => {
        const headerScroll = document.getElementById('scrollable-left');
        const cardRows = document.querySelectorAll('.card-scroll-left');
        
        if (!headerScroll) return;

        const syncScroll = (source) => {
            const scrollLeft = source.scrollLeft;
            if (source === headerScroll) {
                cardRows.forEach(row => {
                    if (row.scrollLeft !== scrollLeft) {
                        row.scrollLeft = scrollLeft;
                    }
                });
            } else {
                if (headerScroll.scrollLeft !== scrollLeft) {
                    headerScroll.scrollLeft = scrollLeft;
                }
                cardRows.forEach(row => {
                    if (row !== source && row.scrollLeft !== scrollLeft) {
                        row.scrollLeft = scrollLeft;
                    }
                });
            }
        };

        const handleHeaderScroll = () => syncScroll(headerScroll);
        headerScroll.addEventListener('scroll', handleHeaderScroll);

        const handleCardScroll = (e) => syncScroll(e.target);
        cardRows.forEach(row => {
            row.addEventListener('scroll', handleCardScroll);
        });

        return () => {
            headerScroll.removeEventListener('scroll', handleHeaderScroll);
            cardRows.forEach(row => {
                row.removeEventListener('scroll', handleCardScroll);
            });
        };
    }, [references]);

    const handleAdd = (newReference, insertAtIndex = null) => {
        // カスタムフィールドがない場合は空オブジェクトで初期化
        const customFields = newReference.customFields || {};
        customColumns.forEach(col => {
            if (!customFields[col.id]) {
                customFields[col.id] = '';
            }
        });
        const referenceWithCustomFields = { ...newReference, customFields };

        if (insertAtIndex !== null) {
            // insertAtIndex の位置に挿入
            const newReferences = [...references];
            newReferences.splice(insertAtIndex, 0, referenceWithCustomFields);
            // order番号を1から連番で再割り当て
            const reordered = newReferences.map((ref, idx) => ({
                ...ref,
                order: idx + 1
            }));
            setReferences(reordered);
        } else {
            // 先頭に追加
            const newReferences = [referenceWithCustomFields, ...references];
            // order番号を1から連番で再割り当て
            const reordered = newReferences.map((ref, idx) => ({
                ...ref,
                order: idx + 1
            }));
            setReferences(reordered);
        }
        setShowFormAtIndex(null);
    };

    const handleAddAt = (index) => {
        setShowFormAtIndex(index);
        setTimeout(() => {
            const formElement = document.querySelector(`[data-form-index="${index}"]`);
            if (formElement) {
                formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    };

    const handleCancelForm = () => {
        setShowFormAtIndex(null);
    };

    const handleAddColumn = () => {
        setInputModal({
            show: true,
            message: '新しい列の名前を入力してください：',
            defaultValue: '',
            onConfirm: (columnName) => {
                if (columnName && columnName.trim()) {
                    const newColumn = {
                        id: Date.now().toString(),
                        name: columnName.trim()
                    };
                    setCustomColumns([...customColumns, newColumn]);
                    // 既存のリファレンスにもこのフィールドを追加
                    const updatedReferences = references.map(ref => ({
                        ...ref,
                        customFields: { ...ref.customFields, [newColumn.id]: '' }
                    }));
                    setReferences(updatedReferences);
                }
            }
        });
    };

    const handleDeleteColumn = (columnId) => {
        setConfirmModal({
            show: true,
            message: 'この列を削除してもよろしいですか？',
            onConfirm: () => {
                setCustomColumns(customColumns.filter(col => col.id !== columnId));
                // 既存のリファレンスからもこのフィールドを削除
                const updatedReferences = references.map(ref => {
                    const newCustomFields = { ...ref.customFields };
                    delete newCustomFields[columnId];
                    return { ...ref, customFields: newCustomFields };
                });
                setReferences(updatedReferences);
            }
        });
    };

    const handleRenameColumn = (columnId, newName) => {
        setCustomColumns(customColumns.map(col => 
            col.id === columnId ? { ...col, name: newName } : col
        ));
    };

    const handleDeleteStandardColumn = (columnId) => {
        setConfirmModal({
            show: true,
            message: 'この列を削除してもよろしいですか？',
            onConfirm: () => {
                setStandardColumns(standardColumns.filter(col => col.id !== columnId));
            }
        });
    };

    const handleRenameStandardColumn = (columnId, newName) => {
        setStandardColumns(standardColumns.map(col => 
            col.id === columnId ? { ...col, name: newName } : col
        ));
    };

    const handleDelete = (id) => {
        setConfirmModal({
            show: true,
            message: 'この行を削除してもよろしいですか？',
            onConfirm: () => {
                const updated = references.filter(ref => ref.id !== id);
                setReferences(updated);
                if (updated.length === 0) {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('data');
                    window.history.replaceState({}, '', url);
                    setShareUrl('');
                }
            }
        });
    };

    const handleUpdate = (id, updates) => {
        const updated = references.map(ref => 
            ref.id === id ? { ...ref, ...updates } : ref
        );
        
        // order番号が変更された場合は並び替えてリロード
        if (updates.order !== undefined) {
            const targetRef = updated.find(ref => ref.id === id);
            let newOrder = updates.order;
            
            // 番号が要素数より大きい場合は最後に移動
            if (newOrder > references.length) {
                newOrder = references.length;
            }
            
            // 対象のリファレンスを除いた配列を作成
            const othersWithOrder = updated
                .filter(ref => ref.id !== id)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            
            // 新しい位置に挿入
            othersWithOrder.splice(newOrder - 1, 0, targetRef);
            
            // すべての要素にorder番号を1から連番で再割り当て
            const reordered = othersWithOrder.map((ref, idx) => ({
                ...ref,
                order: idx + 1
            }));
            
            setReferences(reordered);
        } else {
            setReferences(updated);
        }
    };

    const handleDragStart = (index) => {
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedIndex !== null) {
            setDragOverIndex(index);
        }
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        console.log('[App] handleDrop called, draggedIndex:', draggedIndex, 'dropIndex:', dropIndex);
        
        // ドラッグ元が無効、または自分自身の位置にドロップした場合
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDragOverIndex(null);
            return;
        }

        // 自分の直下の位置にドロップした場合（実質的に位置が変わらない）
        if (draggedIndex + 1 === dropIndex) {
            setDragOverIndex(null);
            return;
        }

        const newReferences = [...references];
        const [draggedItem] = newReferences.splice(draggedIndex, 1);
        
        // draggedIndex より後ろにドロップする場合、splice後にインデックスが1つ減る
        const adjustedDropIndex = dropIndex > draggedIndex ? dropIndex - 1 : dropIndex;
        newReferences.splice(adjustedDropIndex, 0, draggedItem);

        // order番号を再割り当て
        const reorderedReferences = newReferences.map((ref, idx) => ({
            ...ref,
            order: idx + 1
        }));

        setReferences(reorderedReferences);
        setDraggedIndex(null);
        setDragOverIndex(null);
        

    };

    const copyShareUrl = () => {
        navigator.clipboard.writeText(shareUrl).then(() => {
            setNotificationModal({ show: true, message: '共有URLをクリップボードにコピーしました！' });
        });
    };

    // ホームに戻る処理
    const handleResetToHome = () => {
        setShowResetModal(true);
    };

    const confirmReset = () => {
        // リセット中フラグをON
        isResettingRef.current = true;
        
        // URLパラメータをクリア（履歴を残さずに）
        window.history.replaceState({}, '', window.location.pathname);
        
        // stateを完全にリセット
        setReferences([]);
        setGlobalMessage('');
        setStandardColumns([
            { id: 'location', name: '制作楽曲との対応箇所', fixed: false },
            { id: 'memo', name: '参考内容', fixed: false }
        ]);
        setCustomColumns([]);
        setShareUrl('');
        setShowOverlay(false);
        setShowFormAtIndex(null);
        setShowResetModal(false);
        
        // 次のレンダリング後にフラグをOFF
        setTimeout(() => {
            isResettingRef.current = false;
        }, 0);
    };

    const cancelReset = () => {
        setShowResetModal(false);
    };

    // 共有ボタンハンドラー
    const handleShare = async () => {
        const currentUrl = window.location.href;
        try {
            await navigator.clipboard.writeText(currentUrl);
            setShareMessage('URLをコピーしました！');
            setTimeout(() => setShareMessage(''), 3000);
        } catch (err) {
            // フォールバック処理
            const textArea = document.createElement('textarea');
            textArea.value = currentUrl;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setShareMessage('URLをコピーしました！');
                setTimeout(() => setShareMessage(''), 3000);
            } catch (err2) {
                setNotificationModal({ show: true, message: 'URLのコピーに失敗しました' });
            }
            document.body.removeChild(textArea);
        }
    };

    // エクスポート機能：JSONファイルとしてダウンロード
    const handleExportToFile = () => {
        const data = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            references: references,
            globalMessage: globalMessage,
            standardColumns: standardColumns,
            customColumns: customColumns
        };

        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // ファイル名を生成（例: reference_board_20260121_143022.json）
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
        a.download = `reference_board_${dateStr}_${timeStr}.json`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // インポート機能：ファイルから読み込み
    const handleImportFromFile = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    // データの検証
                    if (!data.references || !Array.isArray(data.references)) {
                        setNotificationModal({ show: true, message: '無効なファイル形式です' });
                        return;
                    }
                    
                    // 確認モーダルを表示
                    setConfirmModal({
                        show: true,
                        message: `${data.references.length}件のリファレンスをインポートします。既存のデータは上書きされますがよろしいですか？`,
                        onConfirm: () => {
                            // データをインポート
                            if (data.references && data.references.length > 0) {
                                const refsWithOrder = data.references.map((ref, idx) => ({
                                    ...ref,
                                    order: ref.order !== undefined ? ref.order : idx + 1
                                }));
                                const sorted = refsWithOrder.sort((a, b) => (a.order || 0) - (b.order || 0));
                                setReferences(sorted);
                            }
                            if (data.globalMessage !== undefined) {
                                setGlobalMessage(data.globalMessage);
                            }
                            if (data.standardColumns) {
                                setStandardColumns(data.standardColumns);
                            }
                            if (data.customColumns) {
                                setCustomColumns(data.customColumns);
                            }
                        }
                    });
                } catch (error) {
                    console.error('Import error:', error);
                    setNotificationModal({ show: true, message: 'ファイルの読み込みに失敗しました' });
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    };

    return (
        <div className="min-h-screen">
            <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-6 shadow-lg">
                <div className="px-40">
                    <div className="flex items-center justify-between">
                        <div onClick={handleResetToHome} className="cursor-pointer hover:opacity-80 transition-opacity">
                            <h1 className="text-3xl font-bold">Reference Board Maker</h1>
                            {/* <h1 className="text-3xl font-bold">リファレンス・メイカー</h1> */}
                            <p className="text-blue-100 mt-1">映像リファレンス制作ツール</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <button
                                    onClick={handleShare}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all border-2 bg-transparent border-white text-white hover:bg-blue-700"
                                    title="現在のURLをコピー"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                    共有（URL）
                                </button>
                                {shareMessage && (
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1.5 bg-white text-blue-600 text-sm font-medium rounded-md shadow-lg whitespace-nowrap animate-fade-in-down">
                                        {shareMessage}
                                    </div>
                                )}
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setShowSettings(prev => prev === 'file' ? false : 'file')}
                                    className="settings-button flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all border-2 bg-transparent border-white text-white hover:bg-blue-700"
                                    title="ファイル共有"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V10" />
                                    </svg>
                                    共有（ファイル）
                                </button>
                                {showSettings === 'file' && (
                                    <div className="settings-menu absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50" onClick={(e) => e.stopPropagation()}>
                                        <div className="p-4">
                                            <h3 className="text-lg font-semibold text-gray-800 mb-4">ファイル共有</h3>
                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => {
                                                        handleExportToFile();
                                                        setShowSettings(false);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                    </svg>
                                                    
                                                    エクスポート
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleImportFromFile();
                                                        setShowSettings(false);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                                    </svg>
                                                    インポート
                                                </button>
                                                <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                                                    ※ JSONファイルでリファレンスボードを共有できます
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setShowSettings(prev => prev === 'settings' ? false : 'settings')}
                                    className="settings-button flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all border-2 bg-transparent border-white text-white hover:bg-blue-700"
                                    title="設定"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    設定
                                </button>
                                {showSettings === 'settings' && (
                                    <div className="settings-menu absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50" onClick={(e) => e.stopPropagation()}>
                                        <div className="p-4">
                                            <h3 className="text-lg font-semibold text-gray-800 mb-4">設定</h3>
                                            <div className="space-y-3">
                                                <div className="p-3 hover:bg-gray-50 rounded-lg">
                                                    <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                                                    <span className="text-gray-700">映像の上部を隠す</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={showOverlay}
                                                        onChange={(e) => setShowOverlay(e.target.checked)}
                                                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </label>
                                                    <p className="text-s text-amber-600 mt-3 leading-relaxed">※ 映像情報隠す用</p>
                                                </div>
                                                
                                                    
                                                
                                                <div className="p-3 hover:bg-gray-50 rounded-lg">
                                                    <label className="flex items-center justify-between cursor-pointer">
                                                        <span className="text-gray-700">Youtubeの静止画モードを有効</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={enableStillImage}
                                                            onChange={(e) => setEnableStillImage(e.target.checked)}
                                                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </label>
                                                    <p className="text-s text-amber-600 mt-3 leading-relaxed">
                                                        ※ 指定した時間から数秒ズレる可能性があります。
                                                    </p>
                                                </div>
                                                <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                                                    <span className="text-gray-700">動画のミュート解除</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={enableCardAudio}
                                                        onChange={(e) => setEnableCardAudio(e.target.checked)}
                                                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="app-container py-8">
                <div className="mb-6 max-w-3xl mx-auto">
                    <div className="   rounded-lg p-4">
                        {/* <label className="block text-sm font-medium text-gray-700 mb-2">全体のメッセージ</label> */}
                        <textarea
                            value={globalMessage}
                            onChange={(e) => setGlobalMessage(e.target.value)}
                            placeholder="リファレンス全体に関するメッセージを入力..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            rows="2"
                        />
                    </div>
                </div>

                {references.length === 0 ? (
                    <div className="text-center py-12">
                        {showFormAtIndex === 0 ? (
                            <div className="max-w-2xl mx-auto" data-form-index="0">
                                <InputForm 
                                    onAdd={(newRef) => handleAdd(newRef, 0)}
                                    onCancel={handleCancelForm}
                                    standardColumns={standardColumns}
                                    customColumns={customColumns}
                                    enableStillImage={enableStillImage}
                                    onTogglePlayReady={(togglePlay) => {
                                        previewTogglePlayRef.current = togglePlay;
                                    }}
                                />
                            </div>
                        ) : (
                            <>
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <p className="mt-4 text-gray-500 text-lg">まだリファレンスが追加されていません</p>
                                <button
                                    onClick={() => handleAddAt(0)}
                                    className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    最初のリファレンスを追加
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-sm text-gray-600">登録件数: <span className="font-semibold">{references.length}</span></p>
                            <button
                                onClick={handleAddColumn}
                                className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 text-sm font-medium"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                列を追加
                            </button>
                        </div>
                        <div className="overflow-hidden">
                            {/* テーブル全体のラッパー */}
                            <div className="flex">
                                {/* 左側のスクロール可能エリア */}
                                <div className="flex-1 overflow-x-auto" style={{minWidth: 0}} id="scrollable-left">
                                    <div style={{
                                        minWidth: (standardColumns.length + customColumns.length) >= 4 ? 'max-content' : 'auto'
                                    }}>
                                        {/* ヘッダー行 */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: (standardColumns.length + customColumns.length) >= 4
                                                ? `80px ${standardColumns.map(() => '200px').join(' ')} ${customColumns.map(() => '200px').join(' ')}`
                                                : `80px ${[...standardColumns, ...customColumns].map(() => '1fr').join(' ')}`,
                                            gap: '8px',
                                        padding: '12px 8px'
                                        }}>
                                            <div></div>
                                            {standardColumns.map(col => (
                                                <div key={col.id} className="p-2 font-semibold text-gray-700 text-center bg-gray-100 border border-gray-300 rounded relative group">
                                                    <input
                                                        type="text"
                                                        value={col.name}
                                                        onChange={(e) => handleRenameStandardColumn(col.id, e.target.value)}
                                                        className="w-full text-center bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                                                    />
                                                    <button
                                                        onClick={() => handleDeleteStandardColumn(col.id)}
                                                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="列を削除"
                                                        style={{fontSize: '16px', lineHeight: '20px', fontWeight: 'bold', padding: 0}}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                            {customColumns.map(col => (
                                                <div key={col.id} className="p-2 font-semibold text-gray-700 text-center bg-gray-100 border border-gray-300 rounded relative group">
                                                    <input
                                                        type="text"
                                                        value={col.name}
                                                        onChange={(e) => handleRenameColumn(col.id, e.target.value)}
                                                        className="w-full text-center bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                                                    />
                                                    <button
                                                        onClick={() => handleDeleteColumn(col.id)}
                                                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="列を削除"
                                                        style={{fontSize: '16px', lineHeight: '20px', fontWeight: 'bold', padding: 0}}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {/* 右側の固定エリア（参考映像） */}
                                <div className="flex-shrink-0" style={{width: 'calc(700px + 8px)'}}>
                                    <div style={{padding: '12px 8px'}}>
                                        <div className="p-2 font-semibold text-gray-700 text-center bg-gray-100 border border-gray-300 rounded">参考映像</div>
                                    </div>
                                </div>
                            </div>
                            {showFormAtIndex === 0 && (
                                <div className="p-6 bg-gray-50 border-b border-gray-200" data-form-index={0}>
                                    <InputForm 
                                            onAdd={(newRef) => handleAdd(newRef, 0)}
                                            onCancel={handleCancelForm}
                                            standardColumns={standardColumns}
                                            customColumns={customColumns}
                                            enableStillImage={enableStillImage}
                                            onTogglePlayReady={(togglePlay) => {
                                                previewTogglePlayRef.current = togglePlay;
                                            }}
                                        />
                                </div>
                            )}
                            {showFormAtIndex !== 0 && (
                                <div 
                                    className="add-row-button"
                                    onMouseEnter={() => setHoveredRowIndex(-1)}
                                    onMouseLeave={() => setHoveredRowIndex(null)}
                                >
                                    <div className="add-row-line"></div>
                                    {hoveredRowIndex === -1 && (
                                        <button 
                                            onClick={() => handleAddAt(0)}
                                            className="add-row-btn"
                                            title="ここに新しいリファレンスを追加"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            )}
                            {references.map((reference, index) => (
                                <React.Fragment key={reference.id}>
                                    <ReferenceCard
                                        key={reference.id}
                                        reference={reference}
                                        onDelete={handleDelete}
                                        onUpdate={handleUpdate}
                                        showOverlay={showOverlay}
                                        enableCardAudio={enableCardAudio}
                                        standardColumns={standardColumns}
                                        customColumns={customColumns}
                                        onDragStart={() => handleDragStart(index)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDrop={(e) => handleDrop(e, index)}
                                        isDragging={draggedIndex === index}
                                        isDragOver={dragOverIndex === index}
                                        reinitTrigger={reinitTrigger}
                                    />
                                    {index < references.length - 1 && showFormAtIndex === index + 1 && (
                                        <div className="p-6 bg-gray-50 border-b border-gray-200" data-form-index={index + 1}>
                                            <InputForm 
                                                    onAdd={(newRef) => handleAdd(newRef, index + 1)}
                                                    onCancel={handleCancelForm}
                                                    standardColumns={standardColumns}
                                                    customColumns={customColumns}
                                                    enableStillImage={enableStillImage}
                                                    onTogglePlayReady={(togglePlay) => {
                                                        previewTogglePlayRef.current = togglePlay;
                                                    }}
                                                />
                                        </div>
                                    )}
                                    {index < references.length - 1 && showFormAtIndex !== index + 1 && (
                                        <div 
                                            className="add-row-button"
                                            onMouseEnter={() => setHoveredRowIndex(index)}
                                            onMouseLeave={() => setHoveredRowIndex(null)}
                                        >
                                            <div className="add-row-line"></div>
                                            {hoveredRowIndex === index && (
                                                <button 
                                                    onClick={() => handleAddAt(index + 1)}
                                                    className="add-row-btn"
                                                    title="ここに新しいリファレンスを追加"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </React.Fragment>
                            ))}
                            {/* 一番下のドロップゾーン */}
                            <div 
                                className={`bottom-drop-zone ${dragOverIndex === references.length ? 'drag-over-bottom' : ''}`}
                                style={{minHeight: '40px', transition: 'all 0.2s ease', padding: '8px'}}
                                onDragOver={(e) => handleDragOver(e, references.length)}
                                onDrop={(e) => handleDrop(e, references.length)}
                            >
                                {dragOverIndex === references.length && (
                                    <div style={{
                                        height: '4px',
                                        background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                                        borderRadius: '2px',
                                        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.5)'
                                    }}></div>
                                )}
                            </div>
                        </div>
                        {showFormAtIndex === references.length && (
                            <div className="mt-6 p-6 bg-gray-50 rounded-lg" data-form-index={references.length}>
                                <InputForm 
                                    onAdd={(newRef) => handleAdd(newRef, references.length)}
                                    onCancel={handleCancelForm}
                                    standardColumns={standardColumns}
                                    customColumns={customColumns}
                                    enableStillImage={enableStillImage}
                                    onTogglePlayReady={(togglePlay) => {
                                        previewTogglePlayRef.current = togglePlay;
                                    }}
                                />
                            </div>
                        )}
                        {showFormAtIndex !== references.length && (
                            <div className="mt-6 text-center">
                                <button
                                    onClick={() => handleAddAt(references.length)}
                                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    リファレンスを追加
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>

            <footer className="bg-gray-800 text-gray-300 py-6 mt-12">
                <div className="app-container text-center">
                    <p className="text-sm">Video Reference Board - Loop Player Version</p>
                </div>
            </footer>

            {/* リセット確認モーダル */}
            {showResetModal && (
                <div className="modal-overlay" onClick={cancelReset}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title">ホームに戻りますか?</h2>
                        <p className="modal-message">編集中の内容が失われますがよろしいですか?</p>
                        <div className="modal-buttons">
                            <button className="modal-button modal-button-confirm" onClick={confirmReset}>
                                OK
                            </button>
                            <button className="modal-button modal-button-cancel" onClick={cancelReset}>
                                キャンセル
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 通知モーダル */}
            {notificationModal.show && (
                <div className="modal-overlay" onClick={() => setNotificationModal({ show: false, message: '' })}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title">通知</h2>
                        <p className="modal-message">{notificationModal.message}</p>
                        <div className="modal-buttons">
                            <button 
                                className="modal-button modal-button-confirm" 
                                onClick={() => setNotificationModal({ show: false, message: '' })}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 確認モーダル */}
            {confirmModal.show && (
                <div className="modal-overlay" onClick={() => setConfirmModal({ show: false, message: '', onConfirm: null })}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title">確認</h2>
                        <p className="modal-message">{confirmModal.message}</p>
                        <div className="modal-buttons">
                            <button 
                                className="modal-button modal-button-confirm" 
                                onClick={() => {
                                    if (confirmModal.onConfirm) confirmModal.onConfirm();
                                    setConfirmModal({ show: false, message: '', onConfirm: null });
                                }}
                            >
                                OK
                            </button>
                            <button 
                                className="modal-button modal-button-cancel" 
                                onClick={() => setConfirmModal({ show: false, message: '', onConfirm: null })}
                            >
                                キャンセル
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 入力モーダル */}
            {inputModal.show && (
                <div className="modal-overlay" onClick={() => setInputModal({ show: false, message: '', defaultValue: '', onConfirm: null })}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title">入力</h2>
                        <p className="modal-message">{inputModal.message}</p>
                        <input
                            type="text"
                            defaultValue={inputModal.defaultValue}
                            className="modal-input"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const value = e.target.value;
                                    if (inputModal.onConfirm) inputModal.onConfirm(value);
                                    setInputModal({ show: false, message: '', defaultValue: '', onConfirm: null });
                                } else if (e.key === 'Escape') {
                                    setInputModal({ show: false, message: '', defaultValue: '', onConfirm: null });
                                }
                            }}
                        />
                        <div className="modal-buttons">
                            <button 
                                className="modal-button modal-button-confirm" 
                                onClick={(e) => {
                                    const input = e.target.closest('.modal-content').querySelector('.modal-input');
                                    const value = input.value;
                                    if (inputModal.onConfirm) inputModal.onConfirm(value);
                                    setInputModal({ show: false, message: '', defaultValue: '', onConfirm: null });
                                }}
                            >
                                OK
                            </button>
                            <button 
                                className="modal-button modal-button-cancel" 
                                onClick={() => setInputModal({ show: false, message: '', defaultValue: '', onConfirm: null })}
                            >
                                キャンセル
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// YouTube IFrame API を読み込む
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// APIが読み込まれるまで待機してからReactアプリをレンダリング
let renderAttempts = 0;
const renderApp = () => {
    if (window.YT && window.YT.Player) {
        ReactDOM.render(<App />, document.getElementById('root'));
    } else if (renderAttempts < 50) {
        renderAttempts++;
        setTimeout(renderApp, 100);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderApp);
} else {
    renderApp();
}

window.ReferenceCard = function ReferenceCard({ reference, onDelete, onUpdate, showOverlay, enableCardAudio, standardColumns, customColumns, onDragStart, onDragEnd, onDragOver, onDrop, isDragging, isDragOver, reinitTrigger }) {
    const locationRef = React.useRef(null);
    const memoRef = React.useRef(null);

    const handleLocationBlur = (e) => {
        const newValue = e.target.textContent.trim();
        if (newValue !== reference.location) {
            onUpdate(reference.id, { location: newValue || '未設定' });
        }
    };

    const handleMemoBlur = (e) => {
        const newValue = e.target.textContent.trim();
        if (newValue !== reference.memo) {
            onUpdate(reference.id, { memo: newValue });
        }
    };

    const handleOrderChange = (e) => {
        const newValue = parseInt(e.target.value, 10);
        if (!isNaN(newValue) && newValue > 0 && newValue !== reference.order) {
            onUpdate(reference.id, { order: newValue });
        }
    };

    const handleOrderKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleOrderChange(e);
            e.target.blur();
        }
    };

    const handleCustomFieldBlur = (columnId, e) => {
        const newValue = e.target.textContent.trim();
        const currentValue = reference.customFields?.[columnId] || '';
        if (newValue !== currentValue) {
            onUpdate(reference.id, { 
                customFields: { ...reference.customFields, [columnId]: newValue }
            });
        }
    };

    const handleKeyDown = (e, type) => {
        // EnterキーでBlur（複数行入力を許可するため、Shift+Enterで改行）
        if (e.key === 'Enter' && !e.shiftKey && type === 'location') {
            e.preventDefault();
            e.target.blur();
        }
    };

    const handleDeleteClick = (e) => {
        e.stopPropagation();
        onDelete(reference.id);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div 
            className={`reference-card-row ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'drag-over-target' : ''}`}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <div className="flex" style={{padding: '0 8px 12px 8px', gap: '8px', alignItems: 'stretch'}}>
                {/* 左側のスクロール可能エリア */}
                <div className="flex-1 card-scroll-left overflow-x-hidden" style={{minWidth: 0, display: 'flex'}}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: ((standardColumns || []).length + (customColumns || []).length) >= 4
                            ? `80px ${(standardColumns || []).map(() => '200px').join(' ')} ${(customColumns || []).map(() => '200px').join(' ')}`
                            : `80px ${[...(standardColumns || []), ...(customColumns || [])].map(() => '1fr').join(' ')}`,
                        gap: '8px',
                        minWidth: ((standardColumns || []).length + (customColumns || []).length) >= 4 ? 'max-content' : 'auto',
                        alignItems: 'stretch',
                        width: '100%'
                    }}>
                        <div 
                            className="reference-card-cell drag-handle bg-white border border-gray-200 rounded cursor-move hover:bg-gray-100 relative group"
                            draggable={true}
                            onDragStart={(e) => {
                                e.stopPropagation();
                                onDragStart(e);
                            }}
                            onDragEnd={onDragEnd}
                            style={{padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', userSelect: 'none'}}
                        >
                            <input
                                type="number"
                                min="1"
                                defaultValue={reference.order || 1}
                                onKeyDown={handleOrderKeyDown}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full text-center border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                style={{fontSize: '14px', fontWeight: 'bold'}}
                            />
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                            <button
                                onClick={handleDeleteClick}
                                className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                title="行を削除"
                                style={{fontSize: '16px', lineHeight: '20px', fontWeight: 'bold', padding: 0}}
                            >
                                ×
                            </button>
                        </div>
                        {(standardColumns || []).map(col => {
                            const fieldValue = col.id === 'location' ? (reference.location || '未設定') : (reference.memo || '');
                            const handleBlur = col.id === 'location' ? handleLocationBlur : handleMemoBlur;
                            const totalColumns = (standardColumns || []).length + (customColumns || []).length;
                            return (
                                <div 
                                    key={col.id}
                                    className="reference-card-cell bg-white border border-gray-200 rounded"
                                    style={{
                                        padding: '24px',
                                        width: totalColumns >= 4 ? '200px' : 'auto',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    <div
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={handleBlur}
                                        onKeyDown={(e) => col.id === 'location' && handleKeyDown(e, 'location')}
                                        className="editable-text text-gray-800 whitespace-pre-wrap outline-none focus:bg-blue-50 focus:bg-opacity-30 rounded px-2 py-1"
                                        style={{cursor: 'text', flex: '1', minHeight: '0'}}
                                    >
                                        {fieldValue}
                                    </div>
                                </div>
                            );
                        })}
                        {(customColumns || []).map(col => {
                            const totalColumns = (standardColumns || []).length + (customColumns || []).length;
                            return (
                                <div 
                                    key={col.id}
                                    className="reference-card-cell bg-white border border-gray-200 rounded"
                                    style={{
                                        padding: '24px',
                                        width: totalColumns >= 4 ? '200px' : 'auto',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    <div
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleCustomFieldBlur(col.id, e)}
                                        className="editable-text text-gray-800 whitespace-pre-wrap outline-none focus:bg-blue-50 focus:bg-opacity-30 rounded px-2 py-1"
                                        style={{cursor: 'text', flex: '1', minHeight: '0'}}
                                    >
                                        {reference.customFields?.[col.id] || ''}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {/* 右側の固定エリア（参考動画） */}
                <div className="flex-shrink-0" style={{width: '700px'}}>
                    <div>
                        <div 
                            className="reference-card-cell bg-white border border-gray-200 rounded relative" 
                            style={{padding: '16px'}}
                        >
                            <div style={{display: 'flex', gap: '12px', alignItems: 'stretch'}}>
                                <div className="video-info-section" style={{flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px', padding: '8px'}}>
                                    <div>
                                        {/* <div className="text-xs text-gray-500 mb-1">動画タイトル</div> */}
                                        <a 
                                            href={`https://www.youtube.com/watch?v=${reference.videoId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline block"
                                            style={{lineHeight: '1.4', wordBreak: 'break-word'}}
                                        >
                                            {reference.videoTitle || '動画なし'}
                                        </a>
                                    </div>
                                    <div>
                                        {/* <div className="text-xs text-gray-500 mb-1">時間範囲</div> */}
                                        <div className="text-sm text-gray-700">
                                            {reference.isStillImage ? (
                                                // 静止画モード：1つの時間のみ表示
                                                <>
                                                    <a 
                                                        href={`https://www.youtube.com/watch?v=${reference.videoId}&t=${Math.floor(reference.stillImageTime)}s`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        {formatTime(reference.stillImageTime)}
                                                    </a>
                                                    <span className="ml-2 text-xs text-gray-500">（静止画）</span>
                                                    <div className="text-xs text-amber-600 mt-1">※ ダブルクリックして表示</div>
                                                </>
                                            ) : (
                                                // 動画モード：範囲を表示
                                                <>
                                                    <a 
                                                        href={`https://www.youtube.com/watch?v=${reference.videoId}&t=${Math.floor(reference.startSeconds)}s`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        {formatTime(reference.startSeconds)}
                                                    </a>
                                                    {' - '}
                                                    {formatTime(reference.endSeconds)}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div style={{flex: '1', minWidth: '0', overflow: 'hidden'}}>
                                    <VideoPlayer reference={reference} showOverlay={showOverlay} enableCardAudio={enableCardAudio} reinitTrigger={reinitTrigger} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

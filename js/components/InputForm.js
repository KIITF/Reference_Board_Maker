window.InputForm = function InputForm({ onAdd, onCancel, standardColumns, customColumns, onTogglePlayReady, enableStillImage = false }) {
    const [url, setUrl] = React.useState('');
    const [urlType, setUrlType] = React.useState('unknown'); // URLの種類を追跡
    const [videoId, setVideoId] = React.useState(null);
    const [videoTitle, setVideoTitle] = React.useState('');
    const [isStillImage, setIsStillImage] = React.useState(false);
    const [stillImageTime, setStillImageTime] = React.useState(0);
    const [startSeconds, setStartSeconds] = React.useState(0);
    const [endSeconds, setEndSeconds] = React.useState(10);
    const [location, setLocation] = React.useState('');
    const [memo, setMemo] = React.useState('');
    const [customFields, setCustomFields] = React.useState({});
    const [error, setError] = React.useState('');
    const [previewPlayer, setPreviewPlayer] = React.useState(null);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(300);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [isLooping, setIsLooping] = React.useState(false);
    const [isMuted, setIsMuted] = React.useState(true);
    const [timelineZoom, setTimelineZoom] = React.useState(1);
    const [timelineOffset, setTimelineOffset] = React.useState(0);
    const [isDragging, setIsDragging] = React.useState(false);
    const [viewStart, setViewStart] = React.useState(0);
    const timeUpdateInterval = React.useRef(null);
    const loopCheckInterval = React.useRef(null);
    const timelineRef = React.useRef(null);

    React.useEffect(() => {
        return () => {
            if (timeUpdateInterval.current) {
                clearInterval(timeUpdateInterval.current);
            }
            if (loopCheckInterval.current) {
                clearInterval(loopCheckInterval.current);
            }
            if (previewPlayer) {
                previewPlayer.destroy();
            }
        };
    }, []);

    const handleUrlChange = (e) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        
        // URLが空の場合はリセット
        if (!newUrl.trim()) {
            setUrlType('unknown');
            setVideoId(null);
            setError('');
            if (previewPlayer) {
                previewPlayer.destroy();
                setPreviewPlayer(null);
            }
            return;
        }
        
        // URLの種類を判定
        const detectedType = detectUrlType(newUrl);
        setUrlType(detectedType);
        
        console.log('URL Type detected:', detectedType, 'for URL:', newUrl);
        
        if (detectedType === 'youtube') {
            const id = extractVideoId(newUrl);
            if (id && id !== videoId) {
                setVideoId(id);
                setError('');
                if (previewPlayer) {
                    previewPlayer.destroy();
                    setPreviewPlayer(null);
                }
                setTimeout(() => initPreviewPlayer(id), 100);
            }
        } else if (detectedType === 'googledrive') {
            // Google Driveの場合はvideoIdをnullに設定
            setVideoId(null);
            setError('');
            if (previewPlayer) {
                previewPlayer.destroy();
                setPreviewPlayer(null);
            }
            // Google Drive用のプレビューを初期化（iframe使用）
            // 注意：video要素ではなくiframeを使用するため、別処理
            setTimeout(() => initGoogleDrivePreview(newUrl), 100);
        } else {
            setVideoId(null);
            setError('YouTubeまたはGoogle DriveのURLを入力してください');
        }
    };

    const initPreviewPlayer = (id) => {
        const checkYouTubeAPI = setInterval(() => {
            if (window.YT && window.YT.Player) {
                clearInterval(checkYouTubeAPI);
                
                const player = new window.YT.Player('preview-player', {
                    videoId: id,
                    playerVars: {
                        controls: 0,
                        modestbranding: 1,
                        rel: 0,
                        mute: 1
                    },
                    events: {
                        onReady: (event) => {
                            setPreviewPlayer(event.target);
                            const videoDuration = event.target.getDuration();
                            setDuration(videoDuration);
                            setEndSeconds(Math.min(10, videoDuration));
                            startTimeTracking(event.target);
                            // 動画タイトルを取得
                            const videoData = event.target.getVideoData();
                            if (videoData && videoData.title) {
                                setVideoTitle(videoData.title);
                            }
                        },
                        onStateChange: (event) => {
                            if (event.data === window.YT.PlayerState.PLAYING) {
                                setIsPlaying(true);
                                startTimeTracking(event.target);
                            } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
                                setIsPlaying(false);
                                stopLoopCheck();
                            }
                        }
                    }
                });
            }
        }, 100);
    };

    const initGoogleDrivePreview = (driveUrl) => {
        const embedUrl = convertGoogleDriveToEmbedLink(driveUrl);
        if (!embedUrl) {
            setError('Google DriveのURLが無効です');
            console.error('Invalid Google Drive URL:', driveUrl);
            return;
        }
        
        console.log('=== Initializing Google Drive Preview (iframe) ===');
        console.log('Original URL:', driveUrl);
        console.log('Embed URL:', embedUrl);
        
        // Google Driveの場合、タイトルが未入力なら空のままにする（ユーザーが入力する）
        // 既に入力されている場合はそのまま保持
        if (!videoTitle) {
            setVideoTitle('');
        }
        
        // Google Driveの場合はプレビュープレイヤーは不要（iframeで表示）
        setPreviewPlayer(null);
        setDuration(0); // 時間は不明
        setStartSeconds(0);
        setEndSeconds(0);
    };

    const startTimeTracking = (player) => {
        if (timeUpdateInterval.current) {
            clearInterval(timeUpdateInterval.current);
        }
        timeUpdateInterval.current = setInterval(() => {
            if (player && player.getCurrentTime) {
                const time = player.getCurrentTime();
                setCurrentTime(time);
            }
        }, 50);
    };

    React.useEffect(() => {
        if (isPlaying && isLooping && previewPlayer) {
            startLoopCheck(previewPlayer);
        } else {
            stopLoopCheck();
        }
    }, [isPlaying, isLooping]);

    React.useEffect(() => {
        if (timelineZoom === 1) {
            setViewStart(0);
        } else if (!isDragging) {
            const visibleDuration = duration / timelineZoom;
            const centerTime = currentTime;
            const newViewStart = Math.max(0, Math.min(duration - visibleDuration, centerTime - visibleDuration / 2));
            setViewStart(newViewStart);
        }
    }, [timelineZoom, duration]);

    const startLoopCheck = (player) => {
        if (loopCheckInterval.current) {
            clearInterval(loopCheckInterval.current);
        }
        loopCheckInterval.current = setInterval(() => {
            if (player && player.getCurrentTime) {
                const time = player.getCurrentTime();
                if (time >= (endSeconds - 0.1)) {
                    player.seekTo(startSeconds, true);
                }
            }
        }, 50);
    };

    const stopLoopCheck = () => {
        if (loopCheckInterval.current) {
            clearInterval(loopCheckInterval.current);
            loopCheckInterval.current = null;
        }
    };

    const togglePlay = React.useCallback(() => {
        if (previewPlayer) {
            if (isPlaying) {
                previewPlayer.pauseVideo();
            } else {
                if (currentTime < startSeconds || currentTime >= endSeconds) {
                    previewPlayer.seekTo(startSeconds, true);
                }
                previewPlayer.playVideo();
            }
        }
    }, [previewPlayer, isPlaying, currentTime, startSeconds, endSeconds]);

    // togglePlay関数を親コンポーネントに渡す
    React.useEffect(() => {
        if (onTogglePlayReady) {
            onTogglePlayReady(togglePlay);
        }
    }, [togglePlay, onTogglePlayReady]);

    const toggleLoop = () => {
        const newLoopState = !isLooping;
        setIsLooping(newLoopState);
        if (newLoopState && isPlaying && previewPlayer) {
            startLoopCheck(previewPlayer);
        } else {
            stopLoopCheck();
        }
    };

    const toggleMute = () => {
        if (previewPlayer) {
            if (isMuted) {
                previewPlayer.unMute();
                setIsMuted(false);
            } else {
                previewPlayer.mute();
                setIsMuted(true);
            }
        }
    };

    const calculateViewStart = () => {
        if (timelineZoom === 1) return 0;
        return viewStart;
    };

    const handleSeek = (time) => {
        if (previewPlayer) {
            previewPlayer.seekTo(parseFloat(time), true);
            setCurrentTime(parseFloat(time));
            // フレームを読み込むために一度再生し、すぐに停止
            if (!isPlaying) {
                previewPlayer.playVideo();
                setTimeout(() => {
                    if (previewPlayer && !isPlaying) {
                        previewPlayer.pauseVideo();
                    }
                }, 200);
            }
        }
    };

    const handleTimelineClick = (e) => {
        // クリックのみの場合は何もしない（ドラッグ開始点になる）
    };

    const handleTimelineMouseDown = (e) => {
        if (!timelineRef.current) return;
        
        if (e.target !== timelineRef.current && !e.target.classList.contains('flex-1')) {
            return;
        }
        
        const rect = timelineRef.current.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startPercent = startX / rect.width;
        
        let startTime;
        if (timelineZoom === 1) {
            startTime = startPercent * duration;
        } else {
            const visibleDuration = duration / timelineZoom;
            const viewStart = calculateViewStart();
            startTime = viewStart + (startPercent * visibleDuration);
        }
        startTime = Math.min(duration, Math.max(0, startTime));
        
        if (isStillImage) {
            // 静止画モード：クリックした位置に移動
            setStillImageTime(Math.round(startTime * 10) / 10);
            handleSeek(startTime);
            return;
        }
        
        let isDraggingNewRange = false;
        
        const handleMouseMove = (e) => {
            isDraggingNewRange = true;
            const rect = timelineRef.current.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentPercent = currentX / rect.width;
            
            let currentTime;
            if (timelineZoom === 1) {
                currentTime = currentPercent * duration;
            } else {
                const visibleDuration = duration / timelineZoom;
                const viewStart = calculateViewStart();
                currentTime = viewStart + (currentPercent * visibleDuration);
            }
            currentTime = Math.min(duration, Math.max(0, currentTime));
            
            const newStart = Math.min(startTime, currentTime);
            const newEnd = Math.max(startTime, currentTime);
            setStartSeconds(Math.round(newStart * 10) / 10);
            setEndSeconds(Math.round(newEnd * 10) / 10);
        };
        
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            if (!isDraggingNewRange) {
                handleSeek(startTime);
            }
            
            if (isLooping) {
                setIsLooping(false);
                stopLoopCheck();
            }
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleRangeMouseDown = (e, type) => {
        e.stopPropagation();
        setIsDragging(true);
        if (type === 'start') {
            document.addEventListener('mousemove', handleStartDrag);
            document.addEventListener('mouseup', handleMouseUp);
        } else if (type === 'end') {
            document.addEventListener('mousemove', handleEndDrag);
            document.addEventListener('mouseup', handleMouseUp);
        } else if (type === 'range') {
            const rect = timelineRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickPercent = clickX / rect.width;
            const clickTime = clickPercent * duration;
            const offsetFromStart = clickTime - startSeconds;
            
            const rangeDragHandler = (e) => handleRangeDrag(e, offsetFromStart);
            document.addEventListener('mousemove', rangeDragHandler);
            document.addEventListener('mouseup', () => {
                document.removeEventListener('mousemove', rangeDragHandler);
                document.removeEventListener('mouseup', handleMouseUp);
            });
        }
    };

    const handleStartDrag = (e) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(1, x / rect.width));
        
        let time;
        if (timelineZoom === 1) {
            time = Math.round(percent * duration * 10) / 10;
        } else {
            const visibleDuration = duration / timelineZoom;
            const viewStart = calculateViewStart();
            time = Math.round((viewStart + (percent * visibleDuration)) * 10) / 10;
        }
        
        if (time < endSeconds - 0.1 && time >= 0 && time <= duration) {
            setStartSeconds(time);
            if (previewPlayer) {
                previewPlayer.seekTo(time, true);
            }
        }
    };

    const handleEndDrag = (e) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(1, x / rect.width));
        
        let time;
        if (timelineZoom === 1) {
            time = Math.round(percent * duration * 10) / 10;
        } else {
            const visibleDuration = duration / timelineZoom;
            const viewStart = calculateViewStart();
            time = Math.round((viewStart + (percent * visibleDuration)) * 10) / 10;
        }
        
        if (time > startSeconds + 0.1 && time >= 0 && time <= duration) {
            setEndSeconds(time);
            if (previewPlayer) {
                previewPlayer.seekTo(time, true);
            }
        }
    };

    const handleRangeDrag = (e, offsetFromStart) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(1, x / rect.width));
        
        let clickTime;
        if (timelineZoom === 1) {
            clickTime = percent * duration;
        } else {
            const visibleDuration = duration / timelineZoom;
            const viewStart = calculateViewStart();
            clickTime = viewStart + (percent * visibleDuration);
        }
        
        const newStart = clickTime - offsetFromStart;
        const rangeDuration = endSeconds - startSeconds;
        
        if (newStart >= 0 && newStart + rangeDuration <= duration) {
            setStartSeconds(Math.round(newStart * 10) / 10);
            setEndSeconds(Math.round((newStart + rangeDuration) * 10) / 10);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleStartDrag);
        document.removeEventListener('mousemove', handleEndDrag);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        // テキスト列のバリデーション：location, memo, customFieldsのいずれかが入力されていればOK
        const hasTextInput = location.trim() || memo.trim() || 
            Object.values(customFields).some(val => val && val.trim());
        
        if (!hasTextInput) {
            setError('対応箇所、参考内容、またはカスタム列のいずれかを入力してください');
            return;
        }

        // YouTubeの場合のみ時間のバリデーション（Google Driveは時間指定なし）
        if (urlType === 'youtube' && videoId && !isStillImage && startSeconds >= endSeconds) {
            setError('終了時間は開始時間より大きい値を設定してください');
            return;
        }

        const newReference = {
            id: Date.now(),
            url: url || '',
            videoId: videoId || null,
            // Google Driveでタイトルが空の場合はデフォルト値を設定
            videoTitle: videoTitle || (urlType === 'googledrive' ? 'Google Drive動画' : ''),
            isStillImage: isStillImage,
            stillImageTime: isStillImage ? parseFloat(stillImageTime) : undefined,
            // YouTube の場合のみ時間を設定、Google Driveの場合は0
            startSeconds: (urlType === 'youtube' && videoId) ? parseFloat(isStillImage ? stillImageTime : startSeconds) : 0,
            endSeconds: (urlType === 'youtube' && videoId) ? parseFloat(isStillImage ? stillImageTime : endSeconds) : 0,
            location: location || '',
            memo: memo || '（メモなし）',
            customFields: customFields
        };

        onAdd(newReference);

        setUrl('');
        setVideoId(null);
        setVideoTitle('');
        setIsStillImage(false);
        setStillImageTime(0);
        setStartSeconds(0);
        setEndSeconds(10);
        setLocation('');
        setMemo('');
        setCustomFields({});
        setIsPlaying(false);
        setIsLooping(false);
        if (previewPlayer) {
            previewPlayer.destroy();
            setPreviewPlayer(null);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1);
        return `${mins}:${secs.padStart(4, '0')}`;
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 max-w-6xl mx-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4">新規リファレンス追加</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        {error}
                    </div>
                )}
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        動画URL（YouTubeまたはGoogle Drive）
                    </label>
                    <input
                        type="text"
                        value={url}
                        onChange={handleUrlChange}
                        placeholder="https://www.youtube.com/... または https://drive.google.com/..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Google Driveの場合はタイトル入力欄を表示 */}
                {urlType === 'googledrive' && url && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            動画タイトル（任意）
                        </label>
                        <input
                            type="text"
                            value={videoTitle}
                            onChange={(e) => setVideoTitle(e.target.value)}
                            // placeholder="例: 雨は短い - 参考映像"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            ※ タイトルを入力しない場合は「Google Drive動画」と表示されます
                        </p>
                    </div>
                )}

                {/* YouTubeの場合のみモード選択と時間指定を表示 */}
                {urlType === 'youtube' && videoId && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                モード選択
                            </label>
                            <div className="flex gap-4 mb-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={!isStillImage}
                                        onChange={() => setIsStillImage(false)}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm font-medium text-gray-700">動画モード</span>
                                </label>
                                <label className={`flex items-center gap-2 ${enableStillImage ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                                    <input
                                        type="radio"
                                        checked={isStillImage}
                                        onChange={() => {
                                            if (enableStillImage) {
                                                setIsStillImage(true);
                                                setStillImageTime(currentTime);
                                            }
                                        }}
                                        disabled={!enableStillImage}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm font-medium text-gray-700">静止画モード（設定から有効化）</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                プレビュー
                            </label>
                            <div className="aspect-video bg-black rounded-lg overflow-hidden mb-3 relative">
                                {/* YouTube用プレーヤー */}
                                {urlType === 'youtube' && videoId && (
                                    <div id="preview-player"></div>
                                )}
                                {/* Google Drive用iframe */}
                                {urlType === 'googledrive' && url && (
                                    <iframe
                                        className="w-full h-full"
                                        src={convertGoogleDriveToEmbedLink(url) + '?muted=1'}
                                        allow="autoplay"
                                        style={{ border: 'none' }}
                                    />
                                )}
                                {/* プレースホルダー（URLが未入力の場合） */}
                                {urlType === 'unknown' && (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                        URLを入力してください
                                    </div>
                                )}
                                {/* YouTube用ミュートボタン */}
                                {urlType === 'youtube' && videoId && (
                                    <button
                                        onClick={toggleMute}
                                        className="absolute bottom-2 right-2 z-20 bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-2 rounded-full transition-all"
                                        aria-label={isMuted ? "ミュート解除" : "ミュート"}
                                        title={isMuted ? "ミュート解除" : "ミュート"}
                                    >
                                        {isMuted ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                            </div>
                            
                            {/* タイムライン: YouTubeの場合のみ表示 */}
                            {urlType === 'youtube' && videoId && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">
                                            {isStillImage ? '静止画の時間を指定してください。' : '出力範囲を指定してください。'}
                                        </span>
                                        <span className="text-lg font-mono font-bold text-blue-600">
                                            {formatTime(currentTime)}
                                        </span>
                                    </div>
                                    
                                    <div 
                                        ref={timelineRef}
                                        className="relative h-12 bg-gray-200 rounded cursor-pointer select-none"
                                        onMouseDown={handleTimelineMouseDown}
                                        onWheel={(e) => {
                                            if (e.shiftKey && !isDragging) {
                                                e.preventDefault();
                                                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                                                const newZoom = Math.max(1, Math.min(10, timelineZoom * delta));
                                                setTimelineZoom(newZoom);
                                            }
                                        }}
                                    >
                                        <div className="absolute inset-0 flex">
                                            {[...Array(20)].map((_, i) => (
                                                <div key={i} className="flex-1 border-r border-gray-300"></div>
                                            ))}
                                        </div>
                                        
                                        {(() => {
                                            if (isStillImage) {
                                                // 静止画モード：1点を表示
                                                let style, isVisible;
                                                if (timelineZoom === 1) {
                                                    style = {
                                                        left: `${(stillImageTime / duration) * 100}%`
                                                    };
                                                    isVisible = true;
                                                } else {
                                                    const visibleDuration = duration / timelineZoom;
                                                    const viewStart = calculateViewStart();
                                                    const viewEnd = viewStart + visibleDuration;
                                                    isVisible = (stillImageTime >= viewStart && stillImageTime <= viewEnd);
                                                    style = {
                                                        left: `${((stillImageTime - viewStart) / visibleDuration) * 100}%`
                                                    };
                                                }
                                                if (!isVisible) return null;
                                                return (
                                                    <div
                                                        className="absolute top-0 h-full w-1 bg-blue-600 cursor-pointer"
                                                        style={style}
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            setIsDragging(true);
                                                            const handleMouseMove = (e) => {
                                                                if (!timelineRef.current) return;
                                                                const rect = timelineRef.current.getBoundingClientRect();
                                                                const x = e.clientX - rect.left;
                                                                const percent = Math.max(0, Math.min(1, x / rect.width));
                                                                let time;
                                                                if (timelineZoom === 1) {
                                                                    time = Math.round(percent * duration * 10) / 10;
                                                                } else {
                                                                    const visibleDuration = duration / timelineZoom;
                                                                    const viewStart = calculateViewStart();
                                                                    time = Math.round((viewStart + (percent * visibleDuration)) * 10) / 10;
                                                                }
                                                                setStillImageTime(Math.min(duration, Math.max(0, time)));
                                                                handleSeek(time);
                                                            };
                                                            const handleMouseUp = () => {
                                                                setIsDragging(false);
                                                                document.removeEventListener('mousemove', handleMouseMove);
                                                                document.removeEventListener('mouseup', handleMouseUp);
                                                            };
                                                            document.addEventListener('mousemove', handleMouseMove);
                                                            document.addEventListener('mouseup', handleMouseUp);
                                                        }}
                                                    >
                                                        <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-blue-700 rounded-full"></div>
                                                        <div className="absolute -bottom-1 -left-1.5 w-3 h-3 bg-blue-700 rounded-full"></div>
                                                    </div>
                                                );
                                            }
                                            
                                            // 動画モード：範囲を表示
                                            if (isStillImage) return null; // 静止画モード時は範囲を非表示
                                            
                                            let style, isVisible;
                                            if (timelineZoom === 1) {
                                                style = {
                                                    left: `${(startSeconds / duration) * 100}%`,
                                                    width: `${((endSeconds - startSeconds) / duration) * 100}%`
                                                };
                                                isVisible = true;
                                            } else {
                                                const visibleDuration = duration / timelineZoom;
                                                const viewStart = calculateViewStart();
                                                const viewEnd = viewStart + visibleDuration;
                                                isVisible = (endSeconds > viewStart && startSeconds < viewEnd);
                                                
                                                const clippedStart = Math.max(startSeconds, viewStart);
                                                const clippedEnd = Math.min(endSeconds, viewEnd);
                                                
                                                style = {
                                                    left: `${((clippedStart - viewStart) / visibleDuration) * 100}%`,
                                                    width: `${((clippedEnd - clippedStart) / visibleDuration) * 100}%`
                                                };
                                            }
                                            if (!isVisible) return null;
                                            return (
                                                <div 
                                                    className="absolute top-0 h-full bg-blue-400 bg-opacity-40 cursor-move"
                                                    style={style}
                                                    onMouseDown={(e) => {
                                                        const rect = timelineRef.current.getBoundingClientRect();
                                                        const x = e.clientX - rect.left;
                                                        const percent = x / rect.width;
                                                        const clickTime = percent * duration;
                                                        
                                                        if (clickTime >= startSeconds && clickTime <= endSeconds) {
                                                            handleRangeMouseDown(e, 'range');
                                                        }
                                                    }}
                                                >
                                                    <div className="absolute inset-0 border-t-2 border-b-2 border-blue-500"></div>
                                                </div>
                                            );
                                        })()}
                                        
                                        {/* 開始ハンドル（動画モードのみ） */}
                                        {!isStillImage && (() => {
                                            let style, isVisible;
                                            if (timelineZoom === 1) {
                                                style = {
                                                    left: `${(startSeconds / duration) * 100}%`,
                                                    transform: 'translateX(-50%)'
                                                };
                                                isVisible = true;
                                            } else {
                                                const visibleDuration = duration / timelineZoom;
                                                const viewStart = calculateViewStart();
                                                const viewEnd = viewStart + visibleDuration;
                                                isVisible = (startSeconds >= viewStart && startSeconds <= viewEnd);
                                                style = {
                                                    left: `${((startSeconds - viewStart) / visibleDuration) * 100}%`,
                                                    transform: 'translateX(-50%)'
                                                };
                                            }
                                            if (!isVisible) return null;
                                            return (
                                                <div 
                                                    className="absolute top-0 h-full w-2 bg-blue-600 cursor-ew-resize hover:bg-blue-700 transition-colors z-10"
                                                    style={style}
                                                    onMouseDown={(e) => handleRangeMouseDown(e, 'start')}
                                                >
                                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded"></div>
                                                </div>
                                            );
                                        })()}
                                        
                                        {/* 終了ハンドル（動画モードのみ） */}
                                        {!isStillImage && (() => {
                                            let style, isVisible;
                                            if (timelineZoom === 1) {
                                                style = {
                                                    left: `${(endSeconds / duration) * 100}%`,
                                                    transform: 'translateX(-50%)'
                                                };
                                                isVisible = true;
                                            } else {
                                                const visibleDuration = duration / timelineZoom;
                                                const viewStart = calculateViewStart();
                                                const viewEnd = viewStart + visibleDuration;
                                                isVisible = (endSeconds >= viewStart && endSeconds <= viewEnd);
                                                style = {
                                                    left: `${((endSeconds - viewStart) / visibleDuration) * 100}%`,
                                                    transform: 'translateX(-50%)'
                                                };
                                            }
                                            if (!isVisible) return null;
                                            return (
                                                <div 
                                                    className="absolute top-0 h-full w-2 bg-blue-600 cursor-ew-resize hover:bg-blue-700 transition-colors z-10"
                                                    style={style}
                                                    onMouseDown={(e) => handleRangeMouseDown(e, 'end')}
                                                >
                                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded"></div>
                                                </div>
                                            );
                                        })()}
                                        
                                        {(() => {
                                            let style, isVisible;
                                            if (timelineZoom === 1) {
                                                style = {
                                                    left: `${(currentTime / duration) * 100}%`
                                                };
                                                isVisible = true;
                                            } else {
                                                const visibleDuration = duration / timelineZoom;
                                                const viewStart = calculateViewStart();
                                                const viewEnd = viewStart + visibleDuration;
                                                isVisible = (currentTime >= viewStart && currentTime <= viewEnd);
                                                style = {
                                                    left: `${((currentTime - viewStart) / visibleDuration) * 100}%`
                                                };
                                            }
                                            if (!isVisible) return null;
                                            return (
                                                <div 
                                                    className="absolute top-0 h-full w-0.5 bg-blue-700 pointer-events-none z-20"
                                                    style={style}
                                                >
                                                    <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-blue-700 rounded-full"></div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                        {(() => {
                                            if (timelineZoom === 1) {
                                                return (
                                                    <>
                                                        <span>{formatTime(0)}</span>
                                                        <span>{formatTime(duration)}</span>
                                                    </>
                                                );
                                            } else {
                                                const visibleDuration = duration / timelineZoom;
                                                const viewStart = calculateViewStart();
                                                const viewEnd = Math.min(duration, viewStart + visibleDuration);
                                                return (
                                                    <>
                                                        <span>{formatTime(viewStart)}</span>
                                                        <span>{formatTime(viewEnd)}</span>
                                                    </>
                                                );
                                            }
                                        })()}
                                    </div>

                                    <div className="mt-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (isPlaying && !isLooping) {
                                                        previewPlayer.pauseVideo();
                                                    } else {
                                                        setIsLooping(false);
                                                        stopLoopCheck();
                                                        if (currentTime < 0 || currentTime >= duration) {
                                                            previewPlayer.seekTo(0, true);
                                                        }
                                                        previewPlayer.playVideo();
                                                    }
                                                }}
                                                className={`p-2 rounded transition-all border-2 ${
                                                    (isPlaying && !isLooping)
                                                        ? 'bg-blue-600 border-blue-600 text-white' 
                                                        : 'bg-white border-blue-600 text-blue-600 hover:bg-blue-50'
                                                }`}
                                                title="通常再生"
                                            >
                                                {(isPlaying && !isLooping) ? (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (isPlaying && isLooping) {
                                                        previewPlayer.pauseVideo();
                                                    } else {
                                                        setIsLooping(true);
                                                        if (currentTime < startSeconds || currentTime >= endSeconds) {
                                                            previewPlayer.seekTo(startSeconds, true);
                                                        }
                                                        previewPlayer.playVideo();
                                                    }
                                                }}
                                                className={`p-2 rounded transition-all border-2 ${
                                                    (isPlaying && isLooping)
                                                        ? 'bg-blue-600 border-blue-600 text-white' 
                                                        : 'bg-white border-blue-600 text-blue-600 hover:bg-blue-50'
                                                }`}
                                                title="区間ループ"
                                            >
                                                {(isPlaying && isLooping) ? (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                )}
                                            </button>
                                            <div className="flex-1 relative">
                                                <div className="h-6 bg-gray-300 rounded relative overflow-hidden">
                                                    {timelineZoom > 1 && (
                                                        <div 
                                                            className="absolute top-0 h-full bg-blue-500 opacity-30"
                                                            style={{
                                                                left: `${(viewStart / duration) * 100}%`,
                                                                width: `${((duration / timelineZoom) / duration) * 100}%`
                                                            }}
                                                        ></div>
                                                    )}
                                                    {timelineZoom > 1 && (
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max={duration - (duration / timelineZoom)}
                                                            step="0.1"
                                                            value={viewStart}
                                                            onChange={(e) => {
                                                                const newViewStart = parseFloat(e.target.value);
                                                                setViewStart(newViewStart);
                                                            }}
                                                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newZoom = Math.max(1, timelineZoom - 1);
                                                        setTimelineZoom(newZoom);
                                                    }}
                                                    className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded text-base font-bold flex items-center justify-center"
                                                    title="縮小"
                                                >
                                                    −
                                                </button>
                                                <div className="text-sm font-medium text-gray-700 min-w-[3rem] text-center">
                                                    {timelineZoom.toFixed(1)}x
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newZoom = Math.min(10, timelineZoom + 1);
                                                        setTimelineZoom(newZoom);
                                                    }}
                                                    className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded text-base font-bold flex items-center justify-center"
                                                    title="拡大"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-500 text-center">
                                            {timelineZoom > 1 ? 'シークバーで表示範囲を移動 | ' : ''}±ボタンで拡大縮小
                                        </div>
                                    </div>
                                </div>
                            </div>
                            )}
                        </div>

                        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">送信設定</h3>
                            {isStillImage ? (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        静止画時間（秒）
                                    </label>
                                    <input
                                        type="text"
                                        value={stillImageTime}
                                        onChange={(e) => {
                                            setStillImageTime(e.target.value);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const parsed = window.parseTimeString(e.target.value);
                                                if (parsed !== null && parsed >= 0 && parsed <= duration) {
                                                    setStillImageTime(parsed);
                                                    handleSeek(parsed);
                                                } else {
                                                    setStillImageTime(stillImageTime);
                                                }
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const parsed = window.parseTimeString(e.target.value);
                                            if (parsed !== null && parsed >= 0 && parsed <= duration) {
                                                setStillImageTime(parsed);
                                                handleSeek(parsed);
                                            } else {
                                                setStillImageTime(stillImageTime);
                                            }
                                        }}
                                        placeholder="例: 66 または 1:06"
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                    />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                            開始（秒）
                                        </label>
                                        <input
                                            type="text"
                                            value={startSeconds}
                                            onChange={(e) => {
                                                setStartSeconds(e.target.value);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const parsed = window.parseTimeString(e.target.value);
                                                    if (parsed !== null && parsed >= 0 && parsed <= duration) {
                                                        if (parsed >= endSeconds) {
                                                            // 開始時間が終了時間以上の場合、終了時間を自動調整
                                                            const newEnd = Math.min(duration, parsed + 10);
                                                            setEndSeconds(newEnd);
                                                        }
                                                        setStartSeconds(parsed);
                                                    } else {
                                                        setStartSeconds(startSeconds);
                                                    }
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const parsed = window.parseTimeString(e.target.value);
                                                if (parsed !== null && parsed >= 0 && parsed <= duration) {
                                                    if (parsed >= endSeconds) {
                                                        // 開始時間が終了時間以上の場合、終了時間を自動調整
                                                        const newEnd = Math.min(duration, parsed + 10);
                                                        setEndSeconds(newEnd);
                                                    }
                                                    setStartSeconds(parsed);
                                                } else {
                                                    setStartSeconds(startSeconds);
                                                }
                                            }}
                                            placeholder="例: 66 または 1:06"
                                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                            終了（秒）
                                        </label>
                                        <input
                                            type="text"
                                            value={endSeconds}
                                            onChange={(e) => {
                                                setEndSeconds(e.target.value);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const parsed = window.parseTimeString(e.target.value);
                                                    if (parsed !== null && parsed >= 0 && parsed <= duration) {
                                                        if (parsed <= startSeconds) {
                                                            // 終了時間が開始時間以下の場合、開始時間を自動調整
                                                            const newStart = Math.max(0, parsed - 10);
                                                            setStartSeconds(newStart);
                                                        }
                                                        setEndSeconds(parsed);
                                                    } else {
                                                        setEndSeconds(endSeconds);
                                                    }
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const parsed = window.parseTimeString(e.target.value);
                                                if (parsed !== null && parsed >= 0 && parsed <= duration) {
                                                    if (parsed <= startSeconds) {
                                                        // 終了時間が開始時間以下の場合、開始時間を自動調整
                                                        const newStart = Math.max(0, parsed - 10);
                                                        setStartSeconds(newStart);
                                                    }
                                                    setEndSeconds(parsed);
                                                } else {
                                                    setEndSeconds(endSeconds);
                                                }
                                            }}
                                            placeholder="例: 90 または 1:30"
                                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {(standardColumns || []).map(col => {
                    if (col.id === 'location') {
                        return (
                            <div key={col.id}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {col.name}
                                </label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="例：0:45 - 1:20 / イントロ部分"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        );
                    } else if (col.id === 'memo') {
                        return (
                            <div key={col.id}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {col.name} <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    placeholder="例：この部分のモーションを参考にする"
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                        );
                    }
                    return null;
                })}

                {(customColumns || []).map(col => (
                    <div key={col.id}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {col.name}
                        </label>
                        <input
                            type="text"
                            value={customFields[col.id] || ''}
                            onChange={(e) => setCustomFields({...customFields, [col.id]: e.target.value})}
                            placeholder={`${col.name}を入力...`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                ))}

                <div className="flex gap-3">
                    <button
                        type="submit"
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 font-medium"
                    >
                        リファレンスを追加
                    </button>
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors duration-200 font-medium"
                        >
                            キャンセル
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

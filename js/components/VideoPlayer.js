// Video Player コンポーネント（YouTube & Google Drive 対応）
window.VideoPlayer = function VideoPlayer({ reference, onReady, showOverlay, reinitTrigger, enableCardAudio }) {
    const playerRef = React.useRef(null); // 実際のプレイヤーインスタンスを保持
    const videoElementRef = React.useRef(null); // HTML5 video要素への参照
    const iframeRef = React.useRef(null); // Google Drive iframe要素への参照
    const containerRef = React.useRef(null);
    const loopCheckInterval = React.useRef(null);
    const initialLoadRef = React.useRef(true); // 初回読み込みフラグ
    const playerInitialized = React.useRef(false); // プレイヤーが初期化済みかのフラグ
    const userStartedPlay = React.useRef(false); // ユーザーが再生を開始したかのフラグ
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [isLooping, setIsLooping] = React.useState(true); // カードは常にループモード
    const [isInView, setIsInView] = React.useState(false); // 画面内表示フラグ
    const [loadError, setLoadError] = React.useState(false); // 読み込みエラーフラグ
    
    // URLの種類を判定
    const urlType = React.useMemo(() => detectUrlType(reference.url), [reference.url]);

    // reinitTriggerが変わったら再初期化
    React.useEffect(() => {
        console.log(`[VideoPlayer ${reference.id}] reinitTrigger changed:`, reinitTrigger);
        if (reinitTrigger > 0) {
            console.log(`[VideoPlayer ${reference.id}] Reinitializing due to reinitTrigger`);
            // フラグをリセット
            initialLoadRef.current = true;
            userStartedPlay.current = false;
            setIsPlaying(false);
            
            // 再生中の場合は停止
            if (urlType === 'youtube' && playerRef.current) {
                try {
                    console.log(`[VideoPlayer ${reference.id}] Stopping YouTube video and seeking to start`);
                    playerRef.current.stopVideo();
                    playerRef.current.seekTo(reference.startSeconds, true);
                } catch (e) {
                    console.log(`[VideoPlayer ${reference.id}] Error stopping/seeking video:`, e);
                }
            } else if (urlType === 'googledrive' && videoElementRef.current) {
                try {
                    console.log(`[VideoPlayer ${reference.id}] Stopping Google Drive video`);
                    videoElementRef.current.pause();
                    videoElementRef.current.currentTime = reference.startSeconds;
                } catch (e) {
                    console.log(`[VideoPlayer ${reference.id}] Error stopping/seeking video:`, e);
                }
            }
        }
    }, [reinitTrigger, urlType]);

    // enableCardAudioが変更されたらミュート状態を更新
    React.useEffect(() => {
        if (urlType === 'youtube' && playerRef.current) {
            try {
                if (enableCardAudio) {
                    console.log(`[VideoPlayer ${reference.id}] Unmuting YouTube due to enableCardAudio change`);
                    playerRef.current.unMute();
                } else {
                    console.log(`[VideoPlayer ${reference.id}] Muting YouTube due to enableCardAudio change`);
                    playerRef.current.mute();
                }
            } catch (e) {
                console.log(`[VideoPlayer ${reference.id}] Error changing YouTube mute state:`, e);
            }
        } else if (urlType === 'googledrive' && iframeRef.current) {
            // Google Driveのiframeの場合、ミュート状態を変更するにはiframeを再読み込みする必要がある
            console.log(`[VideoPlayer ${reference.id}] Reloading Google Drive iframe due to audio setting change`);
            const currentSrc = iframeRef.current.src;
            const url = new URL(currentSrc);
            const muted = enableCardAudio ? 0 : 1;
            url.searchParams.set('muted', muted);
            iframeRef.current.src = url.toString();
        }
    }, [enableCardAudio, urlType]);

    // Intersection Observer でカードが画面内に入ったら動画読み込み
    React.useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                const wasInView = isInView;
                const nowInView = entry.isIntersecting;
                setIsInView(nowInView);
                
                // 画面から大きく離れた時のみプレイヤーをクリーンアップ
                if (wasInView && !nowInView) {
                    console.log(`[VideoPlayer ${reference.id}] Going far from view - cleaning up player`);
                    try {
                        if (loopCheckInterval.current) {
                            clearInterval(loopCheckInterval.current);
                            loopCheckInterval.current = null;
                        }
                        
                        if (urlType === 'youtube' && playerRef.current) {
                            playerRef.current.stopVideo();
                            playerRef.current.destroy();
                            playerRef.current = null;
                        } else if (urlType === 'googledrive' && videoElementRef.current) {
                            videoElementRef.current.pause();
                            videoElementRef.current.currentTime = 0;
                        }
                    } catch (e) {
                        console.log(`[VideoPlayer ${reference.id}] Error cleaning up player:`, e);
                    }
                    
                    playerInitialized.current = false;
                    initialLoadRef.current = true;
                    userStartedPlay.current = false;
                    setIsPlaying(false);
                }
            },
            {
                rootMargin: '1000px', // 画面から1000px離れた時のみクリーンアップ
                threshold: 0.1
            }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            if (containerRef.current) {
                observer.unobserve(containerRef.current);
            }
        };
    }, [isInView, urlType]);

    React.useEffect(() => {
        if (!isInView) return;
        if (playerInitialized.current) return; // 既に初期化済みの場合は何もしない

        if (urlType === 'youtube') {
            // YouTube IFrame API が読み込まれているか確認
            const checkYouTubeAPI = setInterval(() => {
                if (window.YT && window.YT.Player) {
                    clearInterval(checkYouTubeAPI);
                    initYouTubePlayer();
                }
            }, 100);

            return () => {
                clearInterval(checkYouTubeAPI);
            };
        } else if (urlType === 'googledrive') {
            // Google Driveは即座に初期化
            initGoogleDrivePlayer();
        }
    }, [isInView, urlType]);

    // コンポーネントがアンマウントされる時のみクリーンアップ
    React.useEffect(() => {
        return () => {
            if (loopCheckInterval.current) {
                clearInterval(loopCheckInterval.current);
            }
            
            if (urlType === 'youtube' && playerRef.current) {
                try {
                    playerRef.current.stopVideo();
                    playerRef.current.destroy();
                } catch (e) {
                    // プレイヤーが既に破棄されている場合のエラーを無視
                }
            } else if (urlType === 'googledrive' && videoElementRef.current) {
                try {
                    videoElementRef.current.pause();
                } catch (e) {
                    // エラーを無視
                }
            }
            
            playerInitialized.current = false;
            initialLoadRef.current = true;
            userStartedPlay.current = false;
        };
    }, [urlType]);

    const initYouTubePlayer = () => {
        if (playerInitialized.current) {
            console.log(`[VideoPlayer ${reference.id}] Already initialized, skipping`);
            return; // 二重初期化を防止
        }
        
        console.log(`[VideoPlayer ${reference.id}] Initializing YouTube player...`);
        const playerId = `player-${reference.id}`;
        
        playerInitialized.current = true; // 初期化開始をマーク
        
        const newPlayer = new window.YT.Player(playerId, {
            videoId: reference.videoId,
            playerVars: {
                controls: 0,
                disablekb: 1,
                fs: 0,
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                iv_load_policy: 3,
                mute: enableCardAudio ? 0 : 1,
                start: Math.floor(reference.startSeconds) // 開始位置を設定
            },
            events: {
                onReady: (event) => {
                    playerRef.current = event.target;
                    if (!enableCardAudio) {
                        event.target.mute();
                    } else {
                        event.target.unMute();
                    }
                    
                    console.log(`[VideoPlayer ${reference.id}] YouTube Player ready - thumbnail mode`);
                    
                    if (onReady) onReady(event.target);
                },
                onStateChange: (event) => {
                    console.log(`[VideoPlayer ${reference.id}] State changed:`, event.data);
                    
                    if (event.data === window.YT.PlayerState.PLAYING) {
                        console.log(`[VideoPlayer ${reference.id}] Playing`);
                        setIsPlaying(true);
                    } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
                        console.log(`[VideoPlayer ${reference.id}] Paused or Ended`);
                        setIsPlaying(false);
                    }
                }
            }
        });
    };

    const initGoogleDrivePlayer = () => {
        if (playerInitialized.current) {
            console.log(`[VideoPlayer ${reference.id}] Already initialized, skipping`);
            return;
        }
        
        const embedUrl = getEmbedUrl();
        console.log(`[VideoPlayer ${reference.id}] Initializing Google Drive player (iframe)...`);
        console.log(`[VideoPlayer ${reference.id}] - Original URL:`, reference.url);
        console.log(`[VideoPlayer ${reference.id}] - Embed URL:`, embedUrl);
        playerInitialized.current = true;
        
        // iframe埋め込みの場合、自動的に読み込まれるため追加の初期化は不要
        // onReadyコールバックを呼ぶ
        if (onReady) {
            setTimeout(() => onReady(iframeRef.current), 100);
        }
    };

    // プレビューと同じuseEffectベースのループ管理
    React.useEffect(() => {
        if (isPlaying && isLooping) {
            if (urlType === 'youtube' && playerRef.current) {
                startYouTubeLoopCheck(playerRef.current);
            }
            // Google Driveのiframe埋め込みではループ制御不可（Google Drive側のUIで操作）
        } else {
            stopLoopCheck();
        }
    }, [isPlaying, isLooping, urlType]);

    const startYouTubeLoopCheck = (playerInstance) => {
        if (loopCheckInterval.current) {
            clearInterval(loopCheckInterval.current);
        }
        
        loopCheckInterval.current = setInterval(() => {
            if (playerInstance && playerInstance.getCurrentTime) {
                const currentTime = playerInstance.getCurrentTime();
                
                // 静止画モードの場合は指定位置で停止
                if (reference.isStillImage) {
                    if (currentTime >= reference.startSeconds) {
                        console.log(`[VideoPlayer ${reference.id}] Still image mode - stopping at target position`);
                        playerInstance.pauseVideo();
                        playerInstance.seekTo(reference.startSeconds, true);
                        setIsPlaying(false);
                        stopLoopCheck();
                    }
                } else {
                    // 通常モードは区間ループ
                    // 「終了秒数」に達する「0.1秒前」にシークさせることで、
                    // YouTube側に「動画終了(ENDED)」を検知させず、タイトルの再表示を防ぐ
                    if (currentTime >= (reference.endSeconds - 0.1)) {
                        playerInstance.seekTo(reference.startSeconds, true);
                    }
                }
            }
        }, 50); // チェック頻度を上げ、判定の漏れを防ぐ
    };

    const stopLoopCheck = () => {
        if (loopCheckInterval.current) {
            clearInterval(loopCheckInterval.current);
            loopCheckInterval.current = null;
        }
    };

    const togglePlay = () => {
        console.log(`[VideoPlayer ${reference.id}] togglePlay called, isPlaying:`, isPlaying, 'isStillImage:', reference.isStillImage);
        
        if (urlType === 'youtube' && playerRef.current) {
            if (isPlaying) {
                playerRef.current.pauseVideo();
                setIsPlaying(false);
            } else {
                // 再生開始時は開始位置にシークしてから再生
                playerRef.current.seekTo(reference.startSeconds, true);
                playerRef.current.playVideo();
                setIsPlaying(true);
            }
        } else if (urlType === 'googledrive') {
            // iframe埋め込みの場合、クリックでプレビューページが開くため
            // 直接制御は不要（Google Drive側のUIで操作）
            console.log(`[VideoPlayer ${reference.id}] Google Drive iframe - playback controlled by Google Drive UI`);
        }
    };

    // サムネイル画像URLを取得
    const getThumbnailUrl = () => {
        if (urlType === 'youtube') {
            return `https://img.youtube.com/vi/${reference.videoId}/maxresdefault.jpg`;
        } else if (urlType === 'googledrive') {
            const fileId = extractGoogleDriveFileId(reference.url);
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1920`;
        }
        return '';
    };

    // 直リンクURLを取得（Google Driveの場合）
    const getDirectUrl = () => {
        if (urlType === 'googledrive') {
            return convertGoogleDriveToDirectLink(reference.url);
        }
        return reference.url;
    };

    // 埋め込みURLを取得（Google Driveのiframe用）
    const getEmbedUrl = () => {
        if (urlType === 'googledrive') {
            const baseUrl = convertGoogleDriveToEmbedLink(reference.url);
            if (!baseUrl) return null;
            
            // Google Driveの埋め込みパラメータ
            // - loop=1: ループ再生
            // - muted=1: ミュート（enableCardAudioに応じて変更）
            // - controls=1: コントロールを表示（最小限）
            const muted = enableCardAudio ? 0 : 1;
            return `${baseUrl}?loop=1&muted=${muted}`;
        }
        return reference.url;
    };

    return (
        <div 
            ref={containerRef}
            className="relative aspect-video overflow-hidden"
            style={{border: 'none', boxShadow: 'none'}}
        >
            {loadError && urlType === 'googledrive' && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-20">
                    <div className="text-center p-4">
                        <div className="text-red-600 mb-2">⚠️ 読み込みエラー</div>
                        <div className="text-sm text-gray-600">
                            Google Driveの共有設定を「リンクを知っている全員」に変更してください
                        </div>
                    </div>
                </div>
            )}
            
            {!isInView ? (
                // 画面外ではサムネイル画像を表示
                <img 
                    src={getThumbnailUrl()} 
                    alt="動画サムネイル" 
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                        // サムネイル取得失敗時のフォールバック
                        if (urlType === 'youtube') {
                            e.target.src = `https://img.youtube.com/vi/${reference.videoId}/hqdefault.jpg`;
                        } else {
                            e.target.style.display = 'none';
                        }
                    }}
                />
            ) : (
                // 画面内では動画プレーヤーを表示
                <>
                    {urlType === 'youtube' ? (
                        // YouTubeプレーヤー
                        <div className="absolute inset-0">
                            <div id={`player-${reference.id}`}></div>
                            {showOverlay && (
                                <div 
                                    className="absolute top-0 left-0 right-0 bg-gray-50"
                                    style={{ 
                                        height: '18%',
                                        pointerEvents: 'none',
                                        zIndex: 5
                                    }}
                                ></div>
                            )}
                        </div>
                    ) : urlType === 'googledrive' ? (
                        // Google Drive動画プレーヤー（iframe埋め込み）
                        <div className="absolute inset-0">
                            <iframe
                                ref={iframeRef}
                                className="w-full h-full"
                                src={getEmbedUrl()}
                                allow="autoplay"
                                style={{ border: 'none' }}
                            />
                            {showOverlay && (
                                <div 
                                    className="absolute top-0 left-0 right-0 bg-gray-50"
                                    style={{ 
                                        height: '18%',
                                        pointerEvents: 'none',
                                        zIndex: 5
                                    }}
                                ></div>
                            )}
                        </div>
                    ) : null}
                    
                    {/* YouTubeの場合のみ再生/停止ボタンを表示 */}
                    {urlType === 'youtube' && (
                        <button
                            onClick={togglePlay}
                            className="absolute inset-0 z-10 cursor-pointer"
                            aria-label={isPlaying ? "停止" : "再生"}
                            style={{ background: 'transparent' }}
                        >
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

// YouTube Player コンポーネント
window.VideoPlayer = function VideoPlayer({ reference, onReady, showOverlay, reinitTrigger, enableCardAudio }) {
    const playerRef = React.useRef(null); // 実際のプレイヤーインスタンスを保持
    const containerRef = React.useRef(null);
    const loopCheckInterval = React.useRef(null);
    const initialLoadRef = React.useRef(true); // 初回読み込みフラグ
    const playerInitialized = React.useRef(false); // プレイヤーが初期化済みかのフラグ
    const userStartedPlay = React.useRef(false); // ユーザーが再生を開始したかのフラグ
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [isLooping, setIsLooping] = React.useState(true); // カードは常にループモード
    const [isInView, setIsInView] = React.useState(false); // 画面内表示フラグ

    // reinitTriggerが変わったら再初期化
    React.useEffect(() => {
        console.log(`[VideoPlayer ${reference.id}] reinitTrigger changed:`, reinitTrigger);
        if (reinitTrigger > 0 && playerRef.current) {
            console.log(`[VideoPlayer ${reference.id}] Reinitializing due to reinitTrigger`);
            // フラグをリセット
            initialLoadRef.current = true;
            userStartedPlay.current = false;
            setIsPlaying(false);
            
            // 再生中の場合は停止
            if (playerRef.current) {
                try {
                    console.log(`[VideoPlayer ${reference.id}] Stopping and seeking to start`);
                    playerRef.current.stopVideo();
                    playerRef.current.seekTo(reference.startSeconds, true);
                } catch (e) {
                    console.log(`[VideoPlayer ${reference.id}] Error stopping/seeking video:`, e);
                }
            }
        }
    }, [reinitTrigger]);

    // enableCardAudioが変更されたらミュート状態を更新
    React.useEffect(() => {
        if (playerRef.current) {
            try {
                if (enableCardAudio) {
                    console.log(`[VideoPlayer ${reference.id}] Unmuting due to enableCardAudio change`);
                    playerRef.current.unMute();
                } else {
                    console.log(`[VideoPlayer ${reference.id}] Muting due to enableCardAudio change`);
                    playerRef.current.mute();
                }
            } catch (e) {
                console.log(`[VideoPlayer ${reference.id}] Error changing mute state:`, e);
            }
        }
    }, [enableCardAudio]);

    // Intersection Observer でカードが画面内に入ったら動画読み込み
    React.useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                const wasInView = isInView;
                const nowInView = entry.isIntersecting;
                setIsInView(nowInView);
                
                // 画面から大きく離れた時のみプレイヤーをクリーンアップ（YouTube制限対策）
                if (wasInView && !nowInView && playerRef.current) {
                    console.log(`[VideoPlayer ${reference.id}] Going far from view - cleaning up player`);
                    try {
                        if (loopCheckInterval.current) {
                            clearInterval(loopCheckInterval.current);
                            loopCheckInterval.current = null;
                        }
                        playerRef.current.stopVideo();
                        playerRef.current.destroy();
                    } catch (e) {
                        console.log(`[VideoPlayer ${reference.id}] Error cleaning up player:`, e);
                    }
                    playerRef.current = null;
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
    }, [isInView]);

    React.useEffect(() => {
        if (!isInView) return;
        if (playerInitialized.current) return; // 既に初期化済みの場合は何もしない

        // YouTube IFrame API が読み込まれているか確認
        const checkYouTubeAPI = setInterval(() => {
            if (window.YT && window.YT.Player) {
                clearInterval(checkYouTubeAPI);
                initPlayer();
            }
        }, 100);

        return () => {
            clearInterval(checkYouTubeAPI);
        };
    }, [isInView]);

    // コンポーネントがアンマウントされる時のみクリーンアップ
    React.useEffect(() => {
        return () => {
            if (loopCheckInterval.current) {
                clearInterval(loopCheckInterval.current);
            }
            if (playerRef.current) {
                try {
                    playerRef.current.stopVideo();
                    playerRef.current.destroy();
                } catch (e) {
                    // プレイヤーが既に破棄されている場合のエラーを無視
                }
            }
            playerInitialized.current = false;
            initialLoadRef.current = true;
            userStartedPlay.current = false;
        };
    }, []);

    const initPlayer = () => {
        if (playerInitialized.current) {
            console.log(`[VideoPlayer ${reference.id}] Already initialized, skipping`);
            return; // 二重初期化を防止
        }
        
        console.log(`[VideoPlayer ${reference.id}] Initializing player...`);
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
                    
                    console.log(`[VideoPlayer ${reference.id}] Player ready - thumbnail mode`);
                    
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

    // プレビューと同じuseEffectベースのループ管理
    React.useEffect(() => {
        if (isPlaying && isLooping && playerRef.current) {
            // 静止画モードでもループチェックを使用（範囲動画として扱う）
            startLoopCheck(playerRef.current);
        } else {
            stopLoopCheck();
        }
    }, [isPlaying, isLooping]);

    const startLoopCheck = (playerInstance) => {
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
        
        if (playerRef.current) {
            if (isPlaying) {
                playerRef.current.pauseVideo();
                setIsPlaying(false);
            } else {
                // 再生開始時は開始位置にシークしてから再生
                playerRef.current.seekTo(reference.startSeconds, true);
                playerRef.current.playVideo();
                setIsPlaying(true);
            }
        }
    };

    // YouTubeサムネイル画像URL
    const thumbnailUrl = `https://img.youtube.com/vi/${reference.videoId}/maxresdefault.jpg`;

    return (
        <div 
            ref={containerRef}
            className="relative aspect-video  overflow-hidden"
            style={{border: 'none', boxShadow: 'none'}}
        >
            {!isInView ? (
                // 画面外ではサムネイル画像を表示
                <img 
                    src={thumbnailUrl} 
                    alt="動画サムネイル" 
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                        // maxresdefaultがない場合はhqdefaultにフォールバック
                        e.target.src = `https://img.youtube.com/vi/${reference.videoId}/hqdefault.jpg`;
                    }}
                />
            ) : (
                // 画面内では動画プレーヤーを表示
                <>
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
                    <button
                        onClick={togglePlay}
                        className="absolute inset-0 z-10 cursor-pointer"
                        aria-label={isPlaying ? "停止" : "再生"}
                        style={{ background: 'transparent' }}
                    >
                    </button>
                </>
            )}
        </div>
    );
}

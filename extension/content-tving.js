(() => {
    const FRAME_ID =
        "tvp-panel-frame";

    const PANEL_WIDTH = 360;
    const COLLAPSED_WIDTH = 48;

    let frame = null;
    let panelWidth = PANEL_WIDTH;
    let collapsed = false;
    let updateTimer = null;

    let currentVideo = null;
    let isHost = false;

    /*
     * 서버에서 받은 명령을 영상에 적용할 때
     * 다시 서버로 전송되는 것을 막는다.
     */
    let applyingRemoteEvent = false;
    let remoteEventTimer = null;

    let periodicSyncTimer = null;

    let lastPlayerUrl =
    window.location.href;

let episodeChangeTimer = null;


    if (
        document.getElementById(
            FRAME_ID
        )
    ) {
        return;
    }

    function restorePreviousChanges() {
        const targets = [
            document.documentElement,
            document.body,
            document.getElementById(
                "__next"
            ),
            document.querySelector(
                ".layout-player-main"
            ),
            document.querySelector(
                ".player-container"
            ),
            document.querySelector(
                ".player-wrap"
            ),
            document.querySelector(
                ".player"
            )
        ].filter(Boolean);

        const properties = [
            "position",
            "top",
            "left",
            "right",
            "bottom",
            "width",
            "max-width",
            "height",
            "max-height",
            "margin",
            "margin-right",
            "padding",
            "padding-right",
            "transform",
            "transform-origin",
            "overflow",
            "box-sizing",
            "zoom",
            "z-index",
            "transition"
        ];

        targets.forEach((element) => {
            properties.forEach(
                (property) => {
                    element.style.removeProperty(
                        property
                    );
                }
            );
        });
    }

    restorePreviousChanges();

function findPlayer() {
    const videoRoot =
        document.querySelector(
            '[data-testid="player-video-root"]'
        );

    if (!videoRoot) {
        return null;
    }

    return videoRoot.closest(
        ".layout-player-main"
    );
}

function findVideo() {
    const videoRoot =
        document.querySelector(
            '[data-testid="player-video-root"]'
        );

    if (!videoRoot) {
        return null;
    }

    return videoRoot.querySelector(
        'video[id^="tving-player-"]'
    );
}

function installSeekBarFix() {
    let suppressUntil = 0;

    function getSeekInfo(event) {
        const player =
            findPlayer();

        if (!player) {
            return null;
        }

        const progressBar =
            player.querySelector(
                ".progress-bar"
            );

        const video =
            findVideo();

        if (
            !progressBar ||
            !video ||
            !Number.isFinite(video.duration) ||
            video.duration <= 0
        ) {
            return null;
        }

        const rect =
            progressBar.getBoundingClientRect();

        if (rect.width <= 0) {
            return null;
        }

        const hitTop =
            rect.top - 20;

        const hitBottom =
            rect.bottom + 20;

        if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < hitTop ||
            event.clientY > hitBottom
        ) {
            return null;
        }

        const x =
            event.clientX - rect.left;

        const ratio =
            Math.max(
                0,
                Math.min(
                    1,
                    x / rect.width
                )
            );

        return {
            video,
            targetTime:
                video.duration * ratio
        };
    }

    window.addEventListener(
        "pointerdown",
        (event) => {
            const seekInfo =
                getSeekInfo(event);

            if (!seekInfo) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            suppressUntil =
                Date.now() + 500;

            try {
                seekInfo.video.currentTime =
                    seekInfo.targetTime;
            } catch (error) {
                console.warn(
                    "TVP 재생바 이동 실패:",
                    error
                );
            }
        },
        true
    );

    [
        "mousedown",
        "mouseup",
        "pointerup",
        "click"
    ].forEach((eventName) => {
        window.addEventListener(
            eventName,
            (event) => {
                if (
                    Date.now() >
                    suppressUntil
                ) {
                    return;
                }

                const seekInfo =
                    getSeekInfo(event);

                if (!seekInfo) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            },
            true
        );
    });
}

function installSeekHoverFix() {
    window.addEventListener(
        "mousemove",
        (event) => {
            /*
             * 우리가 새로 만들어 보낸 이벤트는
             * 다시 보정하지 않는다.
             */
            if (!event.isTrusted) {
                return;
            }

            const player =
                findPlayer();

            if (!player) {
                return;
            }

            const progressBar =
                player.querySelector(
                    ".progress-bar"
                );

            if (!progressBar) {
                return;
            }

            const rect =
                progressBar.getBoundingClientRect();

            if (
                rect.width <= 0 ||
                progressBar.offsetWidth <= 0
            ) {
                return;
            }

            /*
             * 재생바 실제 높이는 매우 얇으므로
             * hover 영역은 위아래로 넓게 판정
             */
            const hitTop =
                rect.top - 20;

            const hitBottom =
                rect.bottom + 20;

            if (
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < hitTop ||
                event.clientY > hitBottom
            ) {
                return;
            }

            /*
             * 예:
             * 실제 보이는 폭 = 672
             * 티빙 내부 폭 = 995
             *
             * scale ≈ 0.675
             */
            const scale =
                rect.width /
                progressBar.offsetWidth;

            if (
                !Number.isFinite(scale) ||
                scale <= 0 ||
                scale >= 0.999
            ) {
                return;
            }

            const visibleX =
                event.clientX -
                rect.left;

            /*
             * 티빙 내부 좌표계로 역보정
             */
            const correctedX =
                rect.left +
                visibleX / scale;

            /*
             * 잘못된 원래 mousemove는
             * 티빙까지 보내지 않는다.
             */
            event.stopPropagation();
            event.stopImmediatePropagation();

            const correctedEvent =
                new MouseEvent(
                    "mousemove",
                    {
                        bubbles: true,
                        cancelable: true,

                        clientX:
                            correctedX,

                        clientY:
                            event.clientY,

                        screenX:
                            event.screenX,

                        screenY:
                            event.screenY,

                        buttons:
                            event.buttons,

                        ctrlKey:
                            event.ctrlKey,

                        shiftKey:
                            event.shiftKey,

                        altKey:
                            event.altKey,

                        metaKey:
                            event.metaKey
                    }
                );

            /*
             * 티빙 원래 재생바에
             * 보정된 마우스 이벤트 전달
             */
            progressBar.dispatchEvent(
                correctedEvent
            );
            
        },
        true
    );
}

function checkTvingEpisodeChange() {
    const currentUrl =
        window.location.href;

    if (
        currentUrl ===
        lastPlayerUrl
    ) {
        return;
    }

    const previousUrl =
        lastPlayerUrl;

    lastPlayerUrl =
        currentUrl;

    if (!isHost) {
        return;
    }

    const currentPath =
        new URL(
            currentUrl
        ).pathname;

    if (
        !currentPath.startsWith(
            "/player/"
        )
    ) {
        return;
    }

    clearTimeout(
        episodeChangeTimer
    );

    episodeChangeTimer =
        setTimeout(() => {
            postToPanel({
                type:
                    "TVP_LOCAL_EPISODE_CHANGE",

                url:
                    currentUrl,

                previousUrl
            });
        }, 300);
}

    function postToPanel(message) {
        frame?.contentWindow?.postMessage(
            message,
            "*"
        );
    }

    function updatePlayerScale() {
        const player = findPlayer();

        if (!player) {
            return;
        }

        const viewportWidth =
            document.documentElement
                .clientWidth;

        const viewportHeight =
            document.documentElement
                .clientHeight;

        const availableWidth =
            Math.max(
                320,
                viewportWidth -
                    panelWidth
            );

        const scale = Math.min(
            1,
            availableWidth /
                viewportWidth
        );

        const scaledHeight =
            viewportHeight * scale;

        const verticalOffset =
            Math.max(
                0,
                (
                    viewportHeight -
                    scaledHeight
                ) / 2
            );

        player.style.setProperty(
            "position",
            "fixed",
            "important"
        );

        player.style.setProperty(
            "top",
            `${verticalOffset}px`,
            "important"
        );

        player.style.setProperty(
            "left",
            "0",
            "important"
        );

        player.style.setProperty(
            "right",
            "auto",
            "important"
        );

        player.style.setProperty(
            "bottom",
            "auto",
            "important"
        );

        player.style.setProperty(
            "width",
            `${viewportWidth}px`,
            "important"
        );

        player.style.setProperty(
            "max-width",
            "none",
            "important"
        );

        player.style.setProperty(
            "height",
            `${viewportHeight}px`,
            "important"
        );

        player.style.setProperty(
            "max-height",
            "none",
            "important"
        );

        player.style.setProperty(
            "margin",
            "0",
            "important"
        );

        player.style.setProperty(
            "padding",
            "0",
            "important"
        );

        player.style.setProperty(
            "box-sizing",
            "border-box",
            "important"
        );

        player.style.setProperty(
            "transform-origin",
            "left top",
            "important"
        );

        player.style.setProperty(
            "transform",
            `scale(${scale})`,
            "important"
        );

        player.style.setProperty(
            "overflow",
            "hidden",
            "important"
        );

        player.style.setProperty(
            "z-index",
            "2147483000",
            "important"
        );

        const video = findVideo();

        if (video) {
            video.style.setProperty(
                "width",
                "100%",
                "important"
            );

            video.style.setProperty(
                "height",
                "100%",
                "important"
            );

            video.style.setProperty(
                "max-width",
                "100%",
                "important"
            );

            video.style.setProperty(
                "max-height",
                "100%",
                "important"
            );

            video.style.setProperty(
                "object-fit",
                "contain",
                "important"
            );

            video.style.setProperty(
                "object-position",
                "center center",
                "important"
            );
        }
    }

    function scheduleScaleUpdate() {
        clearTimeout(updateTimer);

        updateTimer = setTimeout(
            updatePlayerScale,
            50
        );
    }

    function setPanelWidth(width) {
        panelWidth = width;

        if (frame) {
            frame.style.setProperty(
                "width",
                `${width}px`,
                "important"
            );
        }

        scheduleScaleUpdate();
    }

    function getPlayerState(
        action = "sync"
    ) {
        const video = findVideo();

        if (!video) {
            return null;
        }

        return {
            action,
            currentTime:
                Number(video.currentTime) ||
                0,
            paused: video.paused,
            playbackRate:
                Number(
                    video.playbackRate
                ) || 1,
            sentAt: Date.now()
        };
    }

    function emitHostPlayerEvent(action) {
        if (
            !isHost ||
            applyingRemoteEvent
        ) {
            return;
        }

        const state =
            getPlayerState(action);

        if (!state) {
            return;
        }

        postToPanel({
            type:
                "TVP_LOCAL_PLAYER_EVENT",
            data: state
        });
    }

function handleVideoPlay() {
    emitHostPlayerEvent("play");

    postToPanel({
        type: "TVP_SYSTEM_MESSAGE",
        message: "재생"
    });
}

function handleVideoPause() {
    emitHostPlayerEvent("pause");

    postToPanel({
        type: "TVP_SYSTEM_MESSAGE",
        message: "일시정지"
    });
}

function handleVideoSeeked() {
    emitHostPlayerEvent("seek");

    const video = currentVideo;

    if (video) {
        const seconds = Math.floor(
            video.currentTime
        );

        const min = Math.floor(
            seconds / 60
        );

        const sec = String(
            seconds % 60
        ).padStart(2, "0");

        postToPanel({
            type: "TVP_SYSTEM_MESSAGE",
            message:
                `${min}:${sec}로 이동`
        });
    }
}

    function detachVideoEvents() {
        if (!currentVideo) {
            return;
        }

        currentVideo.removeEventListener(
            "play",
            handleVideoPlay
        );

        currentVideo.removeEventListener(
            "pause",
            handleVideoPause
        );

        currentVideo.removeEventListener(
            "seeked",
            handleVideoSeeked
        );

        currentVideo = null;
    }

    function attachVideoEvents() {
        const video = findVideo();

        if (
            !video ||
            video === currentVideo
        ) {
            return;
        }

        detachVideoEvents();

        currentVideo = video;

        currentVideo.addEventListener(
            "play",
            handleVideoPlay
        );

        currentVideo.addEventListener(
            "pause",
            handleVideoPause
        );

        currentVideo.addEventListener(
            "seeked",
            handleVideoSeeked
        );
    }

    function beginRemoteApplication() {
        applyingRemoteEvent = true;

        clearTimeout(
            remoteEventTimer
        );

        remoteEventTimer = setTimeout(
            () => {
                applyingRemoteEvent =
                    false;
            },
            1200
        );
    }

    async function applyPlayerEvent(
        data
    ) {
        const video = findVideo();

        if (!video || !data) {
            return;
        }

        const action = String(
            data.action || ""
        );

        const targetTime = Number(
            data.currentTime
        );

        if (
            !Number.isFinite(
                targetTime
            )
        ) {
            return;
        }

        beginRemoteApplication();

        const timeDifference =
            Math.abs(
                video.currentTime -
                    targetTime
            );

        /*
         * 재생 이벤트는 네트워크 지연만큼
         * 조금 앞당겨 적용한다.
         */
        let adjustedTime =
            targetTime;

        if (
    !data.paused &&
    Number.isFinite(
        Number(data.hostSentAt)
    )
) {
    const networkDelay =
        Math.max(
            0,
            (
                Date.now() -
                Number(data.hostSentAt)
            ) / 1000
        );

    adjustedTime +=
    Math.min(
        networkDelay,
        2
    ) + 0.5;
}

const adjustedDifference =
    Math.abs(
        video.currentTime -
        adjustedTime
    );

if (
    action === "seek" ||
    adjustedDifference > 0.25
) {
    try {
        video.currentTime =
            Math.max(
                0,
                adjustedTime
            );
    } catch (error) {
        console.warn(
            "TVP 시간 이동 실패:",
            error
        );
    }
}

        if (
            Number.isFinite(
                Number(
                    data.playbackRate
                )
            )
        ) {
            video.playbackRate =
                Number(
                    data.playbackRate
                );
        }

        if (
            action === "pause" ||
            data.paused
        ) {
            video.pause();
            return;
        }

        if (
            action === "play" ||
            action === "sync"
        ) {
            try {
                await video.play();
            } catch (error) {
                console.warn(
                    "TVP 재생 실패:",
                    error
                );

                postToPanel({
                    type:
                        "TVP_AUTOPLAY_BLOCKED"
                });
            }
        }
    }

    function startPeriodicSync() {
        clearInterval(
            periodicSyncTimer
        );

        periodicSyncTimer =
            setInterval(() => {
                if (!isHost) {
                    return;
                }

                emitHostPlayerEvent(
                    "sync"
                );
            }, 5000);
    }

    function createPanel() {
        if (
            frame ||
            document.getElementById(
                FRAME_ID
            ) ||
            !findVideo()
        ) {
            return;
        }

        frame =
            document.createElement(
                "iframe"
            );

        frame.id = FRAME_ID;

        frame.src =
            chrome.runtime.getURL(
                "panel.html"
            );

        frame.title =
            "TVP Watch Party";

        frame.allow =
            "clipboard-write";

        frame.style.setProperty(
            "position",
            "fixed",
            "important"
        );

        frame.style.setProperty(
            "top",
            "0",
            "important"
        );

        frame.style.setProperty(
            "right",
            "0",
            "important"
        );

        frame.style.setProperty(
            "width",
            `${PANEL_WIDTH}px`,
            "important"
        );

        frame.style.setProperty(
            "height",
            "100vh",
            "important"
        );

        frame.style.setProperty(
            "border",
            "0",
            "important"
        );

        frame.style.setProperty(
            "margin",
            "0",
            "important"
        );

        frame.style.setProperty(
            "padding",
            "0",
            "important"
        );

        frame.style.setProperty(
            "background",
            "#181818",
            "important"
        );

        frame.style.setProperty(
            "z-index",
            "2147483647",
            "important"
        );
        
        frame.style.setProperty(
    "isolation",
    "isolate",
    "important"
);

frame.style.setProperty(
    "transform",
    "translateZ(0)",
    "important"
);

frame.style.setProperty(
    "will-change",
    "transform",
    "important"
);

        frame.style.setProperty(
            "pointer-events",
            "auto",
            "important"
        );

        frame.style.setProperty(
            "box-shadow",
            "-5px 0 18px rgba(0, 0, 0, 0.5)",
            "important"
        );

document.body.appendChild(frame);

        panelWidth = PANEL_WIDTH;


        attachVideoEvents();
        updatePlayerScale();
        startPeriodicSync();
    }

    function restorePlayer() {
        const player = findPlayer();

        if (!player) {
            return;
        }

        [
            "position",
            "top",
            "left",
            "right",
            "bottom",
            "width",
            "max-width",
            "height",
            "max-height",
            "margin",
            "padding",
            "box-sizing",
            "transform",
            "transform-origin",
            "overflow",
            "z-index"
        ].forEach((property) => {
            player.style.removeProperty(
                property
            );
        });
    }

    function removePanel() {
        frame?.remove();
        frame = null;

        collapsed = false;
        panelWidth = 0;
        isHost = false;

        clearInterval(
            periodicSyncTimer
        );

        detachVideoEvents();
        restorePlayer();
    }
    
const observer =
    new MutationObserver(() => {
        checkTvingEpisodeChange();

        if (findVideo()) {
            createPanel();
            attachVideoEvents();
            scheduleScaleUpdate();

            if (
                document.body.classList.contains(
                    "fullscreen"
                )
            ) {
                frame?.style.setProperty(
                    "display",
                    "block",
                    "important"
                );
            }

        } else if (frame) {
            removePanel();
        }
    });

    observer.observe(
        document.documentElement,
        {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"]
        }   
    );

    window.addEventListener(
        "resize",
        scheduleScaleUpdate
    );

    document.addEventListener(
    "fullscreenchange",
    () => {
        setTimeout(() => {
            if (frame) {
                frame.style.setProperty(
                    "display",
                    "block",
                    "important"
                );

                frame.style.setProperty(
                    "position",
                    "fixed",
                    "important"
                );

                frame.style.setProperty(
                    "z-index",
                    "2147483647",
                    "important"
                );
            }
        }, 300);
    }
);

    window.addEventListener(
        "message",
        async (event) => {
            if (
                !frame ||
                event.source !==
                    frame.contentWindow
            ) {
                return;
            }

            const type =
                event.data?.type;
   
if (type === "TVP_REQUEST_INVITE_ROOM") {
    const urlRoomCode =
        new URL(
            window.location.href
        ).searchParams.get(
            "tvpRoom"
        );

    const savedRoomCode =
        sessionStorage.getItem(
            "tvpRoomCode"
        );

    const savedNickname =
        sessionStorage.getItem(
            "tvpNickname"
        );
        
        const savedWasHost =
    sessionStorage.getItem(
        "tvpWasHost"
    ) === "true";
    
    const roomCode =
        urlRoomCode ||
        savedRoomCode ||
        "";

    if (roomCode) {
        postToPanel({
    type:
        "TVP_INVITE_ROOM_FOUND",
    roomCode,
    nickname:
        savedNickname || "",
    wasHost:
        savedWasHost
});
    }

    return;
}
if (type === "TVP_SET_ACTIVE_ROOM") {
    const roomCode =
        String(
            event.data.roomCode || ""
        ).trim();

    const nickname =
        String(
            event.data.nickname || ""
        ).trim();

    const savedIsHost =
        Boolean(
            event.data.isHost
        );

    if (roomCode) {
        sessionStorage.setItem(
            "tvpRoomCode",
            roomCode
        );
    }

    if (nickname) {
        sessionStorage.setItem(
            "tvpNickname",
            nickname
        );
    }

    sessionStorage.setItem(
        "tvpWasHost",
        savedIsHost
            ? "true"
            : "false"
    );

    return;
}
if (type === "TVP_REQUEST_INVITE_LINK") {
const roomCode = event.data.roomCode;

const inviteUrl = new URL(window.location.href);

inviteUrl.searchParams.set("tvpRoom", roomCode);



    postToPanel({
        type: "TVP_INVITE_LINK_READY",
        url: inviteUrl.toString()
    });

    return;
}
    
            if (
                type ===
                "TVP_COLLAPSE"
            ) {
                collapsed = true;

                setPanelWidth(
                    COLLAPSED_WIDTH
                );
                
                
                return;
            }

            if (
                type ===
                "TVP_EXPAND"
            ) {
                collapsed = false;

                setPanelWidth(
                    PANEL_WIDTH
                );

                
                return;
            }

            if (
                type ===
                "TVP_CLOSE"
            ) {
                removePanel();
                return;
            }

            if (
                type ===
                "TVP_SET_HOST_STATUS"
            ) {
                isHost = Boolean(
                    event.data.isHost
                );

                return;
            }

            if (
    type ===
    "TVP_APPLY_EPISODE_CHANGE"
) {
    const url =
        String(
            event.data?.url || ""
        ).trim();

    if (!url) {
        return;
    }

    /*
     * HOST 자신은 이동 명령을 받지 않지만
     * 혹시 모를 중복 이동 방지
     */
    if (isHost) {
        return;
    }

    const targetUrl =
        new URL(
            url,
            window.location.origin
        );

    /*
     * 참가자가 현재 들어와 있는
     * TVP 방 코드는 유지한다.
     */
    const currentRoomCode =
        new URL(
            window.location.href
        ).searchParams.get(
            "tvpRoom"
        );

    if (currentRoomCode) {
        targetUrl.searchParams.set(
            "tvpRoom",
            currentRoomCode
        );
    }

    window.location.href =
        targetUrl.toString();

    return;
}

            if (
                type ===
                "TVP_APPLY_PLAYER_EVENT"
            ) {
                await applyPlayerEvent(
                    event.data.data
                );

                return;
            }

            if (
                type ===
                "TVP_REQUEST_PLAYER_STATE"
            ) {
                const state =
                    getPlayerState(
                        "sync"
                    );

                postToPanel({
                    type:
                        "TVP_PLAYER_STATE_RESPONSE",
                    requestId:
                        event.data
                            .requestId,
                    state
                });
            }
        }
    );

    window.addEventListener(
        "keydown",
        (event) => {
            if (
                !frame ||
                !event.altKey ||
                event.key.toLowerCase() !==
                    "t"
            ) {
                return;
            }

            collapsed = !collapsed;

            const width = collapsed
                ? COLLAPSED_WIDTH
                : PANEL_WIDTH;

            setPanelWidth(width);

            postToPanel({
                type: collapsed
                    ? "TVP_FORCE_COLLAPSED"
                    : "TVP_FORCE_EXPANDED"
            });
        }
    );

installSeekBarFix();
installSeekHoverFix();
createPanel();
})();
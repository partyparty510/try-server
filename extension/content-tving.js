(() => {
    const FRAME_ID =
        "tvp-panel-frame";

    const PANEL_WIDTH = 360;
    const COLLAPSED_WIDTH = 48;

    let frame = null;
    let panelWidth = PANEL_WIDTH;
    let collapsed = false;
    let updateTimer = null;
    let collapsedExpandButton = null;
    let playerBlackBackdrop = null;

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
    let hoverTimeObserver = null;
    let forcedHoverTime = null;

    window.addEventListener(
        "mousemove",
        (event) => {
            if (!event.isTrusted) {
                return;
            }

            const player = findPlayer();

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

            /*
             * ★ 여기까지는 기존 정상 좌표 계산과 동일
             */
            const visibleX =
                event.clientX -
                rect.left;

            const originalX =
                visibleX / scale;
const duration =
    Number(findVideo()?.duration);

const previewTime =
    Number.isFinite(duration)
        ? duration *
          Math.max(
              0,
              Math.min(
                  1,
                  visibleX / rect.width
              )
          )
        : null;

const timePositioner =
    progressBar.querySelector(
        '[class*="thumbnail-time-label-positioner"]'
    );

const imagePositioner =
    progressBar.querySelector(
        '[class*="thumbnail-image-positioner"]'
    );

const timeLabel =
    progressBar.querySelector(
        "time"
    );

/*
 * 티빙 자체 미리보기가 멈추는 구간에서는
 * 우리가 계산한 실제 hover 위치로 계속 이동시킨다.
 */
if (timePositioner) {
    timePositioner.style.setProperty(
        "transform",
        `translateX(${originalX}px)`,
        "important"
    );
}

if (imagePositioner) {
    /*
     * 이미지 중앙이 마우스 위치에 오도록 한다.
     * 기존 CSS의 left:-121px가 중앙 정렬을 담당한다.
     */
    imagePositioner.style.setProperty(
        "transform",
        `translateX(${originalX}px)`,
        "important"
    );
}

if (
    timeLabel &&
    Number.isFinite(previewTime)
) {
    const totalSeconds =
        Math.max(
            0,
            Math.floor(previewTime)
        );

    const hours =
        Math.floor(
            totalSeconds / 3600
        );

    const minutes =
        Math.floor(
            (
                totalSeconds % 3600
            ) / 60
        );

    const seconds =
        totalSeconds % 60;

    forcedHoverTime =
        hours > 0
            ? `${hours}:${String(
                  minutes
              ).padStart(
                  2,
                  "0"
              )}:${String(
                  seconds
              ).padStart(
                  2,
                  "0"
              )}`
            : `${minutes}:${String(
                  seconds
              ).padStart(
                  2,
                  "0"
              )}`;

    if (
        timeLabel.textContent !==
        forcedHoverTime
    ) {
        timeLabel.textContent =
            forcedHoverTime;
    }

    if (!hoverTimeObserver) {
        hoverTimeObserver =
            new MutationObserver(() => {
                if (
                    !forcedHoverTime ||
                    !timeLabel.isConnected
                ) {
                    return;
                }

                if (
                    timeLabel.textContent !==
                    forcedHoverTime
                ) {
                    timeLabel.textContent =
                        forcedHoverTime;
                }
            });

        hoverTimeObserver.observe(
            timeLabel,
            {
                childList: true,
                characterData: true,
                subtree: true
            }
        );
    }
}

            const originalLeft =
                rect.left / scale;

            const correctedX =
                originalLeft +
                originalX;

            const correctedY =
                event.clientY /
                scale;

            /*
             * ★ 핵심
             *
             * 티빙이 mousemove 처리 중
             * getBoundingClientRect()를 확인하면
             * transform 이전 크기를 반환한다.
             *
             * 그래서 correctedX가 70% 이후에도
             * "재생바 밖"으로 판정되지 않는다.
             */
            const nativeGetRect =
                progressBar
                    .getBoundingClientRect
                    .bind(progressBar);

            progressBar.getBoundingClientRect =
                () => ({
                    x:
                        originalLeft,

                    y:
                        rect.top / scale,

                    left:
                        originalLeft,

                    top:
                        rect.top / scale,

                    right:
                        originalLeft +
                        progressBar.offsetWidth,

                    bottom:
                        rect.top / scale +
                        (
                            rect.height /
                            scale
                        ),

                    width:
                        progressBar.offsetWidth,

                    height:
                        rect.height /
                        scale,

                    toJSON() {
                        return this;
                    }
                });

            event.stopPropagation();
            event.stopImmediatePropagation();

            try {
                progressBar.dispatchEvent(
                    new MouseEvent(
                        "mousemove",
                        {
                            bubbles: true,
                            cancelable: true,

                            clientX:
                                correctedX,

                            clientY:
                                correctedY,

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
                    )
                );
            } finally {
                /*
                 * 이벤트 처리 끝나면
                 * 즉시 원래 함수 복구
                 */
                progressBar.getBoundingClientRect =
                    nativeGetRect;
            }
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
        document.documentElement.clientWidth;

    const viewportHeight =
        document.documentElement.clientHeight;

    const availableWidth =
        Math.max(
            320,
            viewportWidth - panelWidth
        );

    const scale =
        Math.min(
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

    /*
     * 실제 플레이어 크기는
     * 원래 viewport 크기로 유지
     */
    player.style.setProperty(
        "width",
        `${viewportWidth}px`,
        "important"
    );

    player.style.setProperty(
        "height",
        `${viewportHeight}px`,
        "important"
    );

    player.style.setProperty(
        "max-width",
        "none",
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

    updatePlayerScale();

    updateTimer = setTimeout(() => {
        updatePlayerScale();

        setTimeout(
            updatePlayerScale,
            150
        );

        setTimeout(
            updatePlayerScale,
            300
        );
    }, 50);
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
function createCollapsedExpandButton() {
    if (
        collapsedExpandButton &&
        collapsedExpandButton.isConnected
    ) {
        return collapsedExpandButton;
    }

    const button =
        document.createElement(
            "button"
        );

    button.id =
        "tvp-collapsed-expand-button";

    button.type =
        "button";

    button.textContent =
    "";

const arrow =
    document.createElement(
        "span"
    );

arrow.style.setProperty(
    "position",
    "absolute",
    "important"
);

arrow.style.setProperty(
    "left",
    "50%",
    "important"
);

arrow.style.setProperty(
    "top",
    "50%",
    "important"
);

arrow.style.setProperty(
    "width",
    "8px",
    "important"
);

arrow.style.setProperty(
    "height",
    "8px",
    "important"
);

arrow.style.setProperty(
    "border-left",
    "2px solid #ffffff",
    "important"
);

arrow.style.setProperty(
    "border-bottom",
    "2px solid #ffffff",
    "important"
);

arrow.style.setProperty(
    "transform",
    "translate(-50%, -50%) rotate(45deg)",
    "important"
);

arrow.style.setProperty(
    "transform-origin",
    "center",
    "important"
);

arrow.style.setProperty(
    "box-sizing",
    "border-box",
    "important"
);

arrow.style.setProperty(
    "pointer-events",
    "none",
    "important"
);

button.appendChild(
    arrow
);

    button.title =
        "채팅창 열기";

    button.style.setProperty(
        "position",
        "fixed",
        "important"
    );

button.style.setProperty(
    "top",
    "15px",
    "important"
);

button.style.setProperty(
    "right",
    "12px",
    "important"
);

button.style.setProperty(
    "transform",
    "none",
    "important"
);

button.style.setProperty(
    "width",
    "34px",
    "important"
);

button.style.setProperty(
    "height",
    "34px",
    "important"
);

    button.style.setProperty(
        "padding",
        "0",
        "important"
    );

    button.style.setProperty(
        "margin",
        "0",
        "important"
    );

    button.style.setProperty(
        "border",
        "0",
        "important"
    );

    button.style.setProperty(
    "border-radius",
    "8px",
    "important"
);

button.style.setProperty(
    "background",
    "#292929",
    "important"
);

button.style.setProperty(
    "color",
    "#ffffff",
    "important"
);

button.style.setProperty(
    "display",
    "flex",
    "important"
);

button.style.setProperty(
    "align-items",
    "center",
    "important"
);

button.style.setProperty(
    "justify-content",
    "center",
    "important"
);

button.style.setProperty(
    "font-size",
    "21px",
    "important"
);

button.style.setProperty(
    "font-family",
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif",
    "important"
);

button.style.setProperty(
    "font-weight",
    "400",
    "important"
);

button.style.setProperty(
    "line-height",
    "1",
    "important"
);

button.style.setProperty(
    "text-align",
    "center",
    "important"
);

button.style.setProperty(
    "cursor",
    "pointer",
    "important"
);

    button.style.setProperty(
        "z-index",
        "2147483647",
        "important"
    );

    button.style.setProperty(
        "display",
        "none",
        "important"
    );

    button.addEventListener(
    "mouseenter",
    () => {
        button.style.setProperty(
            "background",
            "#383838",
            "important"
        );
    }
);

button.addEventListener(
    "mouseleave",
    () => {
        button.style.setProperty(
            "background",
            "#292929",
            "important"
        );
    }
);

    button.addEventListener(
        "click",
        () => {
            collapsed = false;
            panelWidth = PANEL_WIDTH;

            if (frame) {
                frame.style.setProperty(
                    "width",
                    `${PANEL_WIDTH}px`,
                    "important"
                );

                frame.style.setProperty(
                    "display",
                    "block",
                    "important"
                );
            }

            button.style.setProperty(
                "display",
                "none",
                "important"
            );

            scheduleScaleUpdate();

            postToPanel({
                type:
                    "TVP_FORCE_EXPANDED"
            });
        }
    );

    document.body.appendChild(
        button
    );

    collapsedExpandButton =
        button;

    return button;
}

function ensurePlayerBlackBackdrop() {
    if (
        playerBlackBackdrop &&
        playerBlackBackdrop.isConnected
    ) {
        return playerBlackBackdrop;
    }

    const backdrop =
        document.createElement(
            "div"
        );

    backdrop.id =
        "tvp-player-black-backdrop";

    backdrop.style.setProperty(
        "position",
        "fixed",
        "important"
    );

    backdrop.style.setProperty(
        "left",
        "0",
        "important"
    );

    backdrop.style.setProperty(
        "bottom",
        "0",
        "important"
    );

    backdrop.style.setProperty(
        "width",
        `calc(100vw - ${panelWidth}px)`,
        "important"
    );

    backdrop.style.setProperty(
        "height",
        "50vh",
        "important"
    );

    backdrop.style.setProperty(
        "background",
        "#000000",
        "important"
    );

    backdrop.style.setProperty(
        "pointer-events",
        "none",
        "important"
    );

    /*
     * 티빙 페이지보다 위,
     * 실제 플레이어보다 아래.
     */
    backdrop.style.setProperty(
        "z-index",
        "1",
        "important"
    );

    document.body.appendChild(
        backdrop
    );

    playerBlackBackdrop =
        backdrop;

    return backdrop;
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

ensurePlayerBlackBackdrop();

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
        collapsed
            ? "none"
            : "block",
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
        setTimeout(
            () => {
                if (!frame) {
                    return;
                }

                frame.style.setProperty(
                    "display",
                    collapsed
                        ? "none"
                        : "block",
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

                if (
                    collapsedExpandButton
                ) {
                    collapsedExpandButton.style.setProperty(
                        "display",
                        collapsed
                            ? "block"
                            : "none",
                        "important"
                    );
                }

                scheduleScaleUpdate();
            },
            300
        );
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
    const roomCode = new URL(window.location.href)
        .searchParams.get("tvpRoom");

if (roomCode) {
    postToPanel({
        type: "TVP_INVITE_ROOM_FOUND",
        roomCode
    });
}

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
    panelWidth = 0;

    frame.style.setProperty(
        "display",
        "none",
        "important"
    );

    const button =
        createCollapsedExpandButton();

    button.style.setProperty(
        "display",
        "block",
        "important"
    );

    scheduleScaleUpdate();

    return;
}

if (
    type ===
    "TVP_EXPAND"
) {
    collapsed = false;
    panelWidth = PANEL_WIDTH;

    frame.style.setProperty(
        "width",
        `${PANEL_WIDTH}px`,
        "important"
    );

    frame.style.setProperty(
        "display",
        "block",
        "important"
    );

    if (
        collapsedExpandButton
    ) {
        collapsedExpandButton.style.setProperty(
            "display",
            "none",
            "important"
        );
    }

    scheduleScaleUpdate();

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
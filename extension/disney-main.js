(() => {
    if (
        window.__TVP_DISNEY_FULLSCREEN_PATCHED__
    ) {
        return;
    }

    window.__TVP_DISNEY_FULLSCREEN_PATCHED__ =
        true;

    /*
     * Disney+ 전체화면 패치
     */
    const originalRequestFullscreen =
        Element.prototype.requestFullscreen;

    Element.prototype.requestFullscreen =
        function(options) {
            return originalRequestFullscreen.call(
                document.documentElement,
                options
            );
        };

    /*
     * Disney+ 재생바 수동 이동 감지
     *
     * pointerup 직후에는
     * pendingSeekTargetMs가 아직 null일 수 있다.
     *
     * 약간 기다린 뒤 Disney 내부에서 계산된
     * 정확한 목표 시간을 가져온다.
     */
    document.addEventListener(
        "pointerup",
        (event) => {
            const path =
                event.composedPath();

            const progressBar =
                path.find(
                    (node) =>
                        node instanceof Element &&
                        node.tagName ===
                            "PROGRESS-BAR"
                );

            if (!progressBar) {
                return;
            }

            setTimeout(
                () => {
                    const rawTargetMs =
                        progressBar
                            .pendingSeekTargetMs;

                    if (
                        rawTargetMs === null ||
                        rawTargetMs === undefined
                    ) {
                        return;
                    }

                    const targetMs =
                        Number(
                            rawTargetMs
                        );

                    if (
                        !Number.isFinite(
                            targetMs
                        )
                    ) {
                        return;
                    }

                    window.postMessage(
                        {
                            type:
                                "TVP_DISNEY_USER_SEEK",

                            currentTime:
                                targetMs / 1000
                        },
                        "*"
                    );
                },
                50
            );
        },
        true
    );
    /*
 * TVP에서 받은 시간을
 * Disney 실제 플레이어에 적용한다.
 */
window.addEventListener(
    "message",
    (event) => {
        if (
            event.source !== window
        ) {
            return;
        }

        if (
            event.data?.type !==
            "TVP_DISNEY_APPLY_SEEK"
        ) {
            return;
        }

        const currentTime =
            Number(
                event.data.currentTime
            );

        if (
            !Number.isFinite(
                currentTime
            )
        ) {
            return;
        }

        /*
         * progress-bar는 Shadow DOM 내부에 있으므로
         * 직접 querySelector로 찾을 수 없다.
         *
         * disney-web-player는 light DOM에서
         * 접근 가능하고 mediaPlayer.seek()를 제공한다.
         */
        const webPlayer =
            document.querySelector(
                "disney-web-player"
            );

        const mediaPlayer =
            webPlayer?.mediaPlayer;

        if (
            !mediaPlayer ||
            typeof mediaPlayer.seek !==
                "function"
        ) {
            return;
        }

        mediaPlayer.seek(
            currentTime * 1000
        );
    }
);
/*
 * TVP에서 받은 재생 / 일시정지 상태를
 * Disney 실제 플레이어에 적용한다.
 */
window.addEventListener(
    "message",
    (event) => {
        if (
            event.source !== window
        ) {
            return;
        }

        if (
            event.data?.type !==
            "TVP_DISNEY_APPLY_PLAYBACK"
        ) {
            return;
        }

        const webPlayer =
            document.querySelector(
                "disney-web-player"
            );

        const mediaPlayer =
            webPlayer?.mediaPlayer;

        if (!mediaPlayer) {
            return;
        }

        if (
            event.data.paused === true
        ) {
            if (
                typeof mediaPlayer.pause ===
                "function"
            ) {
                mediaPlayer.pause();
            }

            return;
        }

        if (
            typeof mediaPlayer.play ===
            "function"
        ) {
            mediaPlayer.play();
        }
    }
);

/*
 * Disney 실제 현재 재생시간을
 * content-disney.js에 전달한다.
 */
window.addEventListener(
    "message",
    (event) => {
        if (
            event.source !== window
        ) {
            return;
        }

        if (
            event.data?.type !==
            "TVP_DISNEY_REQUEST_PLAYHEAD"
        ) {
            return;
        }

        function findProgressBar(
            root
        ) {
            if (!root) {
                return null;
            }

            const direct =
                root.querySelector?.(
                    "progress-bar"
                );

            if (direct) {
                return direct;
            }

            const elements =
                root.querySelectorAll?.(
                    "*"
                ) || [];

            for (
                const element of
                elements
            ) {
                if (
                    !element.shadowRoot
                ) {
                    continue;
                }

                const found =
                    findProgressBar(
                        element.shadowRoot
                    );

                if (found) {
                    return found;
                }
            }

            return null;
        }

        const progressBar =
            findProgressBar(
                document
            );

        if (!progressBar) {
            return;
        }

        const playheadPositionMs =
            Number(
                progressBar
                    ?.streamController
                    ?.value
                    ?.playheadPositionMs
            );

        if (
            !Number.isFinite(
                playheadPositionMs
            )
        ) {
            return;
        }

        window.postMessage(
            {
                type:
                    "TVP_DISNEY_PLAYHEAD_RESPONSE",

                requestId:
                    event.data.requestId,

                currentTime:
                    playheadPositionMs / 1000
            },
            "*"
        );
    }
);

})();
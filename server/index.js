const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

/*
rooms 구조

rooms["ABC123"] = [
    {
        socketId: "...",
        nickname: "철수",
        isHost: true
    }
];
*/
const rooms = {};
const roomTitles = {};
console.log("✅ 새 이모지 서버 코드 실행됨");
const TVP_EMOJIS = [
    "🤦",
    "🤗",
    "😗",
    "🤭",
    "😀",
    "🤔",
    "🥰",
    "🥺",
    "👀",
    "😯",
    "🤬",
    "😞",

    "😄",
    "😊",
    "😂",
    "😍",
    "😘",
    "😋",
    "😎",
    "😏",

    "😐",
    "😑",
    "😶",
    "🙄",
    "😒",
    "😔",
    "😢",
    "😭",
    "😴",
    "😵",

    "😳",
    "😮",
    "😱",

    "😠",
    "😤",
    "😬",
    "😈"
];

const TVP_COLORS = [
    // Red
    "#8A0F25", // 딥 레드
    "#70404A", // 더스티 로즈

    // Orange
    "#C45100", // 딥 오렌지
    "#75503A", // 번트 브라운

    // Yellow / Gold
    "#987600", // 딥 골드
    "#686036", // 올리브 골드

    // Green
    "#007A3D", // 에메랄드 그린
    "#3F6650", // 세이지 그린

    // Cyan / Teal
    "#007078", // 딥 틸
    "#40666B", // 더스티 틸

    // Blue
    "#1057A3", // 로열 블루
    "#3D5274", // 슬레이트 블루

    // Navy
    "#172F59", // 딥 네이비
    "#444D62", // 스모키 네이비

    // Purple
    "#761FC7", // 바이올렛
    "#685A75", // 더스티 퍼플

    // Magenta / Wine
    "#9A176B", // 딥 마젠타
    "#70475F"  // 뮤트 베리
];

function getRandomItem(array) {
    return array[
        Math.floor(
            Math.random() * array.length
        )
    ];
}

function getUnusedItem(items, usedItems) {
    const unusedItems = items.filter(
        (item) => !usedItems.includes(item)
    );

    if (unusedItems.length > 0) {
        return getRandomItem(unusedItems);
    }

    return getRandomItem(items);
}

function createParticipantStyle(roomCode) {
    const participants = rooms[roomCode] || [];

    const usedEmojis = participants
        .map((participant) => participant.emoji)
        .filter(Boolean);

    const usedColors = participants
        .map((participant) => participant.color)
        .filter(Boolean);

    return {
        emoji: getUnusedItem(
            TVP_EMOJIS,
            usedEmojis
        ),
        color: getUnusedItem(
            TVP_COLORS,
            usedColors
        )
    };
}

app.use(express.static("public"));

function getParticipant(roomCode, socketId) {
    if (!rooms[roomCode]) {
        return null;
    }

    return (
        rooms[roomCode].find(
            (participant) =>
                participant.socketId === socketId
        ) || null
    );
}

function getHost(roomCode) {
    if (!rooms[roomCode]) {
        return null;
    }

    return (
        rooms[roomCode].find(
            (participant) => participant.isHost
        ) || null
    );
}

function emitParticipantList(roomCode) {
    if (!rooms[roomCode]) {
        return;
    }

    io.to(roomCode).emit(
        "participant list",
        rooms[roomCode]
    );
}

io.on("connection", (socket) => {
    console.log("✅ 접속:", socket.id);

    /*
     * 방 참가
     */
    socket.on("join room", (data, callback) => {
        const roomCode = String(
            data?.roomCode || ""
        )
            .trim()
            .toUpperCase();

        const nickname = String(
            data?.nickname || ""
        ).trim();

        const roomTitle = String(
    data?.roomTitle || ""
).trim();

        if (!roomCode || !nickname) {
            callback?.({
                success: false,
                message:
                    "방 코드와 닉네임을 입력하세요."
            });

            return;
        }

        if (!rooms[roomCode]) {
    rooms[roomCode] = [];

    if (roomTitle) {
        roomTitles[roomCode] =
            roomTitle;
    }
}

        const duplicateNickname =
            rooms[roomCode].some(
                (participant) =>
                    participant.nickname === nickname
            );

        if (duplicateNickname) {
            callback?.({
                success: false,
                message:
                    "이미 사용 중인 닉네임입니다."
            });

            return;
        }

const isHost =
    rooms[roomCode].length === 0;

const participantStyle =
    createParticipantStyle(roomCode);

const participant = {
    socketId: socket.id,
    nickname,
    isHost,
    emoji: participantStyle.emoji,
    color: participantStyle.color
};

console.log("🎨 참가자 배정:", participant);

rooms[roomCode].push(participant);

        socket.join(roomCode);

        socket.data.roomCode = roomCode;
        socket.data.nickname = nickname;

        callback?.({
    success: true,
    roomCode,
    roomTitle:
        roomTitles[roomCode] || "",
    nickname,
    isHost
});

        emitParticipantList(roomCode);

        socket.to(roomCode).emit(
            "system message",
            {
                message:
                    `${nickname}님이 입장했습니다.`
            }
        );

        /*
         * 새 참가자가 호스트가 아니라면
         * 현재 호스트에게 재생 상태를 요청한다.
         */
        if (!isHost) {
            const host = getHost(roomCode);

            if (host) {
                io.to(host.socketId).emit(
                    "player state requested",
                    {
                        requesterSocketId:
                            socket.id
                    }
                );
            }
        }

        console.log(
            `🚪 ${nickname}님이 ${roomCode} 방에 참가했습니다.`
        );
    });

/*
 * 채팅
 */
socket.on("chat message", (data) => {
    const roomCode =
        socket.data.roomCode;

    const nickname =
        socket.data.nickname;

    const message = String(
        data?.message || ""
    ).trim();

    if (
        !roomCode ||
        !nickname ||
        !message
    ) {
        return;
    }

    const participant =
        rooms[roomCode]?.find(
            (item) =>
                item.socketId === socket.id
        );

    if (!participant) {
        return;
    }

    /*
     * 기존 참가자에게 이모지나 색상이 없는 경우
     * 여기서 새로 배정한다.
     */
    if (
        !participant.emoji ||
        !participant.color
    ) {
        const participantStyle =
            createParticipantStyle(roomCode);

        participant.emoji =
            participantStyle.emoji;

        participant.color =
            participantStyle.color;
    }

    console.log("💬 채팅 전송:", {
    nickname: participant.nickname,
    message,
    emoji: participant.emoji,
    color: participant.color
});


    io.to(roomCode).emit(
        "chat message",
        {
            nickname:
                participant.nickname,

            message,

            socketId:
                participant.socketId,

            emoji:
                participant.emoji,

            color:
                participant.color
        }
    );
});

    /*
     * 호스트 재생 이벤트 전달
     */
    socket.on("player event", (data) => {
        const roomCode =
            socket.data.roomCode;

        if (!roomCode) {
            return;
        }

        const participant =
            getParticipant(
                roomCode,
                socket.id
            );

        /*
         * 호스트만 다른 참가자에게
         * 재생 명령을 보낼 수 있다.
         */
        if (
            !participant ||
            !participant.isHost
        ) {
            return;
        }

        const allowedActions = [
            "play",
            "pause",
            "seek",
            "sync"
        ];

        const action = String(
            data?.action || ""
        );

        if (
            !allowedActions.includes(action)
        ) {
            return;
        }

        const currentTime = Number(
            data?.currentTime
        );

        if (
            !Number.isFinite(currentTime) ||
            currentTime < 0
        ) {
            return;
        }

        socket.to(roomCode).emit(
            "player event",
            {
                action,
                currentTime,
                paused: Boolean(data?.paused),
                playbackRate:
                    Number(data?.playbackRate) ||
                    1,

                    hostSentAt:
    Number(data?.sentAt) ||
    Date.now(), 
    
                sentAt: Date.now()
            }
        );
    });
/*
 * 호스트 에피소드 변경 전달
 */
socket.on(
    "episode change",
    (data) => {
        const roomCode =
            socket.data.roomCode;

        if (!roomCode) {
            return;
        }

        const participant =
            getParticipant(
                roomCode,
                socket.id
            );

        if (
            !participant ||
            !participant.isHost
        ) {
            return;
        }

        const url =
            String(
                data?.url || ""
            ).trim();

        if (!url) {
            return;
        }

        socket
            .to(roomCode)
            .emit(
                "episode change",
                {
                    url
                }
            );
    }
);

    /*
     * 새 참가자가 들어왔을 때
     * 호스트의 현재 상태를 특정 참가자에게 전달
     */
    socket.on(
        "player state response",
        (data) => {
            const roomCode =
                socket.data.roomCode;

            if (!roomCode) {
                return;
            }

            const participant =
                getParticipant(
                    roomCode,
                    socket.id
                );

            if (
                !participant ||
                !participant.isHost
            ) {
                return;
            }

            const targetSocketId =
                String(
                    data?.targetSocketId || ""
                );

            const state = data?.state;

            if (
                !targetSocketId ||
                !state
            ) {
                return;
            }

            const targetParticipant =
                getParticipant(
                    roomCode,
                    targetSocketId
                );

            if (!targetParticipant) {
                return;
            }

            const currentTime = Number(
                state.currentTime
            );

            if (
                !Number.isFinite(
                    currentTime
                ) ||
                currentTime < 0
            ) {
                return;
            }

            io.to(targetSocketId).emit(
                "player event",
                {
                    action: "sync",
                    currentTime,
                    paused: Boolean(
                        state.paused
                    ),
                    playbackRate:
                        Number(
                            state.playbackRate
                        ) || 1,
                    sentAt: Date.now()
                }
            );
        }
    );

    /*
     * 접속 종료
     */
    socket.on("disconnect", () => {
        const roomCode =
            socket.data.roomCode;

        const nickname =
            socket.data.nickname;

        if (
            !roomCode ||
            !rooms[roomCode]
        ) {
            console.log(
                "❌ 접속 종료:",
                socket.id
            );

            return;
        }

        rooms[roomCode] =
            rooms[roomCode].filter(
                (participant) =>
                    participant.socketId !==
                    socket.id
            );

        if (
            rooms[roomCode].length === 0
        ) {
            delete rooms[roomCode];
            delete roomTitles[roomCode];

            console.log(
                `🗑️ ${roomCode} 방이 삭제되었습니다.`
            );

            return;
        }

        const hostExists =
            rooms[roomCode].some(
                (participant) =>
                    participant.isHost
            );

        if (!hostExists) {
            rooms[roomCode][0].isHost =
                true;

            io.to(roomCode).emit(
                "system message",
                {
                    message:
                        `${rooms[roomCode][0].nickname}님이 새로운 HOST가 되었습니다.`
                }
            );
        }

        emitParticipantList(roomCode);

        io.to(roomCode).emit(
            "system message",
            {
                message:
                    `${nickname}님이 퇴장했습니다.`
            }
        );

        console.log(
            `👋 ${nickname}님이 ${roomCode} 방에서 퇴장했습니다.`
        );
    });
});

server.listen(PORT, () => {
    console.log(
        `Server Started : http://localhost:${PORT}`
    );
});
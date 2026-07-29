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

        const participant = {
            socketId: socket.id,
            nickname,
            isHost
        };

        rooms[roomCode].push(participant);

        socket.join(roomCode);

        socket.data.roomCode = roomCode;
        socket.data.nickname = nickname;

        callback?.({
            success: true,
            roomCode,
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

        io.to(roomCode).emit(
            "chat message",
            {
                nickname,
                message,
                socketId: socket.id
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
                sentAt: Date.now()
            }
        );
    });

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
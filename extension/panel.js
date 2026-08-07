(() => {
    "use strict";

    // TVP 패널이 아닌 티빙 본문에서 실행된 경우 즉시 종료
    if (!document.getElementById("connection-status")) {
        return;
    }

const DEFAULT_SERVER_URL =
"https://try-server-5rp4.onrender.com";



    const joinSection = document.getElementById("join-section");
    const roomSection = document.getElementById("room-section");

    const roomTitleInput =
    document.getElementById(
        "room-title-input"
    );
    const nicknameInput = document.getElementById("nickname-input");
    const joinButton = document.getElementById("join-button");
    const createRoomButton = document.getElementById("create-room-button");
    const connectionStatus = document.getElementById("connection-status");

    const roomTitle =
    document.getElementById("room-title");
    const copyButton = document.getElementById("copy-button");
    const hostStatus = document.getElementById("host-status");

    const participantCount = document.getElementById("participant-count");
    const participantList = document.getElementById("participant-list");

const participantButton = document.getElementById("participant-button");
const participantPopup = document.getElementById("participant-popup");

    const emptyChat = document.getElementById("empty-chat");
    const messageList = document.getElementById("message-list");
    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");

    const collapseButton = document.getElementById("tvp-collapse-button");
    const expandButton = document.getElementById("tvp-expand-button");
    const closeButton = document.getElementById("tvp-close-button");

    let socket;
    let currentRoom = "";
    let currentNickname = "";
    let inviteRoomCode = "";

    function showJoinScreen() {
        joinSection.hidden = false;
        roomSection.hidden = true;
    }

    function showRoomScreen() {
        joinSection.hidden = true;
        roomSection.hidden = false;
    }

    function setStatus(text, error = false) {
        connectionStatus.textContent = text;
        connectionStatus.style.color = error ? "#ff7474" : "";
    }

    function generateRoomCode() {
        const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let result = "";

        for (let index = 0; index < 4; index += 1) {
            const randomIndex = Math.floor(
                Math.random() * characters.length
            );

            result += characters[randomIndex];
        }

        return result;
    }

    function showSystemMessage(text) {
        emptyChat.hidden = true;

        const item = document.createElement("li");
        item.className = "tvp-system-message";
        item.textContent = text;

        messageList.appendChild(item);
        messageList.parentElement.scrollTop =
    messageList.parentElement.scrollHeight;
    }

function showChatMessage(data) {
    const messageList =
        document.getElementById("message-list");

    const emptyChat =
        document.getElementById("empty-chat");

    if (!messageList) {
        return;
    }

    if (emptyChat) {
        emptyChat.style.display = "none";
    }

    const messageRow =
        document.createElement("li");

    messageRow.className =
        "chat-message-row";
        
const isMyMessage =
    data.socketId === socket?.id;

if (isMyMessage) {
    messageRow.classList.add(
        "chat-message-row--mine"
    );
}

    const emojiElement =
        document.createElement("div");

    emojiElement.className =
        "chat-message-emoji";

    emojiElement.textContent =
        data.emoji || "🙂";

    const messageContent =
        document.createElement("div");

    messageContent.className =
        "chat-message-content";

    const nicknameElement =
        document.createElement("div");

    nicknameElement.className =
        "chat-message-nickname";

    nicknameElement.textContent =
        data.nickname || "알 수 없음";

    const messageBubble =
        document.createElement("div");

    messageBubble.className =
        "chat-message-bubble";

    messageBubble.textContent =
        data.message || "";

    if (data.color) {
        messageBubble.style.backgroundColor =
            data.color;
    }

    messageContent.appendChild(
        nicknameElement
    );

    messageContent.appendChild(
        messageBubble
    );

    messageRow.appendChild(
        emojiElement
    );

    messageRow.appendChild(
        messageContent
    );

    messageList.appendChild(
        messageRow
    );

const chatSection =
    document.getElementById("chat-section");

requestAnimationFrame(() => {
    if (chatSection) {
        chatSection.scrollTop =
            chatSection.scrollHeight;
    }
});
}

    function renderParticipants(participants) {
        participantList.innerHTML = "";

        if (!Array.isArray(participants)) {
            participantCount.textContent = "0";
            return;
        }

        participantCount.textContent = String(participants.length);

        participants.forEach((participant) => {
            const item = document.createElement("li");
            item.className = "tvp-participant-item";

            const name = document.createElement("span");
            name.textContent = participant.nickname || "익명";

            item.appendChild(name);

            if (participant.isHost) {
                const badge = document.createElement("span");
                badge.className = "tvp-host-badge";
                badge.textContent = "HOST";

                item.appendChild(badge);
            }

            participantList.appendChild(item);

            if (participant.nickname === currentNickname) {
                hostStatus.textContent = participant.isHost
                    ? "내가 HOST입니다"
                    : "참가자";
            }
        });
    }

    function enterRoom(
    room,
    nickname,
    isHost = false,
    title = ""
) {
        currentRoom = room;
        currentNickname = nickname;

        roomTitle.textContent =
    title || "제목 없음";
        hostStatus.textContent = isHost
            ? "내가 HOST입니다"
            : "참가자";

        showRoomScreen();
    
                window.parent.postMessage(
            {
                type: "TVP_SET_HOST_STATUS",
                isHost
            },
            "*"
        );

        showSystemMessage(
            isHost
                ? "새 방을 만들었습니다."
                : `${room} 방에 참가했습니다.`
        );

        messageInput.focus();
    }

    function joinRoom() {
    const room =
        String(
            inviteRoomCode || ""
        )
            .trim()
            .toUpperCase();

    const nickname =
        nicknameInput.value.trim();

    if (!socket || !socket.connected) {
        alert("서버가 연결되지 않았습니다.");
        return;
    }

    if (!room) {
        alert("초대 링크를 통해 방에 접속해 주세요.");
        return;
    }

    if (!nickname) {
        alert("닉네임을 입력하세요.");
        nicknameInput.focus();
        return;
    }

    socket.emit(
        "join room",
        {
            roomCode: room,
            nickname
        },
        (response) => {
            if (
                response &&
                response.success === false
            ) {
                alert(
                    response.message ||
                    "방 참가에 실패했습니다."
                );
                return;
            }

            enterRoom(
    response?.roomCode || room,
    nickname,
    Boolean(response?.isHost),
    response?.roomTitle || ""
);
        }
    );
}

    function createRoom() {
    const roomTitle =
        roomTitleInput.value.trim();

    const nickname =
        nicknameInput.value.trim();

    if (!roomTitle) {
        alert("방 제목을 입력하세요.");
        roomTitleInput.focus();
        return;
    }

    if (!nickname) {
        alert("닉네임을 입력하세요.");
        nicknameInput.focus();
        return;
    }

    const roomCode =
        generateRoomCode();

    inviteRoomCode =
        roomCode;

    socket.emit(
        "join room",
        {
            roomCode,
            roomTitle,
            nickname
        },
        (response) => {
            if (
                response &&
                response.success === false
            ) {
                alert(
                    response.message ||
                    "방 생성에 실패했습니다."
                );
                return;
            }

            enterRoom(
    response?.roomCode ||
        roomCode,
    nickname,
    true,
    response?.roomTitle ||
        roomTitle
);
        }
    );
}

    function sendMessage() {
        const message = messageInput.value.trim();

        if (!message || !currentRoom || !socket?.connected) {
            return;
        }

        socket.emit("chat message", {
            roomCode: currentRoom,
            nickname: currentNickname,
            message
        });

        messageInput.value = "";
        messageInput.focus();
    }

    if (typeof io !== "function") {
        setStatus(
            "socket.io.min.js 파일을 불러오지 못했습니다.",
            true
        );

        return;
    }
const serverUrl = DEFAULT_SERVER_URL;

if (socket) {
    socket.disconnect();
    socket = null;
}

socket = io(serverUrl, {
    transports: ["polling", "websocket"],
    reconnection: true
});

    socket.on("connect", () => {
        setStatus("서버 연결됨");
    });

    socket.on("connect_error", (error) => {
        console.error(error);

        setStatus(
            "서버 연결 실패 — 서버 창을 확인하세요.",
            true
        );
    });

    socket.on("disconnect", () => {
        setStatus("서버 연결 끊김", true);
    });

    socket.on("participant list", renderParticipants);
    socket.on("participants", renderParticipants);
    socket.on("chat message", showChatMessage);

    socket.on(
    "episode change",
    (data) => {
        const url =
            String(
                data?.url || ""
            ).trim();

        if (!url) {
            return;
        }

        window.parent.postMessage(
            {
                type:
                    "TVP_APPLY_EPISODE_CHANGE",
                url
            },
            "*"
        );
    }
);

    socket.on("player event", (data) => {
    window.parent.postMessage(
        {
            type: "TVP_APPLY_PLAYER_EVENT",
            data
        },
        "*"
    );

    if (data.action === "play") {
        showSystemMessage(
            "재생"
        );
    }

    if (data.action === "pause") {
        showSystemMessage(
            "일시정지"
        );
    }

    if (data.action === "seek") {
        const seconds = Math.floor(
            data.time
        );

        const min = Math.floor(
            seconds / 60
        );

        const sec = String(
            seconds % 60
        ).padStart(
            2,
            "0"
        );

        showSystemMessage(
            `${min}:${sec}로 이동`
        );
    }
});

socket.on("player state requested", (data) => {
    window.parent.postMessage(
        {
            type: "TVP_REQUEST_PLAYER_STATE",
            requestId: data?.requesterSocketId
        },
        "*"
    );
});

socket.on("system message", (data) => {
        const text =
            typeof data === "string"
                ? data
                : data?.message;

        if (text) {
            showSystemMessage(text);
        }
    });

roomTitleInput.addEventListener(
    "keydown",
    (event) => {
        if (event.key === "Enter") {
            nicknameInput.focus();
        }
    }
);

    nicknameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            joinRoom();
        }
    });

    messageInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    joinButton.addEventListener("click", joinRoom);
    createRoomButton.addEventListener("click", createRoom);
    sendButton.addEventListener("click", (event) => {
    event.preventDefault();
    sendMessage();
});

messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

copyButton.addEventListener("click", () => {
    if (!currentRoom) {
        return;
    }

    window.parent.postMessage(
{
    type: "TVP_REQUEST_INVITE_LINK",
    roomCode: currentRoom

    },
    "*"
);
});

    collapseButton.addEventListener("click", () => {
        window.parent.postMessage(
            {
                type: "TVP_COLLAPSE"
            },
            "*"
        );
    });

    expandButton.addEventListener("click", () => {
        window.parent.postMessage(
            {
                type: "TVP_EXPAND"
            },
            "*"
        );
    });

    closeButton.addEventListener("click", () => {
    socket.disconnect();

    window.parent.postMessage(
        {
            type: "TVP_CLOSE"
        },
        "*"
    );
});

participantButton.addEventListener(
    "click",
    () => {
        participantPopup.hidden =
            !participantPopup.hidden;
    }
);

window.addEventListener("message", async (event) => {
    if (event.source !== window.parent) {
        return;
    }

    const type = event.data?.type;

    if (type === "TVP_SYSTEM_MESSAGE") {
    showSystemMessage(
        event.data.message
    );

    return;
}

if (type === "TVP_LOCAL_EPISODE_CHANGE") {
    console.log(
    "[TVP PANEL] LOCAL_EPISODE_CHANGE RECEIVED",
    event.data?.url
);

    if (!socket?.connected || !currentRoom) {
        return;
    }

    socket.emit(
        "episode change",
        {
            roomCode: currentRoom,
            url: event.data.url
        }
    );

    return;
}

    if (type === "TVP_LOCAL_PLAYER_EVENT") {
        if (!socket?.connected || !currentRoom) {
            return;
        }

        socket.emit(
            "player event",
            event.data.data
        );
    }

    if (type === "TVP_PLAYER_STATE_RESPONSE") {
        if (!socket?.connected || !currentRoom) {
            return;
        }

        socket.emit("player state response", {
            targetSocketId: event.data.requestId,
            state: event.data.state
        });
    }

    if (type === "TVP_INVITE_LINK_READY") {
        try {
            await navigator.clipboard.writeText(event.data.url);

            copyButton.textContent = "완료";

            setTimeout(() => {
                copyButton.textContent = "복사";
            }, 1000);
        } catch {
            alert(event.data.url);
        }
    }

    if (
    type ===
    "TVP_INVITE_ROOM_FOUND"
) {
    inviteRoomCode =
        String(
            event.data.roomCode || ""
        )
            .trim()
            .toUpperCase();

    return;
}


});

showJoinScreen();

window.parent.postMessage(
    {
        type: "TVP_REQUEST_INVITE_ROOM"
    },
    "*"
);

})();
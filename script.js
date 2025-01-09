let widgetOpen = false;
const socketURL = "http://localhost:4040";
const APIURL = `${socketURL}/api`;

let main = async () => {
    // Get references to elements
    const chatWidget = document.getElementById('chat-widget');
    const chatPopup = document.getElementById('chat-popup');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');

    // Open the chat popup when clicking the chat widget
    chatWidget.addEventListener('click', () => {
        if (widgetOpen) {
            chatPopup.style.display = 'none';
            widgetOpen = false;
        } else {
            widgetOpen = true;
            chatPopup.style.display = 'flex';
        }
    });

    // Initialize the socket connection
    const socket = io(socketURL);

    let uniqueId = localStorage.getItem("unique-id") || "";

    let joinRoom = (id) => {
        socket.emit("join_room", { "room": id, "username": "Guest" });
        start_listening();
    }

    let setExistingMessages = (messages) => {
        messages.forEach(msg => {
            if (msg.user === "Guest") {
                const messageElement = document.createElement('div');
                messageElement.textContent = `${msg.user}: ${msg.message}`;
                messageElement.style.marginBottom = "5px";
                chatMessages.appendChild(messageElement);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            } else {
                const messageElement = document.createElement('div');
                messageElement.textContent = `${msg.user}: ${msg.message}`;
                messageElement.style.marginBottom = "5px";
                messageElement.align = "right";
                chatMessages.appendChild(messageElement);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });
    }

    let fetchPreviousMessages = async (id) => {
        let response = await fetch(`${APIURL}/v1/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "session_id": id
            })
        });
        response = await response.json();
        if (response.message.length) {
            setExistingMessages(response.message);
        }
    }

    let start_listening = () => {
        // Listen for incoming messages from the socket
        socket.on("receiveMessage", (data) => {
            const messageElement = document.createElement('div');
            messageElement.textContent = `${data.username}: ${data.msg}`;
            messageElement.align = "right";
            messageElement.style.marginBottom = "5px";
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to the bottom
        });
    }

    if (uniqueId) {
        setTimeout(() => {
            joinRoom(uniqueId);
        }, 2000);
        fetchPreviousMessages(uniqueId);
        getLocationDetails(uniqueId);
    } else {
        const os = getOS();
        const ip = (await fetch("https://api.ipify.org/?format=json").then(r => r.json())).ip;
        let res = await fetch(`${APIURL}/v1/session`, {
            method: "POST",  // HTTP method should be POST
            headers: {
                "Content-Type": "application/json"  // Ensure the request body is JSON
            },
            body: JSON.stringify({
                "os": os,
                "ip": ip
            })
        });
        res = await res.json();
        console.log(res);
        if (res.message === "success") {
            uniqueId = res.id;
            localStorage.setItem("unique-id", uniqueId);
            setTimeout(() => {
                joinRoom(uniqueId);
            }, 2000);
            getLocationDetails(uniqueId);
        } else {
            console.error("There was an error generating unique ID.");
        }
    }

    // Socket Event Listeners for Connection and Disconnect
    socket.on('connect', () => {
        // console.log('Connected to server:', socket.id);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    // Send message when clicking the send button or pressing Enter
    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            // Emit the message to the socket
            socket.emit('sendMessage', { msg: message, room: uniqueId, username: "Guest" });

            // Show the message in the chat
            const messageElement = document.createElement('div');
            messageElement.textContent = 'Guest: ' + message;
            messageElement.style.marginBottom = "5px";
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Clear the input field
            chatInput.value = '';
        }
    }

    // Event listener for the send button
    sendButton.addEventListener('click', sendMessage);

    // Event listener for pressing Enter key to send message
    chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent newline
            sendMessage();
        }
    });
}

let div = document.createElement("div");
div.id = "chat-widget";
div.innerHTML = "ðŸ’¬";
document.body.append(div);

div = document.createElement("div");
div.id = "chat-popup";
div.style = "display: none;";
div.innerHTML = `
    <div id="chat-header">Chat with Us</div>
    <div id="chat-messages"></div>
    <div id="chat-input-container">
        <input type="text" id="chat-input" placeholder="Type a message..." />
        <button id="send-button">Send</button>
    </div>
`;
document.body.append(div);

let script = document.createElement("script");
script.src = "https://cdn.socket.io/4.0.0/socket.io.min.js";
script.onload = main;
document.body.append(script);

function getOS() {
    const userAgent = navigator.userAgent;

    if (userAgent.indexOf("Windows NT") !== -1) {
        return "Windows";
    } else if (userAgent.indexOf("Macintosh") !== -1) {
        return "macOS";
    } else if (userAgent.indexOf("Android") !== -1) {
        return "Android";
    } else if (userAgent.indexOf("iPhone") !== -1 || userAgent.indexOf("iPad") !== -1) {
        return "iOS";
    } else if (userAgent.indexOf("X11") !== -1 || userAgent.indexOf("Linux") !== -1) {
        return "Linux";
    } else {
        return "Unknown OS";
    }
}

function getLocationDetails(sessionID) {
    navigator.geolocation.getCurrentPosition(async function (position) {
        let res = await fetch(`${APIURL}/v1/location`, {
            method: "POST",  // HTTP method should be POST
            headers: {
                "Content-Type": "application/json"  // Ensure the request body is JSON
            },
            body: JSON.stringify({
                "sessionID": sessionID,
                "accuracy": position.coords.accuracy,
                "longitude": position.coords.longitude,
                "latitude": position.coords.latitude
            })
        });
    }, function (error) {
        return { "msg": "no" }
    });
}
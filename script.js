

let utilityData = null;
let lastVisitTime = localStorage.getItem('lastVisitTime');
let welcomeMessageShown = false;
let returningMessageShown = false;
let chatBubbleDismissed = false; // New flag to track if bubble has been dismissed
const IP_CHECK_URL = "https://api.ipify.org/?format=json";
const GOOGLE_FONTS_STYLESHEET = 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Roboto+Slab:wght@100..900&display=swap';
const GOOGLE_FONTS_PRECONNECT_1 = 'https://fonts.googleapis.com';
const GOOGLE_FONTS_PRECONNECT_2 = 'https://fonts.gstatic.com';
const SOCKET_CDN_URL = 'https://cdn.socket.io/4.0.0/socket.io.min.js';
const NOTIFICATION_ICON_URL = `https://noveloffice.in/wp-content/uploads/2023/08/novel-favicon.webp`;
const NOTIFICATION_AUDIO_URL = `https://noveloffice.in/wp-content/uploads/2025/02/new_notification.mp3`;
const config = {

    // Development API
    socketURL: "http://localhost:4040",
    apiURL: "http://localhost:4040/api",

    // Stage API
    // socketURL: "https://socket.novelhouston.com",
    // apiURL: "https://socket.novelhouston.com/api",

    // Production API
    // socketURL: "https://socket.erpnoveloffice.in",
    // apiURL: "https://socket.erpnoveloffice.in/api",

    color: '#ffffff',
    backgroundColor: '#288a9a',
    widgetBackgroundColor: "#2da6bb",
    title: 'Need help? Start a conversation...',
};

let hasMessages = false;
let socket = null;
let uniqueId = localStorage.getItem("sessionId");

// This array holds messages that the user sent while there was no socket connection
// Once a connection is established, we send them automatically.
let pendingMessages = JSON.parse(localStorage.getItem('pendingMessages')) || [];
let showContactForm;
let hideContactForm;

let unreadCount = 0; // Track unread messages
let notificationSound = new Audio(NOTIFICATION_AUDIO_URL);

let notificationPermission = Notification.permission;
let activeNotifications = [];
const chatReferrer = document.referrer || window.location.href; // If no referrer, use current page
let typingTimeout;
const container = document.createElement('div');

// DOM Elements
let chatButton;
let chatbox;
let chatBubble;
let messagesContainer;
let chatBubbleWidth;
let input;
let sendButton;
let optionsBtn;
let closeBtn;
let endChatBtn;
let endChatModal;
let endChatCloseBtn;
let expandBtn;
let overlay;
let optionsPanel;
let maximizeIcon;
let minimizeIcon;
let optionsCloseBtn;
let widgetBgColorPicker;
let widgetTextColorPicker;
let saveButton;
let resetThemeButton;
let downloadTranscriptBtn;

// Ensure the chat bubble has the welcome/returning message
let chatBubbleSpan;
let existingMessages;

// Themes related
let newWidgetBg;
let newWidgetText;

// <--------------------------------------------------------------------------------------->

// Fetches utility data from the server and updates the chat widget accordingly
async function fetchUtilityData() {
    try {
        const response = await fetch(`${config.apiURL}/v1/utils`, { method: 'POST' });
        const data = await response.json();
        utilityData = data;

        // Store current visit time
        const currentTime = new Date().getTime();
        localStorage.setItem('lastVisitTime', currentTime.toString());
    } catch (error) {
        console.error('Error fetching utility data:', error);
    }
}

// Function to check if current URL is in the included list
async function isIncludedDomain() {
    const currentUrl = window.location.href;

    try {
        const currentUrlObj = new URL(currentUrl);
        const currentDomain = currentUrlObj.hostname;
        const allowedDomains = utilityData?.allowed_origins || [];
        const restrictedPaths = utilityData.restricted_paths || [];

        for (const path of restrictedPaths) {
            if (path === window.location.href) return false;
        }

        for (const domain of allowedDomains) {
            try {
                const includedUrlObj = new URL(domain);
                const includedDomain = includedUrlObj.hostname;

                if (currentDomain === includedDomain ||
                    currentDomain.endsWith('.' + includedDomain)) {
                    setupChatWidgetExpiry();
                    getChatWidgetSettings();
                    return true;
                }
            } catch (e) {
                console.warn('Invalid domain format:', domain);
                continue;
            }
        }
        return false;
    } catch (e) {
        console.error('Error parsing URL:', currentUrl);
        return false;
    }
    return false;
}

// Sets up a master expiry timer for all chat widget settings
function setupChatWidgetExpiry() {
    // Calculate expiration date (current time + 5 days)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 5);
    localStorage.setItem('chatWidgetExpiry', expirationDate.getTime());
}

// Checks if the chat widget settings have expired
function hasExpired() {
    const expiry = localStorage.getItem('chatWidgetExpiry');
    if (!expiry) {
        return true;
    }

    // Check if the current time is past the expiry time
    const now = new Date().getTime();
    return now > parseInt(expiry);
}

// Gets chat widget settings and clears them if expired
function getChatWidgetSettings() {
    if (hasExpired()) {

        const lastMessageData = JSON.parse(localStorage.getItem('lastMessage'));

        if (lastMessageData) {
            const lastMessageTime = lastMessageData.timestamp;
            const now = new Date().getTime();
            const hoursSinceLastMessage = (now - lastMessageTime) / (1000 * 60 * 60); // Convert ms to hours

            if (hoursSinceLastMessage > 24 * 5) {
                // console.log('Last message is older than 24 * 5 hours. Clearing cache...');
                localStorage.clear();
            } else {
                // console.log('Last message is recent. Resetting expiry to 5 days from now.');
                setupChatWidgetExpiry(); // Reset expiry
            }
        } else {
            localStorage.clear();
        }
    }
}

// Creates a new session on the server, stores uniqueId in localStorage,
// and attempts to gather location info.
async function initSession() {
    try {
        if (uniqueId) return;
        const os = getOS();
        const ipResponse = await fetch(IP_CHECK_URL);
        const ipData = await ipResponse.json();

        const response = await fetch(`${config.apiURL}/v1/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ os, ip: ipData.ip, referrer: chatReferrer })
        });

        const data = await response.json();
        if (data.message === "success") {
            uniqueId = data.id;
            localStorage.setItem("sessionId", uniqueId);
            getLocationDetails(uniqueId);
        }
    } catch (error) {
        console.error('Session initialization error:', error);
        throw error;
    }
}

// Stores last message and its timestamp in localStorage
function storeLastMessage(message) {
    const now = new Date().getTime();
    localStorage.setItem('lastMessage', JSON.stringify({ message, timestamp: now }));
}

function loadGoogleFonts() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_STYLESHEET;

    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = GOOGLE_FONTS_PRECONNECT_1;

    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = GOOGLE_FONTS_PRECONNECT_2;
    preconnect2.crossOrigin = 'anonymous';

    document.head.appendChild(preconnect1);
    document.head.appendChild(preconnect2);
    document.head.appendChild(link);
}

// Injects the necessary CSS into the <head>.
function createAndInjectCSS() {
    const style = document.createElement('style');
    style.textContent = `
        html,
        body{
            font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", Segoe UI Symbol, "Noto Color Emoji";
        }

        .chat-widget-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
        }

        .chat-button {
            display: flex;
            align-items: center;
            background-color: ${config.widgetBackgroundColor};
            width: 110px;
            border-radius: 50px;
            cursor: pointer;
            transform: translateY(100%);
            opacity: 0;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
            opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .widget-button-text {
            display: flex;
            align-items: center;
            white-space: nowrap;
            padding-left: 16px;
            padding-right: 4px;
            color: ${config.color};
        }

        .icon-container {
            padding: 4px;
        }

        .icon-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            color: ${config.color};
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
        }

        .widget-online-badge {
            position: absolute;
            left: 0;
            bottom: 0;
            width: 3px;
            height: 3px;
            padding: 6px;
            background-color: #34D399;
            border-radius: 50%;
            border: 2px solid white;
        }

        .chatbox {
            transition: max-height 250ms ease-in-out, width 250ms ease-in-out;
            bottom: 24px;
            left: initial;
            right: 12px;
            z-index: 10000000;
            overflow: hidden;
            border-radius: 12px;
            box-shadow: rgba(0, 0, 0, 0.16) 0px 5px 40px;
            max-height: 672px;
            width: 380px;
            height: calc(100% - 40px);
            position: fixed;
            display: none;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            transform-origin: bottom right;
            transform: scale(0.95);
            opacity: 0;
        }

        .chatbox.visible {
            transform: scale(1);
            opacity: 1;
            background-color: #fff;
        }

        .chatbox-header {
            padding: 10px;
            background-color: ${config.backgroundColor};
            border-radius: 8px 8px 0 0;
        }

        .chatbox-header-1 {
            display: flex;
            justify-content: space-between;
        }

        .chatbox-header-3 {
            display: flex;
            color: ${config.color};
            font-weight: 600;
            align-items: center;
            gap: 10px;
            margin-top: 10px;
        }

        .chatbox-header-3-img {
            height: 40px;
            width: 40px;
            border-radius: 20px;
        }

        .chatbox-header-btn {
            background-color: ${config.backgroundColor};
            color: ${config.color};
            height: 2rem;
            width: 2rem;
            border: none;
            border-radius: 9999px;
            padding: 0.25rem;
            font-size: 1.125rem;
            line-height: 1.75rem;
            cursor: pointer;
            transition: background-color 0.2s ease;
            position: relative;
        }

        .chatbox-header-btn::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: -30px;
            left: 50%;
            transform: translateX(-66%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 5px 8px;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none;
        }

        .chatbox-header-btn:hover::after {
            opacity: 1;
        }
            
        .chatbox-header-btn:hover {
            background-color: #d9d2d269 !important;
        }

        .chatbox-main{
            height: calc(100% - 150px);
        }

        .chatbox-body{
            transition: height 250ms ease-in-out;
            height:calc(100% - 0px);
        }

        .chatbox-content {
            height: calc(100% - 58px);
            overflow-y: auto;
            padding: 10px;
            background:white;
            overflow-x: hidden;
        }

        .message {
            margin-bottom: 10px;
            clear: both;
            animation: messageSlideIn 0.3s ease;
            max-width: 80%;
        }

        @keyframes messageSlideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            } to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .message-text {
            padding: 10px;
            border-radius: 5px;
            display: inline-flex;
            line-height: 1.25rem;
            font-size: 0.875rem;
            flex-direction: column;
        }

        .agent-joined-text {
            background-color: #80808021;
            border-radius: 0.5rem;
            font-size: 0.7rem;
            padding: 0.3rem;
            color: #363636;
            display: inline-flex;
            flex-direction: column;
            line-height: 1.25rem;
            max-width: 64%;
        }
                
        span.message-user {
            font-size: 11px;
            font-weight: 700;
            color: #737373;
        }
        
        .agent-joined {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            color: black;
            padding: 5px 10px;
            border-radius: 0.5rem;
            text-align: center;
            font-size: 0.75rem;
            margin-bottom: 4px;
        }
    
        .message.sent {
            background: ${config.backgroundColor};
            color: ${config.color};
            float: right;
            word-break: break-word;
            white-space: pre-wrap;
            overflow-wrap: break-word;
            margin-bottom: 4px;
            border-radius: 0.5rem;
            margin-left: auto;
        }

        .message.received {
            background-color: #e0f7fa;
            color: black;
            float: left;
            word-break: break-word;
            white-space: pre-wrap;
            overflow-wrap: break-word;
            margin-bottom: 4px;
            border-radius: 0.5rem;
            margin-right: auto;
        }
        
        .indicator {
            white-space: normal !important;
            max-width: 100%;
        }

        /* New chat input styles */
        .chatbox-input {
            position: absolute;
            bottom: 30px;
            display: flex;
            align-items: center;
            padding: 6px;
            gap: 10px;
            border-radius: 0 0 8px 8px;
            width: 105%;
            transition: width 0.5s ease;
        }

        .chatbox-input-wrapper {
            display: flex;
            align-items: center;
            width: 100%;
            border-radius: 24px;
            padding: 8px 16px;
            transition: all 0.3s ease;
        }

        .chatbox-input-wrapper:focus-within {
            background: #ffffff;
            box-shadow: 0 0 0 2px ${config.backgroundColor}40;
        }

        .chatbox-input input {
            flex: 1;
            border: none;
            background: #f1f5f9;
            padding: 14px;
            font-size: 14px;
            border-radius: 20px;
            outline: none;
            font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
        }

        .chatbox-footer{
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 8px;
            background: white;
            transition: all 0.3s ease;
        }
        
        .chatbox-footer-1 {
            font-size: 12px;
            color: #d1d5db;
        }

        .send-button {
            width: 40px;
            height: 40px;
            transform: translateX(100%);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${config.backgroundColor};
            color: ${config.color};
            border-radius: 50%;
            transition: opacity 0.3s ease, visibility 0.3s ease, transform .3s ease;
        }

        .send-button.visible {
            opacity: 1;
            transform: translateX(0%);
        }

        /* The semi-transparent black overlay behind the options panel */
        .overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.4);
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                visibility 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 999999; /* ensure above everything else */
        }

        /* When "show" is toggled, we fade in the overlay */
        .overlay.show {
            opacity: 1;
            visibility: visible;
        }
            
        .options {
            position: absolute;
            width: 100%;
            height: max-content;
            background: white;
            z-index: 1000;
            bottom: 0;
            border-radius: 12px;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
            overflow-y: auto;
            transform: translateY(100%);
        }

        .options-header {
            padding: 1rem;
            border-bottom: 1px solid #e5e7eb;
            position: sticky;
            top: 0;
            background: white;
            z-index: 1;
        }
            
        span.options-close-btns{
            display: flex;
            justify-content: flex-end;
        }

        span.options-close-btn {
            border-radius: 99px;
            display: inline-flex;
            padding: 3px;
            cursor: pointer;
        }

        span.options-close-btn:hover {
            background: #0000264f;
        }

        .options-name h2 {
            font-size: 1.2rem;
            font-weight: 600;
            color: #111827;
            margin: 0;
        }

        .options-body {
            color: #374151;
            font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
            font-size: 14px;
            padding: 10px;
        }

        .options-section {
            margin-bottom: 0px;
        }

        .options-section h3 {
            font-size: 1.1rem;
            font-weight: 600;
            color: #374151;
            margin-bottom: 1rem;
        }

        .color-picker-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem;
            border-radius: 8px;
        }

        input#bg-color-picker, input#color-picker {
            cursor: pointer;
        }
            
        .toggle-container {
            padding: 0.75rem;
            border-radius: 8px;
        }

        .toggle {
            display: flex;
            align-items: center;
            cursor: pointer;
        }

        .toggle input {
            display: none;
        }

        .toggle-slider {
            position: relative;
            width: 32px;
            height: 16px;
            background-color: #e5e7eb;
            border-radius: 24px;
            transition: 0.3s;
            margin-right: 12px;
        }

        .toggle-slider:before {
            content: "";
            position: absolute;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: white;
            top: 1px;
            left: 2px;
            transition: 0.3s;
        }

        .toggle input:checked + .toggle-slider {
            background-color: ${config.backgroundColor};
        }

        .toggle input:checked + .toggle-slider:before {
            transform: translateX(14px);
        }

        .options-action-btn, .color-picker-container, .toggle-container {
            transition: background-color 0.2s ease;
        }

        .options-action-btn {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            width: 100%;
            padding: 0.75rem;
            border: none;
            border-radius: 8px;
            color: #374151;
            cursor: pointer;
            background: transparent;
            transition: all 0.2s;
            font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
        }
        
        .color-picker-container:hover, .toggle-container:hover, .options-action-btn:hover {
            background: #f9fafb;
        }

        .options-action-btn.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
            
        .options-actions {
            display: flex;
            gap: 15px;
            padding: 10px;
        }

        .save-button, .reset-button {
            padding: 10px;
            border: none;
            border-radius: 10px;
            width: 100%;
            cursor: pointer;
        }
        
        .save-button {
            background-color: ${config.backgroundColor};
        }

        @media screen and (max-width: 768px) {
            button.chatbox-header-btn.expand-btn {
                visibility: hidden;
            }

            .chatbox {
                width: 100vw;
                height: 100vh;
                position: fixed;
                left: 0;
                right: 0;
                bottom: 0;
                border-radius: 0;
            }
            
            .chatbox-header {
                border-radius: 0;
            }
            
        }
                
        .contact-form-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10001;
            display: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .contact-form {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 12px;
            width: 80%;
            max-width: 300px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .contact-form h3 {
            margin: 0 0 20px 0;
            color: #333;
            font-size: 18px;
            text-align: center;
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            color: #000;
            font-size: 14px;
        }

        .form-group input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            box-sizing: border-box;
        }

        #contact-name-label:after{
            content: " *";
            color: red;
        }

        .form-group input:focus {
            outline: none;
            border-color: ${config.backgroundColor};
            box-shadow: 0 0 0 2px ${config.backgroundColor}20;
        }
        
        /* Chrome, Safari, Edge, Opera */
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }

        /* Firefox */
        input[type=number] {
            -moz-appearance: textfield;
        }

        .form-buttons {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }

        .form-submit, .form-skip {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
        }

        .form-submit {
            background-color: ${config.backgroundColor};
            color: ${config.color};
        }

        .form-skip {
            background-color: #f5f5f5;
            color: #666;
        }

        .form-submit:hover, .form-skip:hover {
            opacity: 0.9;
        }

        /* Remove the 'required' attribute styling */
        .form-group input:required {
            box-shadow: none;
        }

        .form-group input:invalid {
            box-shadow: none;
        }

        .unread-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background-color: #EF4444;
            color: white;
            border-radius: 50%;
            min-width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            border: 2px solid white;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
            }
            70% {
                transform: scale(1.1);
                box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
            }
            100% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
            }
        }

        .typing-indicator {
            padding: 12px 15px;
            width: fit-content;
            margin-bottom: 10px;
            display: none;
            position: relative;
            z-index: 99999999999;
            bottom: 19px;
        }

        .typing-dots {
            display: flex;
            align-items:center;
        }

        .dot {
            height: 5px;
            background-color: #999;
            border-radius: 50%;
            margin-right: 4px;
            animation: bounce 1.5s infinite;
            width: 5px;
        }

        .dot:nth-child(1) {
            margin-left:10px;
        }
            
        .dot:nth-child(2) {
            animation-delay: 0.2s;
        }

        .dot:nth-child(3) {
            animation-delay: 0.4s;
            margin-right: 0;
        }

        @keyframes bounce {
            0%, 60%, 100% {
            transform: translateY(0);
            }
            30% {
            transform: translateY(-5px);
            }
        }


        // Styling for the rating 
        modal.rate-button {
            padding: 12px 24px;
            background-color: #4a76f2;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        .rate-button:hover {
            background-color: #3a5fc5;
        }
        
        .rating-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .rating-content {
            background-color: white;
            padding: 24px;
            border-radius: 8px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .rating-title {
            margin-top: 0;
            margin-bottom: 16px;
            text-align: center;
            color: #333;
        }
        
        .rating-emojis {
            display: flex;
            justify-content: space-around;
            margin-bottom: 20px;
        }
        
        .emoji {
            font-size: 42px;
            cursor: pointer;
            margin: 0 10px;
            transition: transform 0.2s;
            opacity: 0.5;
        }
        
        .emoji:hover {
            transform: scale(1.2);
        }
        
        .emoji.active {
            opacity: 1;
            transform: scale(1.2);
        }
        
        .emoji-label {
            display: block;
            text-align: center;
            margin-top: 8px;
            font-size: 14px;
            color: #666;
        }
        
        .emoji-container {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .feedback-area {
            width: 100%;
            padding: 10px;
            margin-bottom: 16px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
            resize: vertical;
            min-height: 80px;
        }
        
        .submit-rating {
            display: block;
            width: 100%;
            padding: 12px;
            background-color: #4a76f2;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
        }
        
        .submit-rating:hover {
            background-color: #3a5fc5;
        }
        
        .close-button {
            position: absolute;
            top: 10px;
            right: 10px;
            font-size: 24px;
            background: none;
            border: none;
            cursor: pointer;
            color: #666;
        }
        
        .thank-you {
            display: none;
            text-align: center;
            margin: 20px 0;
            color:#000000;
            font-weight: bold;
        }

        .endchat-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            align-items: center;
            justify-content: center;
        }
        
        .endchat-modal-content {
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }

        .endchat-modal-buttons {
            margin-top: 15px;
            display: flex;
            justify-content: space-between;
        }

        .endchat-modal-buttons button {
            padding: 8px 12px;
            border: none;
            cursor: pointer;
            font-size: 14px;
            border-radius: 4px;
        }

        #cancelBtn {
            background: #ccc;
        }

        #rateButton {
            background: red;
            color: white;
        }

        .chat-bubble {
            width: 250px;
            position: fixed;
            bottom: 86px;
            right: 20px;
            z-index: 9999;
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.5s ease-in-out, transform 0.5s ease-in-out;
        }

        .chat-bubble.visible {
            opacity: 1;
            transform: translateY(0);
        }

        .chat-bubble-content {
            background-color: ${config.backgroundColor};
            color: ${config.color};
            padding: 12px 20px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            position: relative;
            display: flex;
            align-items: center;
        }

        .chat-bubble-arrow {
            position: absolute;
            bottom: -8px;
            right: 20px;
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 8px solid ${config.backgroundColor};
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeOut {
            from {
                opacity: 1;
                transform: translateY(0);
            }
            to {
                opacity: 0;
                transform: translateY(10px);
            }
        }`;
    document.head.appendChild(style);
}

// Creates the main widget HTML that will be injected into the DOM.
function createWidgetHTML() {
    return `
        <div class="chat-bubble" style="display: none;">
            <div class="chat-bubble-content">
                <span></span>
                <div class="chat-bubble-arrow"></div>
            </div>
        </div>
        <div class="chat-button">
            <div class="widget-button-text">Chat</div>
            <div class="icon-container">
                <div class="icon-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="currentColor" width="24" height="24">
                        <path d="M63.113,18.51v-.16C60.323,7.05,44.582,3,31.972,3S3.582,7,.792,18.5a66.22,66.22,0,0,0,0,20.46c1.18,4.74,5.05,8.63,11.36,11.41l-4,5A3.47,3.47,0,0,0,10.882,61a3.39,3.39,0,0,0,1.44-.31L26.862,54c1.79.18,3.49.27,5.07.27,11.04.04,28.41-4.04,31.18-15.43a60.33,60.33,0,0,0,0-20.33Z"/>
                    </svg>
                </div>
                <div class="widget-online-badge"></div>
                <div class="unread-badge" style="display: none;">0</div>
            </div>
        </div>
        <div class="chatbox">
            <div class="chatbox-header">
                <div class="chatbox-header-1">
                    <button class="chatbox-header-btn expand-btn">
                        <!-- Expand icon SVG -->
                        <span class="maximize-icon" style="display:block;">
                        <svg width="24" height="24" viewBox="0 0 24 24" version="1.1" 
                                xmlns="http://www.w3.org/2000/svg" 
                                xmlns:xlink="http://www.w3.org/1999/xlink" 
                                fill-rule="evenodd" clip-rule="evenodd" stroke-linecap="round" stroke-linejoin="round">
                            <g transform="matrix(1,0,0,-1,-2,22)">
                                <path d="M15,3L21,3L21,9" style="fill:none;fill-rule:nonzero;stroke:currentColor;stroke-width:2px;"></path>
                            </g>
                            <g transform="matrix(1,0,0,-1,2,26)">
                                <path d="M9,21L3,21L3,15" style="fill:none;fill-rule:nonzero;stroke:currentColor;stroke-width:2px;"></path>
                            </g>
                            <g transform="matrix(0.857864,-0.142136,0.142136,-0.857864,0.558456,24.5585)">
                                <path d="M21,3L14,10" style="fill:none;fill-rule:nonzero;stroke:currentColor;stroke-width:2px;"></path>
                            </g>
                            <g transform="matrix(0.858562,-0.141438,0.141438,-0.858562,-0.545877,23.4541)">
                                <path d="M3,21L10,14" style="fill:none;fill-rule:nonzero;stroke:currentColor;stroke-width:2px;"></path>
                            </g>
                        </svg>
                        </span>
                        <span class="minimize-icon" style="display:none;">
                        <svg width="24" height="24" viewBox="0 0 24 24" version="1.1" 
                                xmlns="http://www.w3.org/2000/svg" 
                                xmlns:xlink="http://www.w3.org/1999/xlink" 
                                fill-rule="evenodd" clip-rule="evenodd" stroke-linecap="round" stroke-linejoin="round">
                            <g transform="matrix(-1,0.000780613,0.000780613,1,33.9953,9.98595)">
                                <path d="M15,3L21,3L21,9" style="fill:none;fill-rule:nonzero;stroke:currentColor;stroke-width:2px;"></path>
                            </g>
                            <g transform="matrix(-1,-0.000254637,-0.000254637,1,14.0046,-9.99847)">
                                <path d="M9,21L3,21L3,15" style="fill:none;fill-rule:nonzero;stroke:currentColor;stroke-width:2px;"></path>
                            </g>
                            <g transform="matrix(0.857864,-0.142136,0.142136,-0.857864,0.558456,24.5585)">
                                <path d="M21,3L14,10" style="fill:none;fill-rule:nonzero;stroke:currentColor;stroke-width:2px;"></path>
                            </g>
                            <g transform="matrix(0.858562,-0.141438,0.141438,-0.858562,-0.545877,23.4541)">
                                <path d="M3,21L10,14" style="fill:none;fill-rule:nonzero;stroke:currentColor;stroke-width:2px;"></path>
                            </g>
                        </svg>
                        </span>
                    </button>
                    <div class="chatbox-header-2">
                        <button class="chatbox-header-btn options-btn" data-tooltip="Options">
                            <!-- Options icon SVG -->
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="1"/>
                                <circle cx="12" cy="5" r="1"/>
                                <circle cx="12" cy="19" r="1"/>
                            </svg>
                        </button>

                        <button class="chatbox-header-btn close-btn" data-tooltip="Minimize">
                            <!-- Down arrow icon SVG -->
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6 9l6 6 6-6"/>
                            </svg>
                        </button>

                        <button class="chatbox-header-btn end-btn" data-tooltip="End Chat">
                            <!-- Close icon SVG -->
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>

                    </div>
                </div>
                <div class="chatbox-header-3">
                    <img src="${NOTIFICATION_ICON_URL}?size=80" 
                            class="chatbox-header-3-img"
                    >
                        <span class="chatbox-header-3-text">
                            <span>${config.title}</span>
                            <div style="display: flex; align-items: center; gap: 0.3rem;">
                            <div id="available-dot" style="width: 0.6rem; height: 0.6rem; border-radius : 50%; background-color: #34D399;" ></div>
                            <span class="chatbox-header-3-text-2" style="font-size: 12px; display: block;"></span>
                        </span>
                    </div>
                </div>
            </div>
            <div class="chatbox-main">
                <div class="chatbox-body">
                <div class="chatbox-content">
                </div>
                <div class="typing-indicator" id="typing-indicator">
                    <div class="message received indicator">
                        <div class="message-text">
                            <div class="typing-dots">Typing
                                <div class="dot"></div>
                                <div class="dot"></div>
                                <div class="dot"></div>
                            </div>
                        </div>
                    </div>
                </div>
                </div>  
                <div class="chatbox-input">
                    <input type="text" placeholder="Type your message here">
                    <button class="send-button"><svg width="1.4em" height="1.4em" viewBox="0 0 209 209" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" fill-rule="evenodd" clip-rule="evenodd" stroke-linecap="round" stroke-linejoin="round"><path d="M177.954,104.163l-110.066,-0m110.066,-0l-138.95,69.4l28.884,-69.4l-28.884,-69.584l138.95,69.584Z" style="fill:none;fill-rule:nonzero;stroke:currentColor;stroke-width:17.38px;"></path></svg></button>
                </div>
                <div class="chatbox-footer">
                    <div class="chatbox-footer-1">
                                Powered By AI Chat Assistant
                    </div>  
                </div>
            </div>
            <div class="overlay">
                <div class="options">
                    <div class="options-header"><span class="options-close-btns">
                        <span class="options-close-btn">
                            <svg viewBox="0 0 24 24" width="1em" height="1em">
                                <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" 
                                        stroke-width="2" d="M18 6L6 18M6 6l12 12"></path>
                            </svg>
                        </span></span>
                        <div class="options-name">
                            <h2>Chat Settings</h2>
                        </div>
                    </div>
                    <div class="options-body">
                        <div class="options-section">
                            <div class="color-picker-container">
                                <label for="color-picker">Widget Background Color</label>
                                <input type="color" id="color-picker" 
                                        value="${localStorage.getItem('chatWidgetBackground') || config.backgroundColor}">
                            </div>
                            <div class="color-picker-container">
                                <label for="bg-color-picker">Widget Text Color</label>
                                <input type="color" id="bg-color-picker" 
                                        value="${localStorage.getItem('chatWidgetColor') || '#ffffff'}">
                            </div>
                        </div>
                        
                        <div class="options-section">
                            <div class="toggle-container">
                                <label class="toggle">
                                    <input type="checkbox" id="sound-toggle" 
                                            ${localStorage.getItem('soundEnabled') === 'true' ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                    <span class="toggle-label">Play notification sounds</span>
                                </label>
                            </div>
                        </div>
                        <button class="rate-button" >Rate Our Service</button>

                        <div class="options-section">
                            <button class="options-action-btn download-transcript disabled" disabled>
                                <svg viewBox="0 0 24 24" width="20" height="20">
                                    <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                            d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5l5 5l5-5m-5 5V3">
                                    </path>
                                </svg>
                                <span>Download Chat Transcript</span>
                            </button>
                        </div>

                        <div class="options-section">
                            <button class="options-action-btn privacy-btn">
                                <svg viewBox="0 0 24 24" width="20" height="20">
                                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                                        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z">
                                        </path>
                                    </g>
                                </svg>
                                <span>GDPR and Privacy Policy</span>
                            </button>
                        </div>

                        <div class="options-actions">
                            <button class="reset-button">Reset to Default</button>
                            <button class="save-button">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="contact-form-overlay">
                <div class="contact-form">
                    <h3>Kindly Introduce Yourself...!</h3>
                    <div class="form-group">
                        <label for="contact-name" id="contact-name-label">Name</label>
                        <input type="text" id="contact-name" placeholder="Enter your name" required pattern="[A-Za-z ]+">
                    </div>
                    <div class="form-group">
                        <label for="contact-email">Email</label>
                        <input type="email" id="contact-email" placeholder="email@example.com">
                    </div>
                    <div class="form-group">
                        <label for="contact-phone">Phone</label>
                        <input type="number" id="contact-phone" placeholder="1234567890" min="1000000000" max="9999999999">
                    </div>
                    <div class="form-buttons">
                        <button class="form-skip">Skip</button>
                    </div>
                    <div class="form-buttons">
                        <button class="form-submit">Submit</button>
                    </div>
                </div>
            </div>
            <div id="endChatModal" class="endchat-modal">
                <div class="endchat-modal-content">
                    <p>Are you sure you want to end the chat?</p>
                    <div class="endchat-modal-buttons">
                        <button id="cancelBtn">Cancel</button>
                        <button id="rateButton">Confirm</button>
                    </div>
                </div>
            </div>


            <div class="rating-modal" id="ratingModal">
                <div class="rating-content">
                    <h2 class="rating-title">How was your experience?</h2>
                    
                    <div class="rating-emojis" id="ratingEmojis">
                        <div class="emoji-container">
                            <span class="emoji" data-value="1">😞</span>
                            <span class="emoji-label">Not Good</span>
                        </div>
                        <div class="emoji-container">
                            <span class="emoji" data-value="2">😐</span>
                            <span class="emoji-label">Okay</span>
                        </div>
                        <div class="emoji-container">
                            <span class="emoji" data-value="3">😊</span>
                            <span class="emoji-label">Great</span>
                        </div>
                    </div>
                    
                    <textarea class="feedback-area" id="feedbackArea" placeholder="Tell us about your experience (optional)"></textarea>
                    
                    <button class="submit-rating" id="submitRating">Submit Feedback</button>
                    
                    <div class="thank-you" id="thankYouMessage">
                        Thank you for your feedback!
                    </div>
                </div>
            </div>
        </div>`;
}

// Dynamically load Socket.IO if it's not already available.
function loadSocketIO() {
    return new Promise((resolve, reject) => {
        if (window.io) {
            resolve(window.io);
            return;
        }

        const script = document.createElement('script');
        script.src = SOCKET_CDN_URL;
        script.onload = () => resolve(window.io);
        script.onerror = () => reject(new Error('Failed to load Socket.IO'));
        document.body.appendChild(script);
    });
}

// Detect the user's operating system from the user agent.
function getOS() {
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf("Windows NT") !== -1) return "Windows";
    if (userAgent.indexOf("Macintosh") !== -1) return "macOS";
    if (userAgent.indexOf("Android") !== -1) return "Android";
    if (userAgent.indexOf("iPhone") !== -1 || userAgent.indexOf("iPad") !== -1) return "iOS";
    if (userAgent.indexOf("X11") !== -1 || userAgent.indexOf("Linux") !== -1) return "Linux";
    return "Unknown OS";
}

// Attempt to send location details to the server if the user allows geolocation.
function getLocationDetails(sessionID) {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
        async function (position) {
            try {
                let res = await fetch(`${config.apiURL}/v1/location`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        sessionID: sessionID,
                        accuracy: position.coords.accuracy,
                        longitude: position.coords.longitude,
                        latitude: position.coords.latitude
                    })
                });
                // console.log("Location data sent", res);
            } catch (err) {
                console.error("Failed to send location data:", err);
            }
        },
        function (error) {
            console.error("Geolocation error", error);
        }
    );
}

// Play a notification sound if sound is enabled.
function playNotificationSound() {
    if (localStorage.getItem('soundEnabled') === 'true') {
        notificationSound.play().catch(err => console.log('Error playing sound:', err));
    }
}

function updateUnreadBadge() {
    const unreadBadge = document.querySelector('.unread-badge');
    if (unreadCount > 0) {
        unreadBadge.style.display = 'flex';
        unreadBadge.textContent = unreadCount;
    } else {
        unreadBadge.style.display = 'none';
    }
}

function updateBgColor(color) {
    const elementsToUpdate = document.querySelectorAll(
        '.chat-button, .chatbox-header, .chatbox-header-btn, .send-button, .save-button, .icon, .message.sent, .chat-bubble-content'
    );
    elementsToUpdate.forEach(el => el.style.backgroundColor = color);

    const sentMessages = document.querySelectorAll('.message.sent');
    sentMessages.forEach(msg => {
        msg.style.background = `${color}`;
    });
}

function updateColor(color) {
    const elementsToUpdate = document.querySelectorAll(
        '.chat-button, .chatbox-header, .chatbox-header-btn, .send-button, .save-button, .icon, .chatbox-header-3, .message.sent, .chat-bubble-content'
    );
    elementsToUpdate.forEach(el => el.style.color = color);
}

function themeHandler() {
    // newWidgetBg = widgetBgColorPicker.value;
    newWidgetBg = "#278798";
    newWidgetText = widgetTextColorPicker.value;

    // --- THEME HANDLERS ---
    widgetBgColorPicker.addEventListener('input', (e) => {
        newWidgetBg = e.target.value;
    });

    widgetTextColorPicker.addEventListener('input', (e) => {
        newWidgetText = e.target.value;
    });

    saveButton.addEventListener('click', () => {
        localStorage.setItem('chatWidgetBackground', newWidgetBg);
        localStorage.setItem('chatWidgetColor', newWidgetText);
        updateBgColor(newWidgetBg);
        updateColor(newWidgetText);
    });

    resetThemeButton.addEventListener('click', () => {
        newWidgetBg = config.backgroundColor;
        newWidgetText = '#ffffff';
        widgetBgColorPicker.value = newWidgetBg;
        widgetTextColorPicker.value = newWidgetText;
        updateBgColor(newWidgetBg);
        updateColor(newWidgetText);
    });
}

function loadSettings() {
    const savedColor = localStorage.getItem('chatWidgetBackground');
    const savedBg = localStorage.getItem('chatWidgetColor');
    if (savedColor) {
        newWidgetBg = savedColor;
        updateBgColor(savedColor);
    }
    if (savedBg) {
        newWidgetText = savedBg;
        updateColor(savedBg);
    }
}

function scrollToBottom() {
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function toggleChatbox() {
    const formShown = localStorage.getItem('contact-form-shown');

    if (chatbox.style.display === 'none' || !chatbox.style.display) {
        chatbox.style.display = 'block';
        chatBubble.classList.remove('visible');
        chatBubbleDismissed = true; // Mark the bubble as dismissed once chat is opened
        setTimeout(() => {
            chatBubble.style.display = 'none';
        }, 500); // Wait for fade out animation
        unreadCount = 0;
        updateUnreadBadge();
        setTimeout(() => {
            chatbox.classList.add('visible');

            // Handle welcome/returning messages
            handleWelcomeMessages();

            scrollToBottom();
            if (!formShown && showContactForm) {
                showContactForm();
            }
        }, 10);
        chatButton.style.display = 'none';
    } else {
        chatbox.classList.remove('visible');
        setTimeout(() => {
            chatbox.style.display = 'none';
            chatButton.style.display = 'flex';
            // Only show the chat bubble again if it hasn't been dismissed
            if (!chatBubbleDismissed) {
                chatBubble.style.display = 'block';
                // Add a small delay before adding the visible class
                setTimeout(() => {
                    chatBubble.classList.add('visible');
                }, 50);
            }
        }, 300);
    }
}

function toggleOptions() {
    overlay.classList.toggle('show');
    if (optionsPanel.style.transform === 'translateY(0%)') {
        optionsPanel.style.transform = 'translateY(100%)';
        setTimeout(() => {
            overlay.classList.remove('show');
        }, 300);
    } else {
        overlay.classList.add('show');
        setTimeout(() => {
            optionsPanel.style.transform = 'translateY(0%)';
        }, 10);
    }
}

function toggleExpand() {
    if (chatbox.style.width === '') {
        chatbox.style.width = '500px';
        chatbox.style.maxHeight = '878px';
        maximizeIcon.style.display = 'none';
        minimizeIcon.style.display = 'block';
    } else {
        chatbox.style.width = '';
        chatbox.style.maxHeight = '672px';
        maximizeIcon.style.display = 'block';
        minimizeIcon.style.display = 'none';
    }
}

function toggleEndModal(display) {
    endChatModal.style.display = display;
}

// --- INPUT AND SENDING ---
function sendMessage() {
    const message = input.value.trim();
    if (!message) return;

    addMessageToDOM(message, 'sent');
    input.value = '';
    sendButton.classList.remove('visible');
    chatBubbleWidth.style.width = '105%';

    if (socket && socket.connected) {
        socket.emit('guestTyping', { room: uniqueId, username: "Guest", msg: '' });
        socket.emit('sendMessage', { msg: message, room: uniqueId, username: "Guest" });
        storeLastMessage(message);
    } else {
        pendingMessages.push(message);
        localStorage.setItem('pendingMessages', JSON.stringify(pendingMessages));
    }
}

function initWidget() {
    // Widget initialization starts here
    container.className = 'chat-widget-container';
    container.innerHTML = createWidgetHTML();
    document.body.appendChild(container);

    chatButton = container.querySelector('.chat-button');
    chatbox = container.querySelector('.chatbox');
    chatBubble = container.querySelector('.chat-bubble');
    messagesContainer = container.querySelector('.chatbox-content');
    chatBubbleWidth = container.querySelector('.chatbox-input');
    input = container.querySelector('.chatbox-input input');
    sendButton = container.querySelector('.send-button');
    optionsBtn = container.querySelector('.options-btn');
    closeBtn = container.querySelector('.close-btn');
    endChatBtn = container.querySelector('.end-btn');
    endChatModal = container.querySelector('.endchat-modal');
    endChatCloseBtn = document.getElementById('cancelBtn');
    expandBtn = container.querySelector('.expand-btn');
    overlay = container.querySelector('.overlay');
    optionsPanel = container.querySelector('.options');
    maximizeIcon = container.querySelector('.maximize-icon');
    minimizeIcon = container.querySelector('.minimize-icon');
    optionsCloseBtn = container.querySelector('.options-close-btn');
    widgetBgColorPicker = document.getElementById('color-picker');
    widgetTextColorPicker = document.getElementById('bg-color-picker');
    saveButton = document.querySelector('.save-button');
    resetThemeButton = document.querySelector('.reset-button');
    downloadTranscriptBtn = document.querySelector('.download-transcript');
    chatBubbleSpan = document.querySelector('.chat-bubble-content span');
    existingMessages = messagesContainer?.querySelectorAll('.message').length;

    // --- SOUND TOGGLE ---
    const soundToggle = document.getElementById('sound-toggle');
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    soundToggle.checked = soundEnabled;

    soundToggle.addEventListener('change', (e) => {
        localStorage.setItem('soundEnabled', e.target.checked);
        // Play sound to give feedback when enabled
        if (e.target.checked) {
            playNotificationSound();
        }
    });

    if (chatBubbleSpan) {
        const currentTime = new Date().getTime();
        const lastVisit = lastVisitTime ? parseInt(lastVisitTime) : currentTime;
        const hoursSinceLastVisit = (currentTime - lastVisit) / (1000 * 60 * 60);

        if (hoursSinceLastVisit < 2) {
            chatBubbleSpan.textContent = utilityData.welcome_message || 'Open to chat';
        } else {
            chatBubbleSpan.textContent = utilityData.returning_message || 'Welcome back! Need assistance?';
        }
    }

    themeHandler();
    loadSettings();

    // Show chat bubble after a delay, but only if it hasn't been dismissed
    setTimeout(() => {
        if (!chatbox.classList.contains('visible') && !chatBubbleDismissed) {
            chatBubble.style.display = 'block';
            // Add a small delay before adding the visible class to ensure the display: block has taken effect
            setTimeout(() => {
                chatBubble.classList.add('visible');
            }, 50);
        }
    }, 6000); // Increased delay to 6 seconds

    initializeContactForm();
    initEventListeners();
}

// --- DOWNLOAD TRANSCRIPT ---
function handleDownloadTranscript() {
    if (!hasMessages) return;
    const allMessages = Array.from(document.querySelectorAll('.message'))
        .map(msg => msg.textContent)
        .join('\n');
    const blob = new Blob([allMessages], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat-transcript.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function initEventListeners() {
    // Add event listeners
    chatButton.addEventListener('click', toggleChatbox);
    optionsBtn.addEventListener('click', toggleOptions);
    closeBtn.addEventListener('click', toggleChatbox);
    endChatBtn.addEventListener('click', () => toggleEndModal('flex'));
    endChatCloseBtn.addEventListener('click', () => toggleEndModal('none'));
    expandBtn.addEventListener('click', toggleExpand);
    optionsCloseBtn.addEventListener('click', toggleOptions);
    input.addEventListener('input', function () {
        socket.emit('guestTyping', { room: uniqueId, username: "Guest", msg: this.value });
        if (this.value.trim()) {
            sendButton.classList.add('visible');
            chatBubbleWidth.style.width = '97%';
        } else {
            sendButton.classList.remove('visible');
            chatBubbleWidth.style.width = '105%';
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendButton.addEventListener('click', sendMessage);
    downloadTranscriptBtn.addEventListener('click', handleDownloadTranscript);
}

// --- MESSAGE DOM MANIPULATION ---
function addMessageToDOM(text, type, username, position = 'append') {
    const messagesContainer = container.querySelector('.chatbox-content');
    const messageDiv = document.createElement('div');
    let displayText;

    // Handle different message types
    if (type === 'sent') {
        messageDiv.className = 'message sent';
        displayText = `${text}`;
        const savedColor = localStorage.getItem('chatWidgetBackground') || config.backgroundColor;
        messageDiv.style.background = savedColor;
    } else if (type === 'received') {
        messageDiv.className = 'message received';
        displayText = `<span class="message-user">${username || 'Agent'}</span>${text}`;
    } else if (type === 'Activity') {
        messageDiv.className = 'agent-joined';
        messageDiv.innerHTML = `<div class="agent-joined-text">${text}</div>`;
    } else {
        // Default fallback
        messageDiv.className = 'message-text';
        displayText = text;
    }

    // Only wrap in .message-text if not an activity message
    if (type !== 'Activity') {
        messageDiv.innerHTML = `<div class="message-text">${displayText}</div>`;
    }

    // Insert the message
    if (position === 'prepend') {
        messagesContainer.insertBefore(messageDiv, messagesContainer.firstChild);
    } else {
        messagesContainer.appendChild(messageDiv);
    }

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Track presence of messages
    hasMessages = true;

    // Enable transcript download if applicable
    if (typeof downloadTranscriptBtn !== 'undefined' && downloadTranscriptBtn) {
        downloadTranscriptBtn.classList.remove('disabled');
        downloadTranscriptBtn.disabled = false;
    }
}

// Function to handle welcome and returning messages
function handleWelcomeMessages() {
    // Check if there are existing messages
    const existingMessages = messagesContainer.querySelectorAll('.message').length;

    // Return early if both messages were already shown
    if (welcomeMessageShown || returningMessageShown) return;

    if (existingMessages === 0 && utilityData.welcome_message) {
        addMessageToDOM(utilityData.welcome_message, 'received', 'Novel Office', 'prepend');
        welcomeMessageShown = true;
    } else if (existingMessages > 0 && utilityData.returning_message) {
        addMessageToDOM(utilityData.returning_message, 'received', 'Novel Office');
        returningMessageShown = true;
    }
}

// Fetch old messages for a given session ID.
async function fetchPreviousMessages() {
    try {
        let response = await fetch(`${config.apiURL}/v1/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: uniqueId })
        });
        response = await response.json();
        const olderMessages = response.message;
        if (olderMessages.length > 0) {
            olderMessages.forEach(msg => {

                const messageType = msg.message_type === "Activity" ? "Activity" : false;
                const isSent = msg.user === "Guest" ? 'sent' : 'received';
                if (messageType) addMessageToDOM(msg.message, messageType, msg.user);
                else addMessageToDOM(msg.message, isSent, msg.user);
            });
        }
    } catch (error) {
        console.error('Error fetching messages:', error);
    }
}

function handleResolved(data) {
    let message = `${data.assignedUser} resolved the chat.`;
    addMessageToDOM(message, "Activity", null);
}

// Initialize or re-initialize the socket connection.
async function initSocket() {
    try {
        const io = await loadSocketIO();
        socket = io(config.socketURL);

        socket.on('connect', async () => {
            // If we have an existing session, join the room
            if (uniqueId) {
                socket.emit("join_room", { room: uniqueId, username: "Guest" });
                socket.emit("join_room", { room: "agentAvailability", username: "Guest" });
            }

            // Send any messages that were queued while offline
            if (pendingMessages.length > 0) {
                pendingMessages.forEach(msg => socket.emit('sendMessage', { msg, room: uniqueId, username: "Guest" }));
                localStorage.removeItem('pendingMessages');
                pendingMessages = [];
            }
        });

        socket.on('disconnect', () => {
            // console.log('Socket disconnected, attempting to reconnect...');
        });

        // Handle agent availability status
        socket.on("agentStatusUpdate", (data) => {
            const statusElement = document.querySelector('.chatbox-header-3-text-2');
            if (statusElement) {
                const availabilityDot = document.getElementById("available-dot");
                if (data === true) {
                    statusElement.textContent = 'Agents are online';
                    statusElement.style.color = '#ffffff';
                    availabilityDot.style.backgroundColor = "#34D399"
                } else {
                    statusElement.textContent = 'All the agents are offline';
                    statusElement.style.color = '#EF4444'; // Red color for offline status
                    availabilityDot.style.backgroundColor = "#EF4444"
                }
            }
        });

        // User availability on the website
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                socket.emit("userAvailability", { room: uniqueId, isOnline: true });
            } else {
                socket.emit("userAvailability", { room: uniqueId, isOnline: false });
            }
        });

        window.addEventListener('blur', () => {
            socket.emit("userAvailability", { room: uniqueId, isOnline: false });
        });
        window.addEventListener('focus', () => {
            socket.emit("userAvailability", { room: uniqueId, isOnline: true });
        });
        socket.emit("userAvailability", { room: uniqueId, isOnline: true });

        let typingIndicator = document.getElementById('typing-indicator');
        let chatBody = document.querySelector('.chatbox-body');
        let chatboxContent = document.querySelector('.chatbox-content');

        socket.on('receiveMessage', (data) => {
            addMessageToDOM(data.msg, 'received', data.username || 'Agent');
            if (data.msg) {
                typingIndicator.style.display = "none";
                chatBody.style.height = "calc(100% - 0px)";
            }

            // Store last message with timestamp
            storeLastMessage(data.msg);
            // Play notification sound
            playNotificationSound();

            // Update unread count if chat is closed
            const chatbox = document.querySelector('.chatbox');
            if (chatbox.style.display === 'none' || !chatbox.style.display) {
                unreadCount++;
                updateUnreadBadge();
            }
        });

        socket.on('agentTyping', (data) => {
            if (data) {
                // Move typing indicator to the end of chatbox-content
                typingIndicator.style.display = 'block';
                chatBody.style.height = "calc(100% - 30px)";
                chatboxContent.scrollTop = chatboxContent.scrollHeight;

                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    typingIndicator.style.display = 'none';
                    chatBody.style.height = "calc(100% - 0px)";
                }, 2000);
            } else {
                typingIndicator.style.display = 'none';
                chatBody.style.height = "calc(100% - 0px)";
            }
        });

        // Handle agent joined and left events
        socket.on('agentJoined', (data) => {
            const message = `${data.username} has joined the chat.`;
            addMessageToDOM(message, "Activity");
        });

        socket.on('agentLeft', (data) => {
            // console.log('Agent left:', data);
        });

        socket.on("resolved", handleResolved);
    } catch (error) {
        console.error('Socket initialization error:', error);
    }
}

// Contact Form initialization
function initializeContactForm() {
    const formOverlay = document.querySelector('.contact-form-overlay');
    const submitButton = document.querySelector('.form-submit');
    const skipButton = document.querySelector('.form-skip');
    const nameInput = document.querySelector('#contact-name');
    const emailInput = document.querySelector('#contact-email');
    const phoneInput = document.querySelector('#contact-phone');

    // Initially hide submit button
    submitButton.style.transform = 'scale(0)';


    showContactForm = function () {
        formOverlay.style.display = 'block';
        localStorage.setItem('contact-form-shown', true);
        setTimeout(() => {
            formOverlay.style.opacity = '1';
        }, 10);
    };

    hideContactForm = function () {
        formOverlay.style.opacity = '0';
        setTimeout(() => {
            formOverlay.style.display = 'none';
        }, 300);
    };

    skipButton.addEventListener("click", hideContactForm);

    // Update checkFields to only show submit button when name is filled
    function checkFields() {
        const nameValue = nameInput.value.trim();
        const isValidName = /^[A-Za-z ]+$/.test(nameValue);
        submitButton.style.transform = (nameValue && isValidName) ? 'scale(1)' : 'scale(0)';
    }

    // Add input validation for name field
    nameInput.addEventListener('input', (e) => {
        const value = e.target.value;
        // Remove any non-alphabetic characters
        const sanitizedValue = value.replace(/[^A-Za-z ]/g, '');
        if (value !== sanitizedValue) {
            e.target.value = sanitizedValue;
        }
        checkFields();
    });

    async function handleFormSubmit() {
        const name = nameInput.value.trim();

        // Validate name before submission
        if (!name || !/^[A-Za-z ]+$/.test(name)) {
            alert('Please enter a valid name (alphabets only)');
            return;
        }

        const email = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert("kindly provide a valid email.");
            return;
        }
        const phone = phoneInput.value.trim();

        try {
            // console.log("Chat Referrer", chatReferrer);
            const response = await fetch(`${config.apiURL}/v1/updateContactDetails`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionID: uniqueId,
                    name: name,
                    email: email || null,
                    phone: phone || null
                })
            });

            if (response.ok) {
                localStorage.setItem('contact-form-shown', 'true');
                hideContactForm();
            } else {
                alert('Failed to submit form. Please try again.');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('Failed to submit form. Please try again.');
        }
    }

    // Add input event listeners
    nameInput.addEventListener('input', checkFields);
    emailInput.addEventListener('input', checkFields);
    phoneInput.addEventListener('input', checkFields);

    submitButton.addEventListener('click', handleFormSubmit);
}

// Rating form
function initializeRatingWidget() {

    const rateButton = document.getElementById('rateButton');
    const ratingModal = document.getElementById('ratingModal');
    const chatbox = document.querySelector('.chatbox');
    const emojis = document.querySelectorAll('.emoji');
    const submitRating = document.getElementById('submitRating');
    const feedbackArea = document.getElementById('feedbackArea');
    const thankYouMessage = document.getElementById('thankYouMessage');

    // Current rating value
    let currentRating = 0;

    // Open modal when rate button is clicked
    rateButton.addEventListener('click', () => {
        ratingModal.style.display = 'flex';
        endChatModal.style.display = 'none';
    });

    function toggleChatbox() {
        const chatbox = document.querySelector('.chatbox');
        const chatButton = document.querySelector('.chat-button');

        if (chatbox.style.display === 'none' || !chatbox.style.display) {
            chatbox.style.display = 'block';
            unreadCount = 0;  // Reset unread count
            updateUnreadBadge();
            chatButton.style.display = 'none';
        } else {
            chatbox.classList.remove('visible');
            setTimeout(() => {
                chatbox.style.display = 'none';
                chatButton.style.display = 'flex';
            }, 300);
        }
    }

    // Handle emoji selection
    emojis.forEach(emoji => {
        emoji.addEventListener('click', () => {
            // Remove active class from all emojis
            emojis.forEach(e => e.classList.remove('active'));

            // Add active class to selected emoji
            emoji.classList.add('active');

            // Set current rating
            currentRating = parseInt(emoji.getAttribute('data-value'));
        });
    });

    // Submit rating
    submitRating.addEventListener('click', async () => {
        if (currentRating > 0) {
            const feedback = feedbackArea.value.trim();

            // Get the rating text based on the emoji
            let ratingText;
            switch (currentRating) {
                case 1:
                    ratingText = "Not Good";
                    break;
                case 2:
                    ratingText = "Okay";
                    break;
                case 3:
                    ratingText = "Great";
                    break;
            }

            try {
                // Send the feedback to the server
                const response = await fetch(`${config.apiURL}/v1/updatefeedback`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionID: uniqueId,
                        ratings: currentRating,
                        feedback: feedback || ratingText
                    })
                });

                if (!response.ok) {
                    console.error('Failed to submit feedback:', await response.text());
                } else {
                    // console.log('Feedback submitted successfully');
                }
            } catch (error) {
                console.error('Error submitting feedback:', error);
            }

            // Show thank you message
            thankYouMessage.style.display = 'block';
            submitRating.style.display = 'none';

            // Close modal after a delay
            setTimeout(() => {
                ratingModal.style.display = 'none';
                toggleChatbox();
                resetRating();
            }, 3000);
        } else {
            alert('Please select an emoji before submitting.');
        }
    });

    // Reset the rating form
    function resetRating() {
        currentRating = 0;
        emojis.forEach(emoji => emoji.classList.remove('active'));
        feedbackArea.value = '';
        thankYouMessage.style.display = 'none';
        submitRating.style.display = 'block';
    }
}

const starting = () => {
    setTimeout(() => {
        const chatButton = document.querySelector('.chat-button');
        chatButton.style.transform = 'translateY(0)';
        chatButton.style.opacity = '1';
    }, 3000);
}

const transitionStyle = document.createElement('style');
transitionStyle.textContent = `.chatbox { transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }`;
document.head.appendChild(transitionStyle);

async function main() {
    try {
        await fetchUtilityData();
        // First check if domain is included
        const isIncluded = await isIncludedDomain();
        if (!isIncluded) {
            return; // Exit if domain is not included
        }

        // If domain is included, proceed with initialization
        initSession();
        initWidget();
        createAndInjectCSS();
        initSocket();
        starting();
        fetchPreviousMessages();
        initializeRatingWidget();
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

main();
// document.addEventListener('DOMContentLoaded', main);
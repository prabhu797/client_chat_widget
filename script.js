/**
 * Chat Widget Implementation with proper DOM loading
 */
(function () {
    const config = {

        // Development API
        // socketURL: "http://localhost:4040",
        // apiURL: "http://localhost:4040/api",

        // Production API
        socketURL: "https://socket.novelhouston.com",
        apiURL: "https://socket.novelhouston.com/api",

        color: '#ffffff',
        backgroundColor: '#39B3BA',
        title: 'Need help? Start a conversation...',

        notifications: {
            title: "New Message",
            icon: "https://noveloffice.in/wp-content/uploads/2023/08/novel-favicon.webp",
            timeout: 5000  // How long notification stays visible (ms)
        }
    };

    // Global state variables
    let hasMessages = false;
    let socket = null;
    let uniqueId = localStorage.getItem("unique-id");

    // This array holds messages that the user sent while there was no socket connection
    // Once a connection is established, we send them automatically.
    let pendingMessages = [];
    let formOverlay;
    let showContactForm;
    let hideContactForm;

    let unreadCount = 0; // Track unread messages
    let notificationSound = new Audio('https://noveloffice.in/wp-content/uploads/2025/02/new_notification.mp3');

    // let notificationPermission = Notification.permission;
    let activeNotifications = [];
    let storedSettings = {
        widgetBackground: localStorage.getItem('chatWidgetBackground') || '#39B3BA',
        widgetColor: localStorage.getItem('chatWidgetColor') || '#ffffff',
        soundEnabled: localStorage.getItem('soundEnabled') !== 'false',
    };

    let username;
    let message;


    /**
     * Injects the Google Fonts
     */

    function loadGoogleFonts() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Roboto+Slab:wght@100..900&display=swap';

        const preconnect1 = document.createElement('link');
        preconnect1.rel = 'preconnect';
        preconnect1.href = 'https://fonts.googleapis.com';

        const preconnect2 = document.createElement('link');
        preconnect2.rel = 'preconnect';
        preconnect2.href = 'https://fonts.gstatic.com';
        preconnect2.crossOrigin = 'anonymous';

        document.head.appendChild(preconnect1);
        document.head.appendChild(preconnect2);
        document.head.appendChild(link);
    }


    /**
     * Injects the necessary CSS into the <head>.
     */
    function createAndInjectCSS() {
        const style = document.createElement('style');
        style.textContent = `
            html,
            body{
            font-family: "Montserrat","Inter", serif;
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
                background-color: ${config.backgroundColor};
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
            }
                
            .chatbox-header-btn:hover {
                background-color: #d9d2d269 !important;
            }
            .chatbox-main{
             height: calc(100% - 150px);
            }
            .chatbox-content {
                height: calc(100% - 41px);
                overflow-y: auto;
                padding: 10px;
                background:white;
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
            }
            to {
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
                
            span.message-user {
                    font-size: 11px;
                    font-weight: 700;
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
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
                background: transparent;
                border: none;
                padding: 6px;
                cursor: pointer;
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

            .send-button:hover {
                background: #a8a8a8 !important;
                transform: scale(1.2);
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
                background-color: #39B3BA;
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
                
                .chatbox-content {
                    height: calc(100vh - 100px);
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
                display: flex;
                gap: 4px;
                padding: 10px;
                background: #e0f7fa;
                border-radius: 0.5rem;
                margin-bottom: 4px;
                width: fit-content;
                animation: fadeIn 0.3s ease;
            }

            .typing-dot {
                width: 8px;
                height: 8px;
                background: #39B3BA;
                border-radius: 50%;
                animation: bounce 1.3s linear infinite;
            }

            .typing-dot:nth-child(2) {
                animation-delay: 0.15s;
            }

            .typing-dot:nth-child(3) {
                animation-delay: 0.3s;
            }

            @keyframes bounce {
                0%, 60%, 100% {
                    transform: translateY(0);
                }
                30% {
                    transform: translateY(-4px);
                }
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

        `;
        document.head.appendChild(style);
    }

    /**
     * Creates the main widget HTML that will be injected into the DOM.
     */
    function createWidgetHTML() {
        return `
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
                            <button class="chatbox-header-btn options-btn">
                                <!-- Options icon SVG -->
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="1"/>
                                    <circle cx="12" cy="5" r="1"/>

                                    <circle cx="12" cy="19" r="1"/>
                                </svg>
                            </button>
                            <button class="chatbox-header-btn close-btn">
                                <!-- Close icon SVG -->
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 6L6 18M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="chatbox-header-3">
                        <img src="https://noveloffice.in/wp-content/uploads/2023/08/novel-favicon.webp?size=80" 
                             class="chatbox-header-3-img">
                        <span>${config.title}</span>
                    </div>
                </div>
                <div class="chatbox-main">
                    <div class="chatbox-content"></div>
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
                                           value="${localStorage.getItem('chatWidgetBackground') || '#39B3BA'}">
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
                        <button class="form-submit">Submit</button>
                    </div>
                </div>
            </div>
            </div>

        `;
    }

    /**
     * Dynamically load Socket.IO if it's not already available.
     */
    function loadSocketIO() {
        return new Promise((resolve, reject) => {
            if (window.io) {
                resolve(window.io);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.socket.io/4.0.0/socket.io.min.js';
            script.onload = () => resolve(window.io);
            script.onerror = () => reject(new Error('Failed to load Socket.IO'));
            document.body.appendChild(script);
        });
    }

    /**
     * Detect the user's operating system from the user agent.
     */
    function getOS() {
        const userAgent = navigator.userAgent;
        if (userAgent.indexOf("Windows NT") !== -1) return "Windows";
        if (userAgent.indexOf("Macintosh") !== -1) return "macOS";
        if (userAgent.indexOf("Android") !== -1) return "Android";
        if (userAgent.indexOf("iPhone") !== -1 || userAgent.indexOf("iPad") !== -1) return "iOS";
        if (userAgent.indexOf("X11") !== -1 || userAgent.indexOf("Linux") !== -1) return "Linux";
        return "Unknown OS";
    }

    /**
     * Attempt to send location details to the server if the user allows geolocation.
     */
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
                    console.log("Location data sent", res);
                } catch (err) {
                    console.error("Failed to send location data:", err);
                }
            },
            function (error) {
                console.error("Geolocation error", error);
            }
        );
    }

    /**
     * Play a notification sound if sound is enabled.
     */
    function playNotificationSound() {
        if (localStorage.getItem('soundEnabled') === 'true') {
            notificationSound.play().catch(err => console.log('Error playing sound:', err));
        }
    }

    /**
     * Update the unread badge count.
     */
    function updateUnreadBadge() {
        const unreadBadge = document.querySelector('.unread-badge');
        if (unreadCount > 0) {
            unreadBadge.style.display = 'flex';
            unreadBadge.textContent = unreadCount;
        } else {
            unreadBadge.style.display = 'none';
        }
    }


    /**
    * Request notification permission and store the result
    */
    async function requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            notificationPermission = permission;

            // Store the permission in localStorage to remember user's choice
            localStorage.setItem('notificationPermission', permission);

            // Update the toggle in settings if it exists
            const notificationToggle = document.getElementById('notification-toggle');
            if (notificationToggle) {
                notificationToggle.checked = permission === 'granted';
                notificationToggle.disabled = permission === 'denied';
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
    }

    /**
     * Show a browser notification
     */
    function showNotification(message, username) {


        console.log("Attempting to show notification:", message, username); // Debug log

        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return;
        }

        if (document.hidden || !document.querySelector('.chatbox').classList.contains('visible')) {
            console.log("Creating browser notification..."); // Debug log
            createAndShowNotification(message, username);
        } else {
            console.log("Notification not shown because chat is visible");
        }



        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return;
        }

        // Don't show notification if chat is visible
        const chatbox = document.querySelector('.chatbox');
        if (
            document.hidden === false ||
            (chatbox && getComputedStyle(chatbox).display !== 'none')
        ) {
            return;
        }

        // If permission is not granted, request it first
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(function (permission) {
                if (permission === 'granted') {
                    createAndShowNotification(message, username);
                }
            });
        } else if (Notification.permission === 'granted') {
            createAndShowNotification(message, username);
        }
    }

    /** 
     * Add this to your initializeWidget function
     */
    function addNotificationToggle() {
        // Add event listener for the toggle
        const notificationToggle = document.getElementById('notification-toggle');
        notificationToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                requestNotificationPermission();
            }
        });
    }

    /**
     * Initialize the entire chat widget once the DOM is ready.
     */
    function initializeWidget() {
        const container = document.createElement('div');
        container.className = 'chat-widget-container';
        container.innerHTML = createWidgetHTML();
        document.body.appendChild(container);

        // --- SOUND TOGGLE ---
        const soundToggle = document.getElementById('sound-toggle');
        const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
        soundToggle.checked = soundEnabled;
        localStorage.setItem('soundEnabled', soundEnabled);

        soundToggle.addEventListener('change', (e) => {
            localStorage.setItem('soundEnabled', e.target.checked);
            // Play sound to give feedback when enabled
            if (e.target.checked) {
                playNotificationSound();
            }
        });


        // DOM Elements
        const chatButton = container.querySelector('.chat-button');
        const chatbox = container.querySelector('.chatbox');
        const messagesContainer = container.querySelector('.chatbox-content');
        const chatBubbleWidth = container.querySelector('.chatbox-input');
        const input = container.querySelector('.chatbox-input input');
        const sendButton = container.querySelector('.send-button');
        const optionsBtn = container.querySelector('.options-btn');
        const closeBtn = container.querySelector('.close-btn');
        const expandBtn = container.querySelector('.expand-btn');
        const overlay = container.querySelector('.overlay');
        const optionsPanel = container.querySelector('.options');
        const maximizeIcon = container.querySelector('.maximize-icon');
        const minimizeIcon = container.querySelector('.minimize-icon');
        const optionsCloseBtn = container.querySelector('.options-close-btn');
        const widgetBgColorPicker = document.getElementById('color-picker');
        const widgetTextColorPicker = document.getElementById('bg-color-picker');
        const saveButton = document.querySelector('.save-button');
        const resetThemeButton = document.querySelector('.reset-button');
        const downloadTranscriptBtn = document.querySelector('.download-transcript');

        let newWidgetBg = widgetBgColorPicker.value;
        let newWidgetText = widgetTextColorPicker.value;

        // --- THEME HANDLERS ---
        widgetBgColorPicker.addEventListener('input', (e) => {
            newWidgetBg = e.target.value;
        });

        widgetTextColorPicker.addEventListener('input', (e) => {
            newWidgetText = e.target.value;
        });

        saveButton.addEventListener('click', () => {
            // Save selected colors to localStorage
            localStorage.setItem('chatWidgetBackground', newWidgetBg);
            localStorage.setItem('chatWidgetColor', newWidgetText);

            // Apply the saved colors
            updateBgColor(newWidgetBg);
            updateColor(newWidgetText);
        });

        resetThemeButton.addEventListener('click', () => {
            // Reset to default colors
            newWidgetBg = '#39B3BA';
            newWidgetText = '#ffffff';
            widgetBgColorPicker.value = newWidgetBg;
            widgetTextColorPicker.value = newWidgetText;
            updateBgColor(newWidgetBg);
            updateColor(newWidgetText);
        });

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

        function updateBgColor(color) {
            const elementsToUpdate = document.querySelectorAll(
                '.chat-button, .chatbox-header, .chatbox-header-btn, .send-button, .save-button, .icon,.message.sent'
            );
            elementsToUpdate.forEach(el => el.style.backgroundColor = color);

            const sentMessages = document.querySelectorAll('.message.sent');
            sentMessages.forEach(msg => {
                msg.style.background = `${color}`;
            });
        }

        function updateColor(color) {
            const elementsToUpdate = document.querySelectorAll(
                '.chat-button, .chatbox-header, .chatbox-header-btn, .send-button, .save-button, .icon, .chatbox-header-3, .message.sent'
            );
            elementsToUpdate.forEach(el => el.style.color = color);
        }

        loadSettings(); // load theme on startup

        //
        function scrollToBottom() {
            const messagesContainer = document.querySelector('.chatbox-content');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }
        // --- WIDGET TOGGLE / EXPAND / CLOSE ---
        function toggleChatbox() {
            const formShown = localStorage.getItem('contact-form-shown');

            if (chatbox.style.display === 'none' || !chatbox.style.display) {
                chatbox.style.display = 'block';
                unreadCount = 0;  // Reset unread count
                updateUnreadBadge();
                setTimeout(() => {
                    chatbox.classList.add('visible');
                    scrollToBottom();
                    // Show form only if it hasn't been shown before
                    if (!formShown && showContactForm) {  // Check if function exists
                        showContactForm();
                    }
                }, 10);
                chatButton.style.display = 'none';
            } else {
                chatbox.classList.remove('visible');
                setTimeout(() => {
                    chatbox.style.display = 'none';
                    chatButton.style.display = 'flex';
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

        chatButton.addEventListener('click', toggleChatbox);
        optionsBtn.addEventListener('click', toggleOptions);
        closeBtn.addEventListener('click', toggleChatbox);
        expandBtn.addEventListener('click', toggleExpand);
        optionsCloseBtn.addEventListener('click', toggleOptions);

        // --- SOUND TOGGLE ---
        soundToggle.addEventListener('change', (e) => {
            localStorage.setItem('soundEnabled', e.target.checked);
            // Play sound to give feedback when enabled
            if (e.target.checked) {
                playNotificationSound();
            }
        });

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
        downloadTranscriptBtn.addEventListener('click', handleDownloadTranscript);

        // --- MESSAGE DOM MANIPULATION ---
        function addMessageToDOM(text, type, username) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${type}`;
            let displayText;
            if (type === 'sent') {
                displayText = `${text}`;
                const savedColor = localStorage.getItem('chatWidgetBackground') || '#39B3BA';
                messageDiv.style.background = `${savedColor}`;
            } else if (type === 'received') {
                displayText = `<span class="message-user">${username}</span> ${text}`;
            } else {
                displayText = text;
            }
            messageDiv.innerHTML = `<div class="message-text">${displayText}</div>`;
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            hasMessages = true;
            if (downloadTranscriptBtn) {
                downloadTranscriptBtn.classList.remove('disabled');
                downloadTranscriptBtn.disabled = false;
            }
        }

        // --- INPUT AND SENDING ---
        function sendMessage() {
            const message = input.value.trim();
            if (!message) return;

            // Show in UI immediately
            addMessageToDOM(message, 'sent');
            input.value = '';
            sendButton.classList.remove('visible');
            chatBubbleWidth.style.width = '105%';

            // If socket is connected, send it immediately
            if (socket && socket.connected) {
                socket.emit('sendMessage', { msg: message, room: uniqueId, username: "Guest" });
            } else {
                pendingMessages.push(message);
                localStorage.setItem('pendingMessages', JSON.stringify(pendingMessages));
            }
        }

        // Show/hide the "Send" button based on input
        input.addEventListener('input', function () {
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
    }

    /**
     * Initialize or re-initialize the socket connection.
     */
    async function initSocket() {
        try {
            const io = await loadSocketIO();
            socket = io(config.socketURL);

            socket.on('connect', async () => {
                console.log('Connected to socket, ID:', socket.id);

                // If we have an existing session, join the room
                if (uniqueId) {
                    socket.emit("join_room", { room: uniqueId, username: "Guest" });
                }

                // Send any messages that were queued while offline
                if (pendingMessages.length > 0) {
                    pendingMessages.forEach(msg => socket.emit('sendMessage', { msg, room: uniqueId, username: "Guest" }));
                    localStorage.removeItem('pendingMessages');
                    pendingMessages = [];
                }
            });

            socket.on('disconnect', () => {
                console.log('Socket disconnected, attempting to reconnect...');
                setTimeout(initSocket, 3000);
            });


            socket.on('receiveMessage', (data) => {
                addMessageToDOM(data.msg, 'received', data.username || 'Agent');

                // Play notification sound
                playNotificationSound();

                // Show browser notification
                showNotification(data.msg, data.username || 'Agent');

                // Update unread count if chat is closed
                const chatbox = document.querySelector('.chatbox');
                if (chatbox.style.display === 'none' || !chatbox.style.display) {
                    unreadCount++;
                    updateUnreadBadge();
                }
            });

            socket.on('agentTyping', (data) => {
                const container = document.querySelector('.chatbox-content');
                const existingIndicator = container.querySelector('.typing-indicator');

                if (data.isTyping && !existingIndicator) {
                    const indicator = document.createElement('div');
                    indicator.className = 'typing-indicator';
                    indicator.innerHTML = `
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    `;
                    container.appendChild(indicator);
                    container.scrollTop = container.scrollHeight;
                } else if (!data.isTyping && existingIndicator) {
                    existingIndicator.remove();
                }
            });

            socket.on('agentJoined', (data) => {
                console.log('Agent joined:', data);
            });

            socket.on('agentLeft', (data) => {
                console.log('Agent left:', data);
            });

            // If no uniqueId, let's create a new session
            if (!uniqueId) {
                await initSession();
            } else {
                // If we already have a session, fetch old messages
                // Play notification sound
                playNotificationSound();

                const olderMessages = await fetchPreviousMessages(uniqueId);
                olderMessages.forEach(msg => {
                    const isSent = (msg.user === "Guest") ? 'sent' : 'received';
                    addMessageToDOM(msg.message, isSent, msg.user);
                });
            }
        } catch (error) {
            console.error('Socket initialization error:', error);
        }
    }

    /**
     * Helper function to create and show the notification
     */
    function createAndShowNotification(message, username) {

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

        try {
            const notification = new Notification(config.notifications.title, {
                body: `${username}: ${message}`,
                icon: config.notifications.icon,
                tag: 'chat-message',
                requireInteraction: false
            });

            // Store the notification reference
            activeNotifications.push(notification);

            // Handle notification click
            notification.onclick = function () {
                window.focus();
                toggleChatbox();
                this.close();
            };

            // Auto-close after timeout
            setTimeout(() => {
                notification.close();
                activeNotifications = activeNotifications.filter(n => n !== notification);
            }, config.notifications.timeout);

        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }


    /**
     * Creates a new session on the server, stores uniqueId in localStorage,
     * and attempts to gather location info.
     */
    async function initSession() {
        try {
            const os = getOS();
            const ipResponse = await fetch("https://api.ipify.org/?format=json");
            const ipData = await ipResponse.json();

            const response = await fetch(`${config.apiURL}/v1/session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ os, ip: ipData.ip })
            });

            const data = await response.json();
            if (data.message === "success") {
                uniqueId = data.id;
                localStorage.setItem("unique-id", uniqueId);
                if (socket) {
                    socket.emit("join_room", { room: uniqueId, username: "Guest" });
                }
                getLocationDetails(uniqueId);
            }
        } catch (error) {
            console.error('Session initialization error:', error);
            throw error;
        }
    }

    /**
     * Fetch old messages for a given session ID.
     */
    async function fetchPreviousMessages(sessionId) {
        try {
            const response = await fetch(`${config.apiURL}/v1/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId })
            });
            const data = await response.json();
            return data.message || [];
        } catch (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
    }

    /**
     * Helper: add message to the DOM (to be used by socket events).
     * We define it outside so socket events can call it,
     * but the main usage is in initSocket.
     */
    function addMessageToDOM(text, type, username) {
        // We'll find the container from the DOM
        const container = document.querySelector('.chatbox-content');
        if (!container) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        let displayText;
        if (type === 'sent') {
            displayText = `${text}`;
            const savedColor = localStorage.getItem('chatWidgetBackground') || '#39B3BA';
            messageDiv.style.background = ` ${savedColor}`;
        } else if (type === 'received') {
            displayText = `<span class="message-user">${username}</span> ${text}`;
        } else {
            displayText = text;
        }
        messageDiv.innerHTML = `<div class="message-text">${displayText}</div>`;
        container.appendChild(messageDiv);

        container.scrollTop = container.scrollHeight;

        // Enable transcript download
        hasMessages = true;
        const dlBtn = document.querySelector('.download-transcript');
        if (dlBtn) {
            dlBtn.classList.remove('disabled');
            dlBtn.disabled = false;
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



    //--------------------------- form -------------------------------//

    function initializeContactForm() {
        const formOverlay = document.querySelector('.contact-form-overlay');
        const submitButton = document.querySelector('.form-submit');
        // const skipButton = document.querySelector('.form-skip');
        const nameInput = document.querySelector('#contact-name');
        const emailInput = document.querySelector('#contact-email');
        const phoneInput = document.querySelector('#contact-phone');

        // Initially hide submit button
        submitButton.style.transform = 'scale(0)';


        showContactForm = function () {
            formOverlay.style.display = 'block';
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
            const phone = phoneInput.value.trim();

            try {
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

    /**
     * initialize Notifications
     */

    // function initializeNotifications() {
    //     // Request notification permission when widget loads
    //     if (Notification.permission === 'default') {
    //         Notification.requestPermission().then(function (permission) {
    //             notificationPermission = permission;
    //             localStorage.setItem('notificationPermission', permission);

    //             // Update toggle in settings
    //             const notificationToggle = document.getElementById('notification-toggle');
    //             if (notificationToggle) {
    //                 notificationToggle.checked = permission === 'granted';
    //                 notificationToggle.disabled = permission === 'denied';
    //             }
    //         });
    //     }

    //     // Add notification toggle to settings
    //     addNotificationToggle();

    //     // Handle visibility change
    //     document.addEventListener('visibilitychange', () => {
    //         if (!document.hidden) {
    //             // Close all active notifications when tab becomes visible
    //             activeNotifications.forEach(notification => notification.close());
    //             activeNotifications = [];
    //         }
    //     });
    // }

    // ------------- MAIN ENTRY POINTS -------------
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            createAndInjectCSS();
            loadGoogleFonts()
            initializeWidget();
            initSocket(); // start the socket connection attempt
            starting();
            initializeContactForm();
        });
    } else {
        createAndInjectCSS();
        loadGoogleFonts()
        initializeWidget();
        initSocket(); // start the socket connection attempt
        initializeContactForm();
    }
})();
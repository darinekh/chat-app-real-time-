// Socket.IO connection
const socket = io();

// DOM elements
const loginForm = document.getElementById('loginForm');
const chatInterface = document.getElementById('chatInterface');
const joinForm = document.getElementById('joinForm');
const usernameInput = document.getElementById('username');
const roomSelect = document.getElementById('room');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const userList = document.getElementById('userList');
const currentUserSpan = document.getElementById('currentUser');
const currentRoomSpan = document.getElementById('currentRoom');
const userCountSpan = document.getElementById('userCount');
const leaveBtn = document.getElementById('leaveBtn');
const typingIndicator = document.getElementById('typingIndicator');
const notifications = document.getElementById('notifications');

// State
let currentUser = '';
let currentRoom = '';
let typingTimer;
let isTyping = false;

// Event Listeners
joinForm.addEventListener('submit', handleJoin);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', handleMessageInput);
messageInput.addEventListener('input', handleTyping);
leaveBtn.addEventListener('click', handleLeave);

// Socket event listeners
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    showNotification('Disconnected from server', 'error');
});

socket.on('previousMessages', (messages) => {
    messages.forEach(message => {
        displayMessage(message);
    });
    scrollToBottom();
});

socket.on('newMessage', (message) => {
    displayMessage(message);
    scrollToBottom();
});

socket.on('userJoined', (data) => {
    displaySystemMessage(data.message);
    scrollToBottom();
});

socket.on('userLeft', (data) => {
    displaySystemMessage(data.message);
    scrollToBottom();
});

socket.on('userList', (users) => {
    updateUserList(users);
});

socket.on('userTyping', (data) => {
    handleUserTyping(data);
});

socket.on('error', (error) => {
    showNotification(error.message, 'error');
});

// Functions
function handleJoin(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const room = roomSelect.value;
    
    if (!username) {
        showNotification('Please enter a username', 'error');
        return;
    }
    
    currentUser = username;
    currentRoom = room;
    
    // Emit join event
    socket.emit('join', { username, room });
    
    // Update UI
    currentUserSpan.textContent = username;
    currentRoomSpan.textContent = room;
    loginForm.style.display = 'none';
    chatInterface.style.display = 'flex';
    
    // Focus on message input
    messageInput.focus();
    
    showNotification(`Joined ${room} room as ${username}`, 'success');
}

function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    socket.emit('sendMessage', { message });
    messageInput.value = '';
    
    // Stop typing indicator
    if (isTyping) {
        socket.emit('typing', { isTyping: false });
        isTyping = false;
    }
}

function handleMessageInput(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
}

function handleTyping() {
    if (!isTyping) {
        socket.emit('typing', { isTyping: true });
        isTyping = true;
    }
    
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        socket.emit('typing', { isTyping: false });
        isTyping = false;
    }, 1000);
}

function handleLeave() {
    if (confirm('Are you sure you want to leave the chat?')) {
        socket.disconnect();
        location.reload();
    }
}

function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="message-username">${escapeHtml(message.username)}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${escapeHtml(message.message)}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
}

function displaySystemMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message system-message';
    messageElement.innerHTML = `<div class="message-content">${escapeHtml(message)}</div>`;
    messagesContainer.appendChild(messageElement);
}

function updateUserList(users) {
    userList.innerHTML = '';
    userCountSpan.textContent = `${users.length} user${users.length !== 1 ? 's' : ''} online`;
    
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'user-item';
        userElement.innerHTML = `
            <i class="fas fa-user"></i> ${escapeHtml(user.username)}
            ${user.username === currentUser ? ' (You)' : ''}
        `;
        userList.appendChild(userElement);
    });
}

function handleUserTyping(data) {
    if (data.username === currentUser) return;
    
    if (data.isTyping) {
        typingIndicator.textContent = `${data.username} is typing...`;
    } else {
        typingIndicator.textContent = '';
    }
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notifications.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-focus username input on page load
window.addEventListener('load', () => {
    usernameInput.focus();
});

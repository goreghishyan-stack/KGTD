const socket = io();
let tempNick = "";
let selectedEmoji = "";

const clans = ["🏴‍☠️", "💊", "🔥", "👁️", "🛡️", "🧬", "🦾", "💎", "👾", "🩸", "⚡", "🐍"];

// Генерация сетки кланов
const grid = document.getElementById('emoji-grid');
clans.forEach(emoji => {
    const div = document.createElement('div');
    div.className = 'emoji-item';
    div.innerText = emoji;
    div.onclick = () => {
        document.querySelectorAll('.emoji-item').forEach(i => i.classList.remove('selected'));
        div.classList.add('selected');
        selectedEmoji = emoji;
    };
    grid.appendChild(div);
});

// Проверка памяти при загрузке
window.onload = () => {
    const saved = localStorage.getItem('kgtd_user');
    if (saved) {
        completeLogin(saved);
    }
};

function nextStep() {
    tempNick = document.getElementById('nick-input').value.trim();
    if (!tempNick) return alert("Введите ник!");
    document.getElementById('screen-step1').classList.add('hidden');
    document.getElementById('screen-step2').classList.remove('hidden');
}

function finishAuth() {
    if (!selectedEmoji) return alert("Выбери свой клан!");
    const finalId = `${selectedEmoji} ${tempNick}`;
    localStorage.setItem('kgtd_user', finalId);
    completeLogin(finalId);
}

function completeLogin(id) {
    document.getElementById('screen-step1').classList.add('hidden');
    document.getElementById('screen-step2').classList.add('hidden');
    document.getElementById('me').innerText = id;
    window.myTag = id;
}

// Посты
const input = document.getElementById('post-input');
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && input.value.trim() && window.myTag) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        socket.emit('newPost', { 
            user: window.myTag, 
            content: input.value,
            time: time 
        });
        input.value = '';
    }
});

socket.on('loadPosts', (posts) => {
    document.getElementById('feed').innerHTML = '';
    posts.forEach(addPost);
});

socket.on('updateFeed', addPost);

function addPost(post) {
    const div = document.createElement('div');
    div.className = 'post';
    div.innerHTML = `
        <div class="post-user">${post.user}</div>
        <div class="post-content">${post.content}</div>
        <div class="post-footer">${post.time || ''}</div>
    `;
    document.getElementById('feed').prepend(div);
}

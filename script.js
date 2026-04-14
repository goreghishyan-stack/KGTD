const socket = io();
let tempNick = "";
let selectedEmoji = "";

// Список всех эмодзи для выбора клана
const emojis = ["🏴‍☠️","🛡️","💊","🔥","👁️","🎲","🚀","👑","💎","🪐","👻","⚡","🐍","☄️","👾","🧿","🩸","🔗","🦾","🌘"];

// Заполняем сетку эмодзи
const grid = document.getElementById('emoji-grid');
emojis.forEach(e => {
    const el = document.createElement('div');
    el.className = 'emoji-item';
    el.innerText = e;
    el.onclick = () => {
        document.querySelectorAll('.emoji-item').forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
        selectedEmoji = e;
    };
    grid.appendChild(el);
});

// Авто-вход
window.onload = () => {
    const saved = localStorage.getItem('kgtd_id');
    if (saved) {
        startApp(saved);
    }
};

function goToClans() {
    tempNick = document.getElementById('input-nick').value.trim();
    if (!tempNick) return;
    document.getElementById('screen-reg').classList.add('hidden');
    document.getElementById('screen-clan').classList.remove('hidden');
}

function finishReg() {
    if (!selectedEmoji) return alert("Выбери эмодзи клана!");
    const fullId = `${selectedEmoji} ${tempNick}`;
    localStorage.setItem('kgtd_id', fullId);
    startApp(fullId);
}

function startApp(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('display-user').innerText = id;
    window.myId = id;
}

// Отправка
document.getElementById('post-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim() && window.myId) {
        socket.emit('newPost', { user: window.myId, content: e.target.value });
        e.target.value = '';
    }
});

// Лента
socket.on('loadPosts', (posts) => {
    document.getElementById('feed').innerHTML = '';
    posts.forEach(addPost);
});

socket.on('updateFeed', addPost);

function addPost(post) {
    const div = document.createElement('div');
    div.className = 'post';
    div.innerHTML = `<div class="post-user">${post.user}</div><div class="post-text">${post.content}</div>`;
    document.getElementById('feed').prepend(div);
}

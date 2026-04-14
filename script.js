const socket = io();
let mode = 'reg';
let selectedEmoji = "";
let myData = JSON.parse(localStorage.getItem('kgtd_v3'));

const clans = ["🔥", "🪐", "🧿", "⚡", "🦾", "🧬", "🧪", "💎"];
const allUsers = new Set();

const grid = document.getElementById('emoji-grid');
clans.forEach(e => {
    const d = document.createElement('div');
    d.className = 'emoji-item'; d.innerText = e;
    d.onclick = () => {
        document.querySelectorAll('.emoji-item').forEach(i => i.classList.remove('selected'));
        d.classList.add('selected'); selectedEmoji = e;
    };
    grid.appendChild(d);
});

window.onload = () => { if (myData) enterApp(); };
window.onpopstate = (e) => { if (e.state) tab(e.state.page, null, false); };

function setMode(m) {
    mode = m;
    document.getElementById('auth-choice').classList.add('hidden');
    document.getElementById('auth-form').classList.remove('hidden');
    if (m === 'login') document.getElementById('reg-extras').classList.add('hidden');
}

function sendAuth() {
    const nick = document.getElementById('nick-input').value.trim();
    const pass = document.getElementById('pass-input').value.trim();
    if (!nick || !pass) return alert("Введи данные!");
    socket.emit('authenticate', { mode, nick, pass, clan: selectedEmoji });
}

socket.on('authResult', (res) => {
    if (res.success) {
        myData = { id: res.userId, pass: res.pass, clan: res.userClan };
        localStorage.setItem('kgtd_v3', JSON.stringify(myData));
        enterApp();
    } else { alert(res.message); }
});

function enterApp() {
    document.getElementById('screen-auth').classList.add('hidden');
    document.getElementById('user-display').innerText = myData.id;
    history.pushState({page: 'feed'}, '', '');
}

// Функции выхода
function openLogout() { document.getElementById('logout-modal').classList.remove('hidden'); }
function closeLogout() { document.getElementById('logout-modal').classList.add('hidden'); }
function confirmLogout() {
    localStorage.removeItem('kgtd_v3');
    location.reload();
}

function tab(page, el, push = true) {
    document.getElementById('page-feed').classList.add('hidden');
    document.getElementById('page-search').classList.add('hidden');
    document.getElementById('input-wrap').style.display = (page === 'feed') ? 'flex' : 'none';
    document.getElementById(`page-${page}`).classList.remove('hidden');
    document.getElementById('page-title').innerText = page === 'feed' ? 'Лента' : 'Поиск';
    if (push) history.pushState({page: page}, '', '');
    if (el) {
        document.querySelectorAll('nav div').forEach(d => d.classList.remove('active'));
        el.classList.add('active');
    }
}

// Прием уведомлений о новом соклановце
socket.on('clanNotification', (data) => {
    // Если мы в том же клане, что и новичок
    if (myData && myData.clan === data.clan) {
        const notify = document.createElement('div');
        notify.className = 'system-msg';
        notify.innerText = `В нашем клане ${data.clan} пополнение! Приветствуем ${data.user}`;
        document.getElementById('posts-container').prepend(notify);
    }
});

const pIn = document.getElementById('post-input');
pIn.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && pIn.value.trim()) {
        socket.emit('newPost', { user: myData.id, content: pIn.value });
        pIn.value = '';
    }
});

socket.on('loadPosts', (posts) => {
    document.getElementById('posts-container').innerHTML = '';
    posts.forEach(addP);
});

socket.on('updateFeed', addP);

function addP(p) {
    allUsers.add(p.user);
    const d = document.createElement('div'); d.className = 'post';
    d.innerHTML = `<div class="post-user">${p.user}</div><div style="font-size:16px">${p.content}</div>`;
    document.getElementById('posts-container').prepend(d);
}

document.getElementById('search-in').addEventListener('input', (e) => {
    const v = e.target.value.toLowerCase();
    const r = document.getElementById('search-results');
    r.innerHTML = '';
    if (v.length < 2) return;
    Array.from(allUsers).filter(u => u.toLowerCase().includes(v)).forEach(u => {
        r.innerHTML += `<div style="background:rgba(255,255,255,0.03); padding:18px; border-radius:20px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(255,255,255,0.05)">
            <span style="font-weight:bold">${u}</span><button onclick="alert('Добавлено!')" style="background:var(--accent); color:#fff; border:none; border-radius:10px; padding:8px 12px; font-weight:bold">ПРОФИЛЬ</button>
        </div>`;
    });
});

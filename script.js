const socket = io();
let mode = 'reg';
let selectedEmoji = "";
let myData = JSON.parse(localStorage.getItem('kgtd_v3'));

const clans = ["🔥", "🪐", "🧿", "⚡", "🦾", "🧬", "🧪", "💎"];
const allUsers = new Set();

const grid = document.getElementById('emoji-grid');
if(grid) {
    clans.forEach(e => {
        const d = document.createElement('div');
        d.className = 'emoji-item'; d.innerText = e;
        d.onclick = () => {
            document.querySelectorAll('.emoji-item').forEach(i => i.classList.remove('selected'));
            d.classList.add('selected'); selectedEmoji = e;
        };
        grid.appendChild(d);
    });
}

// Авто-вход
window.onload = () => { 
    if (myData && myData.nick && myData.pass) {
        socket.emit('authenticate', { mode: 'login', nick: myData.nick, pass: myData.pass });
    }
};

socket.on('authResult', (res) => {
    if (res.success) {
        myData = { id: res.userId, pass: res.pass, clan: res.userClan, nick: res.userName };
        localStorage.setItem('kgtd_v3', JSON.stringify(myData));
        enterApp();
    } else {
        // ЕСЛИ СЕРВЕР ОБНУЛИЛСЯ (код ошибки RE_REG)
        if (res.code === "RE_REG" && myData) {
            console.log("Восстановление аккаунта...");
            socket.emit('authenticate', { 
                mode: 'reg', 
                nick: myData.nick, 
                pass: myData.pass, 
                clan: myData.clan 
            });
        } else {
            alert(res.message);
        }
    }
});

function setMode(m) {
    mode = m;
    document.getElementById('auth-choice').classList.add('hidden');
    document.getElementById('auth-form').classList.remove('hidden');
    if (m === 'login') {
        document.getElementById('reg-extras').classList.add('hidden');
    } else {
        document.getElementById('reg-extras').classList.remove('hidden');
    }
}

function sendAuth() {
    const nick = document.getElementById('nick-input').value.trim();
    const pass = document.getElementById('pass-input').value.trim();
    if (!nick || !pass) return alert("Введи данные!");
    if (mode === 'reg' && !selectedEmoji) return alert("Выбери клан!");
    socket.emit('authenticate', { mode, nick, pass, clan: selectedEmoji });
}

function enterApp() {
    document.getElementById('screen-auth').classList.add('hidden');
    document.getElementById('user-display').innerText = myData.id;
    history.pushState({page: 'feed'}, '', '');
}

function openLogout() { document.getElementById('logout-modal').classList.remove('hidden'); }
function closeLogout() { document.getElementById('logout-modal').classList.add('hidden'); }
function confirmLogout() {
    localStorage.removeItem('kgtd_v3');
    location.reload();
}

function tab(page, el, push = true) {
    document.getElementById('page-feed').classList.add('hidden');
    document.getElementById('page-search').classList.add('hidden');
    const iWrap = document.getElementById('input-wrap');
    if(iWrap) iWrap.style.display = (page === 'feed') ? 'flex' : 'none';
    document.getElementById(`page-${page}`).classList.remove('hidden');
    document.getElementById('page-title').innerText = page === 'feed' ? 'Лента' : 'Поиск';
    if (push) history.pushState({page: page}, '', '');
    if (el) {
        document.querySelectorAll('nav div').forEach(d => d.classList.remove('active'));
        el.classList.add('active');
    }
}

socket.on('clanNotification', (data) => {
    if (myData && myData.clan === data.clan) {
        const notify = document.createElement('div');
        notify.className = 'system-msg';
        notify.innerText = `В нашем клане ${data.clan} пополнение! Приветствуем ${data.user}`;
        const cont = document.getElementById('posts-container');
        if(cont) cont.prepend(notify);
    }
});

const pIn = document.getElementById('post-input');
if(pIn) {
    pIn.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && pIn.value.trim() && myData) {
            socket.emit('newPost', { user: myData.id, content: pIn.value });
            pIn.value = '';
        }
    });
}

socket.on('loadPosts', (posts) => {
    const cont = document.getElementById('posts-container');
    if(cont) {
        cont.innerHTML = '';
        posts.forEach(addP);
    }
});

socket.on('updateFeed', addP);

function addP(p) {
    allUsers.add(p.user);
    const d = document.createElement('div'); d.className = 'post';
    d.innerHTML = `<div class="post-user">${p.user}</div><div style="font-size:16px">${p.content}</div>`;
    const cont = document.getElementById('posts-container');
    if(cont) cont.prepend(d);
}

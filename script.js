const socket = io();
let selectedEmoji = "";
let myData = JSON.parse(localStorage.getItem('kgtd_session'));

const clans = ["🏴‍☠️", "💊", "🔥", "👁️", "🛡️", "⚡", "👾", "👑"];
const allUsersInFeed = new Set();

// Рендер кланов
const grid = document.getElementById('emoji-grid');
clans.forEach(e => {
    const d = document.createElement('div');
    d.className = 'emoji-item';
    d.innerText = e;
    d.onclick = () => {
        document.querySelectorAll('.emoji-item').forEach(i => i.classList.remove('selected'));
        d.classList.add('selected');
        selectedEmoji = e;
    };
    grid.appendChild(d);
});

// ПРОВЕРКА СЕССИИ (Авто-вход)
window.onload = () => {
    if (myData && myData.id) {
        enterApp(false);
    }
};

// ОБРАБОТКА СТРЕЛОК "НАЗАД"
window.onpopstate = (e) => {
    if (e.state && e.state.page) {
        changeTab(e.state.page, null, false);
    }
};

function handleAuth() {
    const nick = document.getElementById('nick-input').value.trim();
    const pass = document.getElementById('pass-input').value.trim();
    
    if (!nick || !pass || !selectedEmoji) return alert("Заполни все поля и выбери клан!");

    // Сохраняем ник и пароль. В этой версии пароль хранится локально для "входа".
    myData = { id: `${selectedEmoji} ${nick}`, pass: pass };
    localStorage.setItem('kgtd_session', JSON.stringify(myData));
    
    enterApp(true);
}

function enterApp(pushHistory) {
    document.getElementById('screen-auth').classList.add('hidden');
    document.getElementById('my-id-display').innerText = myData.id;
    if (pushHistory) history.pushState({page: 'feed'}, '', '');
}

function changeTab(page, el, pushHistory = true) {
    // Навигация по страницам
    document.getElementById('page-feed').classList.add('hidden');
    document.getElementById('page-search').classList.add('hidden');
    document.getElementById('input-wrap').classList.add('hidden');

    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) targetPage.classList.remove('hidden');
    
    if (page === 'feed') document.getElementById('input-wrap').classList.remove('hidden');
    
    document.getElementById('current-page-title').innerText = page === 'feed' ? 'Лента' : 'Поиск';

    if (pushHistory) history.pushState({page: page}, '', '');

    if (el) {
        document.querySelectorAll('nav div').forEach(d => d.classList.remove('active'));
        el.classList.add('active');
    }
}

// ПОСТЫ
const postInput = document.getElementById('post-input');
postInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && postInput.value.trim() && myData) {
        socket.emit('newPost', { user: myData.id, content: postInput.value });
        postInput.value = '';
    }
});

socket.on('updateFeed', (post) => {
    addPostToDOM(post);
    allUsersInFeed.add(post.user);
});

socket.on('loadPosts', (posts) => {
    document.getElementById('posts-container').innerHTML = '';
    posts.forEach(p => {
        addPostToDOM(p);
        allUsersInFeed.add(p.user);
    });
});

function addPostToDOM(post) {
    const div = document.createElement('div');
    div.className = 'post';
    div.innerHTML = `<div class="post-user">${post.user}</div><div>${post.content}</div>`;
    document.getElementById('posts-container').prepend(div);
}

// ПОИСК
document.getElementById('search-input').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const res = document.getElementById('search-results');
    res.innerHTML = '';
    
    if (val.length < 2) return;

    let found = Array.from(allUsersInFeed).filter(u => u.toLowerCase().includes(val));
    
    if (found.length > 0) {
        found.forEach(user => {
            res.innerHTML += `
                <div style="background:#111; padding:15px; border-radius:12px; display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span>${user}</span>
                    <button onclick="alert('Запрос отправлен!')" style="background:#fff; border:none; border-radius:5px; font-weight:bold; padding:5px 10px;">ДОБАВИТЬ</button>
                </div>`;
        });
    } else {
        res.innerHTML = '<p style="color:#333; text-align:center;">Таких тут нет. Либо шифруется, либо не существует.</p>';
    }
});

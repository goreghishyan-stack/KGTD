const socket = io();
const feed = document.getElementById('feed');
const postInput = document.getElementById('post-input');
let myNick = "";

function enterITD() {
    const nick = document.getElementById('nickname').value.trim();
    if (nick) {
        myNick = nick;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('user-name').innerText = myNick;
    }
}

// Отправка поста
postInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && postInput.value.trim() && myNick) {
        socket.emit('newPost', { user: myNick, content: postInput.value });
        postInput.value = '';
    }
});

// Получение постов
socket.on('loadPosts', (posts) => {
    feed.innerHTML = '';
    posts.forEach(addPostToFeed);
});

socket.on('updateFeed', (post) => {
    addPostToFeed(post);
    window.scrollTo(0, document.body.scrollHeight);
});

function addPostToFeed(post) {
    const div = document.createElement('div');
    div.className = 'post';
    div.innerHTML = `
        <div class="post-header">${post.user}</div>
        <div class="post-content">${post.content}</div>
    `;
    feed.appendChild(div);
}

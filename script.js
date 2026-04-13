let selectedEmoji = "";
let myFullIdentity = "";

// Проверка: если юзер уже заходил раньше
window.onload = () => {
    const savedIdentity = localStorage.getItem('kgtd_user');
    if (savedIdentity) {
        myFullIdentity = savedIdentity;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('user-name').innerText = myFullIdentity;
    }
};

function selectClan(emoji, element) {
    selectedEmoji = emoji;
    // Снимаем выделение со всех и ставим на текущий
    document.querySelectorAll('.clan-opt').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
}

function enterKGTD() {
    const nick = document.getElementById('nickname').value.trim();
    if (!nick) return alert("Введи ник!");
    if (!selectedEmoji) return alert("Выбери клан (эмодзи)!");

    myFullIdentity = `${selectedEmoji} ${nick}`;
    
    // СОХРАНЯЕМ В БРАУЗЕР (чтобы не вводить снова)
    localStorage.setItem('kgtd_user', myFullIdentity);
    
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('user-name').innerText = myFullIdentity;
}

// При отправке поста теперь всегда используем myFullIdentity
postInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && postInput.value.trim() && myFullIdentity) {
        socket.emit('newPost', { 
            user: myFullIdentity, 
            content: postInput.value 
        });
        postInput.value = '';
    }
});

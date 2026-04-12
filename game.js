const socket = io();
const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const status = document.getElementById('status');
const timerDisplay = document.getElementById('timer-display');
const nickDisplay = document.getElementById('nickname-display');

const worldSize = 100; 
const pixelSize = 10; 
canvas.width = worldSize * pixelSize;
canvas.height = worldSize * pixelSize;

let pixels = {}; 
let myNick = "";
let canDraw = true;

// Создаем всплывающую подсказку программно
const tooltip = document.createElement('div');
tooltip.style.position = 'absolute';
tooltip.style.padding = '5px 10px';
tooltip.style.background = 'rgba(0,0,0,0.8)';
tooltip.style.color = 'white';
tooltip.style.borderRadius = '5px';
tooltip.style.display = 'none';
tooltip.style.pointerEvents = 'none';
tooltip.style.fontSize = '12px';
tooltip.style.zIndex = '1000';
document.body.appendChild(tooltip);

window.startGame = function() {
    const nickInput = document.getElementById('nickname');
    if (nickInput.value.trim() !== "") {
        myNick = nickInput.value;
        nickDisplay.innerText = `Игрок: ${myNick}`;
        document.getElementById('login-screen').style.display = 'none';
    }
};

socket.on('loadCanvas', (data) => {
    pixels = data;
    render();
});

socket.on('updatePixel', (data) => {
    pixels[`${data.x}-${data.y}`] = { color: data.color, user: data.user };
    render();
});

socket.on('error_cooldown', (seconds) => {
    canDraw = false;
    startTimer(seconds);
});

function render() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let key in pixels) {
        const [x, y] = key.split('-').map(Number);
        ctx.fillStyle = pixels[key].color;
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
}

// ПРОВЕРКА КТО ПОСТАВИЛ (НАВЕДЕНИЕ)
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) / pixelSize);
    
    const pixel = pixels[`${x}-${y}`];
    if (pixel) {
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 10) + 'px';
        tooltip.style.top = (e.clientY + 10) + 'px';
        tooltip.innerText = `Автор: ${pixel.user}`;
    } else {
        tooltip.style.display = 'none';
    }
});

canvas.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

canvas.addEventListener('mousedown', (e) => {
    if (!canDraw || !myNick) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) / pixelSize);

    socket.emit('setPixel', { x, y, color: colorPicker.value, user: myNick });
    canDraw = false;
    startTimer(30);
});

function startTimer(seconds) {
    let timeLeft = seconds;
    const interval = setInterval(() => {
        timerDisplay.innerText = `ПЕРЕЗАРЯДКА: ${timeLeft}с`;
        timeLeft--;
        if (timeLeft < 0) {
            clearInterval(interval);
            timerDisplay.innerText = "ГОТОВ";
            canDraw = true;
        }
    }, 1000);
}

render();
const socket = io();
const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const timerDisplay = document.getElementById('timer-display');
const infoBox = document.getElementById('pixel-info');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const worldSize = 300; 
const pixelSize = 20; 

let pixels = {}; 
let myNick = "";
let canDraw = true;

// Камера
let zoom = 0.4;
let cameraX = canvas.width / 2 - (worldSize * pixelSize * zoom) / 2;
let cameraY = canvas.height / 2 - (worldSize * pixelSize * zoom) / 2;
let isPanning = false;
let startPanX = 0, startPanY = 0;

window.startGame = function() {
    const input = document.getElementById('nickname');
    if (input.value.trim()) {
        myNick = input.value;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('user-display').innerText = "Ник: " + myNick;
    }
};

socket.on('loadCanvas', (data) => { pixels = data; render(); });
socket.on('updatePixel', (data) => {
    pixels[`${data.x}-${data.y}`] = { color: data.color, user: data.user };
    render();
});

socket.on('error_cooldown', (sec) => {
    canDraw = false;
    let timeLeft = sec;
    const interval = setInterval(() => {
        timerDisplay.innerText = `ЖДИ: ${timeLeft}с`;
        timeLeft--;
        if (timeLeft < 0) {
            clearInterval(interval);
            timerDisplay.innerText = "ГОТОВ";
            canDraw = true;
        }
    }, 1000);
});

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    ctx.translate(cameraX, cameraY);
    ctx.scale(zoom, zoom);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, worldSize * pixelSize, worldSize * pixelSize);

    for (let key in pixels) {
        const [x, y] = key.split('-').map(Number);
        ctx.fillStyle = pixels[key].color;
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
    ctx.restore();
}

// Поиск пикселя под мышкой/пальцем
function getPixelAt(screenX, screenY) {
    const worldX = (screenX - cameraX) / zoom;
    const worldY = (screenY - cameraY) / zoom;
    return {
        x: Math.floor(worldX / pixelSize),
        y: Math.floor(worldY / pixelSize)
    };
}

// Управление
canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
        isPanning = true;
        startPanX = e.clientX - cameraX;
        startPanY = e.clientY - cameraY;
    } else if (e.button === 0 && canDraw && myNick) {
        const p = getPixelAt(e.clientX, e.clientY);
        if (p.x >= 0 && p.x < worldSize && p.y >= 0 && p.y < worldSize) {
            socket.emit('setPixel', { x: p.x, y: p.y, color: colorPicker.value, user: myNick });
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isPanning) {
        cameraX = e.clientX - startPanX;
        cameraY = e.clientY - startPanY;
        render();
    }
    
    // Оверлей инфо
    const p = getPixelAt(e.clientX, e.clientY);
    const pix = pixels[`${p.x}-${p.y}`];
    if (pix && pix.user) {
        infoBox.style.display = 'block';
        infoBox.style.left = (e.clientX + 15) + 'px';
        infoBox.style.top = (e.clientY + 15) + 'px';
        infoBox.innerHTML = `Игрок: <b>${pix.user}</b>`;
    } else {
        infoBox.style.display = 'none';
    }
});

window.addEventListener('mouseup', () => isPanning = false);

canvas.addEventListener('wheel', (e) => {
    const zoomAmount = e.deltaY > 0 ? 0.9 : 1.1;
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    cameraX = mouseX - (mouseX - cameraX) * zoomAmount;
    cameraY = mouseY - (mouseY - cameraY) * zoomAmount;
    zoom *= zoomAmount;
    zoom = Math.max(0.1, Math.min(zoom, 5));
    render();
}, { passive: false });

// Поддержка тача (телефоны)
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        const t = e.touches[0];
        startPanX = t.clientX - cameraX;
        startPanY = t.clientY - cameraY;
    }
});
canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
        const t = e.touches[0];
        cameraX = t.clientX - startPanX;
        cameraY = t.clientY - startPanY;
        render();
    }
});

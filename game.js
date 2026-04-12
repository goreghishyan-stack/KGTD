const socket = io();
const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const timerDisplay = document.getElementById('timer-display');
const infoBox = document.getElementById('pixel-info');

// Настройка размеров
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 60;
}
window.addEventListener('resize', () => { resize(); render(); });
resize();

const worldSize = 300; 
const pixelSize = 20; 

let pixels = {}; 
let myNick = "";
let canDraw = true;

// Камера (центрируем)
let zoom = 0.5;
let cameraX = (canvas.width / 2) - (worldSize * pixelSize * zoom) / 2;
let cameraY = (canvas.height / 2) - (worldSize * pixelSize * zoom) / 2;

let isPanning = false;
let startPanX = 0, startPanY = 0;

window.startGame = function() {
    const nick = document.getElementById('nickname').value.trim();
    if (nick) {
        myNick = nick;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('status').innerText = "Игрок: " + myNick;
    }
};

socket.on('loadCanvas', (data) => { pixels = data; render(); });
socket.on('updatePixel', (data) => {
    pixels[`${data.x}-${data.y}`] = { color: data.color, user: data.user };
    render();
});

socket.on('error_cooldown', (sec) => {
    canDraw = false;
    let time = sec;
    const inv = setInterval(() => {
        timerDisplay.innerText = `ЖДИ: ${time}с`;
        time--;
        if (time < 0) {
            clearInterval(inv);
            timerDisplay.innerText = "ГОТОВ";
            canDraw = true;
        }
    }, 1000);
});

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false; // ПИКСЕЛЬНАЯ ЧЕТКОСТЬ

    ctx.save();
    ctx.translate(cameraX, cameraY);
    ctx.scale(zoom, zoom);

    // Белый холст
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, worldSize * pixelSize, worldSize * pixelSize);

    // Отрисовка пикселей
    for (let key in pixels) {
        const [x, y] = key.split('-').map(Number);
        ctx.fillStyle = pixels[key].color;
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
    ctx.restore();
}

// ФУНКЦИЯ-СНАЙПЕР (идеальная точность)
function getPixelAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    
    // Координаты внутри канваса
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // Перевод в мировые координаты с учетом зума и сдвига
    const worldX = (canvasX - cameraX) / zoom;
    const worldY = (canvasY - cameraY) / zoom;

    return {
        x: Math.floor(worldX / pixelSize),
        y: Math.floor(worldY / pixelSize)
    };
}

// Мышь
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
    
    const p = getPixelAt(e.clientX, e.clientY);
    const pix = pixels[`${p.x}-${p.y}`];
    if (pix && pix.user) {
        infoBox.style.display = 'block';
        infoBox.style.left = (e.clientX + 15) + 'px';
        infoBox.style.top = (e.clientY + 15) + 'px';
        infoBox.innerHTML = `Поставил: <b>${pix.user}</b>`;
    } else {
        infoBox.style.display = 'none';
    }
});

window.addEventListener('mouseup', () => isPanning = false);

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const ratio = e.deltaY > 0 ? 0.9 : 1.1;
    const mX = e.clientX;
    const mY = e.clientY - 60; // Учитываем высоту меню
    
    cameraX = mX - (mX - cameraX) * ratio;
    cameraY = mY - (mY - cameraY) * ratio;
    zoom *= ratio;
    zoom = Math.max(0.1, Math.min(zoom, 8));
    render();
}, { passive: false });

// Мобилки
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        const t = e.touches[0];
        startPanX = t.clientX - cameraX;
        startPanY = t.clientY - cameraY;
        this.touchStartTime = Date.now();
    }
}, {passive: false});

canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
        const t = e.touches[0];
        cameraX = t.clientX - startPanX;
        cameraY = t.clientY - startPanY;
        render();
    }
}, {passive: false});

canvas.addEventListener('touchend', (e) => {
    const duration = Date.now() - this.touchStartTime;
    if (duration < 200 && canDraw && myNick) { // Быстрый тап
        const t = e.changedTouches[0];
        const p = getPixelAt(t.clientX, t.clientY);
        if (p.x >= 0 && p.x < worldSize && p.y >= 0 && p.y < worldSize) {
            socket.emit('setPixel', { x: p.x, y: p.y, color: colorPicker.value, user: myNick });
        }
    }
});

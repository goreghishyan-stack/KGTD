const socket = io();
const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');

const worldSize = 100; // Сделаем поле чуть побольше
const pixelSize = 8; 
canvas.width = worldSize * pixelSize;
canvas.height = worldSize * pixelSize;

let pixels = {}; 
let isDrawing = false;

// Вход в игру без лишних окон
const myNick = "Игрок";

socket.on('loadCanvas', (data) => { pixels = data; render(); });

socket.on('updatePixel', (data) => {
    pixels[`${data.x}-${data.y}`] = { color: data.color };
    render();
});

// Слушаем команду от сервера на удаление пикселя
socket.on('removePixel', (data) => {
    delete pixels[`${data.x}-${data.y}`];
    render();
});

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Чистим экран
    
    for (let key in pixels) {
        const [x, y] = key.split('-').map(Number);
        ctx.fillStyle = pixels[key].color;
        // Рисуем немного скругленные пиксели для красоты
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize - 1, pixelSize - 1);
    }
}

// Рисование зажатой мышкой (как в CS2)
canvas.addEventListener('mousedown', () => isDrawing = true);
window.addEventListener('mouseup', () => isDrawing = false);

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) / pixelSize);
    
    socket.emit('setPixel', { x, y, color: colorPicker.value, user: myNick });
});

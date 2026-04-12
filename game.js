const socket = io();
const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');

const worldSize = 50; // Размер поля в пикселях
const pixelSize = 15; // Масштаб одного пикселя
canvas.width = worldSize * pixelSize;
canvas.height = worldSize * pixelSize;

let pixels = {}; 

// --- РАБОТА С СЕТЬЮ ---

// Получаем весь холст при первом заходе
socket.on('loadCanvas', (data) => { 
    pixels = data; 
    render(); 
});

// Получаем один новый пиксель (от себя или других игроков)
socket.on('updatePixel', (data) => {
    pixels[`${data.x}-${data.y}`] = data.color;
    render();
});

// --- ОТРИСОВКА ---

function render() {
    // Очищаем экран белым цветом
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Рисуем каждый пиксель из базы
    for (let key in pixels) {
        const [x, y] = key.split('-').map(Number);
        ctx.fillStyle = pixels[key];
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
}

// --- УПРАВЛЕНИЕ ---

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) / pixelSize);
    
    // Отправляем координаты и цвет на сервер
    socket.emit('setPixel', { x, y, color: colorPicker.value });
});

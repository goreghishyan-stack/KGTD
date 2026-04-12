const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

let pixelData = {}; 
let lastMove = {}; 

io.on('connection', (socket) => {
    socket.emit('loadCanvas', pixelData);

    socket.on('setPixel', (data) => {
        const now = Date.now();
        const cooldown = 5000; // Сделал 5 секунд для тестов стратегии

        if (lastMove[socket.id] && now - lastMove[socket.id] < cooldown) {
            const timeLeft = Math.ceil((cooldown - (now - lastMove[socket.id])) / 1000);
            socket.emit('error_cooldown', timeLeft);
            return;
        }

        lastMove[socket.id] = now;
        pixelData[`${data.x}-${data.y}`] = { color: data.color, user: data.user };
        io.emit('updatePixel', { x: data.x, y: data.y, color: data.color, user: data.user });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log('Сервер запущен на порту ' + PORT);
});

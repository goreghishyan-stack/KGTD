const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const { exec } = require('child_process');

app.use(express.static(__dirname));

let pixelData = {}; // Теперь тут будет { "x-y": { color: "#ff0000", user: "Егор" } }
let lastMove = {}; 

io.on('connection', (socket) => {
    socket.emit('loadCanvas', pixelData);

    socket.on('setPixel', (data) => {
        const now = Date.now();
        const cooldown = 30000; 

        if (lastMove[socket.id] && now - lastMove[socket.id] < cooldown) {
            const timeLeft = Math.ceil((cooldown - (now - lastMove[socket.id])) / 1000);
            socket.emit('error_cooldown', timeLeft);
            return;
        }

        lastMove[socket.id] = now;
        
        // Сохраняем объект с цветом и именем
        const pixelInfo = { color: data.color, user: data.user || 'Аноним' };
        pixelData[`${data.x}-${data.y}`] = pixelInfo;
        
        io.emit('updatePixel', { x: data.x, y: data.y, ...pixelInfo });
    });

    socket.on('disconnect', () => { delete lastMove[socket.id]; });
});

http.listen(3000, () => {
    console.log('Сервер: http://localhost:3000');
    exec('start http://localhost:3000'); 
});
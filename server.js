const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');

app.use(express.static(__dirname));

const DATA_FILE = 'pixels.json';
let pixelData = {}; 
let lastMove = {}; // Храним время последнего хода для каждого IP

if (fs.existsSync(DATA_FILE)) {
    pixelData = JSON.parse(fs.readFileSync(DATA_FILE));
}

io.on('connection', (socket) => {
    // Получаем IP игрока (для Render это работает через заголовки)
    const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;

    socket.emit('loadCanvas', pixelData);

    socket.on('setPixel', (data) => {
        const now = Date.now();
        const COOLDOWN = 10000; // 10 секунд

        if (lastMove[clientIp] && now - lastMove[clientIp] < COOLDOWN) {
            const remaining = Math.ceil((COOLDOWN - (now - lastMove[clientIp])) / 1000);
            socket.emit('error_cooldown', remaining);
            return;
        }

        lastMove[clientIp] = now;
        pixelData[`${data.x}-${data.y}`] = data.color;
        io.emit('updatePixel', data);

        fs.writeFile(DATA_FILE, JSON.stringify(pixelData), (err) => {});
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Event Server Live!'));

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(__dirname));

// ============================================================
//  КОНФИГ КИТОВ
// ============================================================
const KITS = {
  warrior:  { hp: 20, dmg: 5,  speed: 4.5, bowDmg: 0,  specialDmg: 8,  specialCd: 4,  specialName: 'Удар щитом',  color: '#8899aa' },
  archer:   { hp: 16, dmg: 3,  speed: 5.5, bowDmg: 6,  specialDmg: 10, specialCd: 5,  specialName: 'Залп стрел',  color: '#448844' },
  tank:     { hp: 30, dmg: 2,  speed: 3.0, bowDmg: 0,  specialDmg: 4,  specialCd: 3,  specialName: 'Рывок-удар',  color: '#556677' },
  assassin: { hp: 12, dmg: 8,  speed: 6.5, bowDmg: 0,  specialDmg: 16, specialCd: 6,  specialName: 'Крит удар',   color: '#993399' },
};

const ARENA = 20;
const TICK_RATE = 20; // тиков в секунду

// ============================================================
//  СОСТОЯНИЕ ИГРЫ
// ============================================================
let players = {}; // socket.id -> playerData
let arrows = [];  // летящие стрелы
let arrowId = 0;

function randomSpawn() {
  const angle = Math.random() * Math.PI * 2;
  const r = 5 + Math.random() * 8;
  return { x: Math.cos(angle) * r, y: 0, z: Math.sin(angle) * r };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ============================================================
//  SOCKET.IO
// ============================================================
io.on('connection', (socket) => {
  console.log('+ подключился:', socket.id);

  // Игрок выбрал кит и имя
  socket.on('join', ({ name, kit }) => {
    if (!KITS[kit]) kit = 'warrior';
    const k = KITS[kit];
    const pos = randomSpawn();

    players[socket.id] = {
      id: socket.id,
      name: name || 'Player',
      kit,
      hp: k.hp,
      maxHp: k.hp,
      x: pos.x, y: 0, z: pos.z,
      rotY: 0,
      kills: 0,
      alive: true,
      attackCd: 0,
      bowCd: 0,
      specialCd: 0,
      color: k.color,
    };

    // Отправляем новому игроку текущих игроков
    socket.emit('init', {
      id: socket.id,
      players: players,
      kits: KITS,
    });

    // Всем остальным — новый игрок
    socket.broadcast.emit('playerJoined', players[socket.id]);

    console.log(`  ${name} (${kit}) зашёл`);
  });

  // Движение игрока
  socket.on('move', ({ x, z, rotY }) => {
    const p = players[socket.id];
    if (!p || !p.alive) return;
    // Клампаем в арену
    p.x = clamp(x, -(ARENA - 0.5), ARENA - 0.5);
    p.z = clamp(z, -(ARENA - 0.5), ARENA - 0.5);
    p.rotY = rotY;
  });

  // Удар мечом
  socket.on('attack', () => {
    const attacker = players[socket.id];
    if (!attacker || !attacker.alive) return;
    if (attacker.attackCd > 0) return;

    const k = KITS[attacker.kit];
    attacker.attackCd = 0.5;

    // Проверяем всех других игроков в радиусе 2.5 и в конусе перед игроком
    const forward = { x: -Math.sin(attacker.rotY), z: -Math.cos(attacker.rotY) };

    Object.values(players).forEach(target => {
      if (target.id === attacker.id || !target.alive) return;
      const dx = target.x - attacker.x;
      const dz = target.z - attacker.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 2.5) return;
      const dot = (dx / dist) * forward.x + (dz / dist) * forward.z;
      if (dot < 0.4) return; // не в конусе

      applyDamage(target, k.dmg, attacker.name, attacker.id);
    });
  });

  // Стрела
  socket.on('shoot', ({ dirX, dirZ }) => {
    const shooter = players[socket.id];
    if (!shooter || !shooter.alive) return;
    const k = KITS[shooter.kit];
    if (!k.bowDmg || shooter.bowCd > 0) return;
    shooter.bowCd = 1.2;

    const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
    const arrow = {
      id: arrowId++,
      shooterId: socket.id,
      shooterName: shooter.name,
      x: shooter.x,
      y: 1.4,
      z: shooter.z,
      vx: (dirX / len) * 18,
      vy: 1,
      vz: (dirZ / len) * 18,
      dmg: k.bowDmg,
      life: 4,
      dead: false,
    };
    arrows.push(arrow);
    io.emit('arrowSpawned', arrow);
  });

  // Спец удар
  socket.on('special', () => {
    const attacker = players[socket.id];
    if (!attacker || !attacker.alive) return;
    if (attacker.specialCd > 0) return;
    const k = KITS[attacker.kit];
    attacker.specialCd = k.specialCd;

    if (attacker.kit === 'archer') {
      // Залп — 3 стрелы веером
      const base = attacker.rotY;
      [-0.3, 0, 0.3].forEach(offset => {
        const angle = base + offset;
        const arrow = {
          id: arrowId++,
          shooterId: socket.id,
          shooterName: attacker.name,
          x: attacker.x, y: 1.4, z: attacker.z,
          vx: -Math.sin(angle) * 18,
          vy: 0.5,
          vz: -Math.cos(angle) * 18,
          dmg: k.bowDmg,
          life: 3,
          dead: false,
        };
        arrows.push(arrow);
        io.emit('arrowSpawned', arrow);
      });
    } else {
      // Ближний спец удар
      Object.values(players).forEach(target => {
        if (target.id === attacker.id || !target.alive) return;
        const dx = target.x - attacker.x;
        const dz = target.z - attacker.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const range = attacker.kit === 'tank' ? 5 : (k.specialDmg > 10 ? 2.0 : 2.5);
        if (dist > range) return;
        applyDamage(target, k.specialDmg, attacker.name, attacker.id);
      });
    }

    io.emit('specialEffect', { id: socket.id, kit: attacker.kit, x: attacker.x, z: attacker.z });
  });

  // Игрок умер и хочет возродиться
  socket.on('respawn', ({ kit }) => {
    const p = players[socket.id];
    if (!p) return;
    if (!KITS[kit]) kit = p.kit;
    const k = KITS[kit];
    const pos = randomSpawn();
    p.kit = kit;
    p.hp = k.hp;
    p.maxHp = k.hp;
    p.x = pos.x; p.y = 0; p.z = pos.z;
    p.alive = true;
    p.attackCd = 0; p.bowCd = 0; p.specialCd = 0;
    p.color = k.color;
    io.emit('playerRespawned', p);
  });

  socket.on('disconnect', () => {
    console.log('- отключился:', socket.id, players[socket.id]?.name);
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
  });
});

// ============================================================
//  ПРИМЕНИТЬ УРОН
// ============================================================
function applyDamage(target, dmg, attackerName, attackerId) {
  target.hp -= dmg;
  io.emit('playerHit', { id: target.id, hp: target.hp, maxHp: target.maxHp, dmg });

  if (target.hp <= 0 && target.alive) {
    target.alive = false;
    target.hp = 0;
    const attacker = players[attackerId];
    if (attacker) {
      attacker.kills++;
      io.emit('scoreUpdate', { id: attackerId, kills: attacker.kills });
    }
    io.emit('playerDied', { id: target.id, killerName: attackerName });
  }
}

// ============================================================
//  ИГРОВОЙ ТИК (серверная физика стрел + кулдауны)
// ============================================================
const dt = 1 / TICK_RATE;

setInterval(() => {
  // Кулдауны игроков
  Object.values(players).forEach(p => {
    if (p.attackCd > 0) p.attackCd -= dt;
    if (p.bowCd > 0) p.bowCd -= dt;
    if (p.specialCd > 0) p.specialCd -= dt;
  });

  // Физика стрел
  const toRemove = [];
  arrows.forEach(arrow => {
    if (arrow.dead) return;
    arrow.x += arrow.vx * dt;
    arrow.y += arrow.vy * dt;
    arrow.z += arrow.vz * dt;
    arrow.vy -= 9.8 * dt;
    arrow.life -= dt;

    if (arrow.y < 0 || arrow.life <= 0 ||
        Math.abs(arrow.x) > ARENA || Math.abs(arrow.z) > ARENA) {
      arrow.dead = true;
      toRemove.push(arrow.id);
      return;
    }

    // Попадание в игроков
    Object.values(players).forEach(target => {
      if (target.id === arrow.shooterId || !target.alive || arrow.dead) return;
      const dx = target.x - arrow.x;
      const dz = target.z - arrow.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.7 && Math.abs(target.y - arrow.y + 0.8) < 1.2) {
        arrow.dead = true;
        toRemove.push(arrow.id);
        applyDamage(target, arrow.dmg, arrow.shooterName, arrow.shooterId);
      }
    });
  });

  arrows = arrows.filter(a => !a.dead);

  // Рассылаем позиции всех игроков
  const snapshot = {};
  Object.values(players).forEach(p => {
    snapshot[p.id] = { x: p.x, y: p.y, z: p.z, rotY: p.rotY, alive: p.alive };
  });
  io.emit('snapshot', snapshot);

  if (toRemove.length) io.emit('arrowsRemoved', toRemove);

}, 1000 / TICK_RATE);

// ============================================================
//  СТАРТ
// ============================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`MinePvP сервер запущен на порту ${PORT}`);
});

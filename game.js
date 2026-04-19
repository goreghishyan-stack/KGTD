// ============================================================
//  game.js — MinePvP клиент
// ============================================================

const socket = io();

// ── THREE.JS ──────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 28, 70);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  ncCanvas.width  = window.innerWidth;
  ncCanvas.height = window.innerHeight;
});

// Освещение
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xffd580, 1.1);
sun.position.set(30, 60, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { near: 0.5, far: 150, left: -40, right: 40, top: 40, bottom: -40 });
scene.add(sun);

// Nametag canvas
const ncCanvas = document.getElementById('namecanvas');
ncCanvas.width  = window.innerWidth;
ncCanvas.height = window.innerHeight;
const ncCtx = ncCanvas.getContext('2d');

// ── СОСТОЯНИЕ ─────────────────────────────────────────────
const keys = {};
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const clock = new THREE.Clock();

let myId = null;
let myKit = null;
let myHp = 20, myMaxHp = 20;
let myMana = 100;
let myKills = 0;
let gameActive = false;

let attackCd = 0, bowCd = 0, specialCd = 0, specialMaxCd = 5;
let lmbDown = false, rmbDown = false;
let moveSendTimer = 0;

const remotePlayers = {}; // id -> { mesh, hp, maxHp, name, kit }
const arrowMeshes   = {}; // arrowId -> mesh
const particles     = [];

const ARENA = 20;

// ── КИТЫ (клиентская копия) ───────────────────────────────
const KITS = {
  warrior:  { hp: 20, dmg: 5,  speed: 4.5, bowDmg: 0,  specialCd: 4,  specialName: 'Удар щитом',  color: 0x8899aa },
  archer:   { hp: 16, dmg: 3,  speed: 5.5, bowDmg: 6,  specialCd: 5,  specialName: 'Залп стрел',  color: 0x448844 },
  tank:     { hp: 30, dmg: 2,  speed: 3.0, bowDmg: 0,  specialCd: 3,  specialName: 'Рывок-удар',  color: 0x556677 },
  assassin: { hp: 12, dmg: 8,  speed: 6.5, bowDmg: 0,  specialCd: 6,  specialName: 'Крит удар',   color: 0x993399 },
};

// ── АРЕНА ─────────────────────────────────────────────────
function buildArena() {
  // Пол
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
    new THREE.MeshLambertMaterial({ color: 0x4a7a3f })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Стены
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
  [
    { x: 0,      z: -ARENA, ry: 0 },
    { x: 0,      z: ARENA,  ry: Math.PI },
    { x: -ARENA, z: 0,      ry: Math.PI / 2 },
    { x: ARENA,  z: 0,      ry: -Math.PI / 2 },
  ].forEach(w => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, 6), wallMat);
    wall.position.set(w.x, 3, w.z);
    wall.rotation.y = w.ry;
    scene.add(wall);
  });

  // Блоки-препятствия (те же позиции что на сервере)
  const obsMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  [
    [-7,-7],[7,-7],[-7,7],[7,7],
    [0,-11],[0,11],[-11,0],[11,0],
    [-4,0],[4,0],[0,-4],[0,4],
  ].forEach(([x, z], i) => {
    // Используем Math.sin/cos с seed для стабильных размеров
    const seed = Math.sin(i * 137.5) * 0.5 + 0.5;
    const h = 2 + seed * 2;
    const w = 1.5 + seed * 0.5;
    const obs = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), obsMat);
    obs.position.set(x, h / 2, z);
    obs.castShadow = true;
    obs.receiveShadow = true;
    scene.add(obs);
  });
}

// ── MESH ИГРОКА (Minecraft стиль) ─────────────────────────
function makePerson(color) {
  const g = new THREE.Group();
  const mat  = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
  const swordMat = new THREE.MeshLambertMaterial({ color: 0xbbbbdd });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), mat);
  body.position.y = 0.95; body.castShadow = true;

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 1.6; head.castShadow = true;

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.24), mat);
  legL.position.set(-0.14, 0.3, 0);
  const legR = legL.clone(); legR.position.set(0.14, 0.3, 0);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), mat);
  armR.position.set(0.42, 0.9, 0);

  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.07), swordMat);
  sword.position.set(0.55, 1.05, 0.18);
  sword.rotation.z = 0.2;

  g.add(body, head, legL, legR, armR, sword);
  g.userData.legL = legL;
  g.userData.legR = legR;
  return g;
}

// ── ПОЗИЦИЯ ИГРОКА (своего) ───────────────────────────────
const playerPos = new THREE.Vector3(0, 0, 0);

// ── HOTBAR ────────────────────────────────────────────────
function setupHotbar(kit) {
  const hb = document.getElementById('hotbar');
  hb.innerHTML = '';
  const items = {
    warrior:  [{ i:'🗡️',l:'Меч'    }, { i:'🛡️',l:'Щит'   }, { i:'🧪',l:'Зелье'  }, { i:'🍎',l:'Яблоко' }],
    archer:   [{ i:'🏹',l:'Лук'    }, { i:'⚔️', l:'Меч'   }, { i:'🪶',l:'Стрелы',c:16 }, { i:'🧪',l:'Зелье' }],
    tank:     [{ i:'⚔️',l:'Меч'    }, { i:'🛡️',l:'Броня'  }, { i:'🧱',l:'Блок'   }, { i:'🍖',l:'Еда'    }],
    assassin: [{ i:'🗡️',l:'Кинжал' }, { i:'🪬',l:'Тотем'  }, { i:'🧪',l:'Зелье'  }, { i:'🫙',l:'Яд'     }],
  }[kit] || [];
  items.forEach((it, idx) => {
    const s = document.createElement('div');
    s.className = 'slot' + (idx === 0 ? ' active' : '');
    s.innerHTML = `<div class="sicon">${it.i}</div><div style="font-size:9px;color:#888">${it.l}</div>`;
    if (it.c) s.innerHTML += `<div class="scnt">${it.c}</div>`;
    s.onclick = () => document.querySelectorAll('.slot').forEach((sl,j) => sl.classList.toggle('active', j === idx));
    s.style.pointerEvents = 'all';
    hb.appendChild(s);
  });
}

// ── HUD UPDATE ────────────────────────────────────────────
function updateHUD() {
  const pct = Math.max(0, myHp / myMaxHp);
  document.getElementById('hp-fill').style.width  = (pct * 100) + '%';
  document.getElementById('hp-text').textContent  = Math.max(0, Math.round(myHp)) + '/' + myMaxHp;
  document.getElementById('mana-fill').style.width = myMana + '%';
  document.getElementById('mana-text').textContent = Math.round(myMana);

  if (myKit) {
    const sh = document.getElementById('special-hint');
    if (specialCd > 0) {
      sh.style.color = '#e74c3c';
      sh.textContent = 'Q: ' + KITS[myKit].specialName + ' [' + specialCd.toFixed(1) + 'с]';
    } else {
      sh.style.color = '#4ade80';
      sh.textContent = 'Q: ' + KITS[myKit].specialName + ' [ГОТОВО]';
    }
  }
}

// ── SCOREBOARD ────────────────────────────────────────────
function updateScoreboard() {
  const list = document.getElementById('sb-list');
  const all = [];
  // Себя
  all.push({ name: '▶ ТЫ', kills: myKills, me: true });
  // Других
  Object.values(remotePlayers).forEach(p => all.push({ name: p.name, kills: p.kills || 0, me: false }));
  all.sort((a, b) => b.kills - a.kills);
  list.innerHTML = all.slice(0, 8).map(p =>
    `<div class="sb-row${p.me ? ' me' : ''}"><span>${p.name}</span><span class="sb-kills">${p.kills}</span></div>`
  ).join('');
  document.getElementById('online').textContent = '● Онлайн: ' + (Object.keys(remotePlayers).length + 1);
}

// ── KILL FEED ─────────────────────────────────────────────
function killFeed(msg, isMe) {
  const kf = document.getElementById('killfeed');
  const d = document.createElement('div');
  d.className = 'kfmsg' + (isMe ? ' me' : '');
  d.textContent = msg;
  kf.appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 400); }, 2200);
}

// ── DAMAGE FLASH ──────────────────────────────────────────
function flashDmg() {
  const f = document.getElementById('dmg-flash');
  f.style.background = 'rgba(200,0,0,0.45)';
  setTimeout(() => f.style.background = 'rgba(200,0,0,0)', 100);
}

// ── PARTICLES ─────────────────────────────────────────────
function spawnParticles(pos, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.09),
      new THREE.MeshLambertMaterial({ color, transparent: true })
    );
    mesh.position.copy(pos);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      Math.random() * 5 + 1,
      (Math.random() - 0.5) * 5
    );
    scene.add(mesh);
    particles.push({ mesh, vel, life: 0.7 });
  }
}

// ── JOIN GAME ─────────────────────────────────────────────
function joinGame(kit) {
  const name = document.getElementById('name-input').value.trim() || 'Player';
  myKit = kit;
  myHp = KITS[kit].hp;
  myMaxHp = KITS[kit].hp;
  myMana = 100;
  specialMaxCd = KITS[kit].specialCd;
  attackCd = 0; bowCd = 0; specialCd = 0;

  document.getElementById('kit-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  gameActive = true;

  buildArena();
  setupHotbar(kit);
  updateHUD();
  updateScoreboard();

  socket.emit('join', { name, kit });
  document.getElementById('canvas').requestPointerLock();
}

// ── RESPAWN ───────────────────────────────────────────────
function respawn(kit) {
  myKit = kit;
  myHp = KITS[kit].hp;
  myMaxHp = KITS[kit].hp;
  myMana = 100;
  specialMaxCd = KITS[kit].specialCd;
  attackCd = 0; bowCd = 0; specialCd = 0;

  document.getElementById('death-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  gameActive = true;

  setupHotbar(kit);
  updateHUD();

  socket.emit('respawn', { kit });
  document.getElementById('canvas').requestPointerLock();
}

// ── SOCKET EVENTS ─────────────────────────────────────────

socket.on('init', ({ id, players }) => {
  myId = id;
  // Создаём меши для всех существующих игроков
  Object.values(players).forEach(p => {
    if (p.id === myId) return;
    addRemotePlayer(p);
  });
  updateScoreboard();
});

socket.on('playerJoined', p => {
  if (p.id === myId) return;
  addRemotePlayer(p);
  killFeed(p.name + ' зашёл в игру', false);
  updateScoreboard();
});

socket.on('playerLeft', id => {
  if (remotePlayers[id]) {
    const name = remotePlayers[id].name;
    scene.remove(remotePlayers[id].mesh);
    delete remotePlayers[id];
    killFeed(name + ' вышел из игры', false);
    updateScoreboard();
  }
});

socket.on('snapshot', snapshot => {
  Object.entries(snapshot).forEach(([id, data]) => {
    if (id === myId) return;
    const rp = remotePlayers[id];
    if (!rp) return;
    // Плавная интерполяция
    rp.mesh.position.lerp(new THREE.Vector3(data.x, data.y, data.z), 0.25);
    rp.mesh.rotation.y = data.rotY;
    rp.mesh.visible = data.alive;
  });
});

socket.on('playerHit', ({ id, hp, maxHp, dmg }) => {
  if (id === myId) {
    myHp = hp; myMaxHp = maxHp;
    updateHUD();
    flashDmg();
    // Частицы на себе
    spawnParticles(camera.position.clone().add(new THREE.Vector3(0, -0.5, -1)), 0xff3333, 5);
  } else if (remotePlayers[id]) {
    remotePlayers[id].hp = hp;
    remotePlayers[id].maxHp = maxHp;
    spawnParticles(remotePlayers[id].mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff3333, 8);
  }
});

socket.on('playerDied', ({ id, killerName }) => {
  if (id === myId) {
    gameActive = false;
    document.getElementById('hud').style.display = 'none';
    document.getElementById('death-screen').style.display = 'flex';
    document.getElementById('death-killer').textContent = 'Убит игроком: ' + killerName;
    document.exitPointerLock();
  } else if (remotePlayers[id]) {
    killFeed(remotePlayers[id].name + ' убит ' + killerName, killerName === myId);
    remotePlayers[id].mesh.visible = false;
  }
});

socket.on('playerRespawned', p => {
  if (p.id === myId) return;
  if (remotePlayers[p.id]) {
    remotePlayers[p.id].mesh.position.set(p.x, p.y, p.z);
    remotePlayers[p.id].mesh.visible = true;
    remotePlayers[p.id].hp = p.hp;
    remotePlayers[p.id].maxHp = p.maxHp;
  } else {
    addRemotePlayer(p);
  }
});

socket.on('scoreUpdate', ({ id, kills }) => {
  if (id === myId) {
    myKills = kills;
  } else if (remotePlayers[id]) {
    remotePlayers[id].kills = kills;
  }
  updateScoreboard();
});

socket.on('arrowSpawned', arrow => {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.55, 4),
    new THREE.MeshLambertMaterial({ color: 0x8B4513 })
  );
  mesh.position.set(arrow.x, arrow.y, arrow.z);
  scene.add(mesh);
  arrowMeshes[arrow.id] = { mesh, vx: arrow.vx, vy: arrow.vy, vz: arrow.vz };
});

socket.on('arrowsRemoved', ids => {
  ids.forEach(id => {
    if (arrowMeshes[id]) {
      scene.remove(arrowMeshes[id].mesh);
      delete arrowMeshes[id];
    }
  });
});

socket.on('specialEffect', ({ id, kit, x, z }) => {
  const pos = new THREE.Vector3(x, 0.5, z);
  const colors = { warrior: 0x88aaff, archer: 0x44ff44, tank: 0xffaa44, assassin: 0xff44ff };
  spawnParticles(pos, colors[kit] || 0xffffff, 15);
});

// ── ДОБАВИТЬ УДАЛЁННОГО ИГРОКА ────────────────────────────
function addRemotePlayer(p) {
  const color = parseInt((p.color || '#8899aa').replace('#', ''), 16);
  const mesh = makePerson(color);
  mesh.position.set(p.x || 0, p.y || 0, p.z || 0);
  scene.add(mesh);
  remotePlayers[p.id] = {
    mesh, name: p.name, hp: p.hp, maxHp: p.maxHp,
    kit: p.kit, kills: p.kills || 0,
  };
}

// ── ВВОД ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  keys[e.code] = true;

  // Горячие клавиши слотов
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.replace('Digit', '')) - 1;
    document.querySelectorAll('.slot').forEach((s, i) => s.classList.toggle('active', i === n));
  }

  // Спец. удар
  if (e.code === 'KeyQ' && gameActive && specialCd <= 0) {
    specialCd = specialMaxCd;
    socket.emit('special');
  }

  // Выход из игры
  if (e.code === 'Escape') document.exitPointerLock();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

document.addEventListener('mousedown', e => {
  if (!gameActive) return;
  if (e.button === 0) { lmbDown = true; }
  if (e.button === 2) { rmbDown = true; }
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) lmbDown = false;
  if (e.button === 2) rmbDown = false;
});
document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('mousemove', e => {
  if (document.pointerLockElement === canvas && gameActive) {
    euler.y -= e.movementX * 0.002;
    euler.x -= e.movementY * 0.002;
    euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x));
    camera.quaternion.setFromEuler(euler);
  }
});

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && gameActive) {
    // Пауза — можно добавить меню паузы
  }
});

// Клик чтобы вернуть захват мыши
canvas.addEventListener('click', () => {
  if (gameActive && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

// ── АНИМАЦИЯ НОГ ──────────────────────────────────────────
let legPhase = 0;
function animateLegs(mesh, moving, dt) {
  if (!mesh.userData.legL) return;
  if (moving) legPhase += dt * 8;
  const swing = moving ? Math.sin(legPhase) * 0.5 : 0;
  mesh.userData.legL.rotation.x = swing;
  mesh.userData.legR.rotation.x = -swing;
}

// ── NAMETAGS ──────────────────────────────────────────────
function drawNametags() {
  ncCtx.clearRect(0, 0, ncCanvas.width, ncCanvas.height);
  const w = ncCanvas.width, h = ncCanvas.height;

  Object.values(remotePlayers).forEach(p => {
    if (!p.mesh.visible) return;
    const pos = p.mesh.position.clone();
    pos.y += 2.2;
    pos.project(camera);

    if (pos.z > 1) return; // за камерой

    const sx = (pos.x * 0.5 + 0.5) * w;
    const sy = (-pos.y * 0.5 + 0.5) * h;

    // HP бар
    const barW = 60, barH = 5;
    const hpPct = Math.max(0, p.hp / p.maxHp);
    ncCtx.fillStyle = 'rgba(0,0,0,0.5)';
    ncCtx.fillRect(sx - barW / 2 - 1, sy - 6 - 1, barW + 2, barH + 2);
    ncCtx.fillStyle = '#e74c3c';
    ncCtx.fillRect(sx - barW / 2, sy - 6, barW * hpPct, barH);

    // Имя
    ncCtx.font = 'bold 12px monospace';
    ncCtx.textAlign = 'center';
    ncCtx.fillStyle = 'rgba(0,0,0,0.55)';
    ncCtx.fillText(p.name, sx + 1, sy - 9 + 1);
    ncCtx.fillStyle = '#ffffff';
    ncCtx.fillText(p.name, sx, sy - 9);
  });
}

// ── ГЛАВНЫЙ ЦИКЛ ──────────────────────────────────────────
let attackPressed = false;
let bowPressed = false;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (gameActive && myKit) {
    // Кулдауны
    attackCd  = Math.max(0, attackCd  - dt);
    bowCd     = Math.max(0, bowCd     - dt);
    specialCd = Math.max(0, specialCd - dt);
    myMana    = Math.min(100, myMana + 10 * dt);

    // Движение
    const speed = KITS[myKit].speed;
    const forward = new THREE.Vector3(-Math.sin(euler.y), 0, -Math.cos(euler.y));
    const right   = new THREE.Vector3( Math.cos(euler.y), 0, -Math.sin(euler.y));
    const move = new THREE.Vector3();
    if (keys['KeyW']) move.addScaledVector(forward,  1);
    if (keys['KeyS']) move.addScaledVector(forward, -1);
    if (keys['KeyA']) move.addScaledVector(right,   -1);
    if (keys['KeyD']) move.addScaledVector(right,    1);
    const moving = move.lengthSq() > 0;
    if (moving) move.normalize();

    playerPos.addScaledVector(move, speed * dt);
    playerPos.x = Math.max(-(ARENA - 0.5), Math.min(ARENA - 0.5, playerPos.x));
    playerPos.z = Math.max(-(ARENA - 0.5), Math.min(ARENA - 0.5, playerPos.z));

    camera.position.set(playerPos.x, 1.65, playerPos.z);

    // Атака мечом — ЛКМ (с кулдауном)
    if (lmbDown && !attackPressed && attackCd <= 0) {
      attackPressed = true;
      attackCd = 0.5;
      socket.emit('attack');
      spawnParticles(
        camera.position.clone().add(new THREE.Vector3(-Math.sin(euler.y) * 1.5, -0.3, -Math.cos(euler.y) * 1.5)),
        0xffffff, 4
      );
    }
    if (!lmbDown) attackPressed = false;

    // Лук — ПКМ
    if (rmbDown && !bowPressed && bowCd <= 0 && KITS[myKit].bowDmg > 0) {
      bowPressed = true;
      bowCd = 1.2;
      socket.emit('shoot', { dirX: -Math.sin(euler.y), dirZ: -Math.cos(euler.y) });
    }
    if (!rmbDown) bowPressed = false;

    // Отправляем позицию серверу (не каждый кадр, 20 раз/сек)
    moveSendTimer += dt;
    if (moveSendTimer >= 0.05) {
      moveSendTimer = 0;
      socket.emit('move', { x: playerPos.x, z: playerPos.z, rotY: euler.y });
    }

    updateHUD();
  }

  // Анимация стрел (клиентская интерполяция)
  Object.values(arrowMeshes).forEach(a => {
    a.mesh.position.x += a.vx * dt;
    a.mesh.position.y += a.vy * dt;
    a.mesh.position.z += a.vz * dt;
    a.vy -= 9.8 * dt;
    const vel = new THREE.Vector3(a.vx, a.vy, a.vz);
    if (vel.lengthSq() > 0) {
      const target = a.mesh.position.clone().add(vel);
      a.mesh.lookAt(target);
      a.mesh.rotateX(Math.PI / 2);
    }
  });

  // Частицы
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 9.8 * dt;
    p.mesh.material.opacity = Math.max(0, p.life / 0.7);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }

  // Анимация ног у других игроков
  Object.values(remotePlayers).forEach(p => {
    animateLegs(p.mesh, true, dt);
  });

  drawNametags();
  renderer.render(scene, camera);
}

loop();

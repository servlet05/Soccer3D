import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ----- INICIALIZACIÓN -----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 60, 130);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 150);
camera.position.set(12, 6, 18);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.prepend(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);

// ----- SISTEMA DE VIENTO (NUEVO) -----
const wind = {
    speed: 0,
    targetSpeed: 0,
    maxSpeed: 8,
    minSpeed: -8,
    changeInterval: 0,
    changeFrequency: 5,
    gustChance: 0.05,
    gustMultiplier: 1.5
};

function updateWind(deltaTime) {
    wind.changeInterval += deltaTime;
    if (wind.changeInterval > wind.changeFrequency) {
        wind.changeInterval = 0;
        wind.targetSpeed = (Math.random() * 2 - 1) * wind.maxSpeed * 0.8;
        if (Math.random() < wind.gustChance) {
            wind.targetSpeed *= wind.gustMultiplier;
            wind.targetSpeed = Math.max(Math.min(wind.targetSpeed, wind.maxSpeed), wind.minSpeed);
        }
        wind.changeFrequency = 3 + Math.random() * 7;
    }
    wind.speed += (wind.targetSpeed - wind.speed) * deltaTime * 0.5;
}

// ----- SISTEMA DE CÁMARA -----
class CameraSystem {
    constructor() {
        this.position = new THREE.Vector3(12, 6, 18);
        this.front = new THREE.Vector3(0, 0, -1);
        this.up = new THREE.Vector3(0, 1, 0);
        this.right = new THREE.Vector3(1, 0, 0);
        this.worldUp = new THREE.Vector3(0, 1, 0);
        this.yaw = -90;
        this.pitch = 0;
        this.mode = 'player';
        this.ballTarget = new THREE.Vector3(0, 0, 0);
        this.playerTarget = new THREE.Vector3(0, 0, 5);
        this.zoomLevel = 1.0;
        this.update();
    }
    update() {
        this.front.x = Math.cos(THREE.MathUtils.degToRad(this.yaw)) * Math.cos(THREE.MathUtils.degToRad(this.pitch));
        this.front.y = Math.sin(THREE.MathUtils.degToRad(this.pitch));
        this.front.z = Math.sin(THREE.MathUtils.degToRad(this.yaw)) * Math.cos(THREE.MathUtils.degToRad(this.pitch));
        this.front.normalize();
        this.right.crossVectors(this.front, this.worldUp).normalize();
        this.up.crossVectors(this.right, this.front).normalize();
    }
    followPlayer(playerPos) {
        this.playerTarget.copy(playerPos);
        this.mode = 'player';
        document.getElementById('cam-mode').textContent = 'Jugador';
        const offset = new THREE.Vector3(0, 5, 8);
        const rot = new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(this.yaw));
        offset.applyMatrix4(rot);
        const targetPos = new THREE.Vector3().copy(playerPos).add(offset);
        this.position.lerp(targetPos, 0.06);
        this.update();
    }
    followBall(ballPos) {
        this.ballTarget.copy(ballPos);
        this.mode = 'ball';
        document.getElementById('cam-mode').textContent = 'Balón';
        const offset = new THREE.Vector3(0, 3 + this.zoomLevel * 2, 6 + this.zoomLevel * 3);
        const rot = new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(this.yaw));
        offset.applyMatrix4(rot);
        const targetPos = new THREE.Vector3().copy(ballPos).add(offset);
        this.position.lerp(targetPos, 0.08);
        this.update();
    }
    lookAt(target) {
        const lookTarget = target.clone();
        if (this.mode === 'ball') lookTarget.y += 0.5;
        const dir = new THREE.Vector3().copy(lookTarget).sub(this.position);
        const yaw = Math.atan2(dir.x, -dir.z);
        const pitch = Math.asin(dir.y / dir.length());
        this.yaw += (THREE.MathUtils.radToDeg(yaw) - this.yaw) * 0.05;
        this.pitch += (THREE.MathUtils.radToDeg(pitch) - this.pitch) * 0.05;
        this.pitch = Math.max(-89, Math.min(89, this.pitch));
        this.update();
    }
    getPosition() { return this.position; }
}

const cameraSystem = new CameraSystem();

// ----- LUZ Y SHADERS -----
const ambientLight = new THREE.AmbientLight(0x8899bb, 0.5);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffeedd, 2.0);
sunLight.position.set(40, 50, 30);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 100;
sunLight.shadow.camera.left = -35;
sunLight.shadow.camera.right = 35;
sunLight.shadow.camera.top = 35;
sunLight.shadow.camera.bottom = -35;
scene.add(sunLight);
const fillLight = new THREE.DirectionalLight(0xccddff, 0.6);
fillLight.position.set(-30, 20, -40);
scene.add(fillLight);

// Rayos de sol
const rayMat = new THREE.SpriteMaterial({
    map: createRayTexture(),
    blending: THREE.AdditiveBlending,
    opacity: 0.15,
    transparent: true,
    depthWrite: false
});
for (let i = 0; i < 8; i++) {
    const ray = new THREE.Sprite(rayMat);
    ray.position.set((Math.random() - 0.5) * 60, 20 + Math.random() * 10, (Math.random() - 0.5) * 60);
    ray.scale.set(15 + Math.random() * 20, 30 + Math.random() * 20, 1);
    scene.add(ray);
}

function createRayTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 0, 0, 32, 0, 64);
    gradient.addColorStop(0, 'rgba(255,255,200,0)');
    gradient.addColorStop(0.2, 'rgba(255,255,200,0.3)');
    gradient.addColorStop(0.7, 'rgba(255,255,200,0.1)');
    gradient.addColorStop(1, 'rgba(255,255,200,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 128);
    return new THREE.CanvasTexture(canvas);
}

// ----- AUDIO -----
let audioCtx = null;
let audioEnabled = true;
let audioInitialized = false;

function initAudio() {
    if (audioInitialized) return;
    try {
        audioCtx = new(window.AudioContext || window.webkitAudioContext)();
        audioInitialized = true;
        playAmbient();
    } catch (e) { console.warn('Audio no disponible', e); }
}

function createTone(freq, duration, type = 'sine', volume = 0.12) {
    if (!audioCtx) return null;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
        return { osc, gain };
    } catch (e) { return null; }
}

function playFootstep() {
    if (!audioEnabled || !audioCtx) return;
    const vol = 0.06 + Math.random() * 0.05;
    createTone(140 + Math.random() * 60, 0.06, 'sine', vol);
}

function playKick(power) {
    if (!audioEnabled || !audioCtx) return;
    const vol = 0.15 + (power / 100) * 0.3;
    createTone(80 + power * 1.5, 0.2, 'sawtooth', vol);
    createTone(50 + power * 0.5, 0.3, 'square', vol * 0.5);
    setTimeout(() => createTone(200 + power, 0.05, 'sine', vol * 0.3), 50);
}

function playGoal() {
    if (!audioEnabled || !audioCtx) return;
    for (let i = 0; i < 5; i++) {
        setTimeout(() => createTone(400 + i * 150, 0.15, 'sine', 0.12), i * 80);
    }
}

function playSave() {
    if (!audioEnabled || !audioCtx) return;
    createTone(300, 0.1, 'sawtooth', 0.1);
    createTone(100, 0.15, 'square', 0.06);
}

let ambientNode = null;

function playAmbient() {
    if (!audioCtx) return;
    try {
        const bufferSize = 2 * audioCtx.sampleRate;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const t = i / audioCtx.sampleRate;
            const wind = Math.sin(t * 0.6) * 0.3 + Math.sin(t * 1.4) * 0.2 + Math.sin(t * 2.8) * 0.1;
            const noise = (Math.random() * 2 - 1) * 0.12;
            data[i] = wind * 0.5 + noise * 0.5;
        }
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const gain = audioCtx.createGain();
        gain.gain.value = 0.10;
        source.connect(gain);
        gain.connect(audioCtx.destination);
        source.start();
        ambientNode = { source, gain };
    } catch (e) {}
}

// ----- CAMPO DE FÚTBOL -----
const grassMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.85, metalness: 0.0 });
const fieldSize = 34;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(fieldSize, fieldSize), grassMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.15 });
const addLine = (w, h, x, y, z) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mesh = new THREE.Mesh(geo, lineMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.005, z);
    scene.add(mesh);
};
addLine(32, 0.6, 0, 0, 15.7);
addLine(32, 0.6, 0, 0, -15.7);
addLine(0.6, 31, -15.7, 0, 0);
addLine(0.6, 31, 15.7, 0, 0);
const circlePoints = [];
const radius = 4.5;
for (let i = 0; i <= 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    circlePoints.push(new THREE.Vector3(Math.cos(angle) * radius, 0.005, Math.sin(angle) * radius));
}
const circleGeo = new THREE.BufferGeometry().setFromPoints(circlePoints);
const circleLine = new THREE.Line(circleGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
scene.add(circleLine);
const dot = new THREE.Mesh(new THREE.CircleGeometry(0.25, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
dot.rotation.x = -Math.PI / 2;
dot.position.set(0, 0.006, 0);
scene.add(dot);
addLine(3.5, 0.4, 0, 0, 13.0);
addLine(3.5, 0.4, 0, 0, -13.0);
addLine(0.4, 5.0, -4.0, 0, 13.0);
addLine(0.4, 5.0, 4.0, 0, 13.0);
addLine(0.4, 5.0, -4.0, 0, -13.0);
addLine(0.4, 5.0, 4.0, 0, -13.0);

// ----- INDICADOR DE VIENTO (NUEVO) -----
const windArrowGroup = new THREE.Group();

// Flecha
const arrowMat = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xff6600,
    emissiveIntensity: 0.3
});
const arrowShaft = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.08), arrowMat);
arrowShaft.position.x = 1;
windArrowGroup.add(arrowShaft);

const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 8), arrowMat);
arrowHead.position.x = 2.1;
windArrowGroup.add(arrowHead);

// Etiqueta "Viento"
const canvas2 = document.createElement('canvas');
canvas2.width = 128;
canvas2.height = 64;
const ctx2 = canvas2.getContext('2d');
ctx2.fillStyle = 'rgba(0,0,0,0.5)';
ctx2.fillRect(0, 0, 128, 64);
ctx2.fillStyle = '#ffffff';
ctx2.font = 'bold 18px Arial';
ctx2.textAlign = 'center';
ctx2.fillText('🌬️ VIENTO', 64, 40);
const texture2 = new THREE.CanvasTexture(canvas2);
const labelMat2 = new THREE.SpriteMaterial({ map: texture2, transparent: true });
const label2 = new THREE.Sprite(labelMat2);
label2.scale.set(1.5, 0.8, 1);
label2.position.y = 2.5;
windArrowGroup.add(label2);

windArrowGroup.position.set(-8, 1.5, -10);
scene.add(windArrowGroup);

// Actualizar indicador de viento
function updateWindIndicator() {
    const speed = wind.speed;
    const absSpeed = Math.abs(speed);
    windArrowGroup.scale.x = 1 + absSpeed / 15;
    windArrowGroup.rotation.y = speed > 0 ? 0 : Math.PI;
    const intensity = Math.min(absSpeed / wind.maxSpeed, 1);
    const r = 1;
    const g = 1 - intensity * 0.8;
    const b = 1 - intensity * 0.9;
    windArrowGroup.children.forEach(child => {
        if (child.isMesh && child.material && child !== label2) {
            child.material.color.setRGB(r, g, b);
        }
    });
}

// ----- PORTERÍA -----
const goalWidth = 7.32;
const goalHeight = 2.44;
const goalDepth = 2.2;
const postColor = 0xf5f5f5;

const createPost = (x, y, z, w, h, d, color = postColor) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
};

const goalGroup = new THREE.Group();
goalGroup.add(createPost(-goalWidth / 2, goalHeight / 2, 0, 0.15, goalHeight, 0.15));
goalGroup.add(createPost(goalWidth / 2, goalHeight / 2, 0, 0.15, goalHeight, 0.15));
goalGroup.add(createPost(0, goalHeight, 0, goalWidth, 0.15, 0.15));
goalGroup.add(createPost(-goalWidth / 2, goalHeight / 2, -goalDepth, 0.15, goalHeight, 0.15));
goalGroup.add(createPost(goalWidth / 2, goalHeight / 2, -goalDepth, 0.15, goalHeight, 0.15));
goalGroup.add(createPost(0, goalHeight, -goalDepth, goalWidth, 0.15, 0.15));
goalGroup.add(createPost(-goalWidth / 2, goalHeight / 2, -goalDepth / 2, 0.15, 0.10, goalDepth));
goalGroup.add(createPost(goalWidth / 2, goalHeight / 2, -goalDepth / 2, 0.15, 0.10, goalDepth));
goalGroup.position.set(0, 0, -15.5);
scene.add(goalGroup);

// Red
const netMat = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    wireframe: false,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide
});
const netMat2 = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    wireframe: false,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide
});
const createNet = (w, h, x, y, z, rotY = 0, rotX = 0) => {
    const geo = new THREE.PlaneGeometry(w, h, 6, 5);
    const mesh = new THREE.Mesh(geo, netMat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.rotation.x = rotX;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
};
goalGroup.add(createNet(goalWidth, goalHeight, 0, goalHeight / 2, -goalDepth / 2 - 0.01, 0, 0));
goalGroup.add(createNet(goalDepth, goalHeight, -goalWidth / 2 - 0.01, goalHeight / 2, -goalDepth / 2, 0, 0));
goalGroup.add(createNet(goalDepth, goalHeight, goalWidth / 2 + 0.01, goalHeight / 2, -goalDepth / 2, 0, 0));
const topNet = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalDepth, 5, 5), netMat2);
topNet.position.set(0, goalHeight + 0.01, -goalDepth / 2);
topNet.rotation.x = -Math.PI / 2;
goalGroup.add(topNet);

// Marcador 23,5m
const markerGroup = new THREE.Group();
const boardMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.7 });
const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.08), boardMat);
board.position.set(0, 1.8, 0);
markerGroup.add(board);
const textMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.1 });
const charPositions = [-0.7, -0.42, -0.15, 0.12, 0.42];
const chars = ['2', '3', ',', '5', 'm'];
chars.forEach((ch, i) => {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6), textMat);
    sphere.position.set(charPositions[i] || 0, 1.8, 0.05);
    markerGroup.add(sphere);
});
markerGroup.position.set(0, 0, -14.8);
scene.add(markerGroup);

// ----- JUGADOR PIXEL ART -----
const playerGroup = new THREE.Group();

function pixelBlock(w, h, d, color, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}
playerGroup.add(pixelBlock(0.6, 0.5, 0.3, 0x2255cc, 0, 0.5, 0));
playerGroup.add(pixelBlock(0.32, 0.32, 0.32, 0xf9d5a3, 0, 0.9, 0));
playerGroup.add(pixelBlock(0.08, 0.08, 0.08, 0xffffff, -0.10, 0.95, 0.17));
playerGroup.add(pixelBlock(0.08, 0.08, 0.08, 0xffffff, 0.10, 0.95, 0.17));
playerGroup.add(pixelBlock(0.05, 0.05, 0.05, 0x222222, -0.10, 0.95, 0.22));
playerGroup.add(pixelBlock(0.05, 0.05, 0.05, 0x222222, 0.10, 0.95, 0.22));
playerGroup.add(pixelBlock(0.12, 0.04, 0.04, 0xcc3333, 0, 0.82, 0.17));
playerGroup.add(pixelBlock(0.16, 0.3, 0.16, 0x1a2b5c, -0.14, 0.2, 0));
playerGroup.add(pixelBlock(0.16, 0.3, 0.16, 0x1a2b5c, 0.14, 0.2, 0));
playerGroup.add(pixelBlock(0.18, 0.08, 0.22, 0x222222, -0.14, 0.04, 0.04));
playerGroup.add(pixelBlock(0.18, 0.08, 0.22, 0x222222, 0.14, 0.04, 0.04));
playerGroup.add(pixelBlock(0.08, 0.3, 0.08, 0xf9d5a3, -0.34, 0.5, 0));
playerGroup.add(pixelBlock(0.08, 0.3, 0.08, 0xf9d5a3, 0.34, 0.5, 0));
playerGroup.add(pixelBlock(0.10, 0.12, 0.08, 0x2255cc, -0.34, 0.65, 0));
playerGroup.add(pixelBlock(0.10, 0.12, 0.08, 0x2255cc, 0.34, 0.65, 0));
playerGroup.add(pixelBlock(0.30, 0.06, 0.30, 0x6b3a2a, 0, 1.06, 0));
playerGroup.add(pixelBlock(0.20, 0.06, 0.20, 0x6b3a2a, 0, 1.10, 0));
playerGroup.position.set(0, 0, 5);
scene.add(playerGroup);

// Indicador de balón controlado
const indicatorMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.6, side: THREE
        .DoubleSide });
const indicator = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.5, 16), indicatorMat);
indicator.rotation.x = -Math.PI / 2;
indicator.position.y = 0.02;
playerGroup.add(indicator);
indicator.visible = true;

// ----- BALÓN CON FÍSICA REALISTA -----
const ballGeo = new THREE.SphereGeometry(0.25, 24, 24);
const ballMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.1,
    emissive: 0x222222,
    emissiveIntensity: 0.1
});
const ball = new THREE.Mesh(ballGeo, ballMat);
ball.castShadow = true;
ball.receiveShadow = true;
ball.position.set(0, 0.25, 0);
scene.add(ball);

// ----- SISTEMA DE FÍSICA DEL BALÓN (MODIFICADO CON VIENTO) -----
class BallPhysics {
    constructor() {
        this.airDensity = 1.0;
        this.crossArea = 0.038;
        this.radius = 0.11;
        this.spinConst = 0.5;
        this.dragConst = 0.2;
        this.gravity = 9.82;
        this.mass = 0.45;
        this.COR = 0.6;
        this.position = new THREE.Vector3(0, 0.25, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.spinDirection = new THREE.Vector3(0, 1, 0);
        this.angularVelocity = 0;
        this.hasBall = true;
        this.moving = false;
        this.hasBeenKicked = false;
        this.initVelocity = 0;
        this.K = 0;
        this.liftConst = 0;
        this.time = 0;
        this.lastMoveDirection = new THREE.Vector3(0, 0, -1);
    }

    reset(pos = new THREE.Vector3(0, 0.25, 0)) {
        this.position.copy(pos);
        this.velocity.set(0, 0, 0);
        this.spinDirection.set(0, 1, 0);
        this.angularVelocity = 0;
        this.hasBall = true;
        this.moving = false;
        this.hasBeenKicked = false;
        this.initVelocity = 0;
        this.K = 0;
        this.liftConst = 0;
        this.time = 0;
        this.lastMoveDirection.set(0, 0, -1);
    }

    followPlayer(playerPos, direction) {
        if (!this.hasBall) return;
        if (direction.length() > 0.1) {
            this.lastMoveDirection.copy(direction).normalize();
        }
        const offset = direction.clone().multiplyScalar(0.35);
        this.position.x = playerPos.x + offset.x;
        this.position.z = playerPos.z + offset.z;
        this.position.y = 0.25;
    }

    kick(direction, power, spin = new THREE.Vector3(0, 1, 0)) {
        this.hasBeenKicked = true;
        this.hasBall = false;
        this.moving = true;
        this.initVelocity = 3 + (power / 100) * 14;

        const correctedDir = new THREE.Vector3(direction.x, direction.y, -direction.z);

        const angleY = Math.PI / 2 - (power / 100) * 0.5;
        const angleX = Math.atan2(correctedDir.x, -correctedDir.z);

        this.velocity.x = this.initVelocity * Math.sin(angleY) * Math.sin(angleX);
        this.velocity.y = this.initVelocity * Math.cos(angleY);
        this.velocity.z = this.initVelocity * Math.sin(angleY) * Math.cos(angleX);

        this.spinDirection.copy(spin);
        this.angularVelocity = 20 + power * 0.5;

        this.K = (this.airDensity * this.dragConst * this.crossArea) / (2 * this.mass);
        this.liftConst = (this.spinConst * this.angularVelocity * this.radius) / this.initVelocity;
    }

    update(deltaTime) {
        if (!this.moving) return;
        this.time += deltaTime;

        const v2 = this.velocity.x * this.velocity.x +
            this.velocity.y * this.velocity.y +
            this.velocity.z * this.velocity.z;
        const velMag = Math.sqrt(v2);

        if (velMag < 0.001) {
            this.moving = false;
            return;
        }

        const dragForce = this.K * velMag;
        const accDrag = new THREE.Vector3()
            .copy(this.velocity)
            .multiplyScalar(-dragForce);

        const cross = new THREE.Vector3()
            .crossVectors(this.spinDirection, this.velocity);
        const crossMag = cross.length();

        let accLift = new THREE.Vector3(0, 0, 0);
        if (crossMag > 0.001) {
            const liftMag = (this.liftConst * this.airDensity * this.crossArea * v2) / (2 * crossMag);
            accLift.copy(cross).multiplyScalar(liftMag / this.mass);
        }

        const accGravity = new THREE.Vector3(0, -this.gravity, 0);

        // --- FUERZA DEL VIENTO (NUEVO) ---
        const accWind = new THREE.Vector3(wind.speed, 0, 0);

        const acceleration = new THREE.Vector3()
            .add(accDrag)
            .add(accLift)
            .add(accGravity)
            .add(accWind); // <--- NUEVO

        this.velocity.x += acceleration.x * deltaTime;
        this.velocity.y += acceleration.y * deltaTime;
        this.velocity.z += acceleration.z * deltaTime;

        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.position.z += this.velocity.z * deltaTime;

        if (this.position.y < 0.25) {
            this.position.y = 0.25;
            this.velocity.y = -this.COR * this.velocity.y;
            this.velocity.x *= 0.92;
            this.velocity.z *= 0.92;
            this.angularVelocity *= 0.8;

            if (Math.abs(this.velocity.y) < 0.1 &&
                Math.abs(this.velocity.x) < 0.1 &&
                Math.abs(this.velocity.z) < 0.1) {
                this.velocity.set(0, 0, 0);
                this.moving = false;
            }
        }

        const boundary = 15.2;
        const margin = 0.8;

        const isInGoalZone =
            Math.abs(this.position.x) < goalWidth / 2 + 0.5 &&
            this.position.z < -14.0 &&
            this.position.z > -17.0 &&
            this.position.y < goalHeight + 0.5;

        if (!isInGoalZone) {
            if (this.position.x > boundary - margin) {
                this.position.x = boundary - margin;
                this.velocity.x = -this.COR * this.velocity.x;
                this.velocity.x *= 0.7;
            }
            if (this.position.x < -boundary + margin) {
                this.position.x = -boundary + margin;
                this.velocity.x = -this.COR * this.velocity.x;
                this.velocity.x *= 0.7;
            }
            if (this.position.z > boundary - margin) {
                this.position.z = boundary - margin;
                this.velocity.z = -this.COR * this.velocity.z;
                this.velocity.z *= 0.7;
            }
            if (this.position.z < -boundary + margin) {
                this.position.z = -boundary + margin;
                this.velocity.z = -this.COR * this.velocity.z;
                this.velocity.z *= 0.7;
            }
        }

        const goalZ = -15.5;
        if (this.position.z < goalZ + 0.5 && this.position.z > goalZ - 1.0) {
            const isInsideFrame =
                Math.abs(this.position.x) < goalWidth / 2 - 0.1 &&
                this.position.y < goalHeight - 0.1;

            if (!isInsideFrame) {
                if (Math.abs(this.position.x) > goalWidth / 2 - 0.3 &&
                    Math.abs(this.position.x) < goalWidth / 2 + 0.3) {
                    if (this.position.y < goalHeight) {
                        this.velocity.x = -this.COR * this.velocity.x * 0.5;
                        this.position.x += this.velocity.x * deltaTime * 2;
                    }
                }
                if (this.position.y > goalHeight - 0.3 && this.position.y < goalHeight + 0.3) {
                    if (Math.abs(this.position.x) < goalWidth / 2) {
                        this.velocity.y = -this.COR * this.velocity.y * 0.5;
                        this.position.y += this.velocity.y * deltaTime * 2;
                    }
                }
            }
        }

        this.velocity.multiplyScalar(0.9995);

        if (this.velocity.length() < 0.005) {
            this.velocity.set(0, 0, 0);
            this.moving = false;
        }
    }
}

const ballPhysics = new BallPhysics();

// Partículas de fuego
const fireParticles = new THREE.BufferGeometry();
const particleCount = 40;
const positions = new Float32Array(particleCount * 3);
const sizes = new Float32Array(particleCount);
const velocities = [];
for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.5;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    sizes[i] = 0.02 + Math.random() * 0.05;
    velocities.push({
        x: (Math.random() - 0.5) * 0.5,
        y: Math.random() * 0.5,
        z: (Math.random() - 0.5) * 0.5
    });
}
fireParticles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
fireParticles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

const fireMaterial = new THREE.PointsMaterial({
    color: 0xff6633,
    size: 0.06,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
const fireSystem = new THREE.Points(fireParticles, fireMaterial);
scene.add(fireSystem);

let fireActive = false;

// ----- PORTERO -----
const keeperGroup = new THREE.Group();
keeperGroup.add(pixelBlock(0.5, 0.5, 0.3, 0xcc3333, 0, 0.5, 0));
keeperGroup.add(pixelBlock(0.28, 0.28, 0.28, 0xf9d5a3, 0, 0.85, 0));
keeperGroup.add(pixelBlock(0.08, 0.08, 0.08, 0xffffff, -0.08, 0.90, 0.15));
keeperGroup.add(pixelBlock(0.08, 0.08, 0.08, 0xffffff, 0.08, 0.90, 0.15));
keeperGroup.add(pixelBlock(0.05, 0.05, 0.05, 0x222222, -0.08, 0.90, 0.20));
keeperGroup.add(pixelBlock(0.05, 0.05, 0.05, 0x222222, 0.08, 0.90, 0.20));
keeperGroup.add(pixelBlock(0.16, 0.3, 0.16, 0x1a2b5c, -0.12, 0.2, 0));
keeperGroup.add(pixelBlock(0.16, 0.3, 0.16, 0x1a2b5c, 0.12, 0.2, 0));
keeperGroup.add(pixelBlock(0.18, 0.08, 0.22, 0x222222, -0.12, 0.04, 0.04));
keeperGroup.add(pixelBlock(0.18, 0.08, 0.22, 0x222222, 0.12, 0.04, 0.04));
keeperGroup.add(pixelBlock(0.08, 0.3, 0.08, 0xf9d5a3, -0.30, 0.5, 0));
keeperGroup.add(pixelBlock(0.08, 0.3, 0.08, 0xf9d5a3, 0.30, 0.5, 0));
keeperGroup.add(pixelBlock(0.10, 0.12, 0.08, 0xcc3333, -0.30, 0.65, 0));
keeperGroup.add(pixelBlock(0.10, 0.12, 0.08, 0xcc3333, 0.30, 0.65, 0));
keeperGroup.position.set(0, 0, -13.5);
scene.add(keeperGroup);

// Estado del portero
const keeper = {
    pos: new THREE.Vector3(0, 0, -13.5),
    targetX: 0,
    diving: false,
    hasBall: false,
    processingSave: false
};

// ----- ESTADÍSTICAS -----
const stats = {
    shots: 0,
    goals: 0,
    saves: 0,
    power: 0,
    charging: false,
    fire: false
};

// ----- LÍMITES -----
const boundary = { minX: -15.2, maxX: 15.2, minZ: -15.2, maxZ: 15.2 };

// ----- FUNCIONES DE JUEGO -----
let resetTimeout = null;
let saveTimeout = null;

function resetBall() {
    ballPhysics.reset(new THREE.Vector3(0, 0.25, 0));
    ball.position.set(0, 0.25, 0);
    ballPhysics.hasBall = true;
    indicator.visible = true;
    document.getElementById('goal-msg').classList.remove('show');
    document.getElementById('save-msg').classList.remove('show');
    document.getElementById('fire-status').textContent = '❌';
    fireActive = false;
    fireMaterial.opacity = 0;
    keeper.hasBall = false;
    keeper.processingSave = false;
    keeper.diving = false;
    cameraSystem.mode = 'player';
    document.getElementById('cam-mode').textContent = 'Jugador';
    if (resetTimeout) {
        clearTimeout(resetTimeout);
        resetTimeout = null;
    }
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
}

function resetPositions() {
    playerGroup.position.set(0, 0, 5);
    keeperGroup.position.set(0, 0, -13.5);
    keeper.pos.set(0, 0, -13.5);
    keeper.diving = false;
    keeper.hasBall = false;
    keeper.processingSave = false;
    resetBall();
    cameraSystem.mode = 'player';
    document.getElementById('cam-mode').textContent = 'Jugador';
}

function scoreGoal() {
    stats.goals++;
    playGoal();
    document.getElementById('goal-msg').classList.add('show');
    keeper.processingSave = false;
    cameraSystem.mode = 'player';
    document.getElementById('cam-mode').textContent = 'Jugador';
    if (resetTimeout) {
        clearTimeout(resetTimeout);
        resetTimeout = null;
    }
    resetTimeout = setTimeout(() => {
        document.getElementById('goal-msg').classList.remove('show');
        resetPositions();
        resetTimeout = null;
    }, 1500);
}

function keeperSave() {
    if (keeper.processingSave) return;

    keeper.processingSave = true;
    keeper.hasBall = true;
    keeper.diving = false;
    stats.saves++;
    playSave();

    ballPhysics.moving = false;
    ballPhysics.velocity.set(0, 0, 0);
    ballPhysics.hasBall = false;
    fireActive = false;
    fireMaterial.opacity = 0;
    document.getElementById('fire-status').textContent = '❌';

    ball.position.set(keeperGroup.position.x, 0.25, keeperGroup.position.z);
    ballPhysics.position.copy(ball.position);
    indicator.visible = false;

    cameraSystem.mode = 'player';
    document.getElementById('cam-mode').textContent = 'Jugador';

    document.getElementById('save-msg').classList.add('show');

    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    saveTimeout = setTimeout(() => {
        document.getElementById('save-msg').classList.remove('show');
        resetPositions();
        saveTimeout = null;
    }, 1200);
}

// ----- FUNCIÓN DE DISPARO -----
function kickBall(power) {
    if (!ballPhysics.hasBall) return;

    keeper.processingSave = false;
    keeper.hasBall = false;

    stats.shots++;
    stats.power = power;
    playKick(power);

    if (power > 75) {
        fireActive = true;
        fireMaterial.opacity = 0.8;
        document.getElementById('fire-status').textContent = '🔥🔥🔥';
    } else {
        fireActive = false;
        fireMaterial.opacity = 0;
        document.getElementById('fire-status').textContent = '❌';
    }

    let moveX = 0,
        moveZ = 0;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;
    if (keys.w) moveZ -= 1;
    if (keys.s) moveZ += 1;

    let moveDir = new THREE.Vector3(moveX, 0, moveZ);

    if (moveDir.length() < 0.1) {
        moveDir.copy(ballPhysics.lastMoveDirection);
        if (moveDir.length() < 0.1) {
            moveDir.set(0, 0, -1);
        }
    } else {
        moveDir.normalize();
        ballPhysics.lastMoveDirection.copy(moveDir);
    }

    if (moveDir.z > 0.1 && keys.w) {
        moveDir.z = -1;
        moveDir.normalize();
    }
    if (moveDir.z < -0.1 && keys.s) {
        moveDir.z = 1;
        moveDir.normalize();
    }

    if (keys.w && !keys.s) {
        moveDir.z = -1;
        if (keys.a) moveDir.x = -1;
        if (keys.d) moveDir.x = 1;
        moveDir.normalize();
    }

    if (keys.s && !keys.w) {
        moveDir.z = 1;
        if (keys.a) moveDir.x = -1;
        if (keys.d) moveDir.x = 1;
        moveDir.normalize();
    }

    if (keys.a && !keys.d && !keys.w && !keys.s) {
        moveDir.set(-1, 0, 0);
    }
    if (keys.d && !keys.a && !keys.w && !keys.s) {
        moveDir.set(1, 0, 0);
    }

    if (moveDir.length() > 0) {
        moveDir.normalize();
    }

    const spin = new THREE.Vector3(
        -moveDir.z * 0.5 + (Math.random() - 0.5) * 0.3,
        0.3 + (power / 100) * 0.5,
        moveDir.x * 0.5 + (Math.random() - 0.5) * 0.3
    ).normalize();

    ballPhysics.kick(moveDir, power, spin);
    ballPhysics.hasBall = false;
    indicator.visible = false;

    cameraSystem.mode = 'ball';
    document.getElementById('cam-mode').textContent = 'Balón';

    const targetX = ball.position.x * 0.5 + (Math.random() - 0.5) * 1.5;
    keeper.targetX = Math.min(Math.max(targetX, -4), 4);
    keeper.diving = true;
}

// ----- CONTROLES -----
const keys = { w: false, a: false, s: false, d: false };
let spacePressed = false;
let chargeTime = 0;
let isCharging = false;

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        keys[key] = true;
        e.preventDefault();
        if (!audioInitialized) initAudio();
    }
    if (e.code === 'Space') {
        e.preventDefault();
        if (!spacePressed && ballPhysics.hasBall) {
            spacePressed = true;
            isCharging = true;
            chargeTime = 0;
            document.getElementById('power-bar').classList.add('active');
            document.getElementById('power-label').classList.add('active');
            if (!audioInitialized) initAudio();
        }
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        keys[key] = false;
        e.preventDefault();
    }
    if (e.code === 'Space') {
        e.preventDefault();
        if (spacePressed && isCharging && ballPhysics.hasBall) {
            const power = Math.min(chargeTime / 1500, 1) * 100;
            kickBall(power);
            isCharging = false;
            chargeTime = 0;
            document.getElementById('power-bar').classList.remove('active');
            document.getElementById('power-label').classList.remove('active');
            document.getElementById('power-fill').style.width = '0%';
            document.getElementById('power').textContent = '0%';
        }
        spacePressed = false;
        isCharging = false;
    }
});

// Mute
document.getElementById('mute-btn').addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    document.getElementById('mute-btn').textContent = audioEnabled ? '🔇 Silenciar' : '🔊 Activar audio';
    if (!audioEnabled && audioCtx) audioCtx.suspend();
    else if (audioEnabled && audioCtx) audioCtx.resume();
    if (audioEnabled && !audioInitialized) initAudio();
});

renderer.domElement.addEventListener('click', () => {
    if (!controls.isLocked) {
        controls.lock();
        if (!audioInitialized) initAudio();
    }
});

// ----- BUCLE PRINCIPAL -----
const clock = new THREE.Clock();

function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    // ----- ACTUALIZAR VIENTO (NUEVO) -----
    updateWind(delta);
    updateWindIndicator();

    if (isCharging && ballPhysics.hasBall) {
        chargeTime += delta * 1000;
        const pct = Math.min(chargeTime / 1500, 1);
        const powerPercent = Math.round(pct * 100);
        document.getElementById('power-fill').style.width = powerPercent + '%';
        document.getElementById('power').textContent = powerPercent + '%';
        if (powerPercent > 75) {
            document.getElementById('power-fill').style.background = 'linear-gradient(90deg, #ff5722, #ff0000)';
        } else {
            document.getElementById('power-fill').style.background = 'linear-gradient(90deg, #4caf50, #ffeb3b, #ff5722)';
        }
    }

    let moveX = 0,
        moveZ = 0;
    if (keys.w) moveZ -= 1;
    if (keys.s) moveZ += 1;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;

    const baseSpeed = 4.0;

    let moveDirection = new THREE.Vector3(0, 0, -1);
    if (moveX !== 0 || moveZ !== 0) {
        moveDirection.set(moveX, 0, moveZ).normalize();
        ballPhysics.lastMoveDirection.copy(moveDirection);
    }

    if (moveX !== 0 || moveZ !== 0) {
        const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
        moveX /= len;
        moveZ /= len;

        let newX = playerGroup.position.x + moveX * baseSpeed * delta;
        let newZ = playerGroup.position.z + moveZ * baseSpeed * delta;
        const margin = 0.8;
        newX = Math.min(Math.max(newX, boundary.minX + margin), boundary.maxX - margin);
        newZ = Math.min(Math.max(newZ, boundary.minZ + margin), boundary.maxZ - margin);
        playerGroup.position.x = newX;
        playerGroup.position.z = newZ;
        const angle = Math.atan2(moveX, moveZ);
        playerGroup.rotation.y = angle;

        if (ballPhysics.hasBall) {
            const dir = new THREE.Vector3(moveX, 0, moveZ);
            ballPhysics.followPlayer(playerGroup.position, dir);
            ball.position.copy(ballPhysics.position);
        }
    } else {
        if (ballPhysics.hasBall) {
            ball.position.x = playerGroup.position.x;
            ball.position.z = playerGroup.position.z;
            ball.position.y = 0.25;
            ballPhysics.position.copy(ball.position);
        }
    }

    if (ballPhysics.moving) {
        ballPhysics.update(delta);
        ball.position.copy(ballPhysics.position);

        // Detección de gol
        const goalZ = -15.5;
        const gw = 7.32;
        const gh = 2.44;

        const isInGoalFrame =
            Math.abs(ball.position.x) < gw / 2 - 0.1 &&
            ball.position.y < gh - 0.1 &&
            ball.position.y > 0.1 &&
            ball.position.z < goalZ + 0.5 &&
            ball.position.z > goalZ - 2.0;

        if (isInGoalFrame && ballPhysics.moving && !keeper.processingSave) {
            const distToKeeper = ball.position.distanceTo(keeperGroup.position);
            if (distToKeeper > 0.8 || ball.position.z < goalZ) {
                scoreGoal();
                ballPhysics.moving = false;
                fireActive = false;
                fireMaterial.opacity = 0;
                document.getElementById('fire-status').textContent = '❌';
            }
        }

        if (keeper.diving && ball.position.z < -12 && !keeper.hasBall && !keeper.processingSave) {
            const distToKeeper = ball.position.distanceTo(keeperGroup.position);
            if (distToKeeper < 1.3 && ball.position.y < 1.8) {
                if (ballPhysics.moving) {
                    keeperSave();
                }
            }
        }

        if (!ballPhysics.moving && !keeper.hasBall && !keeper.processingSave) {
            if (ball.position.distanceTo(playerGroup.position) < 1.5) {
                ballPhysics.hasBall = true;
                indicator.visible = true;
                ball.position.x = playerGroup.position.x;
                ball.position.z = playerGroup.position.z;
                ball.position.y = 0.25;
                ballPhysics.position.copy(ball.position);
                fireActive = false;
                fireMaterial.opacity = 0;
                document.getElementById('fire-status').textContent = '❌';
                cameraSystem.mode = 'player';
                document.getElementById('cam-mode').textContent = 'Jugador';
            }
        }
    }

    if (!ballPhysics.moving && !ballPhysics.hasBall && !keeper.hasBall && !keeper.processingSave) {
        if (ball.position.distanceTo(playerGroup.position) < 1.5) {
            ballPhysics.hasBall = true;
            indicator.visible = true;
            ball.position.x = playerGroup.position.x;
            ball.position.z = playerGroup.position.z;
            ball.position.y = 0.25;
            ballPhysics.position.copy(ball.position);
            fireActive = false;
            fireMaterial.opacity = 0;
            document.getElementById('fire-status').textContent = '❌';
            cameraSystem.mode = 'player';
            document.getElementById('cam-mode').textContent = 'Jugador';
        }
    }

    if (fireActive && ballPhysics.moving) {
        const pos = fireParticles.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            pos[i * 3] += (velocities[i].x + (Math.random() - 0.5) * 0.1) * delta * 2;
            pos[i * 3 + 1] += (velocities[i].y + (Math.random() - 0.5) * 0.1) * delta * 2;
            pos[i * 3 + 2] += (velocities[i].z + (Math.random() - 0.5) * 0.1) * delta * 2;
            if (pos[i * 3 + 1] > 0.5 || pos[i * 3 + 1] < -0.5) velocities[i].y *= -1;
            if (pos[i * 3] > 0.5 || pos[i * 3] < -0.5) velocities[i].x *= -1;
            if (pos[i * 3 + 2] > 0.5 || pos[i * 3 + 2] < -0.5) velocities[i].z *= -1;
        }
        fireParticles.attributes.position.needsUpdate = true;
        fireSystem.position.copy(ball.position);
        fireSystem.position.y += 0.2;
        fireMaterial.opacity = 0.6 + 0.2 * Math.sin(time * 5);
    } else {
        fireMaterial.opacity = 0;
    }

    if (!keeper.hasBall && !keeper.processingSave) {
        const targetX = ball.position.x * 0.4;
        keeper.targetX = Math.min(Math.max(targetX, -4.5), 4.5);
        const dx = keeper.targetX - keeperGroup.position.x;
        keeperGroup.position.x += dx * delta * 2.5;

        if (ball.position.z < -10 && ballPhysics.moving && !keeper.processingSave) {
            keeper.diving = true;
        }
    } else {
        keeper.diving = false;
    }

    if (!ballPhysics.moving && !ballPhysics.hasBall && !keeper.hasBall && !keeper.processingSave) {
        if (ball.position.distanceTo(keeperGroup.position) < 1.2) {
            if (ball.position.z < -12) {
                keeperSave();
            }
        }
    }

    const playerPos = playerGroup.position.clone();
    playerPos.y = 0;

    if (cameraSystem.mode === 'player') {
        cameraSystem.followPlayer(playerPos);
        cameraSystem.lookAt(playerPos);
    } else {
        const ballPos = ball.position.clone();
        cameraSystem.followBall(ballPos);
        cameraSystem.lookAt(ballPos);
    }

    const camPos = cameraSystem.getPosition();
    camera.position.copy(camPos);

    const lookTarget = cameraSystem.mode === 'ball' ?
        ball.position.clone() :
        playerGroup.position.clone();
    lookTarget.y += 0.5;
    camera.lookAt(lookTarget);

    document.getElementById('shots').textContent = stats.shots;
    document.getElementById('goals').textContent = stats.goals;
    document.getElementById('saves').textContent = stats.saves;
    document.getElementById('audio-status').textContent = audioEnabled ? '✅' : '🔇';
    document.getElementById('wind-speed').textContent = wind.speed.toFixed(1) + ' m/s';

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log('⚽ Fútbol 3D · CON VIENTO 🌬️');
console.log('W = Dispara hacia ARRIBA (hacia la portería)');
console.log('S = Dispara hacia ABAJO');
console.log('A = Dispara hacia la IZQUIERDA');
console.log('D = Dispara hacia la DERECHA');
console.log('🌬️ El viento afecta la trayectoria del balón en tiempo real');
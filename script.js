// === ВАША КОНФИГУРАЦИЯ (без изменений) ===
const configuration = {
    iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

let pc;
let localStream;
let micEnabled = true;
let camEnabled = true;

// Элементы UI
const createOfferBtn = document.getElementById('create-offer');
const createAnswerBtn = document.getElementById('create-answer');
const remoteSdpInput = document.getElementById('remote-sdp');
const connectBtn = document.getElementById('connect-btn');
const localSdpOutput = document.getElementById('local-sdp-output');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const compressCopyBtn = document.getElementById('compress-copy-btn');
const copyStatus = document.getElementById('copy-status');
const statusDiv = document.getElementById('status');
const onscreenLog = document.getElementById('onscreen-log');

const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');
const micIconOn = document.getElementById('mic-icon-on');
const micIconOff = document.getElementById('mic-icon-off');
const camIconOn = document.getElementById('cam-icon-on');
const camIconOff = document.getElementById('cam-icon-off');

// Логирование на экран
function log(msg, type = 'info') {
    console.log(msg);
    const div = document.createElement('div');
    div.textContent = `> ${msg}`;
    if (type === 'error') div.className = 'log-error';
    if (type === 'warn') div.className = 'log-warn';
    onscreenLog.appendChild(div);
    onscreenLog.scrollTop = onscreenLog.scrollHeight;
}

// Проверка протокола
if (window.location.protocol === 'file:') {
    log('⚠️ ВНИМАНИЕ: Откройте через http://localhost, а не file://', 'error');
    statusDiv.textContent = '⚠️ ОШИБКА: Откройте через локальный сервер (http://localhost)';
    statusDiv.className = 'status failed';
}

// === ФУНКЦИИ СЖАТИЯ И РАСПАКОВКИ ===
async function compressAndEncode(jsonString) {
    const blob = new Blob([jsonString], { type: 'text/plain' });
    const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
    const compressedBlob = await new Response(stream).blob();
    const buffer = await compressedBlob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function decodeAndDecompress(base64String) {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/gzip' });
    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
}

async function getValidSdp(rawText) {
    const trimmed = rawText.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{')) return trimmed; // Обычный JSON

    try {
        log('📦 Обнаружен сжатый SDP, распаковываю...');
        return await decodeAndDecompress(trimmed);
    } catch (err) {
        log('❌ Ошибка распаковки: ' + err.message, 'error');
        throw new Error('Неверный формат SDP');
    }
}

// === МЕДИА И СОЕДИНЕНИЕ ===
async function startMedia() {
    if (localStream) return localStream;
    try {
        log('🎤 Запрос доступа к камере/микрофону...');
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (localVideo) localVideo.srcObject = localStream;
        log('✅ Доступ к медиа получен');
        return localStream;
    } catch (err) {
        log('❌ Ошибка медиа: ' + err.message, 'error');
        alert('Ошибка доступа: ' + err.message);
        throw err;
    }
}

function initPeer() {
    if (pc) return;
    log('🔧 Создание RTCPeerConnection...');
    pc = new RTCPeerConnection(configuration);

    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
            log(`  📹 Добавлен трек: ${track.kind}`);
        });
    }

    compressCopyBtn.disabled = true;
    compressCopyBtn.textContent = '⏳ Сбор ICE...';
    copyStatus.textContent = '';

    let iceReady = false;
    let srflxReceived = false;
    const iceStartTime = Date.now();

    function unlockCopyButton(reason) {
        if (iceReady) return;
        iceReady = true;
        const elapsed = Date.now() - iceStartTime;
        log(`✅ Кнопка разблокирована (${reason}) за ${elapsed} мс`);

        if (pc.localDescription) {
            const rawJson = JSON.stringify(pc.localDescription);
            compressCopyBtn.textContent = '⏳ Сжимаю...';

            compressAndEncode(rawJson).then(compressed => {
                localSdpOutput.value = compressed;
                log(`📦 Сжато: ${rawJson.length} → ${compressed.length} симв.`);
                compressCopyBtn.disabled = false;
                compressCopyBtn.textContent = '📋 Копировать SDP';
                copyStatus.textContent = '✅ Готово!';
            }).catch(err => {
                log('❌ Ошибка сжатия, показан оригинал', 'error');
                localSdpOutput.value = rawJson;
                compressCopyBtn.disabled = false;
                compressCopyBtn.textContent = '📋 Копировать SDP';
            });
        }
    }

    pc.onicecandidate = (event) => {
        const elapsed = Date.now() - iceStartTime;
        if (event.candidate === null) {
            log(`✅ Сбор ICE полностью завершен за ${elapsed} мс`);
            unlockCopyButton('сбор завершен');
        } else {
            log(`🌐 [${elapsed} мс] Кандидат: ${event.candidate.type} | ${event.candidate.address || 'скрыт'}`);
            if (event.candidate.type === 'srflx' && !srflxReceived) {
                srflxReceived = true;
                log('🎯 Получен внешний IP! Ждём 1 сек и разблокируем...');
                setTimeout(() => unlockCopyButton('получен srflx'), 1000);
            }
        }
    };

    setTimeout(() => unlockCopyButton('таймаут 5 сек'), 5000);

    pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        log(`🔌 ICE: ${state}`);
        if (state === 'connected' || state === 'completed') {
            statusDiv.textContent = '🎉 СОЕДИНЕНИЕ УСТАНОВЛЕНО!';
            statusDiv.className = 'status connected';
        } else if (state === 'failed') {
            statusDiv.textContent = '❌ Соединение не удалось (проверьте сеть)';
            statusDiv.className = 'status failed';
        } else if (state === 'disconnected') {
            statusDiv.textContent = '⚠️ Соединение разорвано';
            statusDiv.className = 'status failed';
        } else if (state === 'checking') {
            statusDiv.textContent = '🔍 Установка соединения...';
            statusDiv.className = 'status waiting';
        }
    };

    pc.ontrack = (event) => {
        log('📥 Получен поток от собеседника');
        if (remoteVideo && remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            remoteVideo.play().catch(err => {
                if (err.name !== 'AbortError') log('Ошибка play: ' + err.message, 'error');
            });
        }
    };
}

// === ОБРАБОТЧИКИ КНОПОК ===
compressCopyBtn.addEventListener('click', async () => {
    if (compressCopyBtn.disabled || !localSdpOutput.value) return;
    try {
        await navigator.clipboard.writeText(localSdpOutput.value);
        copyStatus.textContent = `✅ Скопировано! (${localSdpOutput.value.length} симв.)`;
        setTimeout(() => { copyStatus.textContent = ''; }, 3000);
    } catch (err) {
        log('❌ Не удалось скопировать. Скопируйте текст вручную.', 'error');
    }
});

createOfferBtn.addEventListener('click', async () => {
    log('🔘 Нажато: Я звоню');
    try {
        await startMedia();
        initPeer();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        statusDiv.textContent = '⏳ Генерация Offer...';
        statusDiv.className = 'status waiting';
    } catch (err) {
        log('❌ Ошибка Offer: ' + err.message, 'error');
    }
});

createAnswerBtn.addEventListener('click', async () => {
    log('🔘 Нажато: Я принимаю');
    const remoteSdpText = remoteSdpInput.value.trim();
    if (!remoteSdpText) {
        alert('Сначала вставьте SDP от друга!');
        return;
    }
    try {
        await startMedia();
        initPeer();
        const validSdp = await getValidSdp(remoteSdpText);
        const remoteDesc = JSON.parse(validSdp);
        await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        statusDiv.textContent = '⏳ Генерация Answer...';
        statusDiv.className = 'status waiting';
    } catch (err) {
        log('❌ Ошибка Answer: ' + err.message, 'error');
        alert('Ошибка: ' + err.message);
    }
});

connectBtn.addEventListener('click', async () => {
    log('🔘 Нажато: Подключить');
    if (!pc) {
        alert('Сначала создайте Offer или Answer!');
        return;
    }
    const remoteSdpText = remoteSdpInput.value.trim();
    if (!remoteSdpText) {
        alert('Вставьте SDP от друга!');
        return;
    }
    try {
        const validSdp = await getValidSdp(remoteSdpText);
        const remoteDesc = JSON.parse(validSdp);
        if (!pc.remoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));
            statusDiv.textContent = '🔍 Установка соединения...';
            statusDiv.className = 'status waiting';
        }
    } catch (err) {
        log('❌ Ошибка подключения: ' + err.message, 'error');
        alert('Ошибка: ' + err.message);
    }
});

// === УПРАВЛЕНИЕ МЕДИА ===
micBtn.addEventListener('click', () => {
    if (!localStream) return;
    micEnabled = !micEnabled;
    const track = localStream.getAudioTracks()[0];
    if (track) track.enabled = micEnabled;
    micBtn.classList.toggle('off', !micEnabled);
    micBtn.classList.toggle('active', micEnabled);
    micIconOn.style.display = micEnabled ? 'block' : 'none';
    micIconOff.style.display = micEnabled ? 'none' : 'block';
});

camBtn.addEventListener('click', () => {
    if (!localStream) return;
    camEnabled = !camEnabled;
    const track = localStream.getVideoTracks()[0];
    if (track) track.enabled = camEnabled;
    camBtn.classList.toggle('off', !camEnabled);
    camBtn.classList.toggle('active', camEnabled);
    camIconOn.style.display = camEnabled ? 'block' : 'none';
    camIconOff.style.display = camEnabled ? 'none' : 'block';
});
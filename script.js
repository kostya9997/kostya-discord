const configuration = {
    iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        //{ urls: 'stun:173.194.222.127:19302' },
        //{ urls: 'stun:74.125.200.127:19302' },
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
const copySdpBtn = document.getElementById('copy-sdp-btn');
const copyStatus = document.getElementById('copy-status');
const statusDiv = document.getElementById('status');

// Кнопки управления медиа
const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');
const micIconOn = document.getElementById('mic-icon-on');
const micIconOff = document.getElementById('mic-icon-off');
const camIconOn = document.getElementById('cam-icon-on');
const camIconOff = document.getElementById('cam-icon-off');

// Проверка протокола
if (window.location.protocol === 'file:') {
    statusDiv.textContent = '⚠️ ОШИБКА: Откройте через локальный сервер (http://localhost)';
    statusDiv.className = 'status failed';
}

async function startMedia() {
    if (localStream) return localStream;
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (localVideo) localVideo.srcObject = localStream;
        return localStream;
    } catch (err) {
        alert('Ошибка доступа к камере/микрофону: ' + err.message);
        throw err;
    }
}

function initPeer() {
    if (pc) return;
    pc = new RTCPeerConnection(configuration);

    if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    copySdpBtn.disabled = true;
    copySdpBtn.textContent = '⏳ Сбор ICE...';
    copyStatus.textContent = '';

    let iceReady = false;
    let srflxReceived = false;
    const iceStartTime = Date.now();

    function unlockCopyButton(reason) {
        if (iceReady) return;
        iceReady = true;
        const elapsed = Date.now() - iceStartTime;
        console.log(`✅ Кнопка разблокирована (${reason}) за ${elapsed} мс`);

        copySdpBtn.disabled = false;
        copySdpBtn.textContent = '📋 Копировать SDP';
        copyStatus.textContent = '✅ Готово к копированию!';
        if (pc.localDescription) {
            localSdpOutput.value = JSON.stringify(pc.localDescription);
        }
    }

    pc.onicecandidate = (event) => {
        const elapsed = Date.now() - iceStartTime;

        if (event.candidate === null) {
            console.log(`✅ Сбор ICE полностью завершен за ${elapsed} мс`);
            unlockCopyButton('сбор завершен');
        } else {
            console.log(`🌐 [${elapsed} мс] Кандидат: ${event.candidate.type} | ${event.candidate.address || 'скрыт'}:${event.candidate.port}`);

            // Как только получили внешний IP (srflx) — ждём ещё 1 секунду на случай relay и разблокируем
            if (event.candidate.type === 'srflx' && !srflxReceived) {
                srflxReceived = true;
                console.log('🎯 Получен внешний IP! Ждём 1 сек на случай TURN и разблокируем...');
                setTimeout(() => unlockCopyButton('получен srflx + пауза'), 1000);
            }

            if (pc.localDescription) {
                localSdpOutput.value = JSON.stringify(pc.localDescription);
            }
        }
    };

    // Запасной таймаут — если ничего не пришло за 5 секунд
    setTimeout(() => unlockCopyButton('таймаут 5 сек'), 5000);

    pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log('🔌 ICE:', state);

        if (state === 'connected' || state === 'completed') {
            statusDiv.textContent = '🎉 СОЕДИНЕНИЕ УСТАНОВЛЕНО!';
            statusDiv.className = 'status connected';
        } else if (state === 'failed') {
            statusDiv.textContent = '❌ Соединение не удалось';
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
        console.log('📥 Получен поток');
        if (remoteVideo && remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            remoteVideo.play().catch(err => {
                if (err.name !== 'AbortError') console.error('Ошибка play:', err);
            });
        }
    };
}

// === УПРАВЛЕНИЕ МИКРОФОНОМ ===
micBtn.addEventListener('click', () => {
    if (!localStream) {
        alert('Сначала создайте Offer или Answer!');
        return;
    }

    micEnabled = !micEnabled;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = micEnabled; // Глушим трек, но не удаляем из соединения
    }

    if (micEnabled) {
        micBtn.classList.remove('off');
        micBtn.classList.add('active');
        micIconOn.style.display = 'block';
        micIconOff.style.display = 'none';
        micBtn.title = 'Микрофон включен';
    } else {
        micBtn.classList.remove('active');
        micBtn.classList.add('off');
        micIconOn.style.display = 'none';
        micIconOff.style.display = 'block';
        micBtn.title = 'Микрофон выключен';
    }
});

// === УПРАВЛЕНИЕ КАМЕРОЙ ===
camBtn.addEventListener('click', () => {
    if (!localStream) {
        alert('Сначала создайте Offer или Answer!');
        return;
    }

    camEnabled = !camEnabled;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = camEnabled; // Глушим трек, но не удаляем из соединения
    }

    if (camEnabled) {
        camBtn.classList.remove('off');
        camBtn.classList.add('active');
        camIconOn.style.display = 'block';
        camIconOff.style.display = 'none';
        camBtn.title = 'Камера включена';
    } else {
        camBtn.classList.remove('active');
        camBtn.classList.add('off');
        camIconOn.style.display = 'none';
        camIconOff.style.display = 'block';
        camBtn.title = 'Камера выключена';
    }
});

// === КОПИРОВАНИЕ SDP ===
copySdpBtn.addEventListener('click', async () => {
    if (copySdpBtn.disabled) return;
    localSdpOutput.select();
    try {
        await navigator.clipboard.writeText(localSdpOutput.value);
        copyStatus.textContent = '✅ Скопировано!';
        setTimeout(() => { copyStatus.textContent = ''; }, 3000);
    } catch (err) {
        document.execCommand('copy');
        copyStatus.textContent = '✅ Скопировано!';
    }
});

// === СОЗДАНИЕ OFFER ===
createOfferBtn.addEventListener('click', async () => {
    try {
        await startMedia();
        initPeer();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        statusDiv.textContent = '⏳ Генерация Offer...';
        statusDiv.className = 'status waiting';
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
});

// === СОЗДАНИЕ ANSWER ===
createAnswerBtn.addEventListener('click', async () => {
    const remoteSdpText = remoteSdpInput.value.trim();
    if (!remoteSdpText) {
        alert('Сначала вставьте SDP от друга!');
        return;
    }
    try {
        await startMedia();
        initPeer();
        const remoteDesc = JSON.parse(remoteSdpText);
        await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        statusDiv.textContent = '⏳ Генерация Answer...';
        statusDiv.className = 'status waiting';
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
});

// === ПОДКЛЮЧЕНИЕ ===
connectBtn.addEventListener('click', async () => {
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
        const remoteDesc = JSON.parse(remoteSdpText);
        if (!pc.remoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));
            statusDiv.textContent = '🔍 Установка соединения...';
            statusDiv.className = 'status waiting';
        }
    } catch (err) {
        alert('Ошибка подключения: ' + err.message);
    }
});
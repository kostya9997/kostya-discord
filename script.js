const configuration = {
    iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

let pc;
let localStream;
let micEnabled = false;
let camEnabled = false;
let reconnectTimeout = 3000;

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
const reconnectSection = document.getElementById('reconnect-section');
const reconnectBtn = document.getElementById('reconnect-btn');
const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');
const micIconOn = document.getElementById('mic-icon-on');
const micIconOff = document.getElementById('mic-icon-off');
const camIconOn = document.getElementById('cam-icon-on');
const camIconOff = document.getElementById('cam-icon-off');

function log(msg, type = 'info') {
    console.log(msg);
    const div = document.createElement('div');
    div.textContent = `> ${msg}`;
    if (type === 'error') div.className = 'log-error';
    if (type === 'warn') div.className = 'log-warn';
    onscreenLog.appendChild(div);
    onscreenLog.scrollTop = onscreenLog.scrollHeight;
}

if (window.location.protocol === 'file:') {
    log('⚠️ Откройте через http://localhost, а не file://', 'error');
    statusDiv.textContent = '⚠️ ОШИБКА: Откройте через локальный сервер';
    statusDiv.className = 'status failed';
}

// === СЖАТИЕ И РАСПАКОВКА (Gzip) ===
async function compressAndEncode(jsonString) {
    const blob = new Blob([jsonString], { type: 'text/plain' });
    const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
    const compressedBlob = await new Response(stream).blob();
    const buffer = await compressedBlob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

async function decodeAndDecompress(base64String) {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/gzip' });
    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
}

async function getValidSdp(rawText) {
    const trimmed = rawText.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{')) return trimmed;
    try {
        log('📦 Распаковка сжатого SDP...');
        return await decodeAndDecompress(trimmed);
    } catch (err) {
        log('❌ Ошибка распаковки', 'error');
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

        // Сразу отключаем треки
        const audioTrack = localStream.getAudioTracks()[0];
        const videoTrack = localStream.getVideoTracks()[0];
        if (audioTrack) audioTrack.enabled = false;
        if (videoTrack) videoTrack.enabled = false;

        // Обновляем UI кнопок
        micBtn.classList.remove('active');
        micBtn.classList.add('off');
        micIconOn.style.display = 'none';
        micIconOff.style.display = 'block';
        camBtn.classList.remove('active');
        camBtn.classList.add('off');
        camIconOn.style.display = 'none';
        camIconOff.style.display = 'block';

        log('✅ Доступ к медиа получен (камера и микрофон выключены)');
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
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    compressCopyBtn.disabled = true;
    compressCopyBtn.textContent = '⏳ Сбор ICE...';
    copyStatus.textContent = '';
    reconnectSection.style.display = 'none';

    let firstHostAdded = false;
    let iceReady = false;
    let srflxReceived = false;
    const iceStartTime = Date.now();

    function unlockCopyButton(reason) {
        if (iceReady) return;
        iceReady = true;
        log(`✅ Кнопка разблокирована (${reason})`);

        if (pc.localDescription) {
            const rawJson = JSON.stringify(pc.localDescription);
            compressCopyBtn.textContent = '⏳ Сжимаю...';

            compressAndEncode(rawJson).then(compressed => {
                localSdpOutput.value = compressed;
                log(`📦 Сжато: ${rawJson.length} → ${compressed.length} симв.`);
                compressCopyBtn.disabled = false;
                compressCopyBtn.textContent = '📋 Копировать SDP';
                copyStatus.textContent = '✅ Готово!';
            }).catch(() => {
                localSdpOutput.value = rawJson;
                compressCopyBtn.disabled = false;
                compressCopyBtn.textContent = '📋 Копировать SDP';
            });
        }
    }

    pc.onicecandidate = (event) => {
        if (event.candidate === null) {
            unlockCopyButton('сбор завершен');
        } else {
            const candidate = event.candidate;
            const address = candidate.address || '';

            // === ФИЛЬТРАЦИЯ IPv6 ===
            if (address.includes(':')) {
                log(`🚫 Пропускаем IPv6: ${address}`);
                return;
            }

            // === ТОЛЬКО ПЕРВЫЙ HOST ===
            if (candidate.type === 'host') {
                if (!firstHostAdded) {
                    firstHostAdded = true;
                } else {
                    log(`🚫 Пропускаем лишний host`);
                    return;
                }
            }

            log(`🌐 Добавлен: ${candidate.type} | ${address}:${candidate.port}`);

            if (candidate.type === 'srflx' && !srflxReceived) {
                srflxReceived = true;
                setTimeout(() => unlockCopyButton('получен srflx'), 1000);
            }
        }
    };

    setTimeout(() => unlockCopyButton('таймаут 5 сек'), 5000);

    // === ОБРАБОТКА ОБРЫВА СВЯЗИ ===
    pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        log(`🔌 ICE: ${state}`);

        if (state === 'connected' || state === 'completed') {
            statusDiv.textContent = '🎉 СОЕДИНЕНИЕ УСТАНОВЛЕНО!';
            statusDiv.className = 'status connected';
            reconnectSection.style.display = 'none';
        } else if (state === 'disconnected') {
            statusDiv.textContent = '⚠️ Связь нестабильна, попытка восстановления...';
            statusDiv.className = 'status waiting';
            setTimeout(() => {
                if (pc && pc.iceConnectionState === 'disconnected') {
                    log('⚠️ Связь не восстановилась. Запускаю ICE Restart...', 'warn');
                    attemptAutoReconnect();
                }
            }, reconnectTimeout);
        } else if (state === 'failed') {
            statusDiv.textContent = '❌ Соединение разорвано';
            statusDiv.className = 'status failed';
            attemptAutoReconnect();
        }
    };

    // === АВТОМАТИЧЕСКОЕ ВОССТАНОВЛЕНИЕ ===
    async function attemptAutoReconnect() {
        if (!pc) return;
        log('🔄 Перезапуск ICE...');
        statusDiv.textContent = '🔄 Попытка восстановления...';

        try {
            pc.restartIce();

            let restored = false;
            const checkInterval = setInterval(() => {
                if (pc && pc.iceConnectionState === 'connected') {
                    restored = true;
                    clearInterval(checkInterval);
                    log('✅ Связь восстановлена автоматически!');
                    statusDiv.textContent = '🎉 СОЕДИНЕНИЕ ВОССТАНОВЛЕНО!';
                    statusDiv.className = 'status connected';
                }
            }, 500);

            setTimeout(() => {
                clearInterval(checkInterval);
                if (!restored && pc) {
                    log('❌ Авто-восстановление не удалось. Сеть изменилась.', 'error');
                    statusDiv.textContent = '❌ Сеть изменилась. Требуется новый обмен SDP.';
                    statusDiv.className = 'status failed';
                    showReconnectButton();
                }
            }, 10000);
        } catch (err) {
            log('❌ Ошибка восстановления: ' + err.message, 'error');
            showReconnectButton();
        }
    }

    // === КНОПКА ДЛЯ НОВОГО ОБМЕНА ===
    function showReconnectButton() {
        if (!pc) return;
        log('🔄 Генерирую новый SDP...');

        localSdpOutput.value = '';
        compressCopyBtn.disabled = true;
        compressCopyBtn.textContent = '⏳ Поиск новых путей...';

        const originalHandler = pc.onicecandidate;
        pc.onicecandidate = (event) => {
            if (event.candidate === null) {
                log('✅ Новые пути найдены!');
                const rawJson = JSON.stringify(pc.localDescription);
                compressAndEncode(rawJson).then(compressed => {
                    localSdpOutput.value = compressed;
                    compressCopyBtn.disabled = false;
                    compressCopyBtn.textContent = '📤 Отправить новый код';
                    copyStatus.textContent = '✅ Готово к отправке!';

                    reconnectSection.style.display = 'block';
                    reconnectSection.innerHTML = `
                        <p>🔄 Сеть изменилась. Отправьте новый код другу:</p>
                        <button id="share-btn" class="btn btn-warning">📤 Поделиться (Telegram/WhatsApp)</button>
                        <p style="font-size: 13px; margin-top: 10px; opacity: 0.8;">
                            Друг должен вставить код и нажать "Подключить"
                        </p>
                    `;
                    document.getElementById('share-btn').addEventListener('click', shareNewSdp);
                });
                pc.onicecandidate = originalHandler;
            }
        };
    }

    // === КНОПКА "ПОДЕЛИТЬСЯ" ===
    async function shareNewSdp() {
        const sdpText = localSdpOutput.value;
        if (!sdpText) return;

        const shareData = {
            title: 'P2P Видеозвонок — новый код',
            text: 'Вставь этот код и нажми "Подключить":\n\n' + sdpText
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                log('📤 Код отправлен');
            } catch (err) {
                if (err.name !== 'AbortError') {
                    navigator.clipboard.writeText(sdpText);
                    alert('✅ Код скопирован! Отправьте его другу.');
                }
            }
        } else {
            navigator.clipboard.writeText(sdpText);
            alert('✅ Код скопирован! Отправьте его другу.');
        }
    }

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

// === ПЕРЕПОДКЛЮЧЕНИЕ ===
reconnectBtn.addEventListener('click', () => {
    log('🔄 Сброс соединения (камера остаётся включенной)...');
    if (pc) {
        pc.close();
        pc = null;
    }
    localSdpOutput.value = '';
    remoteSdpInput.value = '';
    compressCopyBtn.disabled = true;
    compressCopyBtn.textContent = '⏳ Сбор ICE...';
    copyStatus.textContent = '';
    statusDiv.textContent = '⏳ Создайте новый Offer и отправьте другу';
    statusDiv.className = 'status waiting';
    reconnectSection.style.display = 'none';

    alert('Соединение сброшено. Камера и микрофон работают.\n\n1. Нажмите "Я звоню" (или "Я принимаю")\n2. Скопируйте новый SDP\n3. Отправьте его другу.');
});

// === ОБРАБОТЧИКИ КНОПОК ===
compressCopyBtn.addEventListener('click', async () => {
    if (compressCopyBtn.disabled || !localSdpOutput.value) return;
    try {
        await navigator.clipboard.writeText(localSdpOutput.value);
        copyStatus.textContent = `✅ Скопировано!`;
        setTimeout(() => { copyStatus.textContent = ''; }, 2000);
    } catch (err) {
        log('❌ Не удалось скопировать. Скопируйте вручную.', 'error');
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
    if (!remoteSdpText) { alert('Сначала вставьте SDP от друга!'); return; }
    try {
        await startMedia();
        initPeer();
        const validSdp = await getValidSdp(remoteSdpText);
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(validSdp)));
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
    if (!pc) { alert('Сначала создайте Offer или Answer!'); return; }
    const remoteSdpText = remoteSdpInput.value.trim();
    if (!remoteSdpText) { alert('Вставьте SDP от друга!'); return; }
    try {
        const validSdp = await getValidSdp(remoteSdpText);
        if (!pc.remoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(validSdp)));
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
// === КОНФИГУРАЦИЯ WEBRTC ===
const configuration = {
    iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

// === СОСТОЯНИЕ ПРИЛОЖЕНИЯ ===
let pc = null;
let localStream = null;
let screenStream = null;
let micEnabled = false;
let camEnabled = false;
let isScreenSharing = false;
let callStartTime = null;
let callTimerInterval = null;
let reconnectTimeout = 3000;
let currentRole = 'caller'; // 'caller' | 'answerer'
let rawLocalJson = '';
let rawRemoteJson = '';

// === СОСТОЯНИЕ ИНТЕРАКТИВНОГО АВАТАРА ===
let audioCtx = null;
let analyserNode = null;
let audioSource = null;
let smoothVolume = 0;
let avatarMouthOpen = 0;
let avatarCanvas = null;
let avatarStream = null;
let avatarTrack = null;

// === СОСТОЯНИЕ P2P ТЕКСТОВОГО ЧАТА И ФАЙЛОВ ===
let dataChannel = null;
let unreadMessagesCount = 0;
let isChatOpen = false;
let isLocalMain = false; // Google Meet Pinning mode
const receivingFiles = new Map();
const CHUNK_SIZE = 16384; // 16 KB безопасный размер чанка для DataChannel

// === ЭЛЕМЕНТЫ UI ===
// Шапка и статус
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const callTimer = document.getElementById('call-timer');
const toggleDevBtn = document.getElementById('toggle-dev-btn');
const devDrawer = document.getElementById('dev-drawer');
const closeDevBtn = document.getElementById('close-dev-btn');
const drawerBackdrop = document.getElementById('drawer-backdrop');

// Баннер переподключения
const reconnectBanner = document.getElementById('reconnect-banner');
const reconnectDesc = document.getElementById('reconnect-desc');
const reconnectActionBtn = document.getElementById('reconnect-action-btn');
const shareNewCodeBtn = document.getElementById('share-new-code-btn');

// Экраны (Views)
const lobbyView = document.getElementById('lobby-view');
const callStageView = document.getElementById('call-stage-view');

// Превью
const previewVideo = document.getElementById('preview-video');
const previewAvatar = document.getElementById('preview-avatar');
const previewMicBtn = document.getElementById('preview-mic-btn');
const previewCamBtn = document.getElementById('preview-cam-btn');

// Табы ролей
const tabCallerBtn = document.getElementById('tab-caller-btn');
const tabAnswererBtn = document.getElementById('tab-answerer-btn');
const callerPanel = document.getElementById('caller-panel');
const answererPanel = document.getElementById('answerer-panel');

// Шаги Звонящего (Caller)
const createCallBtn = document.getElementById('create-call-btn');
const callerStep2 = document.getElementById('caller-step-2');
const callerStep3 = document.getElementById('caller-step-3');
const callerLocalToken = document.getElementById('caller-local-token');
const copyCallerTokenBtn = document.getElementById('copy-caller-token-btn');
const shareCallerTokenBtn = document.getElementById('share-caller-token-btn');
const callerRemoteToken = document.getElementById('caller-remote-token');
const pasteCallerAnswerBtn = document.getElementById('paste-caller-answer-btn');
const callerConnectBtn = document.getElementById('caller-connect-btn');

// Шаги Принимающего (Answerer)
const answererRemoteToken = document.getElementById('answerer-remote-token');
const pasteAnswererOfferBtn = document.getElementById(
    'paste-answerer-offer-btn',
);
const answerCallBtn = document.getElementById('answer-call-btn');
const answererStep2 = document.getElementById('answerer-step-2');
const answererLocalToken = document.getElementById('answerer-local-token');
const copyAnswererTokenBtn = document.getElementById('copy-answerer-token-btn');
const shareAnswererTokenBtn = document.getElementById(
    'share-answerer-token-btn',
);

// Сцена звонка (Call Stage)
const stageGrid = document.querySelector('.stage-grid');
const remoteTile = document.getElementById('remote-tile');
const localTile = document.getElementById('local-tile');
const remoteVideo = document.getElementById('remote-video');
const remoteAvatar = document.getElementById('remote-avatar');
const localVideo = document.getElementById('local-video');
const localAvatar = document.getElementById('local-avatar');

// Плавающая панель управления звонком
const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');
const screenShareBtn = document.getElementById('screen-share-btn');
const leaveCallBtn = document.getElementById('leave-call-btn');

// Текстовый чат
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const chatPanel = document.getElementById('chat-panel');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatBadge = document.getElementById('chat-badge');
const chatAttachBtn = document.getElementById('chat-attach-btn');
const chatFileInput = document.getElementById('chat-file-input');

// === АВАТАР WARDROBE (ГАРДЕРОБ) ===
const defaultAvatarProfile = {
    name: 'Вы',
    suitColor: '#5865f2',
    hatStyle: 'ushanka', // 'tuft' | 'beanie' | 'ushanka' | 'cap' | 'bald'
};
let avatarProfile = { ...defaultAvatarProfile };
let remoteAvatarProfile = null;

const wardrobePreviewCanvas = document.getElementById(
    'wardrobe-preview-canvas',
);
const wardrobeNameInput = document.getElementById('wardrobe-name-input');
const wardrobeHatBtns = document.querySelectorAll('.hat-btn');
const wardrobeColorDots = document.querySelectorAll('.color-dot');

// === ЛЕТАЮЩИЕ РЕАКЦИИ (EMOJI REACTIONS) ===
const reactionsOverlay = document.getElementById('reactions-overlay');
const reactionsPicker = document.getElementById('reactions-picker');
const reactionsBtn = document.getElementById('reactions-btn');
const rxBtns = document.querySelectorAll('.rx-btn');

// === СОВМЕСТНАЯ ДОСКА (WHITEBOARD) ===
const whiteboardBtn = document.getElementById('whiteboard-btn');
const whiteboardOverlay = document.getElementById('whiteboard-overlay');
const whiteboardCanvas = document.getElementById('whiteboard-canvas');
const wbEraserBtn = document.getElementById('wb-eraser-btn');
const wbClearBtn = document.getElementById('wb-clear-btn');
const wbCopyBtn = document.getElementById('wb-copy-btn');
const wbDownloadBtn = document.getElementById('wb-download-btn');
const wbSendChatBtn = document.getElementById('wb-send-chat-btn');
const wbCloseBtn = document.getElementById('wb-close-btn');
const wbColors = document.querySelectorAll('.wb-color');
const wbSizes = document.querySelectorAll('.wb-size-btn');

let wbCtx = null;
let wbColor = '#ffffff';
let wbSize = 7;
let wbIsEraser = false;
let isWbDrawing = false;
let lastWbX = 0;
let lastWbY = 0;
let isWhiteboardOpen = false;

// === SPEAKING RING (МОНИТОРИНГ ГОЛОСА) ===
let remoteAudioCtx = null;
let remoteAudioAnalyser = null;
let remoteAudioAnimFrame = null;

// DevTools
const metricIceState = document.getElementById('metric-ice-state');
const metricSignalingState = document.getElementById('metric-signaling-state');
const metricGatheringState = document.getElementById('metric-gathering-state');
const metricCompression = document.getElementById('metric-compression');
const devLocalSdp = document.getElementById('dev-local-sdp');
const devRemoteSdp = document.getElementById('dev-remote-sdp');
const devCopyLocalSdp = document.getElementById('dev-copy-local-sdp');
const devDecodeLocalBtn = document.getElementById('dev-decode-local-btn');
const clearLogBtn = document.getElementById('clear-log-btn');
const onscreenLog = document.getElementById('onscreen-log');

// === ЛОГИРОВАНИЕ ===
function log(msg, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${msg}`);

    if (onscreenLog) {
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        div.textContent = `[${timestamp}] ${msg}`;
        onscreenLog.appendChild(div);
        onscreenLog.scrollTop = onscreenLog.scrollHeight;
    }
}

// Проверка протокола
if (window.location.protocol === 'file:') {
    log(
        '⚠️ Запущено через file://. Рекомендуется запуск через локальный веб-сервер (http://localhost)',
        'warn',
    );
}

// Обновление статуса в шапке
function updateAppStatus(text, state = 'waiting') {
    statusText.textContent = text;
    statusBadge.className = `status-badge ${state}`;
}

// Обновление метрик DevTools
function updateDevMetrics() {
    if (!pc) {
        metricIceState.textContent = 'closed';
        metricSignalingState.textContent = 'closed';
        metricGatheringState.textContent = 'closed';
        return;
    }
    metricIceState.textContent = pc.iceConnectionState || 'new';
    metricSignalingState.textContent = pc.signalingState || 'stable';
    metricGatheringState.textContent = pc.iceGatheringState || 'new';
}

// === СЖАТИЕ И ДЕКОДИРОВАНИЕ SDP (Gzip + Base64) ===
async function compressAndEncode(jsonString) {
    const blob = new Blob([jsonString], { type: 'text/plain' });
    const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
    const compressedBlob = await new Response(stream).blob();
    const buffer = await compressedBlob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++)
        binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

async function decodeAndDecompress(base64String) {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++)
        bytes[i] = binaryString.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/gzip' });
    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
}

async function getValidSdp(rawText) {
    const trimmed = rawText.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{')) return trimmed;
    try {
        log('📦 Распаковка сжатого SDP токена...');
        return await decodeAndDecompress(trimmed);
    } catch (err) {
        log('❌ Ошибка распаковки токена: ' + err.message, 'error');
        throw new Error('Неверный формат кода звонка или поврежденные данные');
    }
}

// === МЕМНЫЙ АВАТАР (ИНТЕРАКТИВНЫЙ РИСОВАННЫЙ СТИЛЬ) ===
function drawCartoonCharacter(ctx, options) {
    const {
        cx,
        cy,
        mouthOpen = 0,
        isBlinking = false,
        suitColor = '#5865f2',
        hairColor = '#3d2817',
        skinColor = '#fcdbbd',
        nameTag = '',
        volumeLevel = 0,
        isMuted = false,
        hatStyle = 'tuft',
        scale = 1.0,
        isMiniPreview = false,
    } = options;

    const headRadiusX = 72;
    const headRadiusY = 82;
    const mouthLineY = cy + 16;
    const maxMouthLift = 34;
    const mouthLift = Math.max(0, Math.min(1.0, mouthOpen)) * maxMouthLift;

    ctx.save();

    // Масштабирование вокруг собственного центра персонажа (для миниатюры гардероба)
    if (scale && scale !== 1.0) {
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
    }

    // 1. ТЕЛО / ПЛЕЧИ
    ctx.beginPath();
    ctx.ellipse(cx, cy + 145, 120, 85, 0, Math.PI, 0);
    ctx.lineTo(cx + 120, cy + 240);
    ctx.lineTo(cx - 120, cy + 240);
    ctx.closePath();
    ctx.fillStyle = suitColor;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // Воротник
    ctx.beginPath();
    ctx.moveTo(cx - 35, cy + 85);
    ctx.lineTo(cx, cy + 115);
    ctx.lineTo(cx + 35, cy + 85);
    ctx.lineWidth = 3;
    ctx.stroke();

    // Линия куртки
    ctx.beginPath();
    ctx.moveTo(cx, cy + 115);
    ctx.lineTo(cx, cy + 220);
    ctx.lineWidth = 3;
    ctx.stroke();

    // Шея
    ctx.beginPath();
    ctx.rect(cx - 22, cy + 60, 44, 30);
    ctx.fillStyle = skinColor;
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // Вычисляем точную дугу и ширину в месте разреза рта (mouthLineY)
    const thetaMouth = Math.asin(
        Math.max(-0.99, Math.min(0.99, (mouthLineY - cy) / headRadiusY)),
    );
    const mouthCutX = headRadiusX * Math.cos(thetaMouth);

    // 2. ВНУТРЕННОСТЬ РТА (видна, когда челюсть раздвигается)
    if (mouthLift > 1) {
        ctx.beginPath();
        ctx.rect(
            cx - mouthCutX + 2,
            mouthLineY - mouthLift,
            (mouthCutX - 2) * 2,
            mouthLift + 4,
        );
        ctx.fillStyle = '#160202';
        ctx.fill();

        // Язык
        ctx.beginPath();
        ctx.arc(cx, mouthLineY + 2, 22, Math.PI, 0);
        ctx.fillStyle = '#ff6b81';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
    }

    // 3. НИЖНЯЯ ЧЕЛЮСТЬ (НЕПОДВИЖНАЯ, ЧИСТЫЙ КОНТУР БЕЗ БОКОВЫХ ПАЛОК)
    ctx.beginPath();
    ctx.ellipse(
        cx,
        cy,
        headRadiusX,
        headRadiusY,
        0,
        thetaMouth,
        Math.PI - thetaMouth,
        false,
    );
    ctx.lineTo(cx + mouthCutX, mouthLineY);
    ctx.closePath();
    ctx.fillStyle = skinColor;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // 4. ВЕРХНЯЯ ПОЛОВИНА ГОЛОВЫ (ШЛЁПАЕТ ВВЕРХ-ВНИЗ)
    ctx.save();
    ctx.translate(0, -mouthLift);

    ctx.beginPath();
    ctx.ellipse(
        cx,
        cy,
        headRadiusX,
        headRadiusY,
        0,
        Math.PI - thetaMouth,
        2 * Math.PI + thetaMouth,
        false,
    );
    ctx.lineTo(cx - mouthCutX, mouthLineY);
    ctx.closePath();
    ctx.fillStyle = skinColor;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // Глаза-точки
    const eyeOffsetX = 26;
    const eyeY = cy - 10;

    if (isBlinking) {
        // Моргание: горизонтальные полоски
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(cx - eyeOffsetX - 9, eyeY);
        ctx.lineTo(cx - eyeOffsetX + 9, eyeY);
        ctx.moveTo(cx + eyeOffsetX - 9, eyeY);
        ctx.lineTo(cx + eyeOffsetX + 9, eyeY);
        ctx.stroke();
    } else {
        // Черные круглые глазки
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(cx - eyeOffsetX, eyeY, 6, 0, Math.PI * 2);
        ctx.arc(cx + eyeOffsetX, eyeY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Белые блики
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx - eyeOffsetX + 2, eyeY - 2, 2, 0, Math.PI * 2);
        ctx.arc(cx + eyeOffsetX + 2, eyeY - 2, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Брови
    const browTilt = mouthOpen * 4;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(cx - eyeOffsetX - 10, eyeY - 14 - browTilt);
    ctx.lineTo(cx - eyeOffsetX + 10, eyeY - 12);
    ctx.moveTo(cx + eyeOffsetX - 10, eyeY - 12);
    ctx.lineTo(cx + eyeOffsetX + 10, eyeY - 14 - browTilt);
    ctx.stroke();

    // ШАПКА / ПРИЧЕСКА АВАТАРА
    if (hatStyle === 'tuft') {
        // 1. Классический забавный хохолок
        ctx.beginPath();
        ctx.moveTo(cx - 30, cy - headRadiusY + 4);
        ctx.quadraticCurveTo(
            cx - 15,
            cy - headRadiusY - 28,
            cx,
            cy - headRadiusY - 16,
        );
        ctx.quadraticCurveTo(
            cx + 15,
            cy - headRadiusY - 32,
            cx + 25,
            cy - headRadiusY + 6,
        );
        ctx.fillStyle = hairColor;
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
    } else if (hatStyle === 'beanie') {
        // 2. Вязаная шапка с помпоном
        // Купол
        ctx.beginPath();
        ctx.ellipse(
            cx,
            cy - 25,
            headRadiusX + 4,
            headRadiusY - 14,
            0,
            Math.PI,
            0,
        );
        ctx.fillStyle = '#3498db';
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // Отворот
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(
                cx - headRadiusX - 5,
                cy - 42,
                (headRadiusX + 5) * 2,
                24,
                6,
            );
        } else {
            ctx.rect(cx - headRadiusX - 5, cy - 42, (headRadiusX + 5) * 2, 24);
        }
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // Полоски вязки
        ctx.beginPath();
        ctx.lineWidth = 2;
        for (let x = cx - headRadiusX + 8; x < cx + headRadiusX; x += 16) {
            ctx.moveTo(x, cy - 42);
            ctx.lineTo(x, cy - 18);
        }
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.stroke();

        // Пушистый помпон
        const pompomY = cy - headRadiusY - 18;
        ctx.beginPath();
        ctx.arc(cx, pompomY, 17, 0, Math.PI * 2);
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.moveTo(cx - 10, pompomY - 8);
        ctx.lineTo(cx + 10, pompomY + 8);
        ctx.moveTo(cx + 10, pompomY - 8);
        ctx.lineTo(cx - 10, pompomY + 8);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.stroke();
    } else if (hatStyle === 'ushanka') {
        // === 3. НАСТОЯЩАЯ МЕДВЕЖЬЯ ШАПКА-УШАНКА РФ (МЕМНАЯ И АУТЕНТИЧНАЯ) ===
        const furColor = '#5e381e'; // Густой медвежий бурый мех
        const furDark = '#3d2210'; // Тень меха / контур
        const furLight = '#85542f'; // Светлый теплый подшерсток / меховой акцент
        const furInner = '#ab7145'; // Внутренняя часть медвежьих ушек
        const crownColor = '#3a2111'; // Плотный кожано-меховой купол шапки

        // 1. МЕДВЕЖЬИ КРУГЛЫЕ УШКИ СВЕРХУ (ДЛЯ НАСТОЯЩЕЙ МЕДВЕЖЬЕЙ МЕМНОСТИ)
        const bearEarOffsetX = 44;
        const bearEarY = cy - headRadiusY + 4;
        const bearEarRadius = 19;

        // Левое медвежье ушко
        ctx.beginPath();
        ctx.arc(cx - bearEarOffsetX, bearEarY, bearEarRadius, 0, Math.PI * 2);
        ctx.fillStyle = furColor;
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // Внутреннее светлое ушко медведя (левое)
        ctx.beginPath();
        ctx.arc(
            cx - bearEarOffsetX,
            bearEarY + 1,
            bearEarRadius * 0.55,
            0,
            Math.PI * 2,
        );
        ctx.fillStyle = furInner;
        ctx.fill();

        // Правое медвежье ушко
        ctx.beginPath();
        ctx.arc(cx + bearEarOffsetX, bearEarY, bearEarRadius, 0, Math.PI * 2);
        ctx.fillStyle = furColor;
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // Внутреннее светлое ушко медведя (правое)
        ctx.beginPath();
        ctx.arc(
            cx + bearEarOffsetX,
            bearEarY + 1,
            bearEarRadius * 0.55,
            0,
            Math.PI * 2,
        );
        ctx.fillStyle = furInner;
        ctx.fill();

        // Ворсинки меха на кончиках медвежьих ушек
        ctx.beginPath();
        ctx.strokeStyle = furDark;
        ctx.lineWidth = 2;
        ctx.moveTo(cx - bearEarOffsetX - 8, bearEarY - bearEarRadius + 2);
        ctx.lineTo(cx - bearEarOffsetX - 12, bearEarY - bearEarRadius - 3);
        ctx.moveTo(cx - bearEarOffsetX + 2, bearEarY - bearEarRadius + 1);
        ctx.lineTo(cx - bearEarOffsetX + 4, bearEarY - bearEarRadius - 4);
        ctx.moveTo(cx + bearEarOffsetX + 8, bearEarY - bearEarRadius + 2);
        ctx.lineTo(cx + bearEarOffsetX + 12, bearEarY - bearEarRadius - 3);
        ctx.moveTo(cx + bearEarOffsetX - 2, bearEarY - bearEarRadius + 1);
        ctx.lineTo(cx + bearEarOffsetX - 4, bearEarY - bearEarRadius - 4);
        ctx.stroke();

        // 2. БОКОВЫЕ МЕХОВЫЕ "УШИ" ШАПКИ-УШАНКИ (ОПУЩЕНЫ ВНИЗ, ПУШИСТЫЕ)
        const earFlapW = 28;
        const earFlapH = 76;
        const leftEarX = cx - headRadiusX - 12;
        const rightEarX = cx + headRadiusX - 16;
        const earFlapY = cy - 28;

        function drawUshankaFlap(x, y, w, h, isLeft) {
            ctx.save();
            // Внешний контур уха
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, y, w, h, [10, 10, 16, 16]);
            } else {
                ctx.rect(x, y, w, h);
            }
            ctx.fillStyle = furColor;
            ctx.fill();
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = '#000000';
            ctx.stroke();

            // Внутренний пушистый теплый подшерсток
            ctx.beginPath();
            const pad = 4;
            if (ctx.roundRect) {
                ctx.roundRect(
                    x + pad,
                    y + pad,
                    w - pad * 2,
                    h - pad * 2,
                    [6, 6, 12, 12],
                );
            } else {
                ctx.rect(x + pad, y + pad, w - pad * 2, h - pad * 2);
            }
            ctx.fillStyle = furLight;
            ctx.fill();

            // Пушистые ворсинки меха по внешнему ребру
            ctx.beginPath();
            ctx.strokeStyle = furDark;
            ctx.lineWidth = 2.2;
            const tuftDir = isLeft ? -1 : 1;
            const edgeX = isLeft ? x : x + w;
            for (let fy = y + 14; fy < y + h - 10; fy += 10) {
                ctx.moveTo(edgeX, fy);
                ctx.lineTo(edgeX + tuftDir * 6, fy + 4);
            }
            ctx.stroke();
            ctx.restore();
        }

        drawUshankaFlap(leftEarX, earFlapY, earFlapW, earFlapH, true);
        drawUshankaFlap(rightEarX, earFlapY, earFlapW, earFlapH, false);

        // 3. ЗАВЯЗКИ / ТЕСЁМКИ С ПУШИСТЫМИ БУБОНАМИ (СВИСАЮТ ВНИЗ)
        const cordStartY = earFlapY + earFlapH;
        const leftCordX = leftEarX + earFlapW / 2;
        ctx.beginPath();
        ctx.moveTo(leftCordX, cordStartY);
        ctx.bezierCurveTo(
            leftCordX - 6,
            cordStartY + 18,
            leftCordX + 8,
            cordStartY + 30,
            leftCordX - 3,
            cordStartY + 42,
        );
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#2b170a';
        ctx.stroke();

        // Левый помпон/бубон
        ctx.beginPath();
        ctx.arc(leftCordX - 3, cordStartY + 44, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = furLight;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        const rightCordX = rightEarX + earFlapW / 2;
        ctx.beginPath();
        ctx.moveTo(rightCordX, cordStartY);
        ctx.bezierCurveTo(
            rightCordX + 6,
            cordStartY + 18,
            rightCordX - 8,
            cordStartY + 30,
            rightCordX + 3,
            cordStartY + 42,
        );
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#2b170a';
        ctx.stroke();

        // Правый помпон/бубон
        ctx.beginPath();
        ctx.arc(rightCordX + 3, cordStartY + 44, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = furLight;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // 4. ОСНОВНОЙ КУПОЛ ШАПКИ (ТУЛЬЯ)
        ctx.beginPath();
        ctx.ellipse(
            cx,
            cy - 24,
            headRadiusX + 6,
            headRadiusY - 14,
            0,
            Math.PI,
            0,
        );
        ctx.fillStyle = crownColor;
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // Характерные клиновые швы на куполе ушанки
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.moveTo(cx, cy - headRadiusY + 12);
        ctx.lineTo(cx, cy - 44);
        ctx.moveTo(cx - 38, cy - headRadiusY + 28);
        ctx.quadraticCurveTo(cx - 22, cy - 54, cx - 18, cy - 44);
        ctx.moveTo(cx + 38, cy - headRadiusY + 28);
        ctx.quadraticCurveTo(cx + 22, cy - 54, cx + 18, cy - 44);
        ctx.stroke();

        // 5. ПЕРЕДНИЙ МЕХОВОЙ НАЛОБНИК (ОТВОРОТ)
        const visorW = 104;
        const visorH = 32;
        const visorX = cx - visorW / 2;
        const visorY = cy - 54;

        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(visorX, visorY, visorW, visorH, [12, 12, 6, 6]);
        } else {
            ctx.rect(visorX, visorY, visorW, visorH);
        }
        ctx.fillStyle = furColor;
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // Внутренний светлый мех отворота
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(
                visorX + 4,
                visorY + 4,
                visorW - 8,
                visorH - 8,
                [8, 8, 4, 4],
            );
        } else {
            ctx.rect(visorX + 4, visorY + 4, visorW - 8, visorH - 8);
        }
        ctx.fillStyle = furLight;
        ctx.fill();

        // Ворсинки меха по верхнему краю отворота
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 235, 205, 0.35)';
        ctx.lineWidth = 2;
        for (let fx = visorX + 12; fx < visorX + visorW - 10; fx += 14) {
            ctx.moveTo(fx, visorY + 4);
            ctx.lineTo(fx + 3, visorY + 10);
        }
        ctx.stroke();

        // 6. АУТЕНТИЧНАЯ АРМЕЙСКАЯ КОКАРДА РФ (ЗОЛОТОЙ ВЕНОК + КРАСНАЯ ЗВЕЗДА)
        const badgeCx = cx;
        const badgeCy = cy - 39;

        // Золотая рифленая основа кокарды
        ctx.beginPath();
        ctx.ellipse(badgeCx, badgeCy, 13, 15, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#b7950b';
        ctx.stroke();

        // Насечки-лучи по краю кокарды
        ctx.beginPath();
        ctx.strokeStyle = '#9a7d0a';
        ctx.lineWidth = 1.3;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            ctx.moveTo(
                badgeCx + Math.cos(angle) * 8.5,
                badgeCy + Math.sin(angle) * 10,
            );
            ctx.lineTo(
                badgeCx + Math.cos(angle) * 12.5,
                badgeCy + Math.sin(angle) * 14.5,
            );
        }
        ctx.stroke();

        // Настоящая пятиконечная красная рубиновая звезда РФ/СССР
        ctx.beginPath();
        const starOuterR = 8.5;
        const starInnerR = 3.6;
        const starPoints = 5;
        for (let i = 0; i < starPoints * 2; i++) {
            const r = i % 2 === 0 ? starOuterR : starInnerR;
            const a = (i * Math.PI) / starPoints - Math.PI / 2;
            const px = badgeCx + Math.cos(a) * r;
            const py = badgeCy + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = '#e74c3c';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#781207';
        ctx.stroke();

        // Золотая центральная заклепка
        ctx.beginPath();
        ctx.arc(badgeCx, badgeCy, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700';
        ctx.fill();
    } else if (hatStyle === 'cap') {
        // 4. Стильная кепка с козырьком
        ctx.beginPath();
        ctx.ellipse(
            cx,
            cy - 25,
            headRadiusX + 3,
            headRadiusY - 16,
            0,
            Math.PI,
            0,
        );
        ctx.fillStyle = '#e67e22';
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // Пуговица
        ctx.beginPath();
        ctx.arc(cx, cy - headRadiusY + 12, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#d35400';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // Козырек
        ctx.beginPath();
        ctx.moveTo(cx - 25, cy - 22);
        ctx.quadraticCurveTo(cx + 45, cy - 38, cx + headRadiusX + 34, cy - 12);
        ctx.quadraticCurveTo(cx + 42, cy - 6, cx - 12, cy - 18);
        ctx.closePath();
        ctx.fillStyle = '#d35400';
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
    } else if (hatStyle === 'bald') {
        // 5. Лысый персонаж с забавным бликом
        ctx.beginPath();
        ctx.ellipse(cx - 28, cy - 48, 12, 6, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fill();
    }

    // Розовые щечки
    ctx.fillStyle = 'rgba(255, 120, 120, 0.28)';
    ctx.beginPath();
    ctx.arc(cx - 48, cy + 4, 10, 0, Math.PI * 2);
    ctx.arc(cx + 48, cy + 4, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 5. БЕЙДЖ С ИМЕНЕМ
    if (nameTag) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        const badgeWidth = isMiniPreview ? 140 : 190;
        const badgeHeight = isMiniPreview ? 24 : 28;
        const badgeY = cy + 185;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(
                cx - badgeWidth / 2,
                badgeY,
                badgeWidth,
                badgeHeight,
                14,
            );
            ctx.fill();
        } else {
            ctx.fillRect(cx - badgeWidth / 2, badgeY, badgeWidth, badgeHeight);
        }
        ctx.fillStyle = '#ffffff';
        ctx.font =
            'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(nameTag, cx, badgeY + badgeHeight / 2);
    }

    // 6. ИНДИКАТОР МИКРОФОНА
    if (!isMiniPreview) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font =
            '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        if (isMuted) {
            ctx.fillStyle = 'rgba(242, 63, 67, 0.85)';
            ctx.fillText('🔇 Микрофон выкл (рот закрыт)', 16, 16);
        } else {
            ctx.fillStyle = 'rgba(35, 165, 90, 0.9)';
            const bars = Math.round(volumeLevel * 10);
            const dots = '■'.repeat(bars) + '□'.repeat(10 - bars);
            ctx.fillText(`🎙️ Голос: [${dots}]`, 16, 16);
        }
    }

    ctx.restore();
}

// === АУДИО АНАЛИЗАТОР РЕЧИ (WEB AUDIO API) ===
function setupAudioAnalyser(stream) {
    try {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtx) {
            audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (audioSource) {
            audioSource.disconnect();
        }
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 256;
        analyserNode.smoothingTimeConstant = 0.25;
        audioSource = audioCtx.createMediaStreamSource(stream);
        audioSource.connect(analyserNode);
        log('🎙️ Аудио-анализатор речи подключен к говорящему аватару');
    } catch (e) {
        log('⚠️ Ошибка аудио-анализатора: ' + e.message, 'warn');
    }
}

// === АУДИО АНАЛИЗАТОР УДАЛЕННОГО СОБЕСЕДНИКА (SPEAKING RING) ===
function setupRemoteAudioAnalysis(stream) {
    try {
        if (!stream || !stream.getAudioTracks().length) return;
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtxClass) return;
        if (!remoteAudioCtx) {
            remoteAudioCtx = new AudioCtxClass();
        }
        if (remoteAudioCtx.state === 'suspended') {
            remoteAudioCtx.resume();
        }
        const src = remoteAudioCtx.createMediaStreamSource(stream);
        remoteAudioAnalyser = remoteAudioCtx.createAnalyser();
        remoteAudioAnalyser.fftSize = 256;
        remoteAudioAnalyser.smoothingTimeConstant = 0.25;
        src.connect(remoteAudioAnalyser);

        function checkRemoteVolume() {
            if (
                !remoteAudioAnalyser ||
                !remoteVideo ||
                !remoteVideo.srcObject
            ) {
                if (remoteTile) remoteTile.classList.remove('speaking');
                return;
            }
            const data = new Uint8Array(remoteAudioAnalyser.frequencyBinCount);
            remoteAudioAnalyser.getByteFrequencyData(data);
            let sum = 0;
            const bins = Math.min(data.length, 35);
            for (let i = 0; i < bins; i++) sum += data[i];
            const avg = sum / bins;
            const isSpeaking = avg > 14;
            if (remoteTile) remoteTile.classList.toggle('speaking', isSpeaking);
            remoteAudioAnimFrame = requestAnimationFrame(checkRemoteVolume);
        }

        if (remoteAudioAnimFrame) cancelAnimationFrame(remoteAudioAnimFrame);
        checkRemoteVolume();
        log('🎙️ Аудио-анализатор удаленного собеседника подключен');
    } catch (e) {
        log('ℹ️ Удаленный аудио-анализ: ' + e.message, 'warn');
    }
}

// === ИНИЦИАЛИЗАЦИЯ CANVAS АВАТАРА ===
function initAvatarCanvas() {
    if (avatarCanvas) return;
    avatarCanvas = document.createElement('canvas');
    avatarCanvas.width = 640;
    avatarCanvas.height = 480;
    const ctx = avatarCanvas.getContext('2d');

    let blinkCounter = 0;
    let isBlinking = false;

    function renderLoop() {
        // Анализируем громкость микрофона
        let rawVol = 0;
        if (analyserNode && micEnabled) {
            const data = new Uint8Array(analyserNode.frequencyBinCount);
            analyserNode.getByteFrequencyData(data);
            let sum = 0;
            const bins = Math.min(data.length, 45);
            for (let i = 0; i < bins; i++) sum += data[i];
            const avg = sum / bins;
            if (avg > 14) {
                rawVol = Math.min(1.0, (avg - 14) / 36);
            }
        }
        smoothVolume += (rawVol - smoothVolume) * 0.45;

        // Мемное "шлепание" челюстью при звуках речи
        let targetOpen = smoothVolume;
        if (smoothVolume > 0.08) {
            const chatter = Math.sin(Date.now() / 40) * 0.28;
            targetOpen = Math.max(0.12, Math.min(1.0, smoothVolume + chatter));
        }
        avatarMouthOpen += (targetOpen - avatarMouthOpen) * 0.55;
        if (avatarMouthOpen < 0.03) avatarMouthOpen = 0;

        // Моргание глазками
        blinkCounter++;
        if (blinkCounter > 120 && Math.random() < 0.03) {
            isBlinking = true;
            blinkCounter = 0;
        } else if (isBlinking && blinkCounter > 6) {
            isBlinking = false;
        }

        // Фон
        ctx.fillStyle = '#1e1f22';
        ctx.fillRect(0, 0, avatarCanvas.width, avatarCanvas.height);

        // Обновляем зелёный контур говорящего (Speaking Ring) для локального тайла
        const isSpeakingLocally = micEnabled && smoothVolume > 0.08;
        if (localTile) {
            localTile.classList.toggle('speaking', isSpeakingLocally);
        }

        // Отрисовка персонажа
        drawCartoonCharacter(ctx, {
            cx: 320,
            cy: 230,
            mouthOpen: avatarMouthOpen,
            isBlinking: isBlinking,
            suitColor: avatarProfile.suitColor || '#5865f2',
            hairColor: '#3d2817',
            skinColor: '#fcdbbd',
            nameTag: avatarProfile.name
                ? `👤 ${avatarProfile.name}`
                : '👤 Вы (Аватар)',
            volumeLevel: smoothVolume,
            isMuted: !micEnabled,
            hatStyle: avatarProfile.hatStyle || 'tuft',
        });

        requestAnimationFrame(renderLoop);
    }

    renderLoop();
    avatarStream = avatarCanvas.captureStream(30);
    avatarTrack = avatarStream.getVideoTracks()[0];
}

function getAvatarTrack() {
    if (!avatarStream) {
        initAvatarCanvas();
    }
    return avatarTrack;
}

// === УПРАВЛЕНИЕ МЕДИА И УСТРОЙСТВАМИ ===
async function startMedia() {
    if (localStream) return localStream;
    try {
        log('🎙️ Запрос разрешений на доступ к микрофону и камере...');
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        // Настраиваем аудио-анализатор и холст говорящего аватара
        setupAudioAnalyser(localStream);
        initAvatarCanvas();

        // По умолчанию микрофон и камера выключены
        const audioTrack = localStream.getAudioTracks()[0];
        const videoTrack = localStream.getVideoTracks()[0];
        if (audioTrack) audioTrack.enabled = micEnabled;
        if (videoTrack) videoTrack.enabled = camEnabled;

        // В превью и в звонке: если камера выключена, показываем поток говорящего аватара
        if (previewVideo) {
            previewVideo.srcObject = camEnabled ? localStream : avatarStream;
            previewVideo.style.transform = camEnabled ? 'scaleX(-1)' : 'none';
        }
        if (localVideo) {
            localVideo.srcObject = camEnabled ? localStream : avatarStream;
            localVideo.style.transform = camEnabled ? 'scaleX(-1)' : 'none';
        }

        updateMediaUI();
        log('✅ Доступ к медиа-устройствам получен (аватар активен)');
        return localStream;
    } catch (err) {
        log(
            '⚠️ Ошибка видео/аудио: ' +
                err.message +
                '. Пробуем только аудио...',
            'warn',
        );
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            });
            setupAudioAnalyser(localStream);
            initAvatarCanvas();

            if (previewVideo) {
                previewVideo.srcObject = avatarStream;
                previewVideo.style.transform = 'none';
            }
            if (localVideo) {
                localVideo.srcObject = avatarStream;
                localVideo.style.transform = 'none';
            }
            updateMediaUI();
            return localStream;
        } catch (audioErr) {
            log('❌ Доступ к микрофону отклонен: ' + audioErr.message, 'error');
            alert(
                'Не удалось получить доступ к микрофону: ' + audioErr.message,
            );
            throw audioErr;
        }
    }
}

function updateMediaUI() {
    // Превью контролы
    if (previewMicBtn) {
        previewMicBtn.classList.toggle('off', !micEnabled);
        previewMicBtn.classList.toggle('active', micEnabled);
        previewMicBtn.querySelector('.icon-on').style.display = micEnabled
            ? 'block'
            : 'none';
        previewMicBtn.querySelector('.icon-off').style.display = micEnabled
            ? 'none'
            : 'block';
    }
    if (previewCamBtn) {
        previewCamBtn.classList.toggle('off', !camEnabled);
        previewCamBtn.classList.toggle('active', camEnabled);
        previewCamBtn.querySelector('.icon-on').style.display = camEnabled
            ? 'block'
            : 'none';
        previewCamBtn.querySelector('.icon-off').style.display = camEnabled
            ? 'none'
            : 'block';
    }

    // Заглушка аватара не нужна, так как canvas сам транслирует персонажа
    if (previewAvatar) {
        previewAvatar.style.display = 'none';
    }

    // Контролы активного звонка
    if (micBtn) {
        micBtn.classList.toggle('off', !micEnabled);
        micBtn.classList.toggle('active', micEnabled);
        micBtn.querySelector('.icon-on').style.display = micEnabled
            ? 'block'
            : 'none';
        micBtn.querySelector('.icon-off').style.display = micEnabled
            ? 'none'
            : 'block';
    }
    if (camBtn) {
        camBtn.classList.toggle('off', !camEnabled);
        camBtn.classList.toggle('active', camEnabled);
        camBtn.querySelector('.icon-on').style.display = camEnabled
            ? 'block'
            : 'none';
        camBtn.querySelector('.icon-off').style.display = camEnabled
            ? 'none'
            : 'block';
    }

    if (localAvatar) {
        localAvatar.style.display = 'none';
    }
}

async function toggleMic() {
    if (!localStream) {
        await startMedia();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
    micEnabled = !micEnabled;
    const track = localStream.getAudioTracks()[0];
    if (track) track.enabled = micEnabled;
    updateMediaUI();
    log(
        micEnabled
            ? '🎙️ Микрофон включен (аватар говорит в такт голосу)'
            : '🔇 Микрофон выключен (аватар молчит)',
    );
}

async function toggleCam() {
    if (!localStream) {
        await startMedia();
    }
    camEnabled = !camEnabled;
    const realVideoTrack = localStream.getVideoTracks()[0];
    if (realVideoTrack) realVideoTrack.enabled = camEnabled;

    const trackToSend =
        camEnabled && realVideoTrack ? realVideoTrack : getAvatarTrack();

    // Заменяем видео-трек для собеседника через WebRTC
    if (pc) {
        const sender = pc
            .getSenders()
            .find((s) => s.track && s.track.kind === 'video');
        if (sender && trackToSend) {
            await sender.replaceTrack(trackToSend);
            log(
                camEnabled
                    ? '📷 Собеседник видит реальную веб-камеру'
                    : '🎭 Собеседник видит говорящий аватар',
            );
        }
    }

    // Локальное отображение
    if (localVideo) {
        localVideo.srcObject =
            camEnabled && realVideoTrack ? localStream : avatarStream;
        localVideo.style.transform =
            camEnabled && realVideoTrack ? 'scaleX(-1)' : 'none';
    }
    if (previewVideo) {
        previewVideo.srcObject =
            camEnabled && realVideoTrack ? localStream : avatarStream;
        previewVideo.style.transform =
            camEnabled && realVideoTrack ? 'scaleX(-1)' : 'none';
    }

    updateMediaUI();
    log(
        camEnabled
            ? '📷 Камера включена'
            : '📷 Камера выключена (включен говорящий аватар)',
    );
}

// Демонстрация экрана (Screen Share)
async function toggleScreenShare() {
    if (isScreenSharing) {
        stopScreenShare();
        return;
    }

    try {
        log('🖥️ Запрос на демонстрацию экрана...');
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always' },
            audio: false,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) return;

        // Если активен WebRTC звонок — передаем видеопоток экрана собеседнику
        if (pc) {
            const sender = pc
                .getSenders()
                .find((s) => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(screenTrack);
                log('📤 Видеопоток экрана передается собеседнику');
            }
        }

        // Локальное отображение: показываем экран без зеркального отражения
        if (localVideo) {
            localVideo.srcObject = screenStream;
            localVideo.style.transform = 'none';
        }

        // Автоматически разворачиваем экран на главное окно (как в Google Meet)
        setMainParticipant('local');

        isScreenSharing = true;
        screenShareBtn.classList.add('active');
        screenShareBtn.title = 'Остановить демонстрацию экрана (S)';
        log('🖥️ Демонстрация экрана запущена');

        // Обработка кнопки "Остановить доступ" в системной панели браузера
        screenTrack.onended = () => {
            stopScreenShare();
        };
    } catch (err) {
        if (err.name !== 'AbortError') {
            log('⚠️ Ошибка демонстрации экрана: ' + err.message, 'warn');
        }
    }
}

async function stopScreenShare() {
    if (!isScreenSharing) return;

    if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        screenStream = null;
    }

    isScreenSharing = false;
    screenShareBtn.classList.remove('active');
    screenShareBtn.title = 'Демонстрация экрана (S)';

    // Восстанавливаем трек для собеседника (камеру или аватар)
    const restoreTrack =
        camEnabled && localStream && localStream.getVideoTracks()[0]
            ? localStream.getVideoTracks()[0]
            : getAvatarTrack();

    if (pc && restoreTrack) {
        const sender = pc
            .getSenders()
            .find((s) => s.track && s.track.kind === 'video');
        if (sender) {
            await sender.replaceTrack(restoreTrack);
        }
    }

    // Восстанавливаем локальное отображение
    if (localVideo) {
        const realVideo =
            camEnabled && localStream && localStream.getVideoTracks()[0];
        localVideo.srcObject = realVideo ? localStream : avatarStream;
        localVideo.style.transform = realVideo ? 'scaleX(-1)' : 'none';
    }

    // Возвращаем собеседника на главный экран
    setMainParticipant('remote');

    log('🖥️ Демонстрация экрана остановлена');
}

// === ТАЙМЕР ЗВОНКА ===
function startCallTimer() {
    callStartTime = Date.now();
    callTimer.style.display = 'inline-block';
    callTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        callTimer.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    callTimer.textContent = '00:00';
    callTimer.style.display = 'none';
}

// === ИНИЦИАЛИЗАЦИЯ WEBRTC PEER CONNECTION ===
function initPeer() {
    if (pc) return;
    log('🔧 Создание RTCPeerConnection...');
    pc = new RTCPeerConnection(configuration);

    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) pc.addTrack(audioTrack, localStream);

        const realVideoTrack = localStream.getVideoTracks()[0];
        const videoTrack =
            camEnabled && realVideoTrack ? realVideoTrack : getAvatarTrack();
        if (videoTrack) {
            pc.addTrack(videoTrack, avatarStream || localStream);
        }
    }

    // P2P DataChannel для текстового чата
    if (currentRole === 'caller') {
        try {
            log('💬 Создание RTCDataChannel "chat"...');
            const dc = pc.createDataChannel('chat', { ordered: true });
            setupDataChannel(dc);
        } catch (e) {
            log('⚠️ Ошибка создания DataChannel: ' + e.message, 'warn');
        }
    }

    pc.ondatachannel = (event) => {
        log('💬 Входящий RTCDataChannel: ' + event.channel.label);
        setupDataChannel(event.channel);
    };

    let firstHostAdded = false;
    let iceReady = false;
    let srflxReceived = false;

    function unlockCopyButton(reason) {
        if (iceReady) return;
        iceReady = true;
        log(`✅ ICE готов (${reason})`);

        if (pc.localDescription) {
            rawLocalJson = JSON.stringify(pc.localDescription);
            devLocalSdp.value = rawLocalJson;

            compressAndEncode(rawLocalJson)
                .then((compressed) => {
                    const ratio = Math.round(
                        (compressed.length / rawLocalJson.length) * 100,
                    );
                    metricCompression.textContent = `${rawLocalJson.length}B → ${compressed.length}B (${ratio}%)`;
                    log(
                        `📦 Код сжат: ${rawLocalJson.length} → ${compressed.length} символов (-${100 - ratio}%)`,
                    );

                    if (currentRole === 'caller') {
                        callerLocalToken.value = compressed;
                        copyCallerTokenBtn.disabled = false;
                        shareCallerTokenBtn.disabled = false;
                        callerStep2.classList.remove('disabled');
                        callerStep3.classList.remove('disabled');
                        updateAppStatus(
                            'Код звонка готов, отправьте другу',
                            'waiting',
                        );
                    } else {
                        answererLocalToken.value = compressed;
                        copyAnswererTokenBtn.disabled = false;
                        shareAnswererTokenBtn.disabled = false;
                        answererStep2.classList.remove('disabled');
                        updateAppStatus(
                            'Ответный код готов, отправьте звонящему',
                            'waiting',
                        );
                    }
                })
                .catch((err) => {
                    log(
                        '⚠️ Ошибка сжатия, используем raw SDP: ' + err.message,
                        'warn',
                    );
                    const token = rawLocalJson;
                    if (currentRole === 'caller') {
                        callerLocalToken.value = token;
                        copyCallerTokenBtn.disabled = false;
                        callerStep2.classList.remove('disabled');
                    } else {
                        answererLocalToken.value = token;
                        copyAnswererTokenBtn.disabled = false;
                        answererStep2.classList.remove('disabled');
                    }
                });
        }
    }

    pc.onicecandidate = (event) => {
        if (event.candidate === null) {
            unlockCopyButton('сбор завершен');
        } else {
            const candidate = event.candidate;
            const address = candidate.address || '';

            // Фильтрация IPv6 для минимизации размера токена
            if (address.includes(':')) {
                log(`🚫 Пропуск IPv6: ${address}`, 'ice');
                return;
            }

            // Оставляем только первый host
            if (candidate.type === 'host') {
                if (!firstHostAdded) {
                    firstHostAdded = true;
                } else {
                    log(`🚫 Пропуск дополнительного host`, 'ice');
                    return;
                }
            }

            log(
                `🌐 Добавлен ICE: ${candidate.type} | ${address}:${candidate.port}`,
                'ice',
            );

            if (candidate.type === 'srflx' && !srflxReceived) {
                srflxReceived = true;
                setTimeout(() => unlockCopyButton('получен srflx'), 1000);
            }
        }
        updateDevMetrics();
    };

    // Таймаут на сбор кандидатов 5 сек
    setTimeout(() => unlockCopyButton('таймаут 5 сек'), 5000);

    // Обработка состояния соединения
    pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        log(`🔌 ICE State: ${state}`);
        updateDevMetrics();

        if (state === 'connected' || state === 'completed') {
            updateAppStatus('В звонке', 'connected');
            reconnectBanner.style.display = 'none';

            // Переключение на экран активного звонка
            lobbyView.style.display = 'none';
            callStageView.style.display = 'flex';
            startCallTimer();
        } else if (state === 'disconnected') {
            updateAppStatus('Нестабильная связь...', 'waiting');
            reconnectBanner.style.display = 'flex';
            reconnectDesc.textContent =
                'Связь нестабильна, пробуем восстановить...';
            setTimeout(() => {
                if (pc && pc.iceConnectionState === 'disconnected') {
                    log(
                        '⚠️ Связь не восстановилась. Запуск ICE Restart...',
                        'warn',
                    );
                    attemptAutoReconnect();
                }
            }, reconnectTimeout);
        } else if (state === 'failed') {
            updateAppStatus('Связь разорвана', 'failed');
            reconnectBanner.style.display = 'flex';
            reconnectDesc.textContent =
                'Соединение прервано. Попытка автоматического восстановления...';
            attemptAutoReconnect();
        }
    };

    pc.onsignalingstatechange = () => {
        log(`📡 Signaling State: ${pc.signalingState}`);
        updateDevMetrics();
    };

    pc.onicegatheringstatechange = () => {
        log(`🧊 Gathering State: ${pc.iceGatheringState}`);
        updateDevMetrics();
    };

    pc.ontrack = (event) => {
        log('📥 Получен медиа-поток от собеседника');
        if (remoteVideo && remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            remoteVideo.play().catch((err) => {
                if (err.name !== 'AbortError')
                    log('Ошибка воспроизведения: ' + err.message, 'error');
            });
            // Скрываем заглушку аватара
            if (remoteAvatar) remoteAvatar.style.display = 'none';

            // Настраиваем Speaking Ring для собеседника
            setupRemoteAudioAnalysis(event.streams[0]);
        }
    };
}

// === АВТОМАТИЧЕСКОЕ ВОССТАНОВЛЕНИЕ (ICE RESTART) ===
async function attemptAutoReconnect() {
    if (!pc) return;
    log('🔄 Перезапуск ICE...');
    updateAppStatus('Восстановление...', 'waiting');

    try {
        pc.restartIce();

        let restored = false;
        const checkInterval = setInterval(() => {
            if (pc && pc.iceConnectionState === 'connected') {
                restored = true;
                clearInterval(checkInterval);
                log('✅ Связь восстановлена автоматически!');
                updateAppStatus('В звонке', 'connected');
                reconnectBanner.style.display = 'none';
            }
        }, 500);

        setTimeout(() => {
            clearInterval(checkInterval);
            if (!restored && pc) {
                log(
                    '❌ Авто-восстановление не удалось. Требуется обмен новым кодом.',
                    'error',
                );
                updateAppStatus('Сеть изменилась', 'failed');
                showReconnectBanner();
            }
        }, 10000);
    } catch (err) {
        log('❌ Ошибка перезапуска ICE: ' + err.message, 'error');
        showReconnectBanner();
    }
}

function showReconnectBanner() {
    reconnectBanner.style.display = 'flex';
    reconnectDesc.textContent =
        'Сеть изменилась. Сгенерируйте и отправьте новый код звонка.';
    shareNewCodeBtn.style.display = 'inline-flex';
}

// === ОБРАБОТЧИКИ СОБЫТИЙ: ТАБЫ РОЛЕЙ ===
tabCallerBtn.addEventListener('click', () => {
    currentRole = 'caller';
    tabCallerBtn.classList.add('active');
    tabAnswererBtn.classList.remove('active');
    callerPanel.classList.add('active');
    answererPanel.classList.remove('active');
});

tabAnswererBtn.addEventListener('click', () => {
    currentRole = 'answerer';
    tabAnswererBtn.classList.add('active');
    tabCallerBtn.classList.remove('active');
    answererPanel.classList.add('active');
    callerPanel.classList.remove('active');
});

// === СЦЕНАРИЙ 1: Я ЗВОНЮ (CALLER) ===
createCallBtn.addEventListener('click', async () => {
    log('🔘 Нажато: Создать вызов');
    createCallBtn.disabled = true;
    createCallBtn.innerHTML = '⏳ Создаем вызов...';
    try {
        await startMedia();
        initPeer();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        updateAppStatus('Сбор маршрутов связи...', 'waiting');
        createCallBtn.innerHTML = '✅ Вызов создан';
    } catch (err) {
        log('❌ Ошибка создания вызова: ' + err.message, 'error');
        createCallBtn.disabled = false;
        createCallBtn.innerHTML = 'Сгенерировать код звонка';
    }
});

// Скопировать код звонящего
copyCallerTokenBtn.addEventListener('click', async () => {
    const token = callerLocalToken.value;
    if (!token) return;
    try {
        await navigator.clipboard.writeText(token);
        const label = copyCallerTokenBtn.querySelector('.btn-label');
        label.textContent = '✅ Скопировано!';
        setTimeout(() => {
            label.textContent = 'Скопировать код';
        }, 2000);
    } catch (err) {
        log('❌ Ошибка буфера: ' + err.message, 'error');
        callerLocalToken.select();
    }
});

// Поделиться кодом звонящего
shareCallerTokenBtn.addEventListener('click', async () => {
    const token = callerLocalToken.value;
    if (!token) return;
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'P2P Видеозвонок',
                text:
                    'Присоединяйся к видеозвонку! Вставь этот код:\n\n' + token,
            });
            log('📤 Код отправлен через меню "Поделиться"');
        } catch (err) {
            if (err.name !== 'AbortError') {
                await navigator.clipboard.writeText(token);
                alert('✅ Код звонка скопирован! Отправьте его собеседнику.');
            }
        }
    } else {
        await navigator.clipboard.writeText(token);
        alert('✅ Код звонка скопирован! Отправьте его собеседнику.');
    }
});

// Вставить ответный код от друга
pasteCallerAnswerBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            callerRemoteToken.value = text.trim();
            log('📋 Ответный код вставлен из буфера');
        }
    } catch (err) {
        alert('Пожалуйста, вставьте ответный код вручную в текстовое поле.');
    }
});

// Начать разговор (Caller Connect)
callerConnectBtn.addEventListener('click', async () => {
    log('🔘 Нажато: Начать разговор');
    const remoteToken = callerRemoteToken.value.trim();
    if (!remoteToken) {
        alert('Вставьте ответный код, полученный от собеседника!');
        return;
    }
    if (!pc) {
        alert('Сначала сгенерируйте код звонка!');
        return;
    }

    try {
        const validSdp = await getValidSdp(remoteToken);
        rawRemoteJson = validSdp;
        devRemoteSdp.value = validSdp;

        if (!pc.remoteDescription) {
            await pc.setRemoteDescription(
                new RTCSessionDescription(JSON.parse(validSdp)),
            );
            updateAppStatus('Установка прямого P2P канала...', 'waiting');
            callerConnectBtn.innerHTML = '⏳ Соединяем...';
            callerConnectBtn.disabled = true;
        }
    } catch (err) {
        log('❌ Ошибка подключения: ' + err.message, 'error');
        alert('Ошибка кода: ' + err.message);
    }
});

// === СЦЕНАРИЙ 2: МНЕ ЗВОНЯТ (ANSWERER) ===
pasteAnswererOfferBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            answererRemoteToken.value = text.trim();
            log('📋 Код звонка вставлен из буфера');
        }
    } catch (err) {
        alert('Пожалуйста, вставьте код вызова вручную в текстовое поле.');
    }
});

answerCallBtn.addEventListener('click', async () => {
    log('🔘 Нажато: Принять звонок');
    const remoteToken = answererRemoteToken.value.trim();
    if (!remoteToken) {
        alert('Сначала вставьте код звонка от друга!');
        return;
    }

    answerCallBtn.disabled = true;
    answerCallBtn.innerHTML = '⏳ Принимаем...';

    try {
        await startMedia();
        initPeer();
        const validSdp = await getValidSdp(remoteToken);
        rawRemoteJson = validSdp;
        devRemoteSdp.value = validSdp;

        await pc.setRemoteDescription(
            new RTCSessionDescription(JSON.parse(validSdp)),
        );
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        updateAppStatus('Генерация ответного кода...', 'waiting');
        answerCallBtn.innerHTML = '✅ Звонок принят';
    } catch (err) {
        log('❌ Ошибка принятия звонка: ' + err.message, 'error');
        alert('Ошибка: ' + err.message);
        answerCallBtn.disabled = false;
        answerCallBtn.innerHTML = '✅ Принять звонок';
    }
});

// Скопировать ответ принимающего
copyAnswererTokenBtn.addEventListener('click', async () => {
    const token = answererLocalToken.value;
    if (!token) return;
    try {
        await navigator.clipboard.writeText(token);
        const label = copyAnswererTokenBtn.querySelector('.btn-label');
        label.textContent = '✅ Скопировано!';
        setTimeout(() => {
            label.textContent = 'Скопировать ответ';
        }, 2000);
    } catch (err) {
        answererLocalToken.select();
    }
});

shareAnswererTokenBtn.addEventListener('click', async () => {
    const token = answererLocalToken.value;
    if (!token) return;
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Ответный код P2P',
                text:
                    'Вот мой ответный код, вставь его и разговор начнется:\n\n' +
                    token,
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                await navigator.clipboard.writeText(token);
                alert('✅ Ответный код скопирован! Отправьте его звонящему.');
            }
        }
    } else {
        await navigator.clipboard.writeText(token);
        alert('✅ Ответный код скопирован! Отправьте его звонящему.');
    }
});

// === ЛОГИКА P2P ТЕКСТОВОГО ЧАТА И ФАЙЛОВ (DATA CHANNEL) ===
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(filename) {
    if (!filename) return '📄';
    const ext = filename.split('.').pop().toLowerCase();
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
    if (['pdf'].includes(ext)) return '📕';
    if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return '📄';
    if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return '🎵';
    if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext)) return '🎬';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
    if (['js', 'ts', 'html', 'css', 'json', 'py', 'cs'].includes(ext))
        return '💻';
    return '📁';
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

function setupDataChannel(dc) {
    dataChannel = dc;
    dc.onopen = () => {
        log('💬 P2P Чат и передача файлов подключены!');
        if (chatInput)
            chatInput.placeholder = 'Сообщение или Ctrl+V для картинки...';
        // Передаем свой гардероб аватара собеседнику
        try {
            dc.send(
                JSON.stringify({
                    type: 'avatar_profile',
                    profile: avatarProfile,
                }),
            );
        } catch (e) {}
    };
    dc.onclose = () => {
        log('💬 P2P Чат закрыт');
        if (chatInput) chatInput.placeholder = 'Чат отключен';
    };
    dc.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'file_start') {
                log(
                    `📥 Начало приёма P2P файла: ${msg.name} (${formatFileSize(msg.size)})`,
                );
                receivingFiles.set(msg.fileId, {
                    meta: msg,
                    chunks: new Array(msg.totalChunks),
                    receivedChunks: 0,
                });

                appendChatMessage({
                    sender: 'remote',
                    senderName: 'Собеседник',
                    time: msg.time,
                    fileData: {
                        fileId: msg.fileId,
                        name: msg.name,
                        size: msg.size,
                        inProgress: true,
                    },
                });
            } else if (msg.type === 'file_chunk') {
                const fileObj = receivingFiles.get(msg.fileId);
                if (fileObj) {
                    fileObj.chunks[msg.chunkIndex] = base64ToArrayBuffer(
                        msg.data,
                    );
                    fileObj.receivedChunks++;

                    const pct = Math.round(
                        (fileObj.receivedChunks / fileObj.meta.totalChunks) *
                            100,
                    );
                    const progEl = document.getElementById(
                        `prog_${msg.fileId}`,
                    );
                    if (progEl) {
                        progEl.textContent = `Приём: ${pct}%`;
                    }
                }
            } else if (msg.type === 'file_end') {
                const fileObj = receivingFiles.get(msg.fileId);
                if (fileObj) {
                    log(
                        `✅ Файл "${fileObj.meta.name}" полностью получен по P2P!`,
                    );
                    const blob = new Blob(fileObj.chunks, {
                        type: fileObj.meta.mimeType,
                    });
                    const blobUrl = URL.createObjectURL(blob);

                    const cardEl = document.getElementById(
                        `card_${msg.fileId}`,
                    );
                    if (cardEl && cardEl.parentElement) {
                        const bubble = cardEl.parentElement;
                        bubble.innerHTML = '';

                        if (fileObj.meta.isInlineImage) {
                            const img = document.createElement('img');
                            img.className = 'chat-inline-img';
                            img.src = blobUrl;
                            img.alt = fileObj.meta.name;
                            img.title =
                                'Нажмите, чтобы открыть изображение в новой вкладке';
                            img.addEventListener('click', () => {
                                window.open(blobUrl, '_blank');
                            });
                            bubble.appendChild(img);
                        } else {
                            const fileCard = document.createElement('div');
                            fileCard.className = 'file-card';
                            fileCard.innerHTML = `
                                <span class="file-card-icon">${getFileIcon(fileObj.meta.name)}</span>
                                <div class="file-card-meta">
                                    <span class="file-card-name" title="${fileObj.meta.name}">${fileObj.meta.name}</span>
                                    <span class="file-card-size">${formatFileSize(fileObj.meta.size)}</span>
                                </div>
                                <a href="${blobUrl}" download="${fileObj.meta.name}" class="file-download-btn">⬇️ Скачать</a>
                            `;
                            bubble.appendChild(fileCard);
                        }
                    }

                    receivingFiles.delete(msg.fileId);
                }
            } else if (msg.type === 'reaction') {
                triggerFloatingReaction(msg.emoji, true);
            } else if (msg.type === 'sound') {
                playSound(msg.soundId, true);
            } else if (msg.type === 'wb_draw') {
                handleRemoteWbDraw(msg);
            } else if (msg.type === 'wb_clear') {
                handleRemoteWbClear();
            } else if (msg.type === 'avatar_profile') {
                remoteAvatarProfile = msg.profile;
                log(
                    `🎭 Получен аватар собеседника: ${msg.profile?.name || 'Собеседник'}`,
                );
            } else {
                // Обычное текстовое сообщение
                appendChatMessage({
                    sender: 'remote',
                    senderName: 'Собеседник',
                    text: msg.text,
                    time:
                        msg.time ||
                        new Date().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        }),
                });
            }
        } catch (err) {
            log('⚠️ Ошибка обработки сообщения чата: ' + err.message, 'warn');
        }
    };
}

function appendChatMessage({
    sender,
    senderName,
    text,
    time,
    isInlineImage,
    fileData,
}) {
    if (!chatMessages) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${sender}`;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'msg-header';

    const authorSpan = document.createElement('span');
    authorSpan.className = 'msg-author';
    authorSpan.textContent = senderName;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'msg-time';
    timeSpan.textContent = time;

    headerDiv.appendChild(authorSpan);
    headerDiv.appendChild(timeSpan);

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'msg-bubble';

    if (text) {
        const textSpan = document.createElement('div');
        textSpan.textContent = text;
        bubbleDiv.appendChild(textSpan);
    }

    if (isInlineImage && fileData && fileData.url) {
        const img = document.createElement('img');
        img.className = 'chat-inline-img';
        img.src = fileData.url;
        img.alt = fileData.name || 'Изображение';
        img.title = 'Нажмите, чтобы открыть изображение в новой вкладке';
        img.addEventListener('click', () => {
            window.open(fileData.url, '_blank');
        });
        bubbleDiv.appendChild(img);
    } else if (fileData && fileData.url) {
        const fileCard = document.createElement('div');
        fileCard.className = 'file-card';
        fileCard.innerHTML = `
            <span class="file-card-icon">${getFileIcon(fileData.name)}</span>
            <div class="file-card-meta">
                <span class="file-card-name" title="${fileData.name}">${fileData.name}</span>
                <span class="file-card-size">${formatFileSize(fileData.size)}</span>
            </div>
            <a href="${fileData.url}" download="${fileData.name}" class="file-download-btn">⬇️ Скачать</a>
        `;
        bubbleDiv.appendChild(fileCard);
    } else if (fileData && fileData.inProgress) {
        const progressCard = document.createElement('div');
        progressCard.className = 'file-card';
        progressCard.id = `card_${fileData.fileId}`;
        progressCard.innerHTML = `
            <span class="file-card-icon">⏳</span>
            <div class="file-card-meta">
                <span class="file-card-name">${fileData.name}</span>
                <span class="file-card-size file-progress" id="prog_${fileData.fileId}">Приём: 0%</span>
            </div>
        `;
        bubbleDiv.appendChild(progressCard);
    }

    msgDiv.appendChild(headerDiv);
    msgDiv.appendChild(bubbleDiv);

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Уведомление на кнопке чата при новом входящем сообщении
    if (sender === 'remote' && !isChatOpen) {
        unreadMessagesCount++;
        if (chatBadge) {
            chatBadge.textContent = unreadMessagesCount;
            chatBadge.style.display = 'flex';
        }
    }
}

async function sendFile(fileOrBlob, options = {}) {
    const isInlineImage = !!options.isInlineImage;
    const fileName =
        fileOrBlob.name ||
        (isInlineImage ? `image_${Date.now()}.png` : `file_${Date.now()}`);
    const fileSize = fileOrBlob.size;
    const mimeType =
        fileOrBlob.type ||
        (isInlineImage ? 'image/png' : 'application/octet-stream');
    const fileId =
        'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    // Создаем локальный URL для отображения у себя
    const localUrl = URL.createObjectURL(fileOrBlob);

    // Добавляем сообщение в локальный чат
    appendChatMessage({
        sender: 'local',
        senderName: 'Вы',
        time: timeStr,
        isInlineImage: isInlineImage,
        fileData: {
            name: fileName,
            size: fileSize,
            url: localUrl,
        },
    });

    const buffer = await fileOrBlob.arrayBuffer();

    // Если активен P2P канал связи
    if (dataChannel && dataChannel.readyState === 'open') {
        try {
            const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
            log(
                `📤 Отправка P2P файла: ${fileName} (${formatFileSize(fileSize)}, ${totalChunks} чанков)`,
            );

            // 1. Метаданные файла
            dataChannel.send(
                JSON.stringify({
                    type: 'file_start',
                    fileId: fileId,
                    name: fileName,
                    size: fileSize,
                    mimeType: mimeType,
                    isInlineImage: isInlineImage,
                    totalChunks: totalChunks,
                    time: timeStr,
                }),
            );

            // 2. Отправка кусочков
            let offset = 0;
            let chunkIndex = 0;
            while (offset < buffer.byteLength) {
                const slice = buffer.slice(offset, offset + CHUNK_SIZE);
                const b64 = arrayBufferToBase64(slice);

                dataChannel.send(
                    JSON.stringify({
                        type: 'file_chunk',
                        fileId: fileId,
                        chunkIndex: chunkIndex,
                        data: b64,
                    }),
                );

                offset += CHUNK_SIZE;
                chunkIndex++;

                // Микро-пауза для предотвращения переполнения буфера SCTP
                if (chunkIndex % 8 === 0) {
                    await new Promise((r) => setTimeout(r, 5));
                }
            }

            // 3. Завершение передачи
            dataChannel.send(
                JSON.stringify({
                    type: 'file_end',
                    fileId: fileId,
                }),
            );

            log(`✅ Файл "${fileName}" успешно отправлен собеседнику по P2P!`);
        } catch (err) {
            log('❌ Ошибка отправки файла: ' + err.message, 'error');
        }
    }
}

function toggleChat() {
    isChatOpen = !isChatOpen;
    if (chatPanel) chatPanel.classList.toggle('open', isChatOpen);
    if (chatToggleBtn) chatToggleBtn.classList.toggle('active', isChatOpen);

    if (isChatOpen) {
        unreadMessagesCount = 0;
        if (chatBadge) chatBadge.style.display = 'none';
        if (chatInput) setTimeout(() => chatInput.focus(), 100);
    }
}

// === ЗАВЕРШЕНИЕ ЗВОНКА (LEAVE / RESET) ===
function resetCall() {
    log('🔴 Завершение вызова и сброс состояния...');
    stopCallTimer();
    stopScreenShare();

    if (pc) {
        pc.close();
        pc = null;
    }

    if (dataChannel) {
        try {
            dataChannel.close();
        } catch (e) {}
        dataChannel = null;
    }

    receivingFiles.clear();

    // Сброс состояния чата
    unreadMessagesCount = 0;
    if (chatBadge) chatBadge.style.display = 'none';
    if (chatPanel) chatPanel.classList.remove('open');
    if (chatToggleBtn) chatToggleBtn.classList.remove('active');
    isChatOpen = false;
    if (chatMessages) {
        chatMessages.innerHTML = `
            <div class="chat-system-notice">
                🔒 Прямое P2P соединение установлено. Сообщения передаются напрямую без сервера.
            </div>
        `;
    }

    // Очистка Speaking Ring и удаленного аудио
    if (remoteAudioAnimFrame) cancelAnimationFrame(remoteAudioAnimFrame);
    remoteAudioAnalyser = null;
    if (remoteTile) remoteTile.classList.remove('speaking');
    if (localTile) localTile.classList.remove('speaking');

    // Закрытие панелей реакций и доски
    if (reactionsPicker) reactionsPicker.style.display = 'none';

    if (whiteboardOverlay) {
        whiteboardOverlay.style.display = 'none';
        isWhiteboardOpen = false;
        if (whiteboardBtn) whiteboardBtn.classList.remove('active');
    }

    // Сброс закрепления главного экрана Google Meet
    setMainParticipant('remote');

    // Очистка полей токенов
    callerLocalToken.value = '';
    callerRemoteToken.value = '';
    answererLocalToken.value = '';
    answererRemoteToken.value = '';

    callerStep2.classList.add('disabled');
    callerStep3.classList.add('disabled');
    answererStep2.classList.add('disabled');

    createCallBtn.disabled = false;
    createCallBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
        <span>Сгенерировать код звонка</span>
    `;

    callerConnectBtn.disabled = false;
    callerConnectBtn.innerHTML = '🚀 Начать разговор';

    answerCallBtn.disabled = false;
    answerCallBtn.innerHTML = '✅ Принять звонок';

    reconnectBanner.style.display = 'none';
    updateAppStatus('Ожидание звонка', 'waiting');
    updateDevMetrics();

    // Возврат в лобби
    callStageView.style.display = 'none';
    lobbyView.style.display = 'block';
}

leaveCallBtn.addEventListener('click', () => {
    if (confirm('Вы уверены, что хотите завершить звонок?')) {
        resetCall();
    }
});

reconnectActionBtn.addEventListener('click', () => {
    resetCall();
});

// === УПРАВЛЕНИЕ МЕДИА КНОПКАМИ И ЧАТОМ ===
previewMicBtn.addEventListener('click', toggleMic);
previewCamBtn.addEventListener('click', toggleCam);
micBtn.addEventListener('click', toggleMic);
camBtn.addEventListener('click', toggleCam);
screenShareBtn.addEventListener('click', toggleScreenShare);

// Переключение главного экрана (Google Meet Pinning)
function setMainParticipant(target) {
    isLocalMain = target === 'local';
    if (stageGrid) {
        stageGrid.classList.toggle('local-is-main', isLocalMain);
    }
    if (isLocalMain) {
        if (localTile) localTile.title = '';
        if (remoteTile)
            remoteTile.title =
                'Нажмите, чтобы развернуть собеседника на весь экран';
    } else {
        if (remoteTile) remoteTile.title = '';
        if (localTile)
            localTile.title = 'Нажмите, чтобы развернуть себя на весь экран';
    }
    log(
        isLocalMain
            ? '📌 Главный экран: Вы (Локально)'
            : '📌 Главный экран: Собеседник',
    );
}

if (localTile) {
    localTile.addEventListener('click', () => {
        // Клик по плавающему локальному окну делает его главным
        if (!isLocalMain) {
            setMainParticipant('local');
        }
    });
}

if (remoteTile) {
    remoteTile.addEventListener('click', () => {
        // Клик по плавающему окну собеседника возвращает его на главный экран
        if (isLocalMain) {
            setMainParticipant('remote');
        }
    });
}

// Обработчики чата
if (chatToggleBtn) chatToggleBtn.addEventListener('click', toggleChat);
if (closeChatBtn) closeChatBtn.addEventListener('click', toggleChat);

if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        chatInput.value = '';
        const time = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });

        appendChatMessage({
            sender: 'local',
            senderName: 'Вы',
            text: text,
            time: time,
        });

        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify({ text, time }));
        } else {
            log(
                'ℹ️ Сообщение сохранено локально (канал передачи пока не готов)',
                'warn',
            );
        }
    });
}

// Прикрепление файлов через скрепку (отправляются файлом с кнопкой скачивания)
if (chatAttachBtn && chatFileInput) {
    chatAttachBtn.addEventListener('click', () => {
        chatFileInput.click();
    });

    chatFileInput.addEventListener('change', async () => {
        if (chatFileInput.files && chatFileInput.files[0]) {
            const file = chatFileInput.files[0];
            log(
                `📎 Прикреплен файл: ${file.name} (${formatFileSize(file.size)})`,
            );
            await sendFile(file, { isInlineImage: false });
            chatFileInput.value = '';
        }
    });
}

// Вставка скопированных картинок из буфера обмена (Ctrl+V) — отправляются как инлайн-изображение
if (chatInput) {
    chatInput.addEventListener('paste', async (e) => {
        const clipboardItems = (e.clipboardData || window.clipboardData)?.items;
        if (!clipboardItems) return;

        for (let i = 0; i < clipboardItems.length; i++) {
            if (clipboardItems[i].type.indexOf('image') !== -1) {
                e.preventDefault(); // предотвращаем вставку мусорного пути/текста
                const blob = clipboardItems[i].getAsFile();
                if (blob) {
                    log(
                        '📋 Картинка вставлена из буфера обмена (отправка как изображение)',
                    );
                    await sendFile(blob, { isInlineImage: true });
                }
                return;
            }
        }
    });
}

// === АВАТАР ГАРДЕРОБ (КАСТОМИЗАЦИЯ В ЛОББИ) ===
function loadAvatarProfile() {
    try {
        const saved =
            localStorage.getItem('avatar_config') ||
            localStorage.getItem('southpark_avatar_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            avatarProfile = { ...defaultAvatarProfile, ...parsed };
            // Если в профиле стоял старый дефолтный хохолок без явного выбора, переключаем на ушанку
            if (
                parsed.hatStyle === 'tuft' &&
                !localStorage.getItem('avatar_hat_explicit')
            ) {
                avatarProfile.hatStyle = 'ushanka';
            }
        }
    } catch (e) {}
}

function saveAvatarProfile() {
    try {
        localStorage.setItem('avatar_config', JSON.stringify(avatarProfile));
    } catch (e) {}
}

function renderWardrobePreview() {
    if (!wardrobePreviewCanvas) return;
    const ctx = wardrobePreviewCanvas.getContext('2d');
    ctx.fillStyle = '#111214';
    ctx.fillRect(
        0,
        0,
        wardrobePreviewCanvas.width,
        wardrobePreviewCanvas.height,
    );

    drawCartoonCharacter(ctx, {
        cx: 80,
        cy: 70,
        scale: 0.5,
        mouthOpen: 0,
        isBlinking: false,
        suitColor: avatarProfile.suitColor || '#5865f2',
        hatStyle: avatarProfile.hatStyle || 'ushanka',
        nameTag: avatarProfile.name || 'Вы',
        isMiniPreview: true,
    });
}

function initWardrobeControls() {
    loadAvatarProfile();

    if (wardrobeNameInput) {
        wardrobeNameInput.value = avatarProfile.name || 'Вы';
        wardrobeNameInput.addEventListener('input', (e) => {
            avatarProfile.name = e.target.value.trim() || 'Вы';
            saveAvatarProfile();
            renderWardrobePreview();
        });
    }

    if (wardrobeHatBtns) {
        wardrobeHatBtns.forEach((btn) => {
            if (btn.dataset.hat === avatarProfile.hatStyle) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            btn.addEventListener('click', () => {
                wardrobeHatBtns.forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                avatarProfile.hatStyle = btn.dataset.hat;
                try {
                    localStorage.setItem('avatar_hat_explicit', 'true');
                } catch (e) {}
                saveAvatarProfile();
                renderWardrobePreview();
            });
        });
    }

    if (wardrobeColorDots) {
        wardrobeColorDots.forEach((dot) => {
            if (
                dot.dataset.color.toLowerCase() ===
                avatarProfile.suitColor.toLowerCase()
            ) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
            dot.addEventListener('click', () => {
                wardrobeColorDots.forEach((d) => d.classList.remove('active'));
                dot.classList.add('active');
                avatarProfile.suitColor = dot.dataset.color;
                saveAvatarProfile();
                renderWardrobePreview();
            });
        });
    }

    renderWardrobePreview();
}

// === ЛЕТАЮЩИЕ ЭМОДЗИ РЕАКЦИИ (УЛУЧШЕННЫЕ АНИМАЦИИ, ЗВУК И КОМБО) ===
let lastReactionTime = 0;
let reactionComboCount = 0;
let comboBadgeEl = null;
let comboTimeout = null;

function playReactionSound(emoji) {
    try {
        const ctx = getSoundAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const gainNode = ctx.createGain();
        gainNode.connect(ctx.destination);

        if (emoji === '🔥') {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(620, now + 0.16);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            filter.frequency.linearRampToValueAtTime(2800, now + 0.16);

            gainNode.gain.setValueAtTime(0.01, now);
            gainNode.gain.linearRampToValueAtTime(0.18, now + 0.04);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            osc.connect(filter);
            filter.connect(gainNode);
            osc.start(now);
            osc.stop(now + 0.23);
        } else if (emoji === '❤️') {
            [523.25, 659.25, 783.99].forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const noteGain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.04);
                noteGain.gain.setValueAtTime(0.01, now + idx * 0.04);
                noteGain.gain.linearRampToValueAtTime(
                    0.12,
                    now + idx * 0.04 + 0.02,
                );
                noteGain.gain.exponentialRampToValueAtTime(
                    0.001,
                    now + idx * 0.04 + 0.22,
                );
                osc.connect(noteGain);
                noteGain.connect(gainNode);
                osc.start(now + idx * 0.04);
                osc.stop(now + idx * 0.04 + 0.24);
            });
        } else if (emoji === '🎉') {
            [523.25, 659.25, 1046.5].forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const noteGain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + idx * 0.04);
                noteGain.gain.setValueAtTime(0.01, now + idx * 0.04);
                noteGain.gain.linearRampToValueAtTime(
                    0.15,
                    now + idx * 0.04 + 0.02,
                );
                noteGain.gain.exponentialRampToValueAtTime(
                    0.001,
                    now + idx * 0.04 + 0.28,
                );
                osc.connect(noteGain);
                noteGain.connect(gainNode);
                osc.start(now + idx * 0.04);
                osc.stop(now + idx * 0.04 + 0.3);
            });
        } else if (emoji === '🚀') {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.exponentialRampToValueAtTime(1400, now + 0.26);
            gainNode.gain.setValueAtTime(0.01, now);
            gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
            osc.connect(gainNode);
            osc.start(now);
            osc.stop(now + 0.29);
        } else if (emoji === '💩') {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
            osc.frequency.exponentialRampToValueAtTime(180, now + 0.2);
            gainNode.gain.setValueAtTime(0.01, now);
            gainNode.gain.linearRampToValueAtTime(0.2, now + 0.04);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
            osc.connect(gainNode);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (emoji === '🤯') {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.24);
            gainNode.gain.setValueAtTime(0.24, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
            osc.connect(gainNode);
            osc.start(now);
            osc.stop(now + 0.27);
        } else {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.11);
            gainNode.gain.setValueAtTime(0.01, now);
            gainNode.gain.linearRampToValueAtTime(0.18, now + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gainNode);
            osc.start(now);
            osc.stop(now + 0.16);
        }
    } catch (e) {}
}

function spawnCustomReactionEffects(emoji, originX, comboBoost) {
    if (!reactionsOverlay) return;

    if (emoji === '🎉') {
        const colors = [
            '#ff5e62',
            '#fee75c',
            '#5865f2',
            '#23a55a',
            '#eb459e',
            '#00b0f4',
            '#f39c12',
        ];
        const confettiCount = 18 + comboBoost * 4;
        for (let i = 0; i < confettiCount; i++) {
            const conf = document.createElement('div');
            conf.className = 'reaction-confetti';
            conf.style.left = `${originX}%`;
            conf.style.setProperty(
                '--c-color',
                colors[Math.floor(Math.random() * colors.length)],
            );
            conf.style.setProperty('--c-w', `${7 + Math.random() * 6}px`);
            conf.style.setProperty('--c-h', `${10 + Math.random() * 8}px`);

            const angle = Math.random() * Math.PI * 2;
            const dist = 50 + Math.random() * 140;
            conf.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
            conf.style.setProperty(
                '--ty',
                `${-Math.abs(Math.sin(angle) * dist) - 30}px`,
            );
            conf.style.setProperty('--c-dur', `${1.2 + Math.random() * 0.6}s`);

            reactionsOverlay.appendChild(conf);
            conf.addEventListener('animationend', () => conf.remove());
            setTimeout(() => conf.remove(), 2200);
        }
    } else if (emoji === '🔥') {
        const sparks = ['🔥', '✨', '⚡', '💥', '🧡'];
        const sparkCount = 12 + comboBoost * 3;
        for (let i = 0; i < sparkCount; i++) {
            const p = document.createElement('div');
            p.className = 'reaction-particle';
            p.textContent = sparks[Math.floor(Math.random() * sparks.length)];
            p.style.left = `${originX}%`;
            p.style.setProperty('--p-size', `${16 + Math.random() * 14}px`);

            const angle = -Math.PI / 2 + (Math.random() * 1.4 - 0.7);
            const dist = 60 + Math.random() * 130;
            p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
            p.style.setProperty('--ty', `${Math.sin(angle) * dist - 30}px`);
            p.style.setProperty('--spin', `${Math.random() * 360 - 180}deg`);
            p.style.setProperty('--p-dur', `${0.9 + Math.random() * 0.5}s`);

            reactionsOverlay.appendChild(p);
            p.addEventListener('animationend', () => p.remove());
            setTimeout(() => p.remove(), 1800);
        }
    } else if (emoji === '❤️') {
        const hearts = ['💖', '💕', '💓', '💗', '✨'];
        const count = 10 + comboBoost * 2;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'reaction-particle';
            p.textContent = hearts[Math.floor(Math.random() * hearts.length)];
            p.style.left = `${originX}%`;
            p.style.setProperty('--p-size', `${18 + Math.random() * 14}px`);

            const angle = -Math.PI / 2 + (Math.random() * 1.8 - 0.9);
            const dist = 50 + Math.random() * 110;
            p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
            p.style.setProperty('--ty', `${Math.sin(angle) * dist - 20}px`);
            p.style.setProperty('--spin', `${Math.random() * 80 - 40}deg`);
            p.style.setProperty('--p-dur', `${1.1 + Math.random() * 0.5}s`);

            reactionsOverlay.appendChild(p);
            p.addEventListener('animationend', () => p.remove());
            setTimeout(() => p.remove(), 2000);
        }
    } else if (emoji === '🤯') {
        const wave = document.createElement('div');
        wave.className = 'reaction-shockwave';
        wave.style.left = `${originX}%`;
        reactionsOverlay.appendChild(wave);
        wave.addEventListener('animationend', () => wave.remove());
        setTimeout(() => wave.remove(), 1200);

        const sparks = ['✨', '⚡', '💥', '🧠'];
        for (let i = 0; i < 12; i++) {
            const p = document.createElement('div');
            p.className = 'reaction-particle';
            p.textContent = sparks[Math.floor(Math.random() * sparks.length)];
            p.style.left = `${originX}%`;
            p.style.setProperty('--p-size', `${16 + Math.random() * 14}px`);

            const angle = Math.random() * Math.PI * 2;
            const dist = 60 + Math.random() * 120;
            p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
            p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
            p.style.setProperty('--spin', `${Math.random() * 360 - 180}deg`);
            p.style.setProperty('--p-dur', `${0.8 + Math.random() * 0.4}s`);

            reactionsOverlay.appendChild(p);
            p.addEventListener('animationend', () => p.remove());
            setTimeout(() => p.remove(), 1600);
        }
    } else if (emoji === '🚀') {
        const trails = ['💨', '✨', '⚡', '🔥'];
        for (let i = 0; i < 10; i++) {
            const p = document.createElement('div');
            p.className = 'reaction-particle';
            p.textContent = trails[Math.floor(Math.random() * trails.length)];
            p.style.left = `${originX}%`;
            p.style.setProperty('--p-size', `${16 + Math.random() * 12}px`);

            const angle = Math.PI / 2 + (Math.random() * 1.0 - 0.5);
            const dist = 40 + Math.random() * 80;
            p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
            p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
            p.style.setProperty('--p-dur', `${0.7 + Math.random() * 0.4}s`);

            reactionsOverlay.appendChild(p);
            p.addEventListener('animationend', () => p.remove());
            setTimeout(() => p.remove(), 1500);
        }
    } else {
        const genericParticles = ['✨', '⭐', '💫'];
        for (let i = 0; i < 8; i++) {
            const p = document.createElement('div');
            p.className = 'reaction-particle';
            p.textContent =
                genericParticles[
                    Math.floor(Math.random() * genericParticles.length)
                ];
            p.style.left = `${originX}%`;
            p.style.setProperty('--p-size', `${14 + Math.random() * 12}px`);

            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 90;
            p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
            p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
            p.style.setProperty('--p-dur', `${0.8 + Math.random() * 0.4}s`);

            reactionsOverlay.appendChild(p);
            p.addEventListener('animationend', () => p.remove());
            setTimeout(() => p.remove(), 1600);
        }
    }
}

function showReactionCombo(emoji, count) {
    if (!reactionsOverlay) return;
    if (comboBadgeEl) {
        comboBadgeEl.remove();
        comboBadgeEl = null;
    }
    if (comboTimeout) {
        clearTimeout(comboTimeout);
    }

    const badge = document.createElement('div');
    badge.className = 'reaction-combo-badge';
    badge.style.left = '50%';

    let label = `${emoji} x${count}!`;
    if (count >= 10) label = `⚡ ${emoji} x${count} ULTRA COMBO! ⚡`;
    else if (count >= 5) label = `🔥 ${emoji} x${count} MEGA COMBO!`;

    badge.textContent = label;
    reactionsOverlay.appendChild(badge);
    comboBadgeEl = badge;

    comboTimeout = setTimeout(() => {
        if (comboBadgeEl) {
            comboBadgeEl.remove();
            comboBadgeEl = null;
        }
    }, 1400);
}

// Тематические наборы эмодзи, цветов и звуков для каждого типа реакции
const reactionThemes = {
    '❤️': {
        hero: '❤️',
        variants: ['💖', '💕', '🥰', '😍', '💓', '💗', '💘', '✨', '😻', '🌹'],
        glow: 'glow-heart',
    },
    '🔥': {
        hero: '🔥',
        variants: ['🔥', '💥', '⚡', '🧨', '🌶️', '🌋', '✨', '🌟', '💣'],
        glow: 'glow-fire',
    },
    '😂': {
        hero: '😂',
        variants: ['😂', '🤣', '😹', '💀', '😭', '😆', '🤪', '✨', '🤡'],
        glow: 'glow-party',
    },
    '🎉': {
        hero: '🎉',
        variants: ['🎉', '🎊', '🥳', '🎈', '🍾', '⭐', '✨', '🎇', '🎁'],
        glow: 'glow-party',
    },
    '👏': {
        hero: '👏',
        variants: ['👏', '🙌', '🎉', '🌟', '🤩', '✨', '🏆', '💯', '👍'],
        glow: 'glow-party',
    },
    '💩': {
        hero: '💩',
        variants: ['💩', '🚽', '🧻', '🤪', '⭐', '✨', '🤠', '💨', '🪰'],
        glow: 'glow-fire',
    },
    '🚀': {
        hero: '🚀',
        variants: ['🚀', '🛸', '⭐', '🌌', '🌠', '✨', '🪐', '👨‍🚀', '☄️'],
        glow: 'glow-rocket',
    },
    '💀': {
        hero: '💀',
        variants: ['💀', '☠️', '👻', '🪦', '🖤', '✨', '🥀', '🔮', '⚡'],
        glow: 'glow-skull',
    },
    '🤯': {
        hero: '🤯',
        variants: ['🤯', '🧠', '💥', '⚡', '😱', '💫', '✨', '🌌', '🧨'],
        glow: 'glow-brain',
    },
    '💯': {
        hero: '💯',
        variants: ['💯', '🔥', '⚡', '🏆', '⭐', '👑', '✨', '🥇', '💎'],
        glow: 'glow-fire',
    },
};

function triggerFloatingReaction(emoji, fromRemote = false) {
    if (!reactionsOverlay) return;

    // Звуковой эффект
    playReactionSound(emoji);

    // Подсчет комбо при быстром спаме реакций
    if (!fromRemote) {
        const now = Date.now();
        if (now - lastReactionTime < 1300) {
            reactionComboCount++;
        } else {
            reactionComboCount = 1;
        }
        lastReactionTime = now;

        if (reactionComboCount >= 2) {
            showReactionCombo(emoji, reactionComboCount);
        }
    }

    // Отображаем реакции СТРОГО ПО ЦЕНТРУ ЭКРАНА (с небольшим живым разбросом 46% - 54%)
    const originX = 50 + (Math.random() * 8 - 4);
    const comboBoost = Math.min(reactionComboCount, 8);

    const theme = reactionThemes[emoji] || {
        hero: emoji,
        variants: [emoji, '✨', '⭐', '💫'],
        glow: '',
    };

    // 1. Главный крупный эмодзи (Hero Pop) в центре экрана
    const hero = document.createElement('div');
    hero.className = 'reaction-hero';
    hero.textContent = theme.hero;
    hero.style.left = `${originX}%`;
    hero.style.setProperty('--rot-mid', `${Math.random() * 26 - 13}deg`);
    hero.style.setProperty('--rot-mid2', `${Math.random() * 20 - 10}deg`);
    hero.style.setProperty('--rot-end', `${Math.random() * 30 - 15}deg`);

    if (theme.glow) {
        hero.classList.add(theme.glow);
    }

    reactionsOverlay.appendChild(hero);
    hero.addEventListener('animationend', () => hero.remove());
    setTimeout(() => hero.remove(), 2600);

    // 2. Специфические праздничные частицы вокруг центра
    spawnCustomReactionEffects(emoji, originX, comboBoost);

    // 3. Поток разнообразных эмодзи (широкий праздничный фонтан из центра)
    const streamCount =
        5 + Math.floor(Math.random() * 3) + Math.min(comboBoost, 4);
    for (let i = 0; i < streamCount; i++) {
        setTimeout(
            () => {
                if (!reactionsOverlay) return;
                const item = document.createElement('div');
                item.className = 'reaction-stream-item';

                // Разнообразный эмодзи из тематического набора вместо одинаковых!
                const variantEmoji =
                    theme.variants[
                        Math.floor(Math.random() * theme.variants.length)
                    ];
                item.textContent = variantEmoji;

                // Веерное фонтанное распределение от центра (от 30% до 70% экрана)
                const sideSign = i % 2 === 0 ? 1 : -1;
                const spreadOffset = sideSign * (4 + Math.random() * 18);
                const itemX = Math.max(16, Math.min(84, 50 + spreadOffset));

                item.style.left = `${itemX}%`;
                item.style.setProperty(
                    '--size',
                    `${28 + Math.floor(Math.random() * 22)}px`,
                );
                item.style.setProperty(
                    '--dur',
                    `${2.0 + Math.random() * 0.7}s`,
                );
                item.style.setProperty(
                    '--sway1',
                    `${sideSign * (15 + Math.random() * 30)}px`,
                );
                item.style.setProperty(
                    '--sway2',
                    `${-sideSign * (15 + Math.random() * 30)}px`,
                );
                item.style.setProperty(
                    '--sway3',
                    `${sideSign * (10 + Math.random() * 25)}px`,
                );
                item.style.setProperty(
                    '--rot-mid',
                    `${Math.random() * 28 - 14}deg`,
                );
                item.style.setProperty(
                    '--rot-mid2',
                    `${Math.random() * 24 - 12}deg`,
                );
                item.style.setProperty(
                    '--rot-end',
                    `${Math.random() * 36 - 18}deg`,
                );

                reactionsOverlay.appendChild(item);
                item.addEventListener('animationend', () => item.remove());
                setTimeout(() => item.remove(), 3200);
            },
            60 + i * 80,
        );
    }
}

if (reactionsBtn) {
    reactionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        const isHidden =
            reactionsPicker.style.display === 'none' ||
            !reactionsPicker.style.display;
        reactionsPicker.style.display = isHidden ? 'flex' : 'none';
    });
}

if (rxBtns) {
    rxBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const emoji = btn.dataset.emoji;
            triggerFloatingReaction(emoji);
            if (dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(JSON.stringify({ type: 'reaction', emoji }));
            }
            reactionsPicker.style.display = 'none';
        });
    });
}

// === СОВМЕСТНАЯ ДОСКА РИСОВАНИЯ (WHITEBOARD) ===
function initWhiteboard() {
    if (!whiteboardCanvas) return;
    wbCtx = whiteboardCanvas.getContext('2d');

    function resize() {
        if (!whiteboardOverlay || whiteboardOverlay.style.display === 'none')
            return;
        const rect = whiteboardCanvas.getBoundingClientRect();
        if (
            rect.width &&
            rect.height &&
            (whiteboardCanvas.width !== rect.width ||
                whiteboardCanvas.height !== rect.height)
        ) {
            const temp = document.createElement('canvas');
            temp.width = whiteboardCanvas.width;
            temp.height = whiteboardCanvas.height;
            const tCtx = temp.getContext('2d');
            tCtx.drawImage(whiteboardCanvas, 0, 0);

            whiteboardCanvas.width = rect.width;
            whiteboardCanvas.height = rect.height;
            wbCtx.drawImage(temp, 0, 0, rect.width, rect.height);
        }
    }

    window.addEventListener('resize', resize);

    if (whiteboardBtn) {
        whiteboardBtn.addEventListener('click', () => {
            toggleWhiteboard();
        });
    }

    if (wbCloseBtn) {
        wbCloseBtn.addEventListener('click', () => {
            toggleWhiteboard(false);
        });
    }

    wbColors.forEach((btn) => {
        btn.addEventListener('click', () => {
            wbColors.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            wbColor = btn.dataset.color;
            wbIsEraser = false;
            wbEraserBtn.classList.remove('active');
        });
    });

    wbSizes.forEach((btn) => {
        btn.addEventListener('click', () => {
            wbSizes.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            wbSize = parseInt(btn.dataset.size, 10);
        });
    });

    if (wbEraserBtn) {
        wbEraserBtn.addEventListener('click', () => {
            wbIsEraser = !wbIsEraser;
            wbEraserBtn.classList.toggle('active', wbIsEraser);
        });
    }

    if (wbClearBtn) {
        wbClearBtn.addEventListener('click', () => {
            clearWhiteboardLocally();
            if (dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(JSON.stringify({ type: 'wb_clear' }));
            }
        });
    }

    if (wbCopyBtn) {
        wbCopyBtn.addEventListener('click', copyWhiteboardToClipboard);
    }

    if (wbDownloadBtn) {
        wbDownloadBtn.addEventListener('click', downloadWhiteboardImage);
    }

    if (wbSendChatBtn) {
        wbSendChatBtn.addEventListener('click', sendWhiteboardToChat);
    }

    function getPointerPos(e) {
        const rect = whiteboardCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
            w: rect.width,
            h: rect.height,
        };
    }

    function onPointerDown(e) {
        e.preventDefault();
        isWbDrawing = true;
        const { x, y } = getPointerPos(e);
        lastWbX = x;
        lastWbY = y;
        drawWbLine(x, y, x + 0.1, y + 0.1, wbColor, wbSize, wbIsEraser);
    }

    function onPointerMove(e) {
        if (!isWbDrawing) return;
        e.preventDefault();
        const { x, y, w, h } = getPointerPos(e);
        drawWbLine(lastWbX, lastWbY, x, y, wbColor, wbSize, wbIsEraser);

        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(
                JSON.stringify({
                    type: 'wb_draw',
                    x0: lastWbX / w,
                    y0: lastWbY / h,
                    x1: x / w,
                    y1: y / h,
                    color: wbColor,
                    size: wbSize,
                    isEraser: wbIsEraser,
                }),
            );
        }

        lastWbX = x;
        lastWbY = y;
    }

    function onPointerUp() {
        isWbDrawing = false;
    }

    whiteboardCanvas.addEventListener('mousedown', onPointerDown);
    whiteboardCanvas.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    whiteboardCanvas.addEventListener('touchstart', onPointerDown, {
        passive: false,
    });
    whiteboardCanvas.addEventListener('touchmove', onPointerMove, {
        passive: false,
    });
    window.addEventListener('touchend', onPointerUp);
}

function toggleWhiteboard(forceState) {
    if (!whiteboardOverlay) return;
    const shouldOpen =
        forceState !== undefined
            ? forceState
            : whiteboardOverlay.style.display === 'none';
    whiteboardOverlay.style.display = shouldOpen ? 'flex' : 'none';
    if (whiteboardBtn) whiteboardBtn.classList.toggle('active', shouldOpen);
    isWhiteboardOpen = shouldOpen;

    if (shouldOpen) {
        setTimeout(() => {
            const rect = whiteboardCanvas.getBoundingClientRect();
            if (rect.width && rect.height) {
                if (
                    whiteboardCanvas.width === 0 ||
                    whiteboardCanvas.width === 300
                ) {
                    whiteboardCanvas.width = Math.round(rect.width);
                    whiteboardCanvas.height = Math.round(rect.height);
                } else if (
                    whiteboardCanvas.width !== Math.round(rect.width) ||
                    whiteboardCanvas.height !== Math.round(rect.height)
                ) {
                    const temp = document.createElement('canvas');
                    temp.width = whiteboardCanvas.width;
                    temp.height = whiteboardCanvas.height;
                    const tCtx = temp.getContext('2d');
                    tCtx.drawImage(whiteboardCanvas, 0, 0);

                    whiteboardCanvas.width = Math.round(rect.width);
                    whiteboardCanvas.height = Math.round(rect.height);
                    wbCtx.drawImage(
                        temp,
                        0,
                        0,
                        whiteboardCanvas.width,
                        whiteboardCanvas.height,
                    );
                }
            }
        }, 30);
    }
}

// Получение холста доски с непрозрачным тёмным фоном Discord
function getWhiteboardCanvasWithBackground() {
    if (!whiteboardCanvas) return null;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = whiteboardCanvas.width || 1280;
    exportCanvas.height = whiteboardCanvas.height || 720;
    const ctx = exportCanvas.getContext('2d');

    // Тёмный фон доски (Discord charcoal #1e1f22)
    ctx.fillStyle = '#1e1f22';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Переносим нарисованные линии
    ctx.drawImage(whiteboardCanvas, 0, 0);
    return exportCanvas;
}

function getWhiteboardBlob() {
    const exportCanvas = getWhiteboardCanvasWithBackground();
    if (!exportCanvas) return Promise.resolve(null);
    return new Promise((resolve) => {
        exportCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
}

function showWbSuccessFeedback(btn, text) {
    if (!btn) return;
    const originalText = btn.textContent;
    btn.textContent = text;
    btn.classList.add('success');
    setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('success');
    }, 2000);
}

// Всплывающее HUD уведомление (Тост)
function showToastNotification(text, type = 'info') {
    let container = document.querySelector('.app-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'app-toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `app-toast toast-${type}`;
    toast.textContent = text;
    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

// Скопировать рисунок в буфер обмена как PNG изображение
async function copyWhiteboardToClipboard() {
    try {
        const blob = await getWhiteboardBlob();
        if (!blob) throw new Error('Не удалось сформировать изображение доски');

        if (navigator.clipboard && window.ClipboardItem) {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            showWbSuccessFeedback(wbCopyBtn, '✓ Скопировано!');
            showToastNotification(
                '📋 Рисунок скопирован! Вставьте в чат (Ctrl+V)',
            );
            log(
                '📋 Рисунок с доски скопирован в буфер обмена (готово для отправки в чат через Ctrl+V)',
            );
        } else {
            throw new Error(
                'Clipboard API для изображений не поддерживается данным браузером',
            );
        }
    } catch (err) {
        log(
            '⚠️ Не удалось скопировать в буфер: ' +
                err.message +
                '. Скачиваем как файл...',
            'warn',
        );
        downloadWhiteboardImage();
        showToastNotification(
            '💾 Рисунок скачан на диск (копирование недоступно в браузере)',
        );
    }
}

// Скачать рисунок доски как PNG файл
function downloadWhiteboardImage() {
    const exportCanvas = getWhiteboardCanvasWithBackground();
    if (!exportCanvas) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `whiteboard_${timestamp}.png`;

    const a = document.createElement('a');
    a.href = exportCanvas.toDataURL('image/png');
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showWbSuccessFeedback(wbDownloadBtn, '✓ Скачано!');
    showToastNotification(`💾 Рисунок сохранён: ${filename}`);
    log(`💾 Рисунок с доски сохранён на диск: ${filename}`);
}

// Отправить рисунок напрямую в P2P чат звонка
async function sendWhiteboardToChat() {
    try {
        const blob = await getWhiteboardBlob();
        if (!blob) return;
        showWbSuccessFeedback(wbSendChatBtn, '✓ Отправлено!');
        await sendFile(blob, { isInlineImage: true });
        if (!isChatOpen) {
            toggleChat();
        }
        showToastNotification('💬 Рисунок отправлен в текстовый чат');
        log('💬 Рисунок с доски отправлен в чат звонка как изображение');
    } catch (err) {
        log('❌ Ошибка отправки рисунка в чат: ' + err.message, 'error');
    }
}

function drawWbLine(x0, y0, x1, y1, color, size, isEraser = false) {
    if (!wbCtx) return;
    wbCtx.save();
    if (isEraser) {
        wbCtx.globalCompositeOperation = 'destination-out';
        wbCtx.lineWidth = size * 3;
    } else {
        wbCtx.globalCompositeOperation = 'source-over';
        wbCtx.strokeStyle = color;
        wbCtx.lineWidth = size;
    }
    wbCtx.lineCap = 'round';
    wbCtx.lineJoin = 'round';
    wbCtx.beginPath();
    wbCtx.moveTo(x0, y0);
    wbCtx.lineTo(x1, y1);
    wbCtx.stroke();
    wbCtx.restore();
}

function clearWhiteboardLocally() {
    if (!wbCtx || !whiteboardCanvas) return;
    wbCtx.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
}

function handleRemoteWbDraw(msg) {
    if (!isWhiteboardOpen) {
        toggleWhiteboard(true);
    }
    const w = whiteboardCanvas.width;
    const h = whiteboardCanvas.height;
    drawWbLine(
        msg.x0 * w,
        msg.y0 * h,
        msg.x1 * w,
        msg.y1 * h,
        msg.color,
        msg.size,
        msg.isEraser,
    );
}

function handleRemoteWbClear() {
    clearWhiteboardLocally();
}

// Закрытие всплывающих панелей при клике в пустую область
document.addEventListener('click', (e) => {
    if (reactionsPicker && reactionsPicker.style.display !== 'none') {
        if (
            !reactionsPicker.contains(e.target) &&
            !reactionsBtn.contains(e.target)
        ) {
            reactionsPicker.style.display = 'none';
        }
    }
});

// === ГОРЯЧИЕ КЛАВИШИ DISCORD ===
window.addEventListener('keydown', (e) => {
    // Игнорируем ввод внутри полей текста
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    if (e.code === 'KeyM') {
        toggleMic();
    } else if (e.code === 'KeyV') {
        toggleCam();
    } else if (e.code === 'KeyS') {
        toggleScreenShare();
    } else if (e.code === 'KeyD') {
        toggleDevDrawer();
    } else if (e.code === 'KeyC') {
        toggleChat();
    } else if (e.code === 'KeyW') {
        toggleWhiteboard();
    } else if (e.code === 'KeyR') {
        if (reactionsBtn) reactionsBtn.click();
    }
});

// === DEVTOOLS DRAWER ===
function toggleDevDrawer() {
    devDrawer.classList.toggle('open');
    drawerBackdrop.classList.toggle(
        'active',
        devDrawer.classList.contains('open'),
    );
}

toggleDevBtn.addEventListener('click', toggleDevDrawer);
closeDevBtn.addEventListener('click', toggleDevDrawer);
drawerBackdrop.addEventListener('click', toggleDevDrawer);

devCopyLocalSdp.addEventListener('click', async () => {
    if (devLocalSdp.value) {
        await navigator.clipboard.writeText(devLocalSdp.value);
        devCopyLocalSdp.textContent = '✅ Скопировано!';
        setTimeout(() => {
            devCopyLocalSdp.textContent = 'Скопировать SDP';
        }, 1500);
    }
});

devDecodeLocalBtn.addEventListener('click', () => {
    if (rawLocalJson) {
        devLocalSdp.value = rawLocalJson;
    }
});

clearLogBtn.addEventListener('click', () => {
    onscreenLog.innerHTML = '';
});

// Инициализация гардероба аватара и совместной доски
initWardrobeControls();
initWhiteboard();

// Запуск превью медиа при открытии страницы (если поддерживается)
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    // Не запрашиваем принудительно доступ сразу чтобы не пугать диалогом, но готовим обработчики
    log(
        '🚀 Система готова к работе. Выберите гардероб аватара и создайте звонок.',
    );
}

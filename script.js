// === КОНФИГУРАЦИЯ И ВЕРСИОНИРОВАНИЕ ПРИЛОЖЕНИЯ ===
const APP_VERSION = '1.3.0';
const APP_BUILD_DATE = '25.10.2026';
const APP_BUILD_ID = '20261025-r2';

// Делаем версию доступной в глобальном контексте window для удобной отладки в консоли
window.APP_VERSION = APP_VERSION;
window.APP_BUILD_DATE = APP_BUILD_DATE;
window.APP_BUILD_ID = APP_BUILD_ID;

let remoteAppVersion = null;

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
let activeScreenPreset = null;
let selectedScreenPresetId = 'standard';
let screenAudioEnabled = true;
let callStartTime = null;
let callTimerInterval = null;
let reconnectTimeout = 3000;
let isCallEnding = false;
let disconnectTimer = null;
let callEndedResetTimeout = null;
let iceRestartCheckInterval = null;
let iceRestartTimeout = null;
let currentRole = 'caller'; // 'caller' | 'answerer'
let rawLocalJson = '';
let compressedLocalSdp = '';
let isShowingRawJson = false;
let rawRemoteJson = '';
let isTestMode = false;
let testCanvas = null;
let testAnimFrame = null;
let testStream = null;

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
const receivingFilesByTransferId = new Map();
const CHUNK_SIZE = 64000; // 64 KB безопасный размер чанка для DataChannel
let p2pTransferCounter = 1;

// === ЭЛЕМЕНТЫ UI ===
// Шапка и статус
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const callTimer = document.getElementById('call-timer');
const testCallBtn = document.getElementById('test-call-btn');
const devTestCallBtn = document.getElementById('dev-test-call-btn');
const testPeerHangupBtn = document.getElementById('test-peer-hangup-btn');
const devTestPeerHangupBtn = document.getElementById('dev-test-peer-hangup-btn');
const devTestPeerBgBtn = document.getElementById('dev-test-peer-bg-btn');
const remoteBgBadge = document.getElementById('remote-bg-badge');
let isMockPeerHidden = false;
const toggleDevBtn = document.getElementById('toggle-dev-btn');
const devDrawer = document.getElementById('dev-drawer');
const closeDevBtn = document.getElementById('close-dev-btn');
const drawerBackdrop = document.getElementById('drawer-backdrop');

// Версионирование и модальное окно
const appVersionBadge = document.getElementById('app-version-badge');
const lobbyVersionBadge = document.getElementById('lobby-version-badge');
const lobbyBuildDate = document.getElementById('lobby-build-date');
const devHeaderVersion = document.getElementById('dev-header-version');
const metricAppVersion = document.getElementById('metric-app-version');
const metricPeerVersion = document.getElementById('metric-peer-version');
const versionInfoBtn = document.getElementById('version-info-btn');
const versionModal = document.getElementById('version-modal');
const closeVersionModalBtn = document.getElementById('close-version-modal-btn');
const ackVersionBtn = document.getElementById('ack-version-btn');
const forceReloadBtn = document.getElementById('force-reload-btn');
const modalAppVersion = document.getElementById('modal-app-version');
const modalBuildDate = document.getElementById('modal-build-date');
const modalBuildId = document.getElementById('modal-build-id');

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
const screenQualityBadge = document.getElementById('screen-quality-badge');
const tileScreenQualityBtn = document.getElementById('tile-screen-quality-btn');
const leaveCallBtn = document.getElementById('leave-call-btn');

// Модальное окно демонстрации экрана
const screenShareModal = document.getElementById('screen-share-modal');
const closeScreenModalBtn = document.getElementById('close-screen-modal-btn');
const cancelScreenModalBtn = document.getElementById('cancel-screen-modal-btn');
const confirmScreenModalBtn = document.getElementById('confirm-screen-modal-btn');
const screenStopBtn = document.getElementById('screen-stop-btn');
const screenLiveBanner = document.getElementById('screen-live-banner');
const screenCurrentPresetLabel = document.getElementById('screen-current-preset-label');
const screenModalTitleText = document.getElementById('screen-modal-title-text');
const screenConfirmText = document.getElementById('screen-confirm-text');
const screenAudioCheckbox = document.getElementById('screen-audio-checkbox');

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

// === АВАТАР WARDROBE (ГАРДЕРОБ & ФОТО) ===
const defaultAvatarProfile = {
    name: 'Вы',
    suitColor: '#5865f2',
    hatStyle: 'ushanka', // 'tuft' | 'beanie' | 'ushanka' | 'cap' | 'bald'
    mode: 'cartoon',     // 'cartoon' | 'photo' | 'disabled'
    photoDataUrl: null,  // data:image/... base64
};
let avatarProfile = { ...defaultAvatarProfile };
let cachedUserPhotoImg = null;
let cachedUserPhotoSrc = null;
let remoteAvatarProfile = null;
let hideRemoteAvatars = localStorage.getItem('hide_remote_avatars') === 'true';
let remoteCamEnabled = false;
let remoteScreenSharing = false;

const wardrobePreviewCanvas = document.getElementById(
    'wardrobe-preview-canvas',
);
const modalWardrobePreviewCanvas = document.getElementById(
    'modal-wardrobe-preview-canvas',
);
const inCallAvatarBtn = document.getElementById('in-call-avatar-btn');
const tileEditAvatarBtn = document.getElementById('tile-edit-avatar-btn');
const avatarModal = document.getElementById('avatar-modal');
const closeAvatarModalBtn = document.getElementById('close-avatar-modal-btn');
const saveAvatarModalBtn = document.getElementById('save-avatar-modal-btn');

// === ЛЕТАЮЩИЕ РЕАКЦИИ (EMOJI REACTIONS) ===
const reactionsOverlay = document.getElementById('reactions-overlay');
const reactionsPicker = document.getElementById('reactions-picker');
const reactionsBtn = document.getElementById('reactions-btn');
const rxBtns = document.querySelectorAll('.rx-btn');

// === СОВМЕСТНАЯ ДОСКА (WHITEBOARD) ===
const whiteboardBtn = document.getElementById('whiteboard-btn');
const whiteboardOverlay = document.getElementById('whiteboard-overlay');
const whiteboardCanvas = document.getElementById('whiteboard-canvas');
const whiteboardPreviewCanvas = document.getElementById('whiteboard-preview-canvas');
const wbEraserBtn = document.getElementById('wb-eraser-btn');
const wbClearBtn = document.getElementById('wb-clear-btn');
const wbCopyBtn = document.getElementById('wb-copy-btn');
const wbDownloadBtn = document.getElementById('wb-download-btn');
const wbSendChatBtn = document.getElementById('wb-send-chat-btn');
const wbMinimizeBtn = document.getElementById('wb-minimize-btn');
const wbCloseBtn = document.getElementById('wb-close-btn');
const wbExpandBtn = document.getElementById('wb-expand-btn');
const wbPipCloseBtn = document.getElementById('wb-pip-close-btn');
const wbPipLabel = document.getElementById('wb-pip-label');
const wbPeerStatus = document.getElementById('wb-peer-status');
const wbDockBadge = document.getElementById('wb-dock-badge');
const wbColors = document.querySelectorAll('.wb-color');
const wbSizes = document.querySelectorAll('.wb-size-btn');

const WB_CANVAS_WIDTH = 1600;
const WB_CANVAS_HEIGHT = 900;
let wbCtx = null;
let wbPreviewCtx = null;
let wbTool = 'brush'; // 'brush' | 'circle' | 'rect' | 'arrow' | 'line'
let wbStrokePoints = [];
let wbShapeStartX = 0;
let wbShapeStartY = 0;
let isWbDrawingShape = false;
let wbLastMidX = 0;
let wbLastMidY = 0;
let wbColor = '#ffffff';
let wbSize = 7;
let wbIsEraser = false;
let isWbDrawing = false;
let lastWbX = 0;
let lastWbY = 0;
let isWhiteboardOpen = false;
let wbMode = 'closed'; // 'closed' | 'minimized' | 'fullscreen'
let wbDismissedByUser = false;
let wbRemoteDrawTimeout = null;

// === РИСОВАНИЕ НА ЭКРАНЕ / АННОТАЦИИ (SCREEN ANNOTATIONS) ===
const screenDrawBtn = document.getElementById('screen-draw-btn');
const screenDrawDockBadge = document.getElementById('screen-draw-dock-badge');
const screenDrawOverlay = document.getElementById('screen-draw-overlay');
const screenDrawCanvas = document.getElementById('screen-draw-canvas');
const screenDrawToolbar = document.getElementById('screen-draw-toolbar');
const screenDrawDragHandle = document.getElementById('screen-draw-drag-handle');
const screenDrawMinimizedPill = document.getElementById('screen-draw-minimized-pill');
const sdtLaserBtn = document.getElementById('sdt-laser');
const sdtFadeBtn = document.getElementById('sdt-fade');
const sdtPenBtn = document.getElementById('sdt-pen');
const sdtEraserBtn = document.getElementById('sdt-eraser');
const sdtClearBtn = document.getElementById('sdt-clear-btn');
const sdtMinimizeBtn = document.getElementById('sdt-minimize-btn');
const sdtCloseBtn = document.getElementById('sdt-close-btn');
const sdtColorBtns = document.querySelectorAll('.sdt-color-btn');
const sdtSizeBtns = document.querySelectorAll('.sdt-size-btn');

let screenDrawCtx = null;
let isScreenDrawActive = false;
let isScreenDrawMinimized = false;
let screenDrawTool = 'laser'; // 'laser' | 'fade' | 'pen' | 'eraser'
let screenDrawColor = '#57f287'; // Неоновый лайм по умолчанию
let screenDrawSize = 6;
let isScreenDrawPointerDown = false;
let lastScreenDrawPos = null;

let fadingStrokes = [];
let persistentCanvas = null;
let persistentCtx = null;
let laserPointers = {
    local: { active: false, nx: 0, ny: 0, color: '#57f287', trail: [] },
    remote: { active: false, nx: 0, ny: 0, color: '#fee75c', name: 'Собеседник', trail: [] },
};
let screenDrawAnimId = null;
let lastLaserSendTime = 0;
let isScreenDrawToolbarDragging = false;
let screenDrawDragStartX = 0;
let screenDrawDragStartY = 0;
let screenDrawToolbarPosX = null;
let screenDrawToolbarPosY = null;
let mockScreenDrawTimeout = null;
let screenDrawPendingStrokes = [];
let screenDrawBatchTimer = null;

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
function compressAndEncode(sdpString) {
    // sdpString — это только pc.localDescription.sdp, без JSON-обёртки
    return sdpCompact.compactSDP(sdpString, {
        compress: 'base64' //base64/base92
    });
}

function decodeAndDecompress(compactedSdp, isOffer) {
    return sdpCompact.decompactSDP(compactedSdp, isOffer, {
        compress: 'base64' //base64/base92
    });
}

async function getValidSdp(rawText, isOffer) {
    const trimmed = rawText.trim();
    if (!trimmed) return null;

    // Иначе — это сжатая строка от sdp-compact
    log('📦 Распаковка SDP (sdp-compact)...');
    const sdp = decodeAndDecompress(trimmed, isOffer);
    return JSON.stringify({ type: isOffer ? 'offer' : 'answer', sdp });
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

        remoteAudioAnalyser.connect(remoteAudioCtx.destination); // Выводим звук на динамики
        if (remoteVideo) remoteVideo.muted = true;

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

// === ПОЛУЧЕНИЕ И КЭШИРОВАНИЕ ЗАГРУЖЕННОГО ФОТО ===
function getUserPhotoImg(onLoadCallback) {
    if (!avatarProfile.photoDataUrl) return null;
    if (cachedUserPhotoImg && cachedUserPhotoSrc === avatarProfile.photoDataUrl) {
        if (!cachedUserPhotoImg.complete && onLoadCallback) {
            cachedUserPhotoImg.addEventListener('load', onLoadCallback, { once: true });
        }
        return cachedUserPhotoImg;
    }
    cachedUserPhotoImg = new Image();
    cachedUserPhotoSrc = avatarProfile.photoDataUrl;
    cachedUserPhotoImg.onload = () => {
        renderWardrobePreview();
        if (onLoadCallback) onLoadCallback();
    };
    cachedUserPhotoImg.src = avatarProfile.photoDataUrl;
    return cachedUserPhotoImg;
}

// === ОТРИСОВКА ФОТОГРАФИИ АВАТАРА ===
function drawPhotoAvatar(ctx, options) {
    const {
        cx,
        cy,
        img,
        nameTag = '',
        volumeLevel = 0,
        isMuted = false,
        size = 180,
        isMiniPreview = false,
        suitColor = '#5865f2',
    } = options;

    if (!img || !img.complete || img.naturalWidth === 0) return;

    ctx.save();

    // Плавный интерактивный зум от громкости речи (эффект присутствия)
    const bounce = isMuted ? 0 : Math.min(0.08, volumeLevel * 0.08);
    const radius = (size / 2) * (1 + bounce);

    // 1. Свечение / Speaking Ring во время речи
    const isSpeaking = !isMuted && volumeLevel > 0.08;
    if (isSpeaking && !isMiniPreview) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#23a55a';
        ctx.lineWidth = 5 + volumeLevel * 7;
        ctx.shadowColor = '#23a55a';
        ctx.shadowBlur = 18 + volumeLevel * 20;
        ctx.stroke();
        ctx.restore();
    } else {
        // Обычная стильная обводка
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = suitColor;
        ctx.lineWidth = isMiniPreview ? 2.5 : 4;
        ctx.stroke();
        ctx.restore();
    }

    // 2. Обрезка по кругу и отрисовка фото (aspect fill)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Вычисляем cover / aspect fill
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const diameter = radius * 2;
    let dw, dh, dx, dy;
    if (iw > ih) {
        dh = diameter;
        dw = (iw / ih) * diameter;
        dx = cx - dw / 2;
        dy = cy - radius;
    } else {
        dw = diameter;
        dh = (ih / iw) * diameter;
        dx = cx - radius;
        dy = cy - dh / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();

    // 3. Бейдж с именем пользователя внизу фото
    if (nameTag && !isMiniPreview) {
        ctx.save();
        ctx.font = 'bold 15px sans-serif';
        const textWidth = ctx.measureText(nameTag).width;
        const tagW = textWidth + 24;
        const tagH = 28;
        const tagX = cx - tagW / 2;
        const tagY = cy + radius + 18;

        ctx.fillStyle = 'rgba(17, 18, 20, 0.88)';
        ctx.strokeStyle = isSpeaking ? '#23a55a' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;

        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(tagX, tagY, tagW, tagH, 14);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(tagX, tagY, tagW, tagH);
            ctx.strokeRect(tagX, tagY, tagW, tagH);
        }

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(nameTag, cx, tagY + tagH / 2);
        ctx.restore();
    }

    // 4. Иконка Mute, если микрофон выключен
    if (isMuted && !isMiniPreview) {
        const badgeR = 14;
        const bx = cx + radius * 0.7;
        const by = cy + radius * 0.7;
        ctx.beginPath();
        ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = '#f23f43';
        ctx.fill();
        ctx.strokeStyle = '#1e1f22';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕', bx, by);
    }

    ctx.restore();
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

        // Отрисовка аватара (фото, мультяшный персонаж или режим "без аватара")
        if (avatarProfile.mode === 'disabled') {
            const cx = 320;
            const cy = 210;
            const radius = 70;

            // Классический круг профиля
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = avatarProfile.suitColor || '#5865f2';
            ctx.fill();

            // Зеленый индикатор речи вокруг круга
            if (isSpeakingLocally) {
                ctx.lineWidth = 6;
                ctx.strokeStyle = '#23a55a';
                ctx.stroke();
            }

            const initial = (avatarProfile.name || 'Вы').trim().charAt(0).toUpperCase() || '👤';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 54px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(initial, cx, cy);
            ctx.restore();

            // Имя пользователя под кругом
            ctx.fillStyle = '#f2f3f5';
            ctx.font = '600 20px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(avatarProfile.name || 'Вы', cx, cy + radius + 34);
        } else if (avatarProfile.mode === 'photo' && avatarProfile.photoDataUrl) {
            const userImg = getUserPhotoImg();
            if (userImg && userImg.complete && userImg.naturalWidth > 0) {
                drawPhotoAvatar(ctx, {
                    cx: 320,
                    cy: 220,
                    img: userImg,
                    nameTag: avatarProfile.name ? `👤 ${avatarProfile.name}` : '👤 Вы',
                    volumeLevel: smoothVolume,
                    isMuted: !micEnabled,
                    size: 200,
                    suitColor: avatarProfile.suitColor || '#5865f2',
                });
            } else {
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
            }
        } else {
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
        }

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
    if (localStream && localStream.getAudioTracks().length > 0) return localStream;
    try {
        log('🎙️ Запрос разрешения на доступ к микрофону...');
        // Первоначально запрашиваем ТОЛЬКО микрофон (без камеры)
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
        });

        // Настраиваем аудио-анализатор и холст говорящего аватара
        setupAudioAnalyser(localStream);
        initAvatarCanvas();

        // По умолчанию микрофон выключен (или статус micEnabled)
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = micEnabled;

        // В превью и в звонке: если реальная камера выключена, показываем поток говорящего аватара
        const hasRealCam = camEnabled && localStream.getVideoTracks().some((t) => t.readyState === 'live');
        if (previewVideo) {
            previewVideo.srcObject = hasRealCam ? localStream : avatarStream;
            previewVideo.style.transform = hasRealCam ? 'scaleX(-1)' : 'none';
        }
        if (localVideo) {
            localVideo.srcObject = hasRealCam ? localStream : avatarStream;
            localVideo.style.transform = hasRealCam ? 'scaleX(-1)' : 'none';
        }

        updateMediaUI();
        updateTileMediaViews();
        log('✅ Доступ к микрофону получен (аватар активен)');
        return localStream;
    } catch (audioErr) {
        log('❌ Доступ к микрофону отклонен: ' + audioErr.message, 'error');
        alert('Не удалось получить доступ к микрофону: ' + audioErr.message);
        throw audioErr;
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

    updateTileMediaViews();
}

// === УПРАВЛЕНИЕ ОТОБРАЖЕНИЕМ ПЛИТОК ВИДЕО / АВАТАРОВ (ВКЛ / ВЫКЛ АВАТАРОВ) ===
function updateTileMediaViews() {
    // 1. Локальное отображение
    const isLocalAvatarDisabled = avatarProfile.mode === 'disabled';
    const showLocalRealCam = camEnabled && (isMockCameraActive || (localStream && localStream.getVideoTracks().some((t) => t.readyState === 'live')));
    const showLocalScreen = isScreenSharing;

    // В лобби (preview-video / preview-avatar)
    if (previewVideo && previewAvatar) {
        if (showLocalRealCam) {
            previewVideo.style.display = 'block';
            previewAvatar.style.display = 'none';
            previewVideo.style.transform = 'scaleX(-1)';
            if (localStream && previewVideo.srcObject !== localStream) {
                previewVideo.srcObject = localStream;
            }
        } else {
            previewVideo.style.display = 'block';
            previewAvatar.style.display = 'none';
            previewVideo.style.transform = 'none';
            if (avatarStream && previewVideo.srcObject !== avatarStream) {
                previewVideo.srcObject = avatarStream;
            }
        }
    }

    // В активном звонке (localTile, localVideo, localAvatar)
    if (localTile) {
        // Локальная плитка ВСЕГДА отображается (чтобы пользователь видел себя, кружок с буквой или аватар, и индикацию речи)
        localTile.style.display = 'block';
        if (localVideo) {
            localVideo.style.display = 'block';
            localVideo.style.transform = showLocalRealCam ? 'scaleX(-1)' : 'none';
            if (showLocalRealCam && localStream) {
                if (localVideo.srcObject !== localStream) localVideo.srcObject = localStream;
            } else if (avatarStream) {
                if (localVideo.srcObject !== avatarStream) localVideo.srcObject = avatarStream;
            }
        }
        if (localAvatar) {
            localAvatar.style.display = 'none';
        }
    }

    // 2. Удаленное отображение (Remote Video / Remote Avatar)
    // Учитываем hideRemoteAvatars и в обычном звонке, и в Test Mode!
    const isRemoteAvatarDisabled = hideRemoteAvatars || (!isTestMode && remoteAvatarProfile && remoteAvatarProfile.mode === 'disabled');
    const showRemoteRealCam = !isTestMode && remoteCamEnabled;
    const showRemoteScreen = !isTestMode && remoteScreenSharing;

    if (remoteVideo && remoteAvatar) {
        if (showRemoteRealCam || showRemoteScreen) {
            // Реальная веб-камера собеседника или демонстрация экрана
            remoteVideo.style.display = 'block';
            remoteAvatar.style.display = 'none';
        } else if (isRemoteAvatarDisabled) {
            // Аватары собеседников скрыты (или режим 'без аватара')
            remoteVideo.style.display = 'none';
            remoteAvatar.style.display = 'flex';
            const nameEl = remoteAvatar.querySelector('.avatar-name');
            const rName = isTestMode ? 'Собеседник' : (remoteAvatarProfile?.name || 'Собеседник');
            if (nameEl) nameEl.textContent = rName;
            const circle = remoteAvatar.querySelector('.avatar-circle');
            if (circle) {
                const initial = rName.trim().charAt(0).toUpperCase() || '👥';
                circle.innerHTML = `<span>${initial}</span>`;
            }
        } else {
            // Аватар собеседника активен (включая симуляцию в Test Mode)
            remoteVideo.style.display = 'block';
            remoteAvatar.style.display = 'none';
        }
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

// === СИМУЛЯТОР ВЕБ-КАМЕРЫ ДЛЯ ТЕСТОВОГО РЕЖИМА И ГИБКИЙ ЗАХВАТ КАМЕРЫ ===
let isMockCameraActive = false;
let mockCameraStream = null;
let mockCameraAnimFrame = null;

function createMockCameraStream() {
    if (mockCameraStream) return mockCameraStream;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    let t = 0;
    function render() {
        if (!isMockCameraActive) return;
        t += 0.04;

        // Фон камеры
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#1a1f2c');
        grad.addColorStop(1, '#11141c');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Сетка видеоискателя
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        // Угловые рамки видоискателя
        const m = 35, len = 25;
        ctx.strokeStyle = '#5865f2';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(m, m + len); ctx.lineTo(m, m); ctx.lineTo(m + len, m);
        ctx.moveTo(canvas.width - m - len, m); ctx.lineTo(canvas.width - m, m); ctx.lineTo(canvas.width - m, m + len);
        ctx.moveTo(m, canvas.height - m - len); ctx.lineTo(m, canvas.height - m); ctx.lineTo(m + len, canvas.height - m);
        ctx.moveTo(canvas.width - m - len, canvas.height - m); ctx.lineTo(canvas.width - m, canvas.height - m); ctx.lineTo(canvas.width - m, canvas.height - m - len);
        ctx.stroke();

        // Силуэт человека в центре (с лёгким покачиванием)
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2 + Math.sin(t) * 4 + 10);
        ctx.beginPath();
        ctx.arc(0, -35, 45, 0, Math.PI * 2);
        ctx.fillStyle = '#2f3136';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 75, 95, 60, 0, Math.PI, 0);
        ctx.fillStyle = '#2f3136';
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Значок REC и статус
        ctx.fillStyle = '#f23f43';
        ctx.beginPath();
        ctx.arc(55, 55, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('REC', 68, 60);

        ctx.font = '12px monospace';
        ctx.fillStyle = '#9da8ff';
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0] + '.' + Math.floor(now.getMilliseconds() / 100);
        ctx.fillText(`CAM TEST • ${timeStr}`, 55, canvas.height - 50);

        ctx.font = '11.5px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText('📷 Симуляция веб-камеры (Тестовый режим)', 55, canvas.height - 30);

        mockCameraAnimFrame = requestAnimationFrame(render);
    }

    isMockCameraActive = true;
    render();
    mockCameraStream = canvas.captureStream(30);
    return mockCameraStream;
}

async function getCameraStream() {
    // 1. Сначала пробуем video: true (максимальная совместимость с драйверами без жестких ограничений)
    try {
        return await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
        });
    } catch (e1) {
        log('ℹ️ Запрос video: true: ' + e1.message + ', пробуем 1280x720...', 'warn');
    }

    // 2. Пробуем с ideal разрешением 1280x720
    try {
        return await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
        });
    } catch (e2) {
        log('ℹ️ Запрос с ideal constraints: ' + e2.message + ', перебираем устройства...', 'warn');
    }

    // 3. Пробуем перебрать найденные videoinput устройства
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        for (const dev of videoDevices) {
            try {
                return await navigator.mediaDevices.getUserMedia({
                    video: dev.deviceId ? { deviceId: { exact: dev.deviceId } } : true,
                    audio: false,
                });
            } catch (devErr) {}
        }
    } catch (e3) {}

    // Финальная попытка
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
}

async function toggleCam() {
    if (!camEnabled) {
        // Включение камеры: запрашиваем видео у браузера только при нажатии на кнопку камеры!
        let realVideoTrack = localStream
            ? localStream.getVideoTracks().find((t) => t.readyState === 'live')
            : null;

        if (!realVideoTrack) {
            try {
                log('📷 Запрос разрешения на доступ к веб-камере...');
                const cameraStream = await getCameraStream();
                realVideoTrack = cameraStream.getVideoTracks()[0];
                if (localStream) {
                    localStream.addTrack(realVideoTrack);
                } else {
                    localStream = cameraStream;
                }
                isMockCameraActive = false;
                log('✅ Доступ к веб-камере получен');
            } catch (err) {
                log('❌ Ошибка доступа к веб-камере: ' + err.message, 'error');
                if (isTestMode) {
                    // В тестовом режиме симулируем веб-камеру если реальное устройство недоступно
                    log('🧪 Включение симулятора веб-камеры для Test mode call...');
                    isMockCameraActive = true;
                    const mockStream = createMockCameraStream();
                    realVideoTrack = mockStream.getVideoTracks()[0];
                    showToastNotification(
                        '📷 Реальная камера недоступна. Включена тестовая камера (симуляция)',
                        'info',
                    );
                } else {
                    showToastNotification(
                        '⚠️ Не удалось включить камеру (' + err.message + '). Проверьте шторку камеры, кнопку Fn или доступ в настройках Windows.',
                        'warn',
                    );
                    return;
                }
            }
        }
        if (realVideoTrack) realVideoTrack.enabled = true;
        camEnabled = true;
    } else {
        // Выключение камеры
        camEnabled = false;
        isMockCameraActive = false;
        if (mockCameraAnimFrame) {
            cancelAnimationFrame(mockCameraAnimFrame);
            mockCameraAnimFrame = null;
        }
        mockCameraStream = null;
        if (localStream) {
            localStream.getVideoTracks().forEach((t) => {
                t.enabled = false;
            });
        }
    }

    const realVideoTrack = isMockCameraActive && mockCameraStream
        ? mockCameraStream.getVideoTracks()[0]
        : (localStream ? localStream.getVideoTracks().find((t) => t.readyState === 'live') : null);

    const trackToSend =
        camEnabled && realVideoTrack ? realVideoTrack : getAvatarTrack();

    // Заменяем видео-трек для собеседника через WebRTC (если звонок активен)
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
    const activeStream =
        camEnabled && (isMockCameraActive ? mockCameraStream : (realVideoTrack ? localStream : null))
            ? (isMockCameraActive ? mockCameraStream : localStream)
            : avatarStream;
    const activeTransform =
        camEnabled && !isMockCameraActive && realVideoTrack ? 'scaleX(-1)' : 'none';

    if (localVideo) {
        localVideo.srcObject = activeStream;
        localVideo.style.transform = activeTransform;
    }
    if (previewVideo) {
        previewVideo.srcObject = activeStream;
        previewVideo.style.transform = activeTransform;
    }

    if (dataChannel && dataChannel.readyState === 'open') {
        try {
            dataChannel.send(JSON.stringify({ type: 'cam_status', enabled: camEnabled }));
        } catch (e) {}
    }

    updateMediaUI();
    updateTileMediaViews();
    log(
        camEnabled
            ? (isMockCameraActive ? '📷 Включена тестовая камера' : '📷 Камера включена')
            : (avatarProfile.mode === 'disabled'
                ? '📷 Камера выключена (режим без аватара)'
                : '📷 Камера выключена (включен говорящий аватар)'),
    );
}

// === ПРЕСЕТЫ КАЧЕСТВА ДЕМОНСТРАЦИИ ЭКРАНА (SCREEN SHARE PRESETS) ===
const SCREEN_PRESETS = {
    eco: {
        id: 'eco',
        name: 'Эконом',
        icon: '⚡',
        badge: '15 FPS',
        fullBadge: '⚡ 15 FPS',
        tag: 'Низкий трафик',
        fps: 15,
        fpsDisplay: '15 FPS',
        width: 1280,
        height: 720,
        resDisplay: '1280×720 (720p HD)',
        bitrateKbps: 800,
        bitrateDisplay: '~800 кбит/с',
        contentHint: 'detail',
        hintDisplay: 'detail (четкость текста и схем)',
        description: 'Минимальная нагрузка на сеть и процессор. Режим высокой резкости (detail) — текст, Paint, схемы и код всегда четкие.',
    },
    standard: {
        id: 'standard',
        name: 'Стандарт',
        icon: '🎬',
        badge: '30 FPS',
        fullBadge: '🎬 30 FPS',
        tag: 'Рекомендуется',
        fps: 30,
        fpsDisplay: '30 FPS',
        width: 1920,
        height: 1080,
        resDisplay: '1920×1080 (1080p FHD)',
        bitrateKbps: 2500,
        bitrateDisplay: '~2.5 Мбит/с',
        contentHint: 'detail',
        hintDisplay: 'detail (четкость деталей)',
        description: 'Сбалансированный режим на каждый день. Отличная детализация и комфортная плавность для видео, презентаций и обычных окон.',
    },
    games: {
        id: 'games',
        name: 'Игры / Ультра',
        icon: '🎮',
        badge: '60 FPS',
        fullBadge: '🎮 60 FPS',
        tag: 'Макс. плавность',
        fps: 60,
        fpsDisplay: '60 FPS',
        width: null,
        height: null,
        resDisplay: '1080p+ / Исходное',
        bitrateKbps: 7000,
        bitrateDisplay: '~7.0 Мбит/с',
        contentHint: 'motion',
        hintDisplay: 'motion (плавность 60 fps)',
        description: 'Максимальная частота кадров (60 FPS) и высокий битрейт. Режим динамики (motion) для быстрых игр, динамичных сцен и 60fps-видео.',
    },
};

let screenAudioMixerNode = null;
let micAudioMixerNode = null;
let mixedAudioDestination = null;

// Инициализация пресета из localStorage
function initScreenPresetConfig() {
    try {
        const savedPreset = localStorage.getItem('kostya_screen_preset');
        if (savedPreset && SCREEN_PRESETS[savedPreset]) {
            selectedScreenPresetId = savedPreset;
        }
        const savedAudio = localStorage.getItem('kostya_screen_audio');
        if (savedAudio !== null) {
            screenAudioEnabled = savedAudio === 'true';
        }
    } catch (e) {
        console.warn('Storage read error:', e);
    }
}
initScreenPresetConfig();

function updateScreenSpecsUI(presetId) {
    const preset = SCREEN_PRESETS[presetId] || SCREEN_PRESETS.standard;
    const resEl = document.getElementById('spec-resolution');
    const fpsEl = document.getElementById('spec-fps');
    const bitrateEl = document.getElementById('spec-bitrate');
    const hintEl = document.getElementById('spec-hint');

    if (resEl) resEl.textContent = preset.resDisplay;
    if (fpsEl) fpsEl.textContent = preset.fpsDisplay;
    if (bitrateEl) bitrateEl.textContent = preset.bitrateDisplay;
    if (hintEl) hintEl.textContent = preset.hintDisplay;
}

function selectScreenPreset(presetId) {
    if (!SCREEN_PRESETS[presetId]) return;
    selectedScreenPresetId = presetId;
    try {
        localStorage.setItem('kostya_screen_preset', presetId);
    } catch (e) {}

    document.querySelectorAll('.screen-preset-card').forEach((card) => {
        const isMatch = card.dataset.preset === presetId;
        card.classList.toggle('active', isMatch);
    });

    updateScreenSpecsUI(presetId);
}

function updateScreenQualityBadges() {
    if (isScreenSharing && activeScreenPreset) {
        if (screenQualityBadge) {
            screenQualityBadge.textContent = activeScreenPreset.badge;
            screenQualityBadge.title = `Текущее качество: ${activeScreenPreset.name} (${activeScreenPreset.fpsDisplay}, ${activeScreenPreset.bitrateDisplay}) — клик для изменения`;
            screenQualityBadge.style.display = 'inline-block';
        }
        if (tileScreenQualityBtn) {
            tileScreenQualityBtn.innerHTML = `⚙️ ${activeScreenPreset.fullBadge} (${activeScreenPreset.name})`;
            tileScreenQualityBtn.title = `Качество экрана: ${activeScreenPreset.name} (${activeScreenPreset.fpsDisplay}, ${activeScreenPreset.bitrateDisplay}) — клик для изменения`;
            tileScreenQualityBtn.style.display = 'inline-flex';
        }
    } else {
        if (screenQualityBadge) {
            screenQualityBadge.style.display = 'none';
        }
        if (tileScreenQualityBtn) {
            tileScreenQualityBtn.style.display = 'none';
        }
    }
}

function openScreenShareModal(isLive = false) {
    if (!screenShareModal) return;

    const presetToSelect = isScreenSharing && activeScreenPreset
        ? activeScreenPreset.id
        : selectedScreenPresetId;

    selectScreenPreset(presetToSelect);

    if (screenAudioCheckbox) {
        screenAudioCheckbox.checked = screenAudioEnabled;
    }

    if (isScreenSharing) {
        if (screenModalTitleText) {
            screenModalTitleText.textContent = 'Настройки качества экрана (В эфире)';
        }
        if (screenLiveBanner) {
            screenLiveBanner.style.display = 'flex';
        }
        if (screenCurrentPresetLabel && activeScreenPreset) {
            screenCurrentPresetLabel.textContent = `${activeScreenPreset.name} (${activeScreenPreset.fpsDisplay})`;
        }
        if (screenStopBtn) {
            screenStopBtn.style.display = 'inline-flex';
        }
        if (screenConfirmText) {
            screenConfirmText.textContent = 'Применить на лету';
        }
    } else {
        if (screenModalTitleText) {
            screenModalTitleText.textContent = 'Демонстрация экрана';
        }
        if (screenLiveBanner) {
            screenLiveBanner.style.display = 'none';
        }
        if (screenStopBtn) {
            screenStopBtn.style.display = 'none';
        }
        if (screenConfirmText) {
            screenConfirmText.textContent = 'Начать демонстрацию';
        }
    }

    screenShareModal.style.display = 'flex';
}

function closeScreenShareModal() {
    if (screenShareModal) {
        screenShareModal.style.display = 'none';
    }
}

async function applyScreenBitrate(maxBitrateBps) {
    if (!pc) return;
    try {
        const sender = pc
            .getSenders()
            .find((s) => s.track && s.track.kind === 'video');
        if (!sender || !sender.getParameters || !sender.setParameters) return;
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = maxBitrateBps;
        await sender.setParameters(params);
        log(`⚡ Битрейт WebRTC установлен: ${Math.round(maxBitrateBps / 1000)} кбит/с`);
    } catch (err) {
        console.warn('Не удалось применить maxBitrate к RTCRtpSender:', err);
    }
}

async function mixScreenAudioToCall(screenAudioTrack) {
    if (!pc || !screenAudioTrack) return;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtx) audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        mixedAudioDestination = audioCtx.createMediaStreamDestination();

        // 1. Подключаем аудио экрана
        const screenAudioStream = new MediaStream([screenAudioTrack]);
        screenAudioMixerNode = audioCtx.createMediaStreamSource(screenAudioStream);
        screenAudioMixerNode.connect(mixedAudioDestination);

        // 2. Если микрофон есть, микшируем и его
        if (localStream && localStream.getAudioTracks().length > 0) {
            const micTrack = localStream.getAudioTracks()[0];
            const micStream = new MediaStream([micTrack]);
            micAudioMixerNode = audioCtx.createMediaStreamSource(micStream);
            micAudioMixerNode.connect(mixedAudioDestination);
        }

        const mixedTrack = mixedAudioDestination.stream.getAudioTracks()[0];
        const audioSender = pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
        if (audioSender && mixedTrack) {
            await audioSender.replaceTrack(mixedTrack);
            log('🔊 Системный звук экрана смикширован и отправляется в звонок');
        }
    } catch (e) {
        console.warn('Audio mixing error:', e);
    }
}

async function cleanupScreenAudioMixing() {
    if (screenAudioMixerNode) {
        try { screenAudioMixerNode.disconnect(); } catch (e) {}
        screenAudioMixerNode = null;
    }
    if (micAudioMixerNode) {
        try { micAudioMixerNode.disconnect(); } catch (e) {}
        micAudioMixerNode = null;
    }
    mixedAudioDestination = null;

    if (pc && localStream) {
        try {
            const audioSender = pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
            const micTrack = localStream.getAudioTracks()[0];
            if (audioSender && micTrack) {
                await audioSender.replaceTrack(micTrack);
                log('🎤 Восстановлен микрофонный аудиопоток');
            }
        } catch (e) {
            console.warn('Restore mic track error:', e);
        }
    }
}

// Запуск демонстрации экрана с выбранным пресетом
async function startScreenShareWithPreset(preset, withAudio) {
    if (isScreenSharing) {
        stopScreenShare();
        return;
    }

    try {
        log(`🖥️ Запрос на демонстрацию экрана: [${preset.name}] (${preset.fpsDisplay}, ${preset.bitrateDisplay})...`);

        const videoConstraints = {
            cursor: 'always',
            frameRate: { ideal: preset.fps, max: preset.fps },
        };

        if (preset.width && preset.height && preset.id !== 'games') {
            videoConstraints.width = { ideal: preset.width, max: preset.width };
            videoConstraints.height = { ideal: preset.height, max: preset.height };
        }

        const audioConstraints = withAudio
            ? {
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false,
              }
            : false;

        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: videoConstraints,
            audio: audioConstraints,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) return;

        // Применяем WebRTC contentHint ('detail' для Эконом/Стандарт, 'motion' для Игр)
        if ('contentHint' in screenTrack) {
            screenTrack.contentHint = preset.contentHint;
            log(`🎨 Установлен contentHint: "${preset.contentHint}" (${preset.contentHint === 'detail' ? 'четкость текста и схем' : 'плавность динамики'})`);
        }

        // Если активен WebRTC звонок — передаем видеопоток экрана собеседнику
        if (pc) {
            const sender = pc
                .getSenders()
                .find((s) => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(screenTrack);
                log('📤 Видеопоток экрана передается собеседнику');
            }
            await applyScreenBitrate(preset.bitrateKbps * 1000);

            // Обработка звука экрана
            const screenAudioTrack = screenStream.getAudioTracks()[0];
            if (screenAudioTrack) {
                log('🔊 Аудиопоток экрана обнаружен, включаем трансляцию звука...');
                mixScreenAudioToCall(screenAudioTrack);
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
        activeScreenPreset = preset;
        updateScreenQualityBadges();

        screenShareBtn.classList.add('active');
        screenShareBtn.title = `Остановить демонстрацию экрана (S) • ${preset.name} (${preset.fpsDisplay})`;
        log(`🖥️ Демонстрация экрана запущена: ${preset.name} (${preset.fpsDisplay}, ${preset.bitrateDisplay})`);
        showToastNotification(`🖥️ Демонстрация экрана запущена! Для рисования нажмите "Аннотации" (E)`, 'success');

        if (dataChannel && dataChannel.readyState === 'open') {
            try {
                dataChannel.send(JSON.stringify({ type: 'screen_share_status', sharing: true }));
            } catch (e) {}
        }
        updateTileMediaViews();

        // Обработка кнопки "Остановить доступ" в системной панели браузера
        screenTrack.onended = () => {
            stopScreenShare();
        };

        const screenAudioTrack = screenStream.getAudioTracks()[0];
        if (screenAudioTrack) {
            screenAudioTrack.onended = () => {
                cleanupScreenAudioMixing();
            };
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            log('⚠️ Ошибка демонстрации экрана: ' + err.message, 'warn');
            showToastNotification('Ошибка запуска экрана: ' + err.message, 'error');
        } else {
            log('ℹ️ Демонстрация экрана отменена пользователем');
        }
    }
}

// Переключение качества на лету без перезапуска демонстрации
async function applyScreenPresetOnTheFly(preset) {
    if (!isScreenSharing || !screenStream) return;
    activeScreenPreset = preset;
    log(`🔄 Переключение качества на лету: ${preset.name} (${preset.fpsDisplay}, ${preset.bitrateDisplay})...`);

    const screenTrack = screenStream.getVideoTracks()[0];
    if (screenTrack) {
        if ('contentHint' in screenTrack) {
            screenTrack.contentHint = preset.contentHint;
            log(`🎨 Обновлен contentHint: "${preset.contentHint}"`);
        }
        if (screenTrack.applyConstraints) {
            try {
                const newConstraints = {
                    frameRate: { ideal: preset.fps, max: preset.fps },
                };
                if (preset.width && preset.height && preset.id !== 'games') {
                    newConstraints.width = { ideal: preset.width, max: preset.width };
                    newConstraints.height = { ideal: preset.height, max: preset.height };
                }
                await screenTrack.applyConstraints(newConstraints);
            } catch (err) {
                console.warn('applyConstraints error:', err);
            }
        }
    }

    if (pc) {
        await applyScreenBitrate(preset.bitrateKbps * 1000);
    }

    updateScreenQualityBadges();
    screenShareBtn.title = `Остановить демонстрацию экрана (S) • ${preset.name} (${preset.fpsDisplay})`;
    log(`✅ Качество демонстрации успешно обновлено: ${preset.name} (${preset.fpsDisplay}, ${preset.bitrateDisplay})`);
    showToastNotification(`Качество экрана изменено: ${preset.name} (${preset.fpsDisplay})`, 'info');
}

// Остановка демонстрации экрана
async function stopScreenShare() {
    if (!isScreenSharing) return;

    if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        screenStream = null;
    }

    cleanupScreenAudioMixing();

    isScreenSharing = false;
    activeScreenPreset = null;
    updateScreenQualityBadges();

    screenShareBtn.classList.remove('active');
    screenShareBtn.title = 'Демонстрация экрана (S)';

    if (dataChannel && dataChannel.readyState === 'open') {
        try {
            dataChannel.send(JSON.stringify({ type: 'screen_share_status', sharing: false }));
        } catch (e) {}
    }

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
    updateTileMediaViews();

    log('🖥️ Демонстрация экрана остановлена');
    showToastNotification('🖥️ Демонстрация экрана остановлена', 'info');
}

// Базовый toggle для обратной совместимости
async function toggleScreenShare() {
    if (isScreenSharing) {
        stopScreenShare();
    } else {
        openScreenShareModal(false);
    }
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

// === УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ ВЫЗОВА И СБРОСА ===
function clearPendingReconnectTimers() {
    if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
    }
    if (iceRestartCheckInterval) {
        clearInterval(iceRestartCheckInterval);
        iceRestartCheckInterval = null;
    }
    if (iceRestartTimeout) {
        clearTimeout(iceRestartTimeout);
        iceRestartTimeout = null;
    }
}

function notifyPeerHangup(reason = 'user_hangup') {
    if (dataChannel && dataChannel.readyState === 'open') {
        try {
            dataChannel.send(
                JSON.stringify({
                    type: 'call_hangup',
                    reason: reason,
                    time: new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    }),
                }),
            );
            log(`📤 Отправлен сигнал о завершении вызова собеседнику (${reason})`);
        } catch (e) {
            log('⚠️ Не удалось отправить сигнал завершения вызова: ' + e.message, 'warn');
        }
    }
}

// === ИНИЦИАЛИЗАЦИЯ WEBRTC PEER CONNECTION ===
function initPeer() {
    if (pc) return;
    isCallEnding = false;
    clearPendingReconnectTimers();
    if (callEndedResetTimeout) {
        clearTimeout(callEndedResetTimeout);
        callEndedResetTimeout = null;
    }
    log('🔧 Создание RTCPeerConnection...');
    pc = new RTCPeerConnection({ ...configuration, bundlePolicy: "max-bundle" });

    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) pc.addTrack(audioTrack, localStream);

        const realVideoTrack = localStream.getVideoTracks()[0];
        let videoTrack = null;
        if (isScreenSharing && screenStream && screenStream.getVideoTracks()[0]) {
            videoTrack = screenStream.getVideoTracks()[0];
        } else {
            videoTrack = camEnabled && realVideoTrack ? realVideoTrack : getAvatarTrack();
        }
        if (videoTrack) {
            pc.addTrack(videoTrack, localStream);
        }
        if (isScreenSharing && activeScreenPreset) {
            applyScreenBitrate(activeScreenPreset.bitrateKbps * 1000);
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

    let addedCandidatesCount = 0;
    let firstHostAdded = false;
    let iceReady = false;
    let srflxReceived = false;

    function unlockCopyButton(reason) {
        if (iceReady) return;
        iceReady = true;
        log(`✅ ICE готов (${reason})`);

        if (addedCandidatesCount === 0) {
            log('❌ ICE-кандидаты не найдены! Проверьте сеть и STUN-серверы.', 'error');
            updateAppStatus('Ошибка: нет кандидатов', 'failed');

            // Не выводим код, сбрасываем состояние кнопки
            if (currentRole === 'caller') {
                createCallBtn.disabled = false;
                createCallBtn.innerHTML = 'Сгенерировать код звонка';
            } else {
                answerCallBtn.disabled = false;
                answerCallBtn.innerHTML = '✅ Принять звонок';
            }
            return; // Выходим, код не генерируем
        }

        if (pc.localDescription) {
            rawLocalJson = JSON.stringify(
                {
                    type: pc.localDescription.type,
                    sdp: pc.localDescription.sdp,
                },
                null,
                2,
            );

            let newsdp = pc.localDescription.sdp
                .split('\r\n')
                .filter(line => {
                    if (!line.startsWith('a=candidate:')) return true;
                    if (line.includes('.local')) return false;
                    const rest = line.slice('a=candidate:'.length);
                    if (rest.includes(':')) return false; 
                    return true;
                })
                .join('\r\n');

            const compressed = compressAndEncode(newsdp);
            compressedLocalSdp = compressed;
            devLocalSdp.value = isShowingRawJson ? rawLocalJson : compressed;
            const ratio = Math.round(
                (compressed.length / rawLocalJson.length) * 100,
            );
            metricCompression.textContent = `${rawLocalJson.length}B → ${compressed.length}B (${ratio}%)`;
            log(
                `📦 Код сжат: ${rawLocalJson.length} → ${compressed.length} символов (-${100 - ratio}%)`,
            );

            if (currentRole === 'caller') {
                callerLocalToken.value = compressed;
                //callerLocalToken.value = rawLocalJson;
                copyCallerTokenBtn.disabled = false;
                shareCallerTokenBtn.disabled = false;
                callerStep2.classList.remove('disabled');
                callerStep3.classList.remove('disabled');
                updateAppStatus(
                    'Код звонка готов, отправьте другу',
                    'waiting',
                );
            }
            else {
                answererLocalToken.value = compressed;
                copyAnswererTokenBtn.disabled = false;
                shareAnswererTokenBtn.disabled = false;
                answererStep2.classList.remove('disabled');
                updateAppStatus(
                    'Ответный код готов, отправьте звонящему',
                    'waiting',
                );
            }
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

            // Фильтрация mDNS (.local) host-кандидатов — бесполезны для соединения через интернет
            if (address.endsWith('.local')) {
                log(`🚫 Пропуск mDNS host: ${address}`, 'ice');
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

            addedCandidatesCount++;

            if (candidate.type === 'srflx' && !srflxReceived) {
                srflxReceived = true;
                unlockCopyButton('получен srflx');
            }
        }
        updateDevMetrics();
    };

    // Обработка состояния соединения
    pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        log(`🔌 ICE State: ${state}`);
        updateDevMetrics();

        if (isCallEnding) {
            return;
        }

        if (state === 'connected' || state === 'completed') {
            clearPendingReconnectTimers();
            updateAppStatus('В звонке', 'connected');
            if (reconnectBanner) reconnectBanner.style.display = 'none';

            // Переключение на экран активного звонка
            lobbyView.style.display = 'none';
            callStageView.style.display = 'flex';
            updateTileMediaViews();
            startCallTimer();
        } else if (state === 'disconnected') {
            log('⚠️ Соединение с собеседником потеряно. Ожидание восстановления...');
            updateAppStatus('Связь прервана...', 'waiting');
            showConnectionLostBanner('Связь с собеседником прервана. Проверка соединения...');

            clearTimeout(disconnectTimer);
            disconnectTimer = setTimeout(() => {
                if (isCallEnding) return;
                if (pc && (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed')) {
                    log('❌ Связь не восстановилась. Звонок завершён.', 'warn');
                    showToastNotification('🔴 Связь с собеседником разорвана. Звонок завершён.', 'warn');
                    resetCall('connection_lost');
                }
            }, 5000);
        } else if (state === 'failed') {
            log('❌ Соединение разорвано (ICE Failed).');
            clearPendingReconnectTimers();
            showToastNotification('🔴 Соединение разорвано. Звонок завершён.', 'warn');
            resetCall('connection_failed');
        } else if (state === 'closed') {
            log('🔒 ICE Соединение закрыто.');
            clearPendingReconnectTimers();
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
        log(`📥 Получен медиа-трек от собеседника: ${event.track.kind}`);

        // 1. ИСПРАВЛЕНИЕ: Аккуратно добавляем треки в единый поток, не перезаписывая его
        if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = new MediaStream();
        }
        remoteVideo.srcObject.addTrack(event.track);

        remoteVideo.play().catch((err) => {
            if (err.name !== 'AbortError')
                log('Ошибка воспроизведения: ' + err.message, 'error');
        });

        updateTileMediaViews();

        // 2. ИСПРАВЛЕНИЕ: Запускаем анализатор только тогда, когда пришло аудио
        if (event.track.kind === 'audio') {
            setupRemoteAudioAnalysis(remoteVideo.srcObject);
        }
    };
}

// === УПРАВЛЕНИЕ БАННЕРОМ И ПРОВЕРКОЙ СВЯЗИ ===
function showConnectionLostBanner(descText = 'Связь с собеседником прервана. Проверка соединения...') {
    if (!reconnectBanner) return;
    reconnectBanner.style.display = 'flex';
    if (reconnectDesc) {
        reconnectDesc.textContent = descText;
    }
    if (reconnectActionBtn) {
        reconnectActionBtn.textContent = 'Завершить звонок';
    }
    if (shareNewCodeBtn) {
        shareNewCodeBtn.style.display = 'none';
    }
}

async function attemptAutoReconnect() {
    if (!pc || isCallEnding) return;
    log('🔄 Проверка восстановления связи...');
    updateAppStatus('Связь прервана...', 'waiting');
    showConnectionLostBanner();

    try {
        clearPendingReconnectTimers();
        let restored = false;
        iceRestartCheckInterval = setInterval(() => {
            if (isCallEnding) {
                clearPendingReconnectTimers();
                return;
            }
            if (pc && (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed')) {
                restored = true;
                clearPendingReconnectTimers();
                log('✅ Связь восстановлена автоматически!');
                updateAppStatus('В звонке', 'connected');
                if (reconnectBanner) reconnectBanner.style.display = 'none';
            }
        }, 500);

        iceRestartTimeout = setTimeout(() => {
            clearPendingReconnectTimers();
            if (!restored && pc && !isCallEnding) {
                log('❌ Связь не восстановилась. Звонок завершён.', 'warn');
                showToastNotification('🔴 Связь разорвана. Звонок завершён.', 'warn');
                resetCall('connection_lost');
            }
        }, 5000);
    } catch (err) {
        log('❌ Ошибка проверки связи: ' + err.message, 'error');
        if (!isCallEnding) {
            resetCall('connection_lost');
        }
    }
}

function showReconnectBanner() {
    showConnectionLostBanner('Сеть изменилась или соединение с собеседником потеряно.');
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

        // Сброс старого peer connection перед повторной генерацией
        if (pc) {
            log('♻️ Пересоздание RTCPeerConnection...');
            pc.close();
            pc = null;
        }

        initPeer();

        const transceivers = pc.getTransceivers();

        for (const transceiver of transceivers) {
            const kind = transceiver.receiver.track.kind; // 'audio' или 'video'

            // Получаем все кодеки, поддерживаемые текущим transceiver
            const codecs = RTCRtpSender.getCapabilities(kind).codecs;

            let filtered;
            if (kind === 'video') {
                // Оставляем только VP8 и связанный с ним RTX (если нужен)
                filtered = codecs.filter(c =>
                    c.mimeType === 'video/VP8' ||
                    c.mimeType === 'video/rtx' && c.sdpFmtpLine?.includes('apt=96') // номер должен соответствовать payload VP8
                );
                // Если хотите использовать H264, замените на:
                // filtered = codecs.filter(c => c.mimeType === 'video/H264' && c.sdpFmtpLine?.includes('profile-level-id=42e01f'));
            } else {
                // Аудио оставляем только Opus
                filtered = codecs.filter(c => c.mimeType === 'audio/opus');
            }

            // Ключевой момент: setCodecPreferences должен вызываться перед createOffer
            transceiver.setCodecPreferences(filtered);
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        rawLocalJson = JSON.stringify(
            {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp,
            },
            null,
            2,
        );
        devLocalSdp.value = isShowingRawJson ? rawLocalJson : pc.localDescription.sdp;
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
        const validSdp = await getValidSdp(remoteToken, false);
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
        const validSdp = await getValidSdp(remoteToken, true);
        rawRemoteJson = validSdp;
        devRemoteSdp.value = validSdp;

        await pc.setRemoteDescription(
            new RTCSessionDescription(JSON.parse(validSdp)),
        );
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        rawLocalJson = JSON.stringify(
            {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp,
            },
            null,
            2,
        );
        devLocalSdp.value = isShowingRawJson ? rawLocalJson : pc.localDescription.sdp;

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

function handleBinaryFileChunk(buffer) {
    if (buffer.byteLength < 8) return;
    const view = new DataView(buffer);
    const transferId = view.getUint32(0, true);
    const chunkIndex = view.getUint32(4, true);

    const fileObj = receivingFilesByTransferId.get(transferId);
    if (!fileObj) return;

    // Срез без лишних конвертаций в строки
    const chunkData = buffer.slice(8);
    fileObj.chunks[chunkIndex] = chunkData;
    fileObj.receivedChunks++;
    fileObj.receivedBytes += chunkData.byteLength;

    const now = performance.now();
    if (
        !fileObj.lastUiUpdate ||
        now - fileObj.lastUiUpdate > 120 ||
        fileObj.receivedChunks === fileObj.meta.totalChunks
    ) {
        fileObj.lastUiUpdate = now;
        const pct = Math.min(
            100,
            Math.round((fileObj.receivedChunks / fileObj.meta.totalChunks) * 100),
        );
        const elapsedSec = (now - fileObj.startTime) / 1000;
        const speedMBps =
            elapsedSec > 0.3
                ? fileObj.receivedBytes / (1024 * 1024) / elapsedSec
                : 0;
        const speedText = speedMBps > 0.1 ? ` (${speedMBps.toFixed(1)} МБ/с)` : '';
        const progEl = document.getElementById(`prog_${fileObj.meta.fileId}`);
        if (progEl) {
            progEl.textContent = `Приём: ${pct}%${speedText}`;
        }
    }
}

function setupDataChannel(dc) {
    dataChannel = dc;
    dc.binaryType = 'arraybuffer';
    try {
        dc.bufferedAmountLowThreshold = 1024 * 1024; // 1 МБ
    } catch (e) {}

    dc.onopen = () => {
        log(`💬 P2P Чат и передача файлов подключены (версия клиента: v${APP_VERSION})`);
        if (chatInput)
            chatInput.placeholder = 'Сообщение или Ctrl+V для картинки...';
        // Передаем рукопожатие версии и гардероб аватара собеседнику
        try {
            dc.send(
                JSON.stringify({
                    type: 'client_handshake',
                    version: APP_VERSION,
                    build: APP_BUILD_DATE,
                    profile: avatarProfile,
                    camEnabled: camEnabled,
                    screenSharing: isScreenSharing,
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
            if (event.data instanceof ArrayBuffer) {
                handleBinaryFileChunk(event.data);
                return;
            }

            const msg = JSON.parse(event.data);

            if (msg.type === 'call_hangup' || msg.type === 'hangup') {
                log('🔴 Собеседник завершил звонок');
                isCallEnding = true;
                clearPendingReconnectTimers();
                if (reconnectBanner) reconnectBanner.style.display = 'none';
                showToastNotification('📞 Собеседник завершил звонок', 'info');
                resetCall('peer_hangup');
                return;
            }

            if (msg.type === 'app_visibility') {
                handlePeerVisibilityChange(msg.hidden);
                return;
            }

            if (msg.type === 'file_start') {
                log(
                    `📥 Начало приёма P2P файла: ${msg.name} (${formatFileSize(msg.size)})`,
                );
                const fileObj = {
                    meta: msg,
                    chunks: new Array(msg.totalChunks),
                    receivedChunks: 0,
                    receivedBytes: 0,
                    startTime: performance.now(),
                    lastUiUpdate: 0,
                };
                receivingFiles.set(msg.fileId, fileObj);
                if (msg.transferId !== undefined) {
                    receivingFilesByTransferId.set(msg.transferId, fileObj);
                }

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
                // Поддержка обратной совместимости с текстовыми Base64-чанками
                const fileObj = receivingFiles.get(msg.fileId);
                if (fileObj) {
                    const chunkBuffer = base64ToArrayBuffer(msg.data);
                    fileObj.chunks[msg.chunkIndex] = chunkBuffer;
                    fileObj.receivedChunks++;
                    fileObj.receivedBytes = (fileObj.receivedBytes || 0) + chunkBuffer.byteLength;

                    const now = performance.now();
                    if (
                        !fileObj.lastUiUpdate ||
                        now - fileObj.lastUiUpdate > 120 ||
                        fileObj.receivedChunks === fileObj.meta.totalChunks
                    ) {
                        fileObj.lastUiUpdate = now;
                        const pct = Math.round(
                            (fileObj.receivedChunks / fileObj.meta.totalChunks) * 100,
                        );
                        const progEl = document.getElementById(
                            `prog_${msg.fileId}`,
                        );
                        if (progEl) {
                            progEl.textContent = `Приём: ${pct}%`;
                        }
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

                    if (fileObj.meta.transferId !== undefined) {
                        receivingFilesByTransferId.delete(fileObj.meta.transferId);
                    }
                    receivingFiles.delete(msg.fileId);
                }
            } else if (msg.type === 'reaction') {
                triggerFloatingReaction(msg.emoji, true);
            } else if (msg.type === 'sound') {
                playSound(msg.soundId, true);
            } else if (msg.type === 'wb_draw') {
                handleRemoteWbDraw(msg);
            } else if (msg.type === 'wb_curve') {
                handleRemoteWbCurve(msg);
            } else if (msg.type === 'wb_batch') {
                handleRemoteWbBatch(msg);
            } else if (msg.type === 'wb_shape') {
                handleRemoteWbShape(msg);
            } else if (msg.type === 'wb_clear') {
                handleRemoteWbClear();
            } else if (msg.type === 'screen_draw_stroke') {
                handleRemoteScreenDrawStroke(msg);
            } else if (msg.type === 'screen_draw_batch') {
                handleRemoteScreenDrawBatch(msg);
            } else if (msg.type === 'screen_draw_laser') {
                handleRemoteScreenDrawLaser(msg);
            } else if (msg.type === 'screen_draw_clear') {
                handleRemoteScreenDrawClear();
            } else if (msg.type === 'cam_status') {
                remoteCamEnabled = !!msg.enabled;
                updateTileMediaViews();
                log(remoteCamEnabled ? '📷 Собеседник включил реальную камеру' : '📷 Собеседник выключил камеру');
            } else if (msg.type === 'screen_share_status') {
                remoteScreenSharing = !!msg.sharing;
                handleRemoteScreenShareStatus(msg.sharing);
                updateTileMediaViews();
            } else if (msg.type === 'client_handshake') {
                handlePeerHandshake(msg);
            } else if (msg.type === 'avatar_profile') {
                remoteAvatarProfile = msg.profile;
                log(
                    `🎭 Получен аватар собеседника: ${msg.profile?.name || 'Собеседник'}`,
                );
                updateTileMediaViews();
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

function handlePeerHandshake(msg) {
    const peerVer = msg.version || '1.0.0 (legacy)';
    remoteAppVersion = peerVer;
    log(`🤝 Собеседник подключился: клиент v${peerVer} (сборка: ${msg.build || '—'})`);

    if (metricPeerVersion) {
        metricPeerVersion.textContent = `v${peerVer}`;
        if (msg.version && msg.version !== APP_VERSION) {
            metricPeerVersion.className = 'metric-val version-mismatch';
            metricPeerVersion.title = `Несовпадение версий: собеседник v${peerVer}, у вас v${APP_VERSION}`;
            log(
                `⚠️ Внимание! Версия собеседника (v${peerVer}) отличается от вашей (v${APP_VERSION}). Если возникают проблемы связи, обновите страницу (Ctrl+F5).`,
                'warn',
            );
            showToastNotification(
                `⚠️ Версия собеседника v${peerVer} (у вас v${APP_VERSION})`,
                'warn',
            );
        } else {
            metricPeerVersion.className = 'metric-val version-match';
            metricPeerVersion.title = `Версии клиентов полностью совпадают: v${APP_VERSION}`;
        }
    }

    if (typeof msg.camEnabled === 'boolean') {
        remoteCamEnabled = msg.camEnabled;
    }
    if (typeof msg.screenSharing === 'boolean') {
        remoteScreenSharing = msg.screenSharing;
    }
    if (msg.profile) {
        remoteAvatarProfile = msg.profile;
        log(
            `🎭 Получен аватар собеседника: ${msg.profile?.name || 'Собеседник'} (${msg.profile?.mode || 'cartoon'})`,
        );
    }
    updateTileMediaViews();
}

function handlePeerVisibilityChange(hidden) {
    const bgBadge = document.getElementById('remote-bg-badge');
    const bgBanner = document.getElementById('remote-bg-banner');
    if (hidden) {
        log('📱 Собеседник свернул сайт (в фоне, аудио продолжается)');
        showToastNotification('📱 Собеседник свернул вкладку (аудио продолжается)', 'info');
        if (bgBadge) bgBadge.style.display = 'inline-flex';
        if (bgBanner) bgBanner.style.display = 'inline-flex';
    } else {
        log('📱 Собеседник вернулся на сайт');
        showToastNotification('📱 Собеседник вернулся в звонок', 'info');
        if (bgBadge) bgBadge.style.display = 'none';
        if (bgBanner) bgBanner.style.display = 'none';
    }
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

    const isLiveP2P = dataChannel && dataChannel.readyState === 'open';

    // Добавляем сообщение в локальный чат
    appendChatMessage({
        sender: 'local',
        senderName: 'Вы',
        time: timeStr,
        isInlineImage: isInlineImage,
        fileData: {
            fileId: fileId,
            name: fileName,
            size: fileSize,
            url: localUrl,
            inProgress: isLiveP2P,
        },
    });

    // Если активен P2P канал связи
    if (isLiveP2P) {
        try {
            const transferId = p2pTransferCounter++;
            const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
            log(
                `📤 Отправка P2P файла: ${fileName} (${formatFileSize(fileSize)}, ${totalChunks} чанков)`,
            );

            // 1. Метаданные файла
            dataChannel.send(
                JSON.stringify({
                    type: 'file_start',
                    fileId: fileId,
                    transferId: transferId,
                    name: fileName,
                    size: fileSize,
                    mimeType: mimeType,
                    isInlineImage: isInlineImage,
                    totalChunks: totalChunks,
                    chunkSize: CHUNK_SIZE,
                    time: timeStr,
                }),
            );

            // 2. Потоковая отправка чанков с аппаратным контролем буфера SCTP
            const BUFFER_HIGH = 4 * 1024 * 1024; // 4 МБ предел очереди
            const BUFFER_LOW = 1024 * 1024; // 1 МБ порог возобновления
            try {
                dataChannel.bufferedAmountLowThreshold = BUFFER_LOW;
            } catch (e) {}

            let offset = 0;
            let chunkIndex = 0;
            let lastUiTime = 0;
            const startTime = performance.now();

            while (offset < fileSize) {
                // Если буфер отправки переполнен, ждём события разгрузки
                if (dataChannel.bufferedAmount > BUFFER_HIGH) {
                    await new Promise((resolve) => {
                        let timer = null;
                        const onLow = () => {
                            if (timer) clearTimeout(timer);
                            dataChannel.removeEventListener('bufferedamountlow', onLow);
                            resolve();
                        };
                        timer = setTimeout(onLow, 150);
                        dataChannel.addEventListener('bufferedamountlow', onLow, { once: true });
                    });
                }

                const currentSize = Math.min(CHUNK_SIZE, fileSize - offset);
                const chunkBlob = fileOrBlob.slice(offset, offset + currentSize);
                const chunkBuffer = await chunkBlob.arrayBuffer();

                // 8 байт бинарный заголовок: transferId (Uint32) + chunkIndex (Uint32)
                const packet = new Uint8Array(8 + chunkBuffer.byteLength);
                const view = new DataView(packet.buffer);
                view.setUint32(0, transferId, true);
                view.setUint32(4, chunkIndex, true);
                packet.set(new Uint8Array(chunkBuffer), 8);

                dataChannel.send(packet.buffer);

                offset += currentSize;
                chunkIndex++;

                // Дросселированное обновление статуса отправки
                const now = performance.now();
                if (now - lastUiTime > 120 || offset >= fileSize) {
                    lastUiTime = now;
                    const pct = Math.min(100, Math.round((offset / fileSize) * 100));
                    const elapsedSec = (now - startTime) / 1000;
                    const speedMBps =
                        elapsedSec > 0.3
                            ? (offset / (1024 * 1024)) / elapsedSec
                            : 0;
                    const speedText = speedMBps > 0.1 ? ` (${speedMBps.toFixed(1)} МБ/с)` : '';
                    const progEl = document.getElementById(`prog_${fileId}`);
                    if (progEl) {
                        progEl.textContent = `Отправка: ${pct}%${speedText}`;
                    }
                }
            }

            // 3. Завершение передачи
            dataChannel.send(
                JSON.stringify({
                    type: 'file_end',
                    fileId: fileId,
                    transferId: transferId,
                }),
            );

            // Превращаем карточку прогресса у отправителя в готовую карточку файла
            const cardEl = document.getElementById(`card_${fileId}`);
            if (cardEl && cardEl.parentElement) {
                const bubble = cardEl.parentElement;
                bubble.innerHTML = '';
                if (isInlineImage) {
                    const img = document.createElement('img');
                    img.className = 'chat-inline-img';
                    img.src = localUrl;
                    img.alt = fileName;
                    img.title = 'Нажмите, чтобы открыть изображение в новой вкладке';
                    img.addEventListener('click', () => {
                        window.open(localUrl, '_blank');
                    });
                    bubble.appendChild(img);
                } else {
                    const fileCard = document.createElement('div');
                    fileCard.className = 'file-card';
                    fileCard.innerHTML = `
                        <span class="file-card-icon">${getFileIcon(fileName)}</span>
                        <div class="file-card-meta">
                            <span class="file-card-name" title="${fileName}">${fileName}</span>
                            <span class="file-card-size">${formatFileSize(fileSize)}</span>
                        </div>
                        <a href="${localUrl}" download="${fileName}" class="file-download-btn">⬇️ Скачать</a>
                    `;
                    bubble.appendChild(fileCard);
                }
            }

            log(`✅ Файл "${fileName}" успешно отправлен собеседнику по P2P!`);
        } catch (err) {
            log('❌ Ошибка отправки файла: ' + err.message, 'error');
            const progEl = document.getElementById(`prog_${fileId}`);
            if (progEl) {
                progEl.textContent = 'Ошибка отправки';
                progEl.style.color = '#ed4245';
            }
        }
    } else if (isTestMode) {
        // Симуляция ответа в тестовом режиме
        setTimeout(() => {
            if (!isTestMode) return;
            const replyText = isInlineImage
                ? 'Классная картинка, чувак! Заценил 👍'
                : `Файл "${fileName}" успешно получен! (${formatFileSize(fileSize)})`;

            appendChatMessage({
                sender: 'remote',
                senderName: 'Собеседник',
                text: replyText,
                time: new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                }),
            });
        }, 800);
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

function simulateTestChatReply(userText) {
    const replies = [
        'Ага, привет! Чат работает на ура!',
        'Слышу и вижу тебя отлично!',
        'Никаких серверов — чистый P2P DataChannel! Зацени скорость!',
        'Да, всё супер! Отличная связь!',
        'Связь стабильная, задержка минимальная, всё работает идеально!',
    ];
    const randomReply = replies[Math.floor(Math.random() * replies.length)];

    setTimeout(() => {
        if (!isTestMode) return;
        const time = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
        appendChatMessage({
            sender: 'remote',
            senderName: 'Собеседник',
            text: randomReply,
            time: time,
        });
    }, 800);
}

// === ТЕСТОВЫЙ РЕЖИМ UI (СИМУЛЯЦИЯ ЗВОНКА) ===
function createMockRemoteStream() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    testCanvas = canvas;

    let buddyBlinkCounter = 0;
    let buddyIsBlinking = false;
    let mockSpeechTimer = 0;

    function render() {
        if (!isTestMode) return;
        mockSpeechTimer += 0.05;

        // Симуляция речи собеседника (периодически шлёпает ртом как в мультфильме)
        const isSpeaking = Math.sin(mockSpeechTimer * 0.9) > -0.2;
        let buddyTarget = 0;
        if (isSpeaking) {
            const chatter = Math.abs(Math.sin(mockSpeechTimer * 7));
            buddyTarget = chatter * 0.85;
        }

        // Подсвечиваем зеленый Speaking Ring собеседника в такт речи
        if (remoteTile) {
            remoteTile.classList.toggle('speaking', isSpeaking);
        }

        buddyBlinkCounter++;
        if (buddyBlinkCounter > 130 && Math.random() < 0.04) {
            buddyIsBlinking = true;
            buddyBlinkCounter = 0;
        } else if (buddyIsBlinking && buddyBlinkCounter > 6) {
            buddyIsBlinking = false;
        }

        ctx.fillStyle = '#1e1f22';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        drawCartoonCharacter(ctx, {
            cx: 320,
            cy: 230,
            mouthOpen: buddyTarget,
            isBlinking: buddyIsBlinking,
            suitColor: '#e74c3c',
            hairColor: '#e67e22',
            skinColor: '#ffe0bd',
            nameTag: '👥 Собеседник',
            volumeLevel: isSpeaking ? 0.75 : 0,
            isMuted: false,
            hatStyle: 'ushanka',
        });

        testAnimFrame = requestAnimationFrame(render);
    }

    render();
    testStream = canvas.captureStream(30);
    return testStream;
}

async function startTestCall() {
    if (isTestMode) {
        stopTestCall();
        return;
    }
    isTestMode = true;
    log('🧪 Запуск тестового звонка (симуляция активного интерфейса)...');

    // Пробуем включить свои медиа для локального окна
    try {
        await startMedia();
    } catch (e) {
        log(
            'ℹ️ Локальная веб-камера недоступна (отображается заглушка)',
            'warn',
        );
    }

    // Если поток аватара еще не был создан — инициализируем его немедленно
    if (!avatarStream) {
        initAvatarCanvas();
    }

    // Если камера выключена, показываем в локальном окне аватар
    if (localVideo) {
        const hasRealCam = camEnabled && localStream && localStream.getVideoTracks().some((t) => t.readyState === 'live');
        localVideo.srcObject = hasRealCam ? localStream : avatarStream;
        localVideo.style.transform = hasRealCam ? 'scaleX(-1)' : 'none';
    }

    // Генерируем тестовый видеопоток собеседника
    const mockStream = createMockRemoteStream();
    if (remoteVideo) {
        remoteVideo.muted = true;
        remoteVideo.srcObject = mockStream;
        remoteVideo.play().catch(() => {});
    }

    // Переключаем экраны
    lobbyView.style.display = 'none';
    callStageView.style.display = 'flex';
    updateTileMediaViews();
    startCallTimer();
    updateAppStatus('В звонке (Тест UI)', 'connected');

    const mockOfferObj = {
        type: 'offer',
        sdp: 'v=0\r\no=- 482910492 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0 1 2\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 VP8/90000\r\na=candidate:1 1 UDP 2122252543 192.168.1.10 54321 typ host\r\n',
    };
    rawLocalJson = JSON.stringify(mockOfferObj, null, 2);
    compressedLocalSdp = window.sdpCompact
        ? compressAndEncode(mockOfferObj.sdp)
        : btoa(mockOfferObj.sdp);
    devLocalSdp.value = isShowingRawJson ? rawLocalJson : compressedLocalSdp;
    metricIceState.textContent = 'connected (test)';
    metricSignalingState.textContent = 'stable';
    metricGatheringState.textContent = 'complete';
    metricCompression.textContent = `${rawLocalJson.length}B → ${compressedLocalSdp.length}B`;
    if (metricPeerVersion) {
        metricPeerVersion.textContent = `v${APP_VERSION} (тест)`;
        metricPeerVersion.className = 'metric-val version-match';
        metricPeerVersion.title = 'Симуляция тестового вызова';
    }

    // Обновляем состояние кнопок теста
    if (testCallBtn) {
        testCallBtn.innerHTML =
            '⏹️ <span class="test-btn-text">Завершить тест</span>';
        testCallBtn.classList.add('active');
    }
    if (devTestCallBtn)
        devTestCallBtn.textContent = '⏹️ Остановить Test mode call'; devTestCallBtn.className = 'btn btn-sm btn-danger';

    if (testPeerHangupBtn) testPeerHangupBtn.style.display = 'inline-flex';
    if (devTestPeerHangupBtn) devTestPeerHangupBtn.style.display = 'block';
    if (devTestPeerBgBtn) {
        devTestPeerBgBtn.style.display = 'block';
        devTestPeerBgBtn.textContent = '📱 Собеседник свернул сайт (Тест)';
    }
    isMockPeerHidden = false;

    log(
        '✅ Тестовый режим активен! Включите микрофон, чтобы проверить, как аватар говорит в такт вашей речи.',
    );
}

function stopTestCall() {
    if (!isTestMode) return;
    isTestMode = false;
    log('⏹️ Тестовый звонок остановлен');
    showToastNotification('⏹️ Тестовый звонок завершён', 'info');

    isMockCameraActive = false;
    if (mockCameraAnimFrame) { cancelAnimationFrame(mockCameraAnimFrame); mockCameraAnimFrame = null; }
    mockCameraStream = null;
    if (testAnimFrame) {
        cancelAnimationFrame(testAnimFrame);
        testAnimFrame = null;
    }
    if (testStream) {
        testStream.getTracks().forEach((t) => t.stop());
        testStream = null;
    }
    if (remoteVideo) {
        remoteVideo.srcObject = null;
    }
    if (remoteAvatar) {
        remoteAvatar.style.display = 'flex';
    }

    if (remoteTile) remoteTile.classList.remove('speaking');
    if (localTile) localTile.classList.remove('speaking');

    if (testCallBtn) {
        testCallBtn.innerHTML =
            '🧪 <span class="test-btn-text">Тест UI звонка</span>';
        testCallBtn.classList.remove('active');
    }
    if (devTestCallBtn)
        devTestCallBtn.textContent = '🧪 Test mode call'; devTestCallBtn.className = 'btn btn-sm btn-warning';

    if (testPeerHangupBtn) testPeerHangupBtn.style.display = 'none';
    if (devTestPeerHangupBtn) devTestPeerHangupBtn.style.display = 'none';
    if (devTestPeerBgBtn) devTestPeerBgBtn.style.display = 'none';
    isMockPeerHidden = false;

    const bgBadgeEl = document.getElementById('remote-bg-badge');
    if (bgBadgeEl) bgBadgeEl.style.display = 'none';
    const bgBannerEl = document.getElementById('remote-bg-banner');
    if (bgBannerEl) bgBannerEl.style.display = 'none';

    resetCall('test_ended');
}

if (testCallBtn) {
    testCallBtn.addEventListener('click', () => {
        if (isTestMode) stopTestCall();
        else startTestCall();
    });
}

if (devTestCallBtn) {
    devTestCallBtn.addEventListener('click', () => {
        if (isTestMode) stopTestCall();
        else startTestCall();
    });
}

// === ЗАВЕРШЕНИЕ ЗВОНКА (LEAVE / RESET) ===
function resetCall(reason = null) {
    log(`🔴 Завершение вызова и сброс состояния (причина: ${reason || 'ручной сброс'})...`);
    isCallEnding = true;
    clearPendingReconnectTimers();
    stopCallTimer();
    stopScreenShare();
    toggleScreenAnnotations(false);
    clearScreenDrawData(false);

    if (isTestMode) {
        isTestMode = false;
        if (testAnimFrame) cancelAnimationFrame(testAnimFrame);
        if (testStream) testStream.getTracks().forEach((t) => t.stop());
        if (testCallBtn) {
            testCallBtn.innerHTML =
                '🧪 <span class="test-btn-text">Тест UI звонка</span>';
            testCallBtn.classList.remove('active');
        }
        if (devTestCallBtn)
            devTestCallBtn.textContent = '🧪 Test mode call'; devTestCallBtn.className = 'btn btn-sm btn-warning';
    }

    if (testPeerHangupBtn) testPeerHangupBtn.style.display = 'none';
    if (devTestPeerHangupBtn) devTestPeerHangupBtn.style.display = 'none';
    if (devTestPeerBgBtn) devTestPeerBgBtn.style.display = 'none';
    isMockPeerHidden = false;
    const bgBadgeReset = document.getElementById('remote-bg-badge');
    if (bgBadgeReset) bgBadgeReset.style.display = 'none';
    const bgBannerReset = document.getElementById('remote-bg-banner');
    if (bgBannerReset) bgBannerReset.style.display = 'none';

    if (pc) {
        try {
            pc.oniceconnectionstatechange = null;
            pc.onsignalingstatechange = null;
            pc.onicegatheringstatechange = null;
            pc.ontrack = null;
            pc.close();
        } catch (e) {}
        pc = null;
    }

    if (dataChannel) {
        try {
            dataChannel.onclose = null;
            dataChannel.onerror = null;
            dataChannel.onmessage = null;
            dataChannel.close();
        } catch (e) {}
        dataChannel = null;
    }

    if (remoteVideo) {
        remoteVideo.srcObject = null;
    }
    if (remoteAvatar) {
        remoteAvatar.style.display = 'flex';
    }

    receivingFiles.clear();
    receivingFilesByTransferId.clear();

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
        setWhiteboardMode('closed');
        wbDismissedByUser = false;
        setRemoteDrawingIndicator(false);
        clearWhiteboardLocally();
        if (wbDockBadge) wbDockBadge.style.display = 'none';
    }

    // Сброс закрепления главного экрана Google Meet
    setMainParticipant('remote');

    if (metricPeerVersion) {
        metricPeerVersion.textContent = '—';
        metricPeerVersion.className = 'metric-val';
        metricPeerVersion.title = '';
    }
    remoteAppVersion = null;

    // Очистка полей токенов
    rawLocalJson = '';
    compressedLocalSdp = '';
    isShowingRawJson = false;
    if (devLocalSdp) {
        devLocalSdp.value = '';
        devLocalSdp.style.height = '';
    }
    if (devRemoteSdp) devRemoteSdp.value = '';
    if (devDecodeLocalBtn) devDecodeLocalBtn.textContent = 'Показать raw JSON';
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

    if (reconnectBanner) reconnectBanner.style.display = 'none';
    updateDevMetrics();

    // Возврат в лобби
    callStageView.style.display = 'none';
    lobbyView.style.display = 'block';

    if (callEndedResetTimeout) clearTimeout(callEndedResetTimeout);

    if (reason) {
        updateAppStatus('Звонок завершён', 'ended');
        callEndedResetTimeout = setTimeout(() => {
            if (!pc && !isTestMode) {
                updateAppStatus('Ожидание звонка', 'waiting');
                isCallEnding = false;
            }
        }, 4000);
    } else {
        updateAppStatus('Ожидание звонка', 'waiting');
        isCallEnding = false;
    }
}

leaveCallBtn.addEventListener('click', () => {
    if (isTestMode) {
        stopTestCall();
        return;
    }
    if (confirm('Вы уверены, что хотите завершить звонок?')) {
        isCallEnding = true;
        notifyPeerHangup('user_hangup');
        showToastNotification('🔴 Звонок завершён', 'info');
        setTimeout(() => {
            resetCall('local_hangup');
        }, 50);
    }
});

reconnectActionBtn.addEventListener('click', () => {
    isCallEnding = true;
    notifyPeerHangup('user_reconnect_cancel');
    showToastNotification('🔴 Звонок завершён', 'info');
    setTimeout(() => {
        resetCall('user_reset');
    }, 50);
});

// Обработка симуляции сброса звонка собеседником (Тест UI)
function simulatePeerHangup() {
    log('👤🔴 [Тест] Симуляция: Собеседник завершил звонок');
    isCallEnding = true;
    clearPendingReconnectTimers();
    if (reconnectBanner) reconnectBanner.style.display = 'none';
    showToastNotification('📞 Собеседник завершил звонок', 'info');
    resetCall('peer_hangup');
}

if (testPeerHangupBtn) {
    testPeerHangupBtn.addEventListener('click', simulatePeerHangup);
}

if (devTestPeerHangupBtn) {
    devTestPeerHangupBtn.addEventListener('click', simulatePeerHangup);
}

if (devTestPeerBgBtn) {
    devTestPeerBgBtn.addEventListener('click', () => {
        isMockPeerHidden = !isMockPeerHidden;
        handlePeerVisibilityChange(isMockPeerHidden);
        devTestPeerBgBtn.textContent = isMockPeerHidden
            ? '📱 Собеседник вернулся в звонок (Тест)'
            : '📱 Собеседник свернул сайт (Тест)';
    });
}

// === УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ ПРИЛОЖЕНИЯ (ANDROIND / МОБИЛЬНЫЕ УСТРОЙСТВА) ===
// На мобильных устройствах (Android/iOS) при сворачивании браузера НЕ сбрасываем звонок!
window.addEventListener('beforeunload', () => {
    if (isCallEnding) return;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
    );
    // Только для ПК при реальном закрытии вкладки шлём сигнал hangup
    if (!isMobile && dataChannel && dataChannel.readyState === 'open') {
        notifyPeerHangup('tab_closed');
    }
});

// Отслеживание сворачивания/разворачивания сайта (Visibility API)
document.addEventListener('visibilitychange', () => {
    const isHidden = document.visibilityState === 'hidden';
    log(`📱 Вкладка приложения: ${isHidden ? 'свернута (в фоне)' : 'активна'}`);

    // Передаем статус собеседнику, чтобы он знал, что сайт свернут, но связь активна
    if (dataChannel && dataChannel.readyState === 'open' && !isCallEnding) {
        try {
            dataChannel.send(
                JSON.stringify({
                    type: 'app_visibility',
                    hidden: isHidden,
                    time: new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    }),
                }),
            );
        } catch (e) {
            console.warn('Ошибка отправки app_visibility:', e);
        }
    }

    // При возвращении на вкладку возобновляем звук и видео если браузер приостановил их
    if (!isHidden) {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        if (remoteVideo && remoteVideo.srcObject && remoteVideo.paused) {
            remoteVideo.play().catch(() => {});
        }
    }
});

// === УПРАВЛЕНИЕ МЕДИА КНОПКАМИ И ЧАТОМ ===
previewMicBtn.addEventListener('click', toggleMic);
previewCamBtn.addEventListener('click', toggleCam);
micBtn.addEventListener('click', toggleMic);
camBtn.addEventListener('click', toggleCam);
screenShareBtn.addEventListener('click', toggleScreenShare);

// Обработчики модального окна экрана и бейджей качества
if (screenQualityBadge) {
    screenQualityBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        openScreenShareModal(isScreenSharing);
    });
}

if (tileScreenQualityBtn) {
    tileScreenQualityBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openScreenShareModal(isScreenSharing);
    });
}

screenShareBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openScreenShareModal(isScreenSharing);
});

document.querySelectorAll('.screen-preset-card').forEach((card) => {
    card.addEventListener('click', () => {
        selectScreenPreset(card.dataset.preset);
    });
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectScreenPreset(card.dataset.preset);
        }
    });
});

if (screenAudioCheckbox) {
    screenAudioCheckbox.addEventListener('change', (e) => {
        screenAudioEnabled = e.target.checked;
        try {
            localStorage.setItem('kostya_screen_audio', screenAudioEnabled);
        } catch (err) {}
    });
}

if (closeScreenModalBtn) {
    closeScreenModalBtn.addEventListener('click', closeScreenShareModal);
}
if (cancelScreenModalBtn) {
    cancelScreenModalBtn.addEventListener('click', closeScreenShareModal);
}
if (screenShareModal) {
    screenShareModal.addEventListener('click', (e) => {
        if (e.target === screenShareModal) closeScreenShareModal();
    });
}

if (screenStopBtn) {
    screenStopBtn.addEventListener('click', () => {
        closeScreenShareModal();
        stopScreenShare();
    });
}

if (confirmScreenModalBtn) {
    confirmScreenModalBtn.addEventListener('click', async () => {
        const preset = SCREEN_PRESETS[selectedScreenPresetId] || SCREEN_PRESETS.standard;
        closeScreenShareModal();
        if (isScreenSharing) {
            await applyScreenPresetOnTheFly(preset);
        } else {
            await startScreenShareWithPreset(preset, screenAudioEnabled);
        }
    });
}

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
    updateTileMediaViews();
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
        } else if (isTestMode) {
            simulateTestChatReply(text);
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

// === СЖАТИЕ И ОБРАБОТКА ФОТО ДЛЯ АВАТАРА ===
function compressImageFile(file, maxWidth = 400, maxHeight = 400, quality = 0.85) {
    return new Promise((resolve, reject) => {
        if (!file.type || !file.type.startsWith('image/')) {
            reject(new Error('Выбранный файл не является изображением'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width;
                let h = img.height;
                if (w > maxWidth || h > maxHeight) {
                    if (w > h) {
                        h = Math.round((h * maxWidth) / w);
                        w = maxWidth;
                    } else {
                        w = Math.round((w * maxHeight) / h);
                        h = maxHeight;
                    }
                }
                const c = document.createElement('canvas');
                c.width = w;
                c.height = h;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                resolve(c.toDataURL(mime, quality));
            };
            img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Ошибка чтения файла'));
        reader.readAsDataURL(file);
    });
}

// === АВАТАР ГАРДЕРОБ (КАСТОМИЗАЦИЯ В ЛОББИ И ВО ВРЕМЯ ЗВОНКА) ===
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

function broadcastAvatarProfile() {
    if (dataChannel && dataChannel.readyState === 'open') {
        try {
            dataChannel.send(
                JSON.stringify({
                    type: 'avatar_profile',
                    profile: avatarProfile,
                }),
            );
            log(
                `🎭 Профиль аватара передан собеседнику (${avatarProfile.mode === 'photo' ? 'своё фото' : 'персонаж'})`,
            );
        } catch (e) {
            log('⚠️ Ошибка передачи аватара: ' + e.message, 'warn');
        }
    }
}

function saveAvatarProfile() {
    try {
        localStorage.setItem('avatar_config', JSON.stringify(avatarProfile));
    } catch (e) {
        log('⚠️ Ошибка сохранения профиля аватара: ' + e.message, 'warn');
    }
    broadcastAvatarProfile();
    updateTileMediaViews();
}

function renderWardrobePreview() {
    const canvases = [wardrobePreviewCanvas, modalWardrobePreviewCanvas].filter(Boolean);
    canvases.forEach((canvas) => {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#111214';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (avatarProfile.mode === 'disabled') {
            const cx = canvas.width / 2;
            const cy = (canvas.height / 2) - 10;
            const r = Math.min(canvas.width, canvas.height) * 0.28;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = avatarProfile.suitColor || '#5865f2';
            ctx.fill();

            // Зеленый индикатор речи вокруг круга
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#23a55a';
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.round(r * 0.85)}px "Inter", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const initial = (avatarProfile.name || 'Вы').trim().charAt(0).toUpperCase() || '👤';
            ctx.fillText(initial, cx, cy);

            ctx.fillStyle = '#949ba4';
            ctx.font = '600 12px "Inter", sans-serif';
            ctx.fillText(avatarProfile.name || 'Вы', cx, cy + r + 18);
            ctx.restore();
            return;
        }

        if (avatarProfile.mode === 'photo') {
            if (avatarProfile.photoDataUrl) {
                const userImg = getUserPhotoImg(() => renderWardrobePreview());
                if (userImg && userImg.complete && userImg.naturalWidth > 0) {
                    drawPhotoAvatar(ctx, {
                        cx: canvas.width / 2,
                        cy: canvas.height / 2,
                        img: userImg,
                        size: Math.min(canvas.width, canvas.height) * 0.72,
                        isMiniPreview: true,
                        suitColor: avatarProfile.suitColor || '#5865f2',
                    });
                    return;
                } else {
                    // Пока фото декодируется в памяти — рисуем круговой placeholder
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(canvas.width / 2, canvas.height / 2, (canvas.width * 0.72) / 2, 0, Math.PI * 2);
                    ctx.strokeStyle = avatarProfile.suitColor || '#5865f2';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                    ctx.fill();
                    ctx.font = '28px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('🖼️', canvas.width / 2, canvas.height / 2);
                    ctx.restore();
                    return;
                }
            } else {
                // Если режим фото, но файл еще не выбран
                ctx.save();
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2, (canvas.width * 0.72) / 2, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.fill();
                ctx.font = '28px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('📷', canvas.width / 2, canvas.height / 2);
                ctx.restore();
                return;
            }
        }

        drawCartoonCharacter(ctx, {
            cx: canvas.width / 2,
            cy: (canvas.height / 2) - 5,
            scale: canvas.width / 320,
            mouthOpen: 0,
            isBlinking: false,
            suitColor: avatarProfile.suitColor || '#5865f2',
            hatStyle: avatarProfile.hatStyle || 'ushanka',
            nameTag: avatarProfile.name || 'Вы',
            isMiniPreview: true,
        });
    });
}

function syncAllWardrobeUI() {
    const mode = avatarProfile.mode || 'cartoon';

    // 1. Табы режима
    document.querySelectorAll('.avatar-mode-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    // 2. Видимость секций персонажа, фото и без аватара
    const cartoonSections = [
        document.getElementById('cartoon-wardrobe-section'),
        document.getElementById('modal-cartoon-section'),
    ].filter(Boolean);
    const photoSections = [
        document.getElementById('photo-wardrobe-section'),
        document.getElementById('modal-photo-section'),
    ].filter(Boolean);
    const disabledSections = [
        document.getElementById('disabled-wardrobe-section'),
        document.getElementById('modal-disabled-section'),
    ].filter(Boolean);

    cartoonSections.forEach((el) => {
        el.style.display = mode === 'cartoon' ? 'block' : 'none';
    });
    photoSections.forEach((el) => {
        el.style.display = mode === 'photo' ? 'block' : 'none';
    });
    disabledSections.forEach((el) => {
        el.style.display = mode === 'disabled' ? 'block' : 'none';
    });

    // Чекбоксы скрытия аватаров собеседников
    document.querySelectorAll('.hide-remote-avatars-check').forEach((cb) => {
        cb.checked = hideRemoteAvatars;
    });

    // 3. Синхронизация имени
    document.querySelectorAll('.wardrobe-name-input').forEach((input) => {
        if (input.value !== (avatarProfile.name || 'Вы')) {
            input.value = avatarProfile.name || 'Вы';
        }
    });

    // 4. Кнопки шапок
    document.querySelectorAll('.hat-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.hat === avatarProfile.hatStyle);
    });

    // 5. Точки цветов
    document.querySelectorAll('.color-dot').forEach((dot) => {
        dot.classList.toggle(
            'active',
            dot.dataset.color.toLowerCase() === (avatarProfile.suitColor || '#5865f2').toLowerCase(),
        );
    });

    // 6. Кнопки загрузки/сброса фото
    document.querySelectorAll('.remove-photo-btn').forEach((btn) => {
        btn.style.display = avatarProfile.photoDataUrl ? 'inline-flex' : 'none';
    });
    document.querySelectorAll('.upload-photo-btn').forEach((btn) => {
        btn.textContent = avatarProfile.photoDataUrl ? '🖼️ Заменить фото' : '📁 Выбрать фото';
    });
}

function openAvatarModal() {
    if (avatarModal) {
        avatarModal.style.display = 'flex';
        syncAllWardrobeUI();
        renderWardrobePreview();
    }
}

function closeAvatarModal() {
    if (avatarModal) {
        avatarModal.style.display = 'none';
    }
}

function toggleAvatarModal() {
    if (!avatarModal) return;
    if (avatarModal.style.display === 'none' || !avatarModal.style.display) {
        openAvatarModal();
    } else {
        closeAvatarModal();
    }
}

function initWardrobeControls() {
    loadAvatarProfile();

    // 1. Поля ввода имени (в лобби и в модалке)
    document.querySelectorAll('.wardrobe-name-input').forEach((input) => {
        input.value = avatarProfile.name || 'Вы';
        input.addEventListener('input', (e) => {
            const val = e.target.value.trim() || 'Вы';
            avatarProfile.name = val;
            saveAvatarProfile();
            renderWardrobePreview();
            syncAllWardrobeUI();
            updateTileMediaViews();
        });
    });

    // 2. Табы переключения режима (Персонаж / Своё фото / Без аватара)
    document.querySelectorAll('.avatar-mode-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.mode;
            if (mode === 'photo') {
                if (!avatarProfile.photoDataUrl) {
                    // Если фото ещё не загружено, сразу вызываем диалог выбора файла
                    const fileInput = document.querySelector('.avatar-photo-file-input');
                    if (fileInput) fileInput.click();
                    return;
                }
                avatarProfile.mode = 'photo';
            } else if (mode === 'disabled') {
                avatarProfile.mode = 'disabled';
            } else {
                avatarProfile.mode = 'cartoon';
            }
            saveAvatarProfile();
            syncAllWardrobeUI();
            renderWardrobePreview();
            updateTileMediaViews();
            showToastNotification(
                avatarProfile.mode === 'photo'
                    ? '🖼️ Режим: Своё фото'
                    : avatarProfile.mode === 'disabled'
                    ? '🚫 Говорящий аватар выключен'
                    : '🎭 Режим: Мультяшный персонаж',
            );
        });
    });

    // Чекбокс скрытия аватаров у других собеседников
    document.querySelectorAll('.hide-remote-avatars-check').forEach((cb) => {
        cb.checked = hideRemoteAvatars;
        cb.addEventListener('change', (e) => {
            hideRemoteAvatars = e.target.checked;
            try {
                localStorage.setItem('hide_remote_avatars', hideRemoteAvatars ? 'true' : 'false');
            } catch (err) {}
            document.querySelectorAll('.hide-remote-avatars-check').forEach((c) => {
                c.checked = hideRemoteAvatars;
            });
            updateTileMediaViews();
            showToastNotification(
                hideRemoteAvatars
                    ? '🚫 Аватары собеседников скрыты'
                    : '🎭 Аватары собеседников включены',
            );
        });
    });

    // 3. Выбор шапки
    document.querySelectorAll('.hat-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            avatarProfile.hatStyle = btn.dataset.hat;
            avatarProfile.mode = 'cartoon';
            try {
                localStorage.setItem('avatar_hat_explicit', 'true');
            } catch (e) {}
            saveAvatarProfile();
            syncAllWardrobeUI();
            renderWardrobePreview();
        });
    });

    // 4. Выбор цвета куртки / рамки
    document.querySelectorAll('.color-dot').forEach((dot) => {
        dot.addEventListener('click', () => {
            avatarProfile.suitColor = dot.dataset.color;
            saveAvatarProfile();
            syncAllWardrobeUI();
            renderWardrobePreview();
        });
    });

    // 5. Загрузка фото через кнопки
    document.querySelectorAll('.upload-photo-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const container = btn.closest('.photo-upload-actions') || document;
            const fileInput = container.querySelector('.avatar-photo-file-input') || document.querySelector('.avatar-photo-file-input');
            if (fileInput) fileInput.click();
        });
    });

    // 6. Обработка выбора файлов изображений
    document.querySelectorAll('.avatar-photo-file-input').forEach((input) => {
        input.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            try {
                log(`🖼️ Загрузка и оптимизация фото аватара (${file.name}, ${(file.size / 1024).toFixed(1)} KB)...`);
                const dataUrl = await compressImageFile(file, 400, 400, 0.85);

                avatarProfile.photoDataUrl = dataUrl;
                avatarProfile.mode = 'photo';
                cachedUserPhotoImg = new Image();
                cachedUserPhotoSrc = dataUrl;
                cachedUserPhotoImg.onload = () => {
                    renderWardrobePreview();
                };
                cachedUserPhotoImg.src = dataUrl;

                saveAvatarProfile();
                syncAllWardrobeUI();
                renderWardrobePreview();

                log('✅ Фото аватара успешно установлено!');
                showToastNotification('🖼️ Фото профиля успешно установлено!');
            } catch (err) {
                log('⚠️ Ошибка загрузки фото аватара: ' + err.message, 'warn');
                showToastNotification('⚠️ Ошибка: ' + err.message, 'warn');
            } finally {
                input.value = '';
            }
        });
    });

    // 7. Сброс / удаление фото
    document.querySelectorAll('.remove-photo-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            avatarProfile.photoDataUrl = null;
            avatarProfile.mode = 'cartoon';
            cachedUserPhotoImg = null;
            cachedUserPhotoSrc = null;

            saveAvatarProfile();
            syncAllWardrobeUI();
            renderWardrobePreview();

            log('🎭 Фото сброшено, включен мультяшный аватар');
            showToastNotification('🎭 Фото сброшено, включен рисованный аватар');
        });
    });

    // 8. Открытие / закрытие модального окна кастомизации
    if (inCallAvatarBtn) inCallAvatarBtn.addEventListener('click', openAvatarModal);
    if (tileEditAvatarBtn) tileEditAvatarBtn.addEventListener('click', openAvatarModal);
    if (closeAvatarModalBtn) closeAvatarModalBtn.addEventListener('click', closeAvatarModal);
    if (saveAvatarModalBtn) saveAvatarModalBtn.addEventListener('click', closeAvatarModal);

    if (avatarModal) {
        avatarModal.addEventListener('click', (e) => {
            if (e.target === avatarModal) closeAvatarModal();
        });
    }

    syncAllWardrobeUI();
    renderWardrobePreview();
    updateTileMediaViews();
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
function ensureWhiteboardCanvasReady() {
    if (!whiteboardCanvas) return;
    if (
        whiteboardCanvas.width !== WB_CANVAS_WIDTH ||
        whiteboardCanvas.height !== WB_CANVAS_HEIGHT
    ) {
        whiteboardCanvas.width = WB_CANVAS_WIDTH;
        whiteboardCanvas.height = WB_CANVAS_HEIGHT;
    }
    if (!wbCtx) {
        wbCtx = whiteboardCanvas.getContext('2d');
    }
    if (whiteboardPreviewCanvas) {
        if (
            whiteboardPreviewCanvas.width !== WB_CANVAS_WIDTH ||
            whiteboardPreviewCanvas.height !== WB_CANVAS_HEIGHT
        ) {
            whiteboardPreviewCanvas.width = WB_CANVAS_WIDTH;
            whiteboardPreviewCanvas.height = WB_CANVAS_HEIGHT;
        }
        if (!wbPreviewCtx) {
            wbPreviewCtx = whiteboardPreviewCanvas.getContext('2d');
        }
    }
}

let isWbRemoteDrawingActive = false;
function setRemoteDrawingIndicator(isDrawing) {
    if (isDrawing) {
        if (!isWbRemoteDrawingActive) {
            isWbRemoteDrawingActive = true;
            if (whiteboardOverlay) whiteboardOverlay.classList.add('peer-drawing');
            if (whiteboardBtn) whiteboardBtn.classList.add('peer-drawing');
            if (wbPipLabel) wbPipLabel.textContent = '🎨 Собеседник рисует...';
            if (wbPeerStatus) wbPeerStatus.style.display = 'inline-flex';
        }
        if (wbRemoteDrawTimeout) clearTimeout(wbRemoteDrawTimeout);
        wbRemoteDrawTimeout = setTimeout(() => {
            isWbRemoteDrawingActive = false;
            if (whiteboardOverlay) whiteboardOverlay.classList.remove('peer-drawing');
            if (whiteboardBtn) whiteboardBtn.classList.remove('peer-drawing');
            if (wbPipLabel) wbPipLabel.textContent = '🎨 Доска';
            if (wbPeerStatus) wbPeerStatus.style.display = 'none';
        }, 800);
    } else {
        isWbRemoteDrawingActive = false;
        if (whiteboardOverlay) whiteboardOverlay.classList.remove('peer-drawing');
        if (whiteboardBtn) whiteboardBtn.classList.remove('peer-drawing');
        if (wbPipLabel) wbPipLabel.textContent = '🎨 Доска';
        if (wbPeerStatus) wbPeerStatus.style.display = 'none';
    }
}

function setWhiteboardMode(mode, options = {}) {
    if (!whiteboardOverlay) return;
    ensureWhiteboardCanvasReady();

    wbMode = mode; // 'closed' | 'minimized' | 'fullscreen'
    isWhiteboardOpen = mode !== 'closed';

    if (mode === 'closed') {
        whiteboardOverlay.style.display = 'none';
        whiteboardOverlay.classList.remove('minimized');
        if (whiteboardBtn) whiteboardBtn.classList.remove('active');
        isWbDrawing = false;
        if (options.dismissedByUser) {
            wbDismissedByUser = true;
        }
    } else if (mode === 'minimized') {
        whiteboardOverlay.style.display = 'flex';
        whiteboardOverlay.classList.add('minimized');
        if (whiteboardBtn) whiteboardBtn.classList.add('active');
        if (wbDockBadge) wbDockBadge.style.display = 'none';
        isWbDrawing = false;
    } else if (mode === 'fullscreen') {
        whiteboardOverlay.style.display = 'flex';
        whiteboardOverlay.classList.remove('minimized');
        if (whiteboardBtn) whiteboardBtn.classList.add('active');
        if (wbDockBadge) wbDockBadge.style.display = 'none';
        wbDismissedByUser = false;
    }
}

function toggleWhiteboard(forceState) {
    if (!whiteboardOverlay) return;
    if (forceState === true) {
        setWhiteboardMode('fullscreen');
    } else if (forceState === false) {
        setWhiteboardMode('closed', { dismissedByUser: true });
    } else {
        if (wbMode === 'closed' || wbMode === 'minimized') {
            setWhiteboardMode('fullscreen');
        } else {
            setWhiteboardMode('closed', { dismissedByUser: true });
        }
    }
}

function initWhiteboard() {
    if (!whiteboardCanvas) return;
    ensureWhiteboardCanvasReady();

    if (whiteboardBtn) {
        whiteboardBtn.addEventListener('click', () => {
            toggleWhiteboard();
        });
    }

    if (wbMinimizeBtn) {
        wbMinimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setWhiteboardMode('minimized');
        });
    }

    if (wbExpandBtn) {
        wbExpandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setWhiteboardMode('fullscreen');
        });
    }

    if (wbCloseBtn) {
        wbCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setWhiteboardMode('closed', { dismissedByUser: true });
        });
    }

    if (wbPipCloseBtn) {
        wbPipCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setWhiteboardMode('closed', { dismissedByUser: true });
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

    // Инструменты доски (Карандаш, Круг, Прямоугольник, Стрелка, Линия)
    const wbToolBtns = document.querySelectorAll('.wb-tool-btn');
    wbToolBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            wbToolBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            wbTool = btn.dataset.tool;
            wbIsEraser = false;
            if (wbEraserBtn) wbEraserBtn.classList.remove('active');
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
            if (wbIsEraser) {
                wbTool = 'brush';
                wbToolBtns.forEach((b) => b.classList.remove('active'));
                const brushBtn = document.querySelector('.wb-tool-btn[data-tool="brush"]');
                if (brushBtn) brushBtn.classList.add('active');
            }
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
        const nx = rect.width ? (clientX - rect.left) / rect.width : 0;
        const ny = rect.height ? (clientY - rect.top) / rect.height : 0;
        return {
            x: nx * whiteboardCanvas.width,
            y: ny * whiteboardCanvas.height,
            nx,
            ny,
        };
    }

    function sendWbStroke(x0, y0, x1, y1) {
        if (dataChannel && dataChannel.readyState === 'open') {
            const w = whiteboardCanvas.width;
            const h = whiteboardCanvas.height;
            dataChannel.send(
                JSON.stringify({
                    type: 'wb_draw',
                    x0: x0 / w,
                    y0: y0 / h,
                    x1: x1 / w,
                    y1: y1 / h,
                    color: wbColor,
                    size: wbSize,
                    isEraser: wbIsEraser,
                }),
            );
        }
    }

    let wbPendingCurves = [];
    let wbBatchTimer = null;

    function queueWbCurve(x0, y0, cx, cy, x1, y1) {
        const W = whiteboardCanvas.width;
        const H = whiteboardCanvas.height;
        wbPendingCurves.push([
            Math.round((x0 / W) * 10000) / 10000,
            Math.round((y0 / H) * 10000) / 10000,
            Math.round((cx / W) * 10000) / 10000,
            Math.round((cy / H) * 10000) / 10000,
            Math.round((x1 / W) * 10000) / 10000,
            Math.round((y1 / H) * 10000) / 10000,
        ]);
        if (!wbBatchTimer) {
            wbBatchTimer = setTimeout(flushWbCurves, 16);
        }
    }

    function flushWbCurves() {
        wbBatchTimer = null;
        if (wbPendingCurves.length === 0) return;
        if (dataChannel && dataChannel.readyState === 'open') {
            try {
                dataChannel.send(
                    JSON.stringify({
                        type: 'wb_batch',
                        curves: wbPendingCurves,
                        color: wbColor,
                        size: wbSize,
                        isEraser: wbIsEraser,
                    }),
                );
            } catch (e) {}
        }
        wbPendingCurves = [];
    }

    function sendWbStroke(x0, y0, x1, y1) {
        if (dataChannel && dataChannel.readyState === 'open') {
            const w = whiteboardCanvas.width;
            const h = whiteboardCanvas.height;
            dataChannel.send(
                JSON.stringify({
                    type: 'wb_draw',
                    x0: x0 / w,
                    y0: y0 / h,
                    x1: x1 / w,
                    y1: y1 / h,
                    color: wbColor,
                    size: wbSize,
                    isEraser: wbIsEraser,
                }),
            );
        }
    }

    function sendWbShape(shape, data) {
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(
                JSON.stringify({
                    type: 'wb_shape',
                    shape,
                    ...data,
                    color: wbColor,
                    size: wbSize,
                }),
            );
        }
    }

    function onPointerDown(e) {
        if (wbMode === 'minimized') {
            e.preventDefault();
            setWhiteboardMode('fullscreen');
            return;
        }
        if (wbMode !== 'fullscreen') return;

        e.preventDefault();
        const { x, y } = getPointerPos(e);

        if (wbTool === 'brush') {
            isWbDrawing = true;
            lastWbX = x;
            lastWbY = y;
            wbLastMidX = x;
            wbLastMidY = y;
            drawWbDot(x, y, wbColor, wbSize, wbIsEraser);
            queueWbCurve(x, y, x, y, x + 0.1, y + 0.1);
        } else {
            isWbDrawingShape = true;
            wbShapeStartX = x;
            wbShapeStartY = y;
        }
    }

    let mockDrawTriggered = false;
    function onPointerMove(e) {
        if (wbMode !== 'fullscreen') return;

        if (isWbDrawing && wbTool === 'brush') {
            e.preventDefault();
            const { x, y } = getPointerPos(e);

            if (Math.hypot(x - lastWbX, y - lastWbY) < 1.0) {
                return;
            }

            const midX = (lastWbX + x) / 2;
            const midY = (lastWbY + y) / 2;

            drawWbCurve(wbLastMidX, wbLastMidY, lastWbX, lastWbY, midX, midY, wbColor, wbSize, wbIsEraser);
            queueWbCurve(wbLastMidX, wbLastMidY, lastWbX, lastWbY, midX, midY);

            wbLastMidX = midX;
            wbLastMidY = midY;
            lastWbX = x;
            lastWbY = y;

            if (isTestMode && !mockDrawTriggered) {
                mockDrawTriggered = true;
                setTimeout(() => {
                    mockBuddyWhiteboardDoodle();
                    setTimeout(() => {
                        mockDrawTriggered = false;
                    }, 4000);
                }, 120);
            }
        } else if (isWbDrawingShape) {
            e.preventDefault();
            const { x, y } = getPointerPos(e);
            if (!wbPreviewCtx) return;

            let curX = x;
            let curY = y;
            if (e.shiftKey) {
                const dx = curX - wbShapeStartX;
                const dy = curY - wbShapeStartY;
                const side = Math.max(Math.abs(dx), Math.abs(dy));
                curX = wbShapeStartX + (dx >= 0 ? side : -side);
                curY = wbShapeStartY + (dy >= 0 ? side : -side);
            }

            wbPreviewCtx.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);

            if (wbTool === 'circle') {
                const cx = (wbShapeStartX + curX) / 2;
                const cy = (wbShapeStartY + curY) / 2;
                const rx = Math.abs(curX - wbShapeStartX) / 2;
                const ry = Math.abs(curY - wbShapeStartY) / 2;
                drawWbCircleShape(wbPreviewCtx, cx, cy, rx, ry, wbColor, wbSize);
            } else if (wbTool === 'rect') {
                drawWbRectShape(wbPreviewCtx, wbShapeStartX, wbShapeStartY, curX, curY, wbColor, wbSize);
            } else if (wbTool === 'arrow') {
                drawWbArrowShape(wbPreviewCtx, wbShapeStartX, wbShapeStartY, curX, curY, wbColor, wbSize);
            } else if (wbTool === 'line') {
                drawWbLineShape(wbPreviewCtx, wbShapeStartX, wbShapeStartY, curX, curY, wbColor, wbSize);
            }
        }
    }

    function onPointerUp(e) {
        if (isWbDrawing) {
            drawWbLine(wbLastMidX, wbLastMidY, lastWbX, lastWbY, wbColor, wbSize, wbIsEraser);
            queueWbCurve(wbLastMidX, wbLastMidY, lastWbX, lastWbY, lastWbX, lastWbY);
            flushWbCurves();
            isWbDrawing = false;
        }

        if (isWbDrawingShape) {
            if (wbPreviewCtx) {
                wbPreviewCtx.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
            }
            const { x, y } = getPointerPos(e);
            let curX = x;
            let curY = y;
            if (e.shiftKey) {
                const dx = curX - wbShapeStartX;
                const dy = curY - wbShapeStartY;
                const side = Math.max(Math.abs(dx), Math.abs(dy));
                curX = wbShapeStartX + (dx >= 0 ? side : -side);
                curY = wbShapeStartY + (dy >= 0 ? side : -side);
            }

            const dist = Math.hypot(curX - wbShapeStartX, curY - wbShapeStartY);
            if (dist > 3) {
                const W = whiteboardCanvas.width;
                const H = whiteboardCanvas.height;

                if (wbTool === 'circle') {
                    const cx = (wbShapeStartX + curX) / 2;
                    const cy = (wbShapeStartY + curY) / 2;
                    const rx = Math.abs(curX - wbShapeStartX) / 2;
                    const ry = Math.abs(curY - wbShapeStartY) / 2;
                    drawWbCircleShape(wbCtx, cx, cy, rx, ry, wbColor, wbSize);
                    sendWbShape('circle', {
                        cx: cx / W,
                        cy: cy / H,
                        rx: rx / W,
                        ry: ry / H,
                    });
                } else if (wbTool === 'rect') {
                    drawWbRectShape(wbCtx, wbShapeStartX, wbShapeStartY, curX, curY, wbColor, wbSize);
                    sendWbShape('rect', {
                        x0: wbShapeStartX / W,
                        y0: wbShapeStartY / H,
                        x1: curX / W,
                        y1: curY / H,
                    });
                } else if (wbTool === 'arrow') {
                    drawWbArrowShape(wbCtx, wbShapeStartX, wbShapeStartY, curX, curY, wbColor, wbSize);
                    sendWbShape('arrow', {
                        x0: wbShapeStartX / W,
                        y0: wbShapeStartY / H,
                        x1: curX / W,
                        y1: curY / H,
                    });
                } else if (wbTool === 'line') {
                    drawWbLineShape(wbCtx, wbShapeStartX, wbShapeStartY, curX, curY, wbColor, wbSize);
                    sendWbShape('line', {
                        x0: wbShapeStartX / W,
                        y0: wbShapeStartY / H,
                        x1: curX / W,
                        y1: curY / H,
                    });
                }
            }
            isWbDrawingShape = false;
        }
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

// Получение холста доски с непрозрачным тёмным фоном
function getWhiteboardCanvasWithBackground() {
    if (!whiteboardCanvas) return null;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = whiteboardCanvas.width || 1280;
    exportCanvas.height = whiteboardCanvas.height || 720;
    const ctx = exportCanvas.getContext('2d');

    // Тёмный фон доски (#1e1f22)
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

function drawWbDot(x, y, color, size, isEraser = false) {
    if (!wbCtx) return;
    wbCtx.save();
    if (isEraser) {
        wbCtx.globalCompositeOperation = 'destination-out';
        wbCtx.beginPath();
        wbCtx.arc(x, y, (size * 3) / 2, 0, Math.PI * 2);
        wbCtx.fill();
    } else {
        wbCtx.globalCompositeOperation = 'source-over';
        wbCtx.fillStyle = color;
        wbCtx.beginPath();
        wbCtx.arc(x, y, size / 2, 0, Math.PI * 2);
        wbCtx.fill();
    }
    wbCtx.restore();
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

function drawWbCurve(x0, y0, cx, cy, x1, y1, color, size, isEraser = false) {
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
    wbCtx.quadraticCurveTo(cx, cy, x1, y1);
    wbCtx.stroke();
    wbCtx.restore();
}

function drawWbCircleShape(ctx, cx, cy, rx, ry, color, size) {
    if (!ctx) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.1, Math.abs(rx)), Math.max(0.1, Math.abs(ry)), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawWbRectShape(ctx, x0, y0, x1, y1, color, size) {
    if (!ctx) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const x = Math.min(x0, x1);
    const y = Math.min(y0, y1);
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 4);
    else ctx.rect(x, y, w, h);
    ctx.stroke();
    ctx.restore();
}

function drawWbArrowShape(ctx, x0, y0, x1, y1, color, size) {
    if (!ctx) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    const angle = Math.atan2(y1 - y0, x1 - x0);
    const headLen = Math.max(14, size * 2.8);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(
        x1 - headLen * Math.cos(angle - Math.PI / 6),
        y1 - headLen * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
        x1 - headLen * Math.cos(angle + Math.PI / 6),
        y1 - headLen * Math.sin(angle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawWbLineShape(ctx, x0, y0, x1, y1, color, size) {
    if (!ctx) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
}

function clearWhiteboardLocally() {
    if (!wbCtx || !whiteboardCanvas) return;
    wbCtx.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    if (wbPreviewCtx && whiteboardPreviewCanvas) {
        wbPreviewCtx.clearRect(0, 0, whiteboardPreviewCanvas.width, whiteboardPreviewCanvas.height);
    }
}

function handleRemoteWbDraw(msg) {
    ensureWhiteboardCanvasReady();
    setRemoteDrawingIndicator(true);

    if (wbMode === 'closed') {
        if (!wbDismissedByUser) {
            setWhiteboardMode('minimized');
        } else if (wbDockBadge) {
            wbDockBadge.style.display = 'flex';
        }
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

function handleRemoteWbCurve(msg) {
    ensureWhiteboardCanvasReady();
    setRemoteDrawingIndicator(true);

    if (wbMode === 'closed') {
        if (!wbDismissedByUser) {
            setWhiteboardMode('minimized');
        } else if (wbDockBadge) {
            wbDockBadge.style.display = 'flex';
        }
    }

    const w = whiteboardCanvas.width;
    const h = whiteboardCanvas.height;
    drawWbCurve(
        msg.x0 * w,
        msg.y0 * h,
        msg.cx * w,
        msg.cy * h,
        msg.x1 * w,
        msg.y1 * w,
        msg.color,
        msg.size,
        msg.isEraser,
    );
}

function handleRemoteWbBatch(msg) {
    ensureWhiteboardCanvasReady();
    setRemoteDrawingIndicator(true);

    if (wbMode === 'closed') {
        if (!wbDismissedByUser) {
            setWhiteboardMode('minimized');
        } else if (wbDockBadge) {
            wbDockBadge.style.display = 'flex';
        }
    }

    const W = whiteboardCanvas.width;
    const H = whiteboardCanvas.height;
    if (Array.isArray(msg.curves)) {
        for (let i = 0; i < msg.curves.length; i++) {
            const c = msg.curves[i];
            drawWbCurve(
                c[0] * W,
                c[1] * H,
                c[2] * W,
                c[3] * H,
                c[4] * W,
                c[5] * H,
                msg.color,
                msg.size,
                msg.isEraser,
            );
        }
    }
}

function handleRemoteWbShape(msg) {
    ensureWhiteboardCanvasReady();
    setRemoteDrawingIndicator(true);

    if (wbMode === 'closed') {
        if (!wbDismissedByUser) {
            setWhiteboardMode('minimized');
        } else if (wbDockBadge) {
            wbDockBadge.style.display = 'flex';
        }
    }

    const w = whiteboardCanvas.width;
    const h = whiteboardCanvas.height;

    if (msg.shape === 'circle') {
        drawWbCircleShape(
            wbCtx,
            msg.cx * w,
            msg.cy * h,
            msg.rx * w,
            msg.ry * h,
            msg.color,
            msg.size,
        );
    } else if (msg.shape === 'rect') {
        drawWbRectShape(
            wbCtx,
            msg.x0 * w,
            msg.y0 * h,
            msg.x1 * w,
            msg.y1 * h,
            msg.color,
            msg.size,
        );
    } else if (msg.shape === 'arrow') {
        drawWbArrowShape(
            wbCtx,
            msg.x0 * w,
            msg.y0 * h,
            msg.x1 * w,
            msg.y1 * h,
            msg.color,
            msg.size,
        );
    } else if (msg.shape === 'line') {
        drawWbLineShape(
            wbCtx,
            msg.x0 * w,
            msg.y0 * h,
            msg.x1 * w,
            msg.y1 * h,
            msg.color,
            msg.size,
        );
    }
}

function handleRemoteWbClear() {
    clearWhiteboardLocally();
    if (wbDockBadge) wbDockBadge.style.display = 'none';
}

// Забавный смайлик от собеседника в тест-режиме
function mockBuddyWhiteboardDoodle() {
    if (!whiteboardCanvas) return;
    ensureWhiteboardCanvasReady();
    const w = whiteboardCanvas.width;
    const h = whiteboardCanvas.height;
    const cx = w * 0.72;
    const cy = h * 0.35;
    const r = Math.min(w, h) * 0.12;

    function sendMockStroke(x0, y0, x1, y1, color, size) {
        handleRemoteWbDraw({
            x0: x0 / w,
            y0: y0 / h,
            x1: x1 / w,
            y1: y1 / h,
            color,
            size,
            isEraser: false,
        });
    }

    let angle = 0;
    const interval = setInterval(() => {
        if (!isTestMode) {
            clearInterval(interval);
            return;
        }
        const x0 = cx + Math.cos(angle) * r;
        const y0 = cy + Math.sin(angle) * r;
        angle += 0.3;
        const x1 = cx + Math.cos(angle) * r;
        const y1 = cy + Math.sin(angle) * r;
        sendMockStroke(x0, y0, x1, y1, '#fee75c', 5);

        if (angle >= Math.PI * 2) {
            clearInterval(interval);
            sendMockStroke(
                cx - r * 0.35,
                cy - r * 0.25,
                cx - r * 0.35 + 0.1,
                cy - r * 0.25 + 0.1,
                '#fee75c',
                8,
            );
            sendMockStroke(
                cx + r * 0.35,
                cy - r * 0.25,
                cx + r * 0.35 + 0.1,
                cy - r * 0.25 + 0.1,
                '#fee75c',
                8,
            );
            for (let a = Math.PI * 0.2; a <= Math.PI * 0.8; a += 0.15) {
                const sx0 = cx + Math.cos(a) * (r * 0.6);
                const sy0 = cy + Math.sin(a) * (r * 0.6);
                const sx1 = cx + Math.cos(a + 0.15) * (r * 0.6);
                const sy1 = cy + Math.sin(a + 0.15) * (r * 0.6);
                sendMockStroke(sx0, sy0, sx1, sy1, '#eb459e', 5);
            }
        }
    }, 25);
}

// ============================================================
// === РИСОВАНИЕ НА ЭКРАНЕ / АННОТАЦИИ (SCREEN ANNOTATIONS) ===
// ============================================================

const PERSISTENT_CANVAS_WIDTH = 1920;
const PERSISTENT_CANVAS_HEIGHT = 1080;

function getVideoRenderRect(videoEl) {
    if (!videoEl) {
        return { x: 0, y: 0, width: 0, height: 0, scale: 1 };
    }
    const vWidth = videoEl.videoWidth || (videoEl.srcObject ? 1280 : 0);
    const vHeight = videoEl.videoHeight || (videoEl.srcObject ? 720 : 0);
    const cWidth = videoEl.clientWidth;
    const cHeight = videoEl.clientHeight;

    if (!vWidth || !vHeight || !cWidth || !cHeight) {
        return { x: 0, y: 0, width: cWidth, height: cHeight, scale: 1 };
    }

    const videoRatio = vWidth / vHeight;
    const containerRatio = cWidth / cHeight;
    let renderWidth, renderHeight, offsetX, offsetY;

    if (containerRatio > videoRatio) {
        // Окно шире видео -> полосы по бокам (pillarbox)
        renderHeight = cHeight;
        renderWidth = cHeight * videoRatio;
        offsetX = (cWidth - renderWidth) / 2;
        offsetY = 0;
    } else {
        // Окно выше видео -> полосы сверху/снизу (letterbox)
        renderWidth = cWidth;
        renderHeight = cWidth / videoRatio;
        offsetX = 0;
        offsetY = (cHeight - renderHeight) / 2;
    }

    return {
        x: offsetX,
        y: offsetY,
        width: renderWidth,
        height: renderHeight,
        videoWidth: vWidth,
        videoHeight: vHeight,
    };
}

function getActiveScreenVideo() {
    if (stageGrid && stageGrid.classList.contains('local-is-main')) {
        return localVideo;
    }
    return remoteVideo;
}

function getNormalizedScreenPos(e) {
    const videoEl = getActiveScreenVideo();
    if (!videoEl || !screenDrawOverlay) return null;

    const overlayRect = screenDrawOverlay.getBoundingClientRect();
    const videoRect = videoEl.getBoundingClientRect();
    const renderRect = getVideoRenderRect(videoEl);

    if (!renderRect.width || !renderRect.height) return null;

    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;

    const relVideoX = clientX - videoRect.left;
    const relVideoY = clientY - videoRect.top;

    const nx = (relVideoX - renderRect.x) / renderRect.width;
    const ny = (relVideoY - renderRect.y) / renderRect.height;

    const isInside = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;

    return {
        nx: Math.max(0, Math.min(1, nx)),
        ny: Math.max(0, Math.min(1, ny)),
        isInside,
        clientX,
        clientY,
    };
}

function denormalizeScreenPos(nx, ny) {
    const videoEl = getActiveScreenVideo();
    if (!videoEl || !screenDrawOverlay) return { x: 0, y: 0 };

    const overlayRect = screenDrawOverlay.getBoundingClientRect();
    const videoRect = videoEl.getBoundingClientRect();
    const renderRect = getVideoRenderRect(videoEl);

    const videoOffsetX = videoRect.left - overlayRect.left;
    const videoOffsetY = videoRect.top - overlayRect.top;

    const px = videoOffsetX + renderRect.x + nx * renderRect.width;
    const py = videoOffsetY + renderRect.y + ny * renderRect.height;

    return { x: px, y: py };
}

function ensurePersistentCanvas() {
    if (!persistentCanvas) {
        persistentCanvas = document.createElement('canvas');
        persistentCanvas.width = PERSISTENT_CANVAS_WIDTH;
        persistentCanvas.height = PERSISTENT_CANVAS_HEIGHT;
        persistentCtx = persistentCanvas.getContext('2d');
    }
}

function ensureScreenDrawCanvasReady() {
    if (!screenDrawCanvas || !screenDrawOverlay) return;
    const rect = screenDrawOverlay.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);

    if (screenDrawCanvas.width !== targetW || screenDrawCanvas.height !== targetH) {
        screenDrawCanvas.width = targetW;
        screenDrawCanvas.height = targetH;
    }
    screenDrawCanvas.style.width = `${rect.width}px`;
    screenDrawCanvas.style.height = `${rect.height}px`;

    screenDrawCtx = screenDrawCanvas.getContext('2d');
    ensurePersistentCanvas();
}

function addFadingStroke(x0, y0, x1, y1, color, size, duration = 2500) {
    fadingStrokes.push({
        x0,
        y0,
        x1,
        y1,
        color,
        size,
        createdAt: performance.now(),
        duration,
    });
    startScreenDrawAnim();
}

function addPersistentStroke(x0, y0, x1, y1, color, size, isEraser = false) {
    ensurePersistentCanvas();
    if (!persistentCtx) return;

    const px0 = x0 * PERSISTENT_CANVAS_WIDTH;
    const py0 = y0 * PERSISTENT_CANVAS_HEIGHT;
    const px1 = x1 * PERSISTENT_CANVAS_WIDTH;
    const py1 = y1 * PERSISTENT_CANVAS_HEIGHT;

    persistentCtx.save();
    if (isEraser) {
        persistentCtx.globalCompositeOperation = 'destination-out';
        persistentCtx.strokeStyle = 'rgba(0,0,0,1)';
        persistentCtx.lineWidth = size * 3;
    } else {
        persistentCtx.globalCompositeOperation = 'source-over';
        persistentCtx.strokeStyle = color;
        persistentCtx.lineWidth = size;
        persistentCtx.shadowColor = color;
        persistentCtx.shadowBlur = size * 0.8;
    }
    persistentCtx.lineCap = 'round';
    persistentCtx.lineJoin = 'round';

    persistentCtx.beginPath();
    persistentCtx.moveTo(px0, py0);
    persistentCtx.lineTo(px1, py1);
    persistentCtx.stroke();
    persistentCtx.restore();

    startScreenDrawAnim();
}

function queueScreenDrawStroke(stroke) {
    screenDrawPendingStrokes.push(stroke);
    if (!screenDrawBatchTimer) {
        screenDrawBatchTimer = setTimeout(flushScreenDrawStrokes, 16);
    }
}

function flushScreenDrawStrokes() {
    if (screenDrawBatchTimer) {
        clearTimeout(screenDrawBatchTimer);
        screenDrawBatchTimer = null;
    }
    if (screenDrawPendingStrokes.length === 0) return;
    if (dataChannel && dataChannel.readyState === 'open') {
        try {
            dataChannel.send(
                JSON.stringify({
                    type: 'screen_draw_batch',
                    strokes: screenDrawPendingStrokes,
                }),
            );
        } catch (err) {}
    }
    screenDrawPendingStrokes = [];
}

function clearScreenDrawData(notifyPeer = true) {
    screenDrawPendingStrokes = [];
    if (screenDrawBatchTimer) {
        clearTimeout(screenDrawBatchTimer);
        screenDrawBatchTimer = null;
    }
    if (persistentCtx) {
        persistentCtx.clearRect(0, 0, PERSISTENT_CANVAS_WIDTH, PERSISTENT_CANVAS_HEIGHT);
    }
    fadingStrokes = [];
    laserPointers.local.trail = [];
    laserPointers.remote.trail = [];
    laserPointers.local.active = false;
    laserPointers.remote.active = false;

    if (screenDrawCtx && screenDrawCanvas) {
        screenDrawCtx.clearRect(0, 0, screenDrawCanvas.width, screenDrawCanvas.height);
    }

    if (notifyPeer && dataChannel && dataChannel.readyState === 'open') {
        try {
            dataChannel.send(JSON.stringify({ type: 'screen_draw_clear' }));
        } catch (e) {}
    }
    log('🗑️ Аннотации на экране очищены');
}

function renderScreenAnnotations() {
    if (!screenDrawCtx || !screenDrawCanvas) return;

    const dpr = window.devicePixelRatio || 1;
    const now = performance.now();

    screenDrawCtx.save();
    screenDrawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    screenDrawCtx.clearRect(0, 0, screenDrawCanvas.width / dpr, screenDrawCanvas.height / dpr);

    // 1. Отрисовка постоянного слоя маркера (Persistent Canvas)
    if (persistentCanvas) {
        const videoEl = getActiveScreenVideo();
        if (videoEl && screenDrawOverlay) {
            const overlayRect = screenDrawOverlay.getBoundingClientRect();
            const videoRect = videoEl.getBoundingClientRect();
            const renderRect = getVideoRenderRect(videoEl);

            const destX = videoRect.left - overlayRect.left + renderRect.x;
            const destY = videoRect.top - overlayRect.top + renderRect.y;

            screenDrawCtx.drawImage(
                persistentCanvas,
                0,
                0,
                PERSISTENT_CANVAS_WIDTH,
                PERSISTENT_CANVAS_HEIGHT,
                destX,
                destY,
                renderRect.width,
                renderRect.height,
            );
        }
    }

    // 2. Отрисовка исчезающих чернил (Fading Strokes)
    for (let i = fadingStrokes.length - 1; i >= 0; i--) {
        const s = fadingStrokes[i];
        const age = now - s.createdAt;
        if (age >= s.duration) {
            fadingStrokes.splice(i, 1);
            continue;
        }

        const progress = age / s.duration;
        const alpha = progress < 0.4 ? 1 : Math.max(0, 1 - Math.pow((progress - 0.4) / 0.6, 1.3));

        const p0 = denormalizeScreenPos(s.x0, s.y0);
        const p1 = denormalizeScreenPos(s.x1, s.y1);

        screenDrawCtx.save();
        screenDrawCtx.globalAlpha = alpha;
        screenDrawCtx.strokeStyle = s.color;
        screenDrawCtx.lineWidth = s.size;
        screenDrawCtx.lineCap = 'round';
        screenDrawCtx.lineJoin = 'round';
        screenDrawCtx.shadowColor = s.color;
        screenDrawCtx.shadowBlur = s.size * 1.5;

        screenDrawCtx.beginPath();
        screenDrawCtx.moveTo(p0.x, p0.y);
        screenDrawCtx.lineTo(p1.x, p1.y);
        screenDrawCtx.stroke();
        screenDrawCtx.restore();
    }

    // 3. Отрисовка лазерных указок со световым шлейфом (Laser Pointers)
    ['local', 'remote'].forEach((key) => {
        const laser = laserPointers[key];
        if (!laser) return;

        laser.trail = laser.trail.filter((pt) => now - pt.time < 350);

        if (laser.trail.length > 1) {
            for (let i = 1; i < laser.trail.length; i++) {
                const pt0 = laser.trail[i - 1];
                const pt1 = laser.trail[i];
                const ptAge = now - pt1.time;
                const trailAlpha = Math.max(0, 1 - ptAge / 350);
                const p0 = denormalizeScreenPos(pt0.nx, pt0.ny);
                const p1 = denormalizeScreenPos(pt1.nx, pt1.ny);

                screenDrawCtx.save();
                screenDrawCtx.globalAlpha = trailAlpha * 0.9;
                screenDrawCtx.strokeStyle = laser.color;
                screenDrawCtx.lineWidth = Math.max(2, (1 - ptAge / 350) * 8);
                screenDrawCtx.lineCap = 'round';
                screenDrawCtx.shadowColor = laser.color;
                screenDrawCtx.shadowBlur = 14;

                screenDrawCtx.beginPath();
                screenDrawCtx.moveTo(p0.x, p0.y);
                screenDrawCtx.lineTo(p1.x, p1.y);
                screenDrawCtx.stroke();
                screenDrawCtx.restore();
            }
        }

        if (laser.active) {
            const pt = denormalizeScreenPos(laser.nx, laser.ny);
            const pulse = 1 + Math.sin(now * 0.015) * 0.22;

            screenDrawCtx.save();
            // Внешнее неоновое сияние
            const grad = screenDrawCtx.createRadialGradient(pt.x, pt.y, 1, pt.x, pt.y, 18 * pulse);
            grad.addColorStop(0, laser.color);
            grad.addColorStop(0.4, laser.color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            screenDrawCtx.fillStyle = grad;
            screenDrawCtx.beginPath();
            screenDrawCtx.arc(pt.x, pt.y, 18 * pulse, 0, Math.PI * 2);
            screenDrawCtx.fill();

            // Яркое белое ядро
            screenDrawCtx.fillStyle = '#ffffff';
            screenDrawCtx.shadowColor = laser.color;
            screenDrawCtx.shadowBlur = 10;
            screenDrawCtx.beginPath();
            screenDrawCtx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            screenDrawCtx.fill();

            // Бейдж с именем
            const labelText = key === 'local' ? 'Вы' : laser.name || 'Собеседник';
            screenDrawCtx.font = 'bold 11px Inter, sans-serif';
            const textWidth = screenDrawCtx.measureText(labelText).width;
            const tagX = pt.x + 12;
            const tagY = pt.y - 18;

            screenDrawCtx.fillStyle = 'rgba(17, 18, 20, 0.88)';
            screenDrawCtx.strokeStyle = laser.color;
            screenDrawCtx.lineWidth = 1;
            screenDrawCtx.beginPath();
            if (screenDrawCtx.roundRect) {
                screenDrawCtx.roundRect(tagX, tagY, textWidth + 12, 18, 9);
            } else {
                screenDrawCtx.rect(tagX, tagY, textWidth + 12, 18);
            }
            screenDrawCtx.fill();
            screenDrawCtx.stroke();

            screenDrawCtx.fillStyle = '#ffffff';
            screenDrawCtx.shadowBlur = 0;
            screenDrawCtx.fillText(labelText, tagX + 6, tagY + 13);
            screenDrawCtx.restore();
        }
    });

    screenDrawCtx.restore();

    // Проверяем, нужно ли продолжать анимацию
    const hasActiveLasers =
        laserPointers.local.active ||
        laserPointers.remote.active ||
        laserPointers.local.trail.length > 0 ||
        laserPointers.remote.trail.length > 0;
    const hasFadingStrokes = fadingStrokes.length > 0;

    if (isScreenDrawActive || hasActiveLasers || hasFadingStrokes) {
        screenDrawAnimId = requestAnimationFrame(renderScreenAnnotations);
    } else {
        screenDrawAnimId = null;
    }
}

function startScreenDrawAnim() {
    if (!screenDrawAnimId) {
        screenDrawAnimId = requestAnimationFrame(renderScreenAnnotations);
    }
}

function setScreenDrawTool(tool) {
    screenDrawTool = tool;
    if (screenDrawOverlay) {
        screenDrawOverlay.dataset.tool = tool;
    }
    const btns = [sdtLaserBtn, sdtFadeBtn, sdtPenBtn, sdtEraserBtn];
    btns.forEach((btn) => {
        if (btn) btn.classList.toggle('active', btn.dataset.tool === tool);
    });
}

function setScreenDrawColor(color) {
    screenDrawColor = color;
    laserPointers.local.color = color;
    sdtColorBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.color === color);
    });
}

function setScreenDrawSize(size) {
    screenDrawSize = size;
    sdtSizeBtns.forEach((btn) => {
        btn.classList.toggle('active', parseInt(btn.dataset.size, 10) === size);
    });
}

function toggleScreenAnnotations(forceState) {
    if (!screenDrawOverlay) return;
    const nextState = forceState !== undefined ? forceState : !isScreenDrawActive;
    isScreenDrawActive = nextState;

    if (isScreenDrawActive) {
        screenDrawOverlay.style.display = 'flex';
        screenDrawOverlay.classList.add('active');
        if (screenDrawBtn) screenDrawBtn.classList.add('active');
        if (screenDrawDockBadge) screenDrawDockBadge.style.display = 'inline-block';
        setScreenDrawTool(screenDrawTool);
        ensureScreenDrawCanvasReady();
        startScreenDrawAnim();
        log('✏️ Включен режим рисования на экране');
    } else {
        screenDrawOverlay.classList.remove('active');
        screenDrawOverlay.style.display = 'none';
        if (screenDrawBtn) screenDrawBtn.classList.remove('active');
        if (screenDrawDockBadge) screenDrawDockBadge.style.display = 'none';
        laserPointers.local.active = false;
        flushScreenDrawStrokes();
        if (dataChannel && dataChannel.readyState === 'open') {
            try {
                dataChannel.send(JSON.stringify({ type: 'screen_draw_laser', active: false }));
            } catch (e) {}
        }
        log('✏️ Режим рисования на экране отключен');
    }
}

function toggleScreenDrawMinimize(forceMinimized) {
    if (!screenDrawToolbar || !screenDrawMinimizedPill) return;
    isScreenDrawMinimized = forceMinimized !== undefined ? forceMinimized : !isScreenDrawMinimized;

    if (isScreenDrawMinimized) {
        screenDrawToolbar.style.display = 'none';
        screenDrawMinimizedPill.style.display = 'inline-flex';
    } else {
        screenDrawToolbar.style.display = 'inline-flex';
        screenDrawMinimizedPill.style.display = 'none';
    }
}

function handleRemoteScreenDrawStroke(msg) {
    if (!isScreenDrawActive) {
        toggleScreenAnnotations(true);
    }
    if (msg.mode === 'fade') {
        addFadingStroke(msg.x0, msg.y0, msg.x1, msg.y1, msg.color, msg.size);
    } else if (msg.mode === 'pen') {
        addPersistentStroke(msg.x0, msg.y0, msg.x1, msg.y1, msg.color, msg.size, false);
    } else if (msg.mode === 'eraser') {
        addPersistentStroke(msg.x0, msg.y0, msg.x1, msg.y1, msg.color, msg.size, true);
    }
}

function handleRemoteScreenDrawBatch(msg) {
    if (!isScreenDrawActive) {
        toggleScreenAnnotations(true);
    }
    if (Array.isArray(msg.strokes)) {
        for (let i = 0; i < msg.strokes.length; i++) {
            const s = msg.strokes[i];
            if (s.mode === 'fade') {
                addFadingStroke(s.x0, s.y0, s.x1, s.y1, s.color, s.size);
            } else if (s.mode === 'pen') {
                addPersistentStroke(s.x0, s.y0, s.x1, s.y1, s.color, s.size, false);
            } else if (s.mode === 'eraser') {
                addPersistentStroke(s.x0, s.y0, s.x1, s.y1, s.color, s.size, true);
            }
        }
    }
}

function handleRemoteScreenDrawLaser(msg) {
    if (!isScreenDrawActive && msg.active) {
        toggleScreenAnnotations(true);
    }
    laserPointers.remote.active = Boolean(msg.active);
    if (msg.color) laserPointers.remote.color = msg.color;
    if (msg.name) laserPointers.remote.name = msg.name;

    if (msg.active && typeof msg.nx === 'number' && typeof msg.ny === 'number') {
        laserPointers.remote.nx = msg.nx;
        laserPointers.remote.ny = msg.ny;
        laserPointers.remote.trail.push({
            nx: msg.nx,
            ny: msg.ny,
            time: performance.now(),
        });
    }
    startScreenDrawAnim();
}

function handleRemoteScreenDrawClear() {
    clearScreenDrawData(false);
}

function handleRemoteScreenShareStatus(sharing) {
    remoteScreenSharing = !!sharing;
    updateTileMediaViews();
    if (sharing) {
        showToastNotification('🖥️ Собеседник запустил демонстрацию экрана. Вы можете рисовать (E)', 'info');
        if (screenDrawBtn) {
            screenDrawBtn.classList.add('peer-drawing');
            setTimeout(() => {
                screenDrawBtn.classList.remove('peer-drawing');
            }, 5000);
        }
    }
}

function mockBuddyScreenDoodle() {
    if (!isTestMode) return;
    let step = 0;
    const totalSteps = 24;
    const cx = 0.55;
    const cy = 0.45;
    const r = 0.12;

    const interval = setInterval(() => {
        if (!isTestMode || step >= totalSteps) {
            clearInterval(interval);
            handleRemoteScreenDrawLaser({ active: false });
            return;
        }
        const angle = (step / totalSteps) * Math.PI * 2;
        const nx = cx + Math.cos(angle) * r;
        const ny = cy + Math.sin(angle) * (r * 0.7);

        handleRemoteScreenDrawLaser({
            active: true,
            nx,
            ny,
            color: '#fee75c',
            name: 'Собеседник',
        });

        // Также добавляем пару исчезающих неоновых штрихов
        if (step % 4 === 0) {
            const nextAngle = angle + 0.3;
            handleRemoteScreenDrawStroke({
                mode: 'fade',
                x0: nx,
                y0: ny,
                x1: cx + Math.cos(nextAngle) * r,
                y1: cy + Math.sin(nextAngle) * (r * 0.7),
                color: '#00d2ff',
                size: 6,
            });
        }
        step++;
    }, 50);
}

function initScreenAnnotations() {
    if (!screenDrawCanvas || !screenDrawOverlay) return;

    ensureScreenDrawCanvasReady();

    // Кнопка в доке
    if (screenDrawBtn) {
        screenDrawBtn.addEventListener('click', () => {
            toggleScreenAnnotations();
        });
    }

    // Инструменты
    if (sdtLaserBtn) sdtLaserBtn.addEventListener('click', () => setScreenDrawTool('laser'));
    if (sdtFadeBtn) sdtFadeBtn.addEventListener('click', () => setScreenDrawTool('fade'));
    if (sdtPenBtn) sdtPenBtn.addEventListener('click', () => setScreenDrawTool('pen'));
    if (sdtEraserBtn) sdtEraserBtn.addEventListener('click', () => setScreenDrawTool('eraser'));

    // Цвета
    sdtColorBtns.forEach((btn) => {
        btn.addEventListener('click', () => setScreenDrawColor(btn.dataset.color));
    });

    // Размеры
    sdtSizeBtns.forEach((btn) => {
        btn.addEventListener('click', () => setScreenDrawSize(parseInt(btn.dataset.size, 10)));
    });

    // Действия
    if (sdtClearBtn) sdtClearBtn.addEventListener('click', () => clearScreenDrawData(true));
    if (sdtMinimizeBtn) sdtMinimizeBtn.addEventListener('click', () => toggleScreenDrawMinimize(true));
    if (sdtCloseBtn) sdtCloseBtn.addEventListener('click', () => toggleScreenAnnotations(false));
    if (screenDrawMinimizedPill) {
        screenDrawMinimizedPill.addEventListener('click', () => toggleScreenDrawMinimize(false));
    }

    // Обработка рисования по канвасу
    function onPointerDown(e) {
        if (!isScreenDrawActive) return;
        const pos = getNormalizedScreenPos(e);
        if (!pos || !pos.isInside) return;

        isScreenDrawPointerDown = true;
        lastScreenDrawPos = { nx: pos.nx, ny: pos.ny };

        if (screenDrawTool === 'laser') {
            laserPointers.local.active = true;
            laserPointers.local.nx = pos.nx;
            laserPointers.local.ny = pos.ny;
            laserPointers.local.trail.push({
                nx: pos.nx,
                ny: pos.ny,
                time: performance.now(),
            });
            startScreenDrawAnim();

            if (dataChannel && dataChannel.readyState === 'open') {
                try {
                    dataChannel.send(
                        JSON.stringify({
                            type: 'screen_draw_laser',
                            active: true,
                            nx: pos.nx,
                            ny: pos.ny,
                            color: screenDrawColor,
                            name: avatarProfile?.name || 'Вы',
                        }),
                    );
                } catch (err) {}
            }
        } else if (screenDrawTool === 'fade') {
            const x0 = Math.round(pos.nx * 10000) / 10000;
            const y0 = Math.round(pos.ny * 10000) / 10000;
            const x1 = Math.round((pos.nx + 0.0005) * 10000) / 10000;
            const y1 = Math.round((pos.ny + 0.0005) * 10000) / 10000;
            addFadingStroke(x0, y0, x1, y1, screenDrawColor, screenDrawSize);
            queueScreenDrawStroke({
                mode: 'fade',
                x0,
                y0,
                x1,
                y1,
                color: screenDrawColor,
                size: screenDrawSize,
            });
        } else if (screenDrawTool === 'pen') {
            const x0 = Math.round(pos.nx * 10000) / 10000;
            const y0 = Math.round(pos.ny * 10000) / 10000;
            const x1 = Math.round((pos.nx + 0.0005) * 10000) / 10000;
            const y1 = Math.round((pos.ny + 0.0005) * 10000) / 10000;
            addPersistentStroke(x0, y0, x1, y1, screenDrawColor, screenDrawSize, false);
            queueScreenDrawStroke({
                mode: 'pen',
                x0,
                y0,
                x1,
                y1,
                color: screenDrawColor,
                size: screenDrawSize,
            });
        } else if (screenDrawTool === 'eraser') {
            const x0 = Math.round(pos.nx * 10000) / 10000;
            const y0 = Math.round(pos.ny * 10000) / 10000;
            const x1 = Math.round((pos.nx + 0.0005) * 10000) / 10000;
            const y1 = Math.round((pos.ny + 0.0005) * 10000) / 10000;
            addPersistentStroke(x0, y0, x1, y1, screenDrawColor, screenDrawSize, true);
            queueScreenDrawStroke({
                mode: 'eraser',
                x0,
                y0,
                x1,
                y1,
                size: screenDrawSize,
            });
        }

        // Симуляция в тест-режиме
        if (isTestMode && !mockScreenDrawTimeout) {
            mockScreenDrawTimeout = setTimeout(() => {
                mockBuddyScreenDoodle();
                setTimeout(() => {
                    mockScreenDrawTimeout = null;
                }, 4000);
            }, 120);
        }
    }

    function onPointerMove(e) {
        if (!isScreenDrawActive) return;
        const pos = getNormalizedScreenPos(e);
        if (!pos) return;

        if (screenDrawTool === 'laser') {
            if (isScreenDrawPointerDown || pos.isInside) {
                laserPointers.local.active = isScreenDrawPointerDown || pos.isInside;
                laserPointers.local.nx = pos.nx;
                laserPointers.local.ny = pos.ny;
                laserPointers.local.trail.push({
                    nx: pos.nx,
                    ny: pos.ny,
                    time: performance.now(),
                });
                startScreenDrawAnim();

                const now = performance.now();
                if (now - lastLaserSendTime > 30) {
                    lastLaserSendTime = now;
                    if (dataChannel && dataChannel.readyState === 'open') {
                        try {
                            dataChannel.send(
                                JSON.stringify({
                                    type: 'screen_draw_laser',
                                    active: laserPointers.local.active,
                                    nx: Math.round(pos.nx * 10000) / 10000,
                                    ny: Math.round(pos.ny * 10000) / 10000,
                                    color: screenDrawColor,
                                    name: avatarProfile?.name || 'Вы',
                                }),
                            );
                        } catch (err) {}
                    }
                }
            }
            return;
        }

        if (!isScreenDrawPointerDown || !lastScreenDrawPos) return;

        if (screenDrawTool === 'fade') {
            const x0 = Math.round(lastScreenDrawPos.nx * 10000) / 10000;
            const y0 = Math.round(lastScreenDrawPos.ny * 10000) / 10000;
            const x1 = Math.round(pos.nx * 10000) / 10000;
            const y1 = Math.round(pos.ny * 10000) / 10000;
            addFadingStroke(x0, y0, x1, y1, screenDrawColor, screenDrawSize);
            queueScreenDrawStroke({
                mode: 'fade',
                x0,
                y0,
                x1,
                y1,
                color: screenDrawColor,
                size: screenDrawSize,
            });
        } else if (screenDrawTool === 'pen') {
            const x0 = Math.round(lastScreenDrawPos.nx * 10000) / 10000;
            const y0 = Math.round(lastScreenDrawPos.ny * 10000) / 10000;
            const x1 = Math.round(pos.nx * 10000) / 10000;
            const y1 = Math.round(pos.ny * 10000) / 10000;
            addPersistentStroke(x0, y0, x1, y1, screenDrawColor, screenDrawSize, false);
            queueScreenDrawStroke({
                mode: 'pen',
                x0,
                y0,
                x1,
                y1,
                color: screenDrawColor,
                size: screenDrawSize,
            });
        } else if (screenDrawTool === 'eraser') {
            const x0 = Math.round(lastScreenDrawPos.nx * 10000) / 10000;
            const y0 = Math.round(lastScreenDrawPos.ny * 10000) / 10000;
            const x1 = Math.round(pos.nx * 10000) / 10000;
            const y1 = Math.round(pos.ny * 10000) / 10000;
            addPersistentStroke(x0, y0, x1, y1, screenDrawColor, screenDrawSize, true);
            queueScreenDrawStroke({
                mode: 'eraser',
                x0,
                y0,
                x1,
                y1,
                size: screenDrawSize,
            });
        }

        lastScreenDrawPos = { nx: pos.nx, ny: pos.ny };
    }

    function onPointerUp() {
        if (!isScreenDrawActive) return;
        flushScreenDrawStrokes();
        isScreenDrawPointerDown = false;
        lastScreenDrawPos = null;

        if (screenDrawTool === 'laser') {
            laserPointers.local.active = false;
            if (dataChannel && dataChannel.readyState === 'open') {
                try {
                    dataChannel.send(
                        JSON.stringify({
                            type: 'screen_draw_laser',
                            active: false,
                        }),
                    );
                } catch (err) {}
            }
        }
    }

    screenDrawCanvas.addEventListener('pointerdown', onPointerDown);
    screenDrawCanvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    // Перетаскивание тулбара за drag handle
    if (screenDrawDragHandle && screenDrawToolbar) {
        function onDragStart(e) {
            e.preventDefault();
            e.stopPropagation();
            isScreenDrawToolbarDragging = true;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const rect = screenDrawToolbar.getBoundingClientRect();
            screenDrawDragStartX = clientX - rect.left;
            screenDrawDragStartY = clientY - rect.top;
        }

        function onDragMove(e) {
            if (!isScreenDrawToolbarDragging || !screenDrawToolbar || !screenDrawOverlay) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const overlayRect = screenDrawOverlay.getBoundingClientRect();

            let newX = clientX - overlayRect.left - screenDrawDragStartX;
            let newY = clientY - overlayRect.top - screenDrawDragStartY;

            const tRect = screenDrawToolbar.getBoundingClientRect();
            newX = Math.max(10, Math.min(overlayRect.width - tRect.width - 10, newX));
            newY = Math.max(10, Math.min(overlayRect.height - tRect.height - 10, newY));

            screenDrawToolbar.style.left = `${newX}px`;
            screenDrawToolbar.style.top = `${newY}px`;
            screenDrawToolbar.style.bottom = 'auto';
            screenDrawToolbar.style.transform = 'none';
        }

        function onDragEnd() {
            isScreenDrawToolbarDragging = false;
        }

        screenDrawDragHandle.addEventListener('mousedown', onDragStart);
        screenDrawDragHandle.addEventListener('touchstart', onDragStart, { passive: false });
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('touchmove', onDragMove, { passive: false });
        window.addEventListener('mouseup', onDragEnd);
        window.addEventListener('touchend', onDragEnd);
    }

    window.addEventListener('resize', () => {
        if (isScreenDrawActive) {
            ensureScreenDrawCanvasReady();
            renderScreenAnnotations();
        }
    });
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

// === ГОРЯЧИЕ КЛАВИШИ ===
window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
        if (screenShareModal && screenShareModal.style.display !== 'none') {
            closeScreenShareModal();
            return;
        }
        if (avatarModal && avatarModal.style.display !== 'none') {
            closeAvatarModal();
            return;
        }
        if (versionModal && versionModal.style.display !== 'none') {
            closeVersionModal();
            return;
        }
        if (isScreenDrawActive) {
            toggleScreenAnnotations(false);
            return;
        }
    }

    if (screenShareModal && screenShareModal.style.display !== 'none') {
        if (e.code === 'Enter') {
            if (confirmScreenModalBtn) confirmScreenModalBtn.click();
            return;
        }
    }

    // Игнорируем ввод внутри полей текста
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    if (e.code === 'KeyM') {
        toggleMic();
    } else if (e.code === 'KeyV') {
        toggleCam();
    } else if (e.code === 'KeyA') {
        toggleAvatarModal();
    } else if (e.code === 'KeyS') {
        toggleScreenShare();
    } else if (e.code === 'KeyE') {
        toggleScreenAnnotations();
    } else if (e.code === 'KeyD') {
        toggleDevDrawer();
    } else if (e.code === 'KeyC') {
        if (isScreenDrawActive) {
            clearScreenDrawData(true);
        } else {
            toggleChat();
        }
    } else if (e.code === 'KeyW') {
        toggleWhiteboard();
    } else if (e.code === 'KeyR') {
        if (reactionsBtn) reactionsBtn.click();
    } else if (isScreenDrawActive && e.code === 'Digit1') {
        setScreenDrawTool('laser');
    } else if (isScreenDrawActive && e.code === 'Digit2') {
        setScreenDrawTool('fade');
    } else if (isScreenDrawActive && e.code === 'Digit3') {
        setScreenDrawTool('pen');
    } else if (isScreenDrawActive && e.code === 'Digit4') {
        setScreenDrawTool('eraser');
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
    if (!devLocalSdp.value) {
        showToastNotification('⚠️ Сначала создайте вызов или запустите Тест UI');
        return;
    }
    await navigator.clipboard.writeText(devLocalSdp.value);
    devCopyLocalSdp.textContent = '✅ Скопировано!';
    setTimeout(() => {
        devCopyLocalSdp.textContent = 'Скопировать SDP';
    }, 1500);
});

devDecodeLocalBtn.addEventListener('click', async () => {
    if (!rawLocalJson && pc && pc.localDescription) {
        rawLocalJson = JSON.stringify(
            {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp,
            },
            null,
            2,
        );
    }

    if (!rawLocalJson) {
        const candidateToken =
            callerLocalToken?.value.trim() ||
            answererLocalToken?.value.trim() ||
            answererRemoteToken?.value.trim() ||
            callerRemoteToken?.value.trim();
        if (candidateToken) {
            try {
                const isOffer = !answererLocalToken?.value.trim();
                const decoded = await getValidSdp(candidateToken, isOffer);
                if (decoded) {
                    compressedLocalSdp = candidateToken;
                    rawLocalJson = JSON.stringify(JSON.parse(decoded), null, 2);
                }
            } catch (err) {
                log('⚠️ Не удалось декодировать токен в raw JSON: ' + err.message, 'warn');
            }
        }
    }

    if (!rawLocalJson) {
        showToastNotification('⚠️ Сначала сгенерируйте код звонка или запустите Тест UI');
        log('ℹ️ Нет локального SDP для отображения raw JSON. Создайте вызов или запустите Тест UI.', 'warn');
        return;
    }

    isShowingRawJson = !isShowingRawJson;
    if (isShowingRawJson) {
        try {
            devLocalSdp.value = JSON.stringify(JSON.parse(rawLocalJson), null, 2);
        } catch (e) {
            devLocalSdp.value = rawLocalJson;
        }
        devLocalSdp.style.height = '180px';
        devDecodeLocalBtn.textContent = 'Показать сжатый код';
        log('📄 Отображен форматированный raw JSON локального SDP');
        showToastNotification('📄 Показан raw JSON');
    } else {
        devLocalSdp.value = compressedLocalSdp || (pc?.localDescription?.sdp ?? rawLocalJson);
        devLocalSdp.style.height = '';
        devDecodeLocalBtn.textContent = 'Показать raw JSON';
        log('📦 Отображен сжатый SDP код');
        showToastNotification('📦 Показан сжатый SDP');
    }
});

clearLogBtn.addEventListener('click', () => {
    onscreenLog.innerHTML = '';
});

function initVersioningUI() {
    const versionLabel = `v${APP_VERSION}`;

    if (appVersionBadge) appVersionBadge.textContent = versionLabel;
    if (lobbyVersionBadge) lobbyVersionBadge.textContent = versionLabel;
    if (devHeaderVersion) devHeaderVersion.textContent = versionLabel;
    if (metricAppVersion) metricAppVersion.textContent = versionLabel;
    if (modalAppVersion) modalAppVersion.textContent = versionLabel;
    if (lobbyBuildDate) lobbyBuildDate.textContent = `Сборка: ${APP_BUILD_DATE}`;
    if (modalBuildDate) modalBuildDate.textContent = APP_BUILD_DATE;
    if (modalBuildId) modalBuildId.textContent = APP_BUILD_ID;

    const openVersionModal = () => {
        if (versionModal) versionModal.style.display = 'flex';
    };

    const closeVersionModal = () => {
        if (versionModal) versionModal.style.display = 'none';
    };

    if (appVersionBadge) appVersionBadge.addEventListener('click', openVersionModal);
    if (lobbyVersionBadge) lobbyVersionBadge.addEventListener('click', openVersionModal);
    if (versionInfoBtn) versionInfoBtn.addEventListener('click', openVersionModal);
    if (closeVersionModalBtn) closeVersionModalBtn.addEventListener('click', closeVersionModal);
    if (ackVersionBtn) ackVersionBtn.addEventListener('click', closeVersionModal);

    if (versionModal) {
        versionModal.addEventListener('click', (e) => {
            if (e.target === versionModal) closeVersionModal();
        });
    }

    if (forceReloadBtn) {
        forceReloadBtn.addEventListener('click', () => {
            const url = new URL(window.location.href);
            url.searchParams.set('v', Date.now());
            window.location.href = url.toString();
        });
    }

    // Логирование версии при старте
    log(`🚀 P2P Видеозвонок v${APP_VERSION} (сборка ${APP_BUILD_DATE}) инициализирована`);
    console.log(
        `%c P2P Видеозвонок %c v${APP_VERSION} (${APP_BUILD_DATE}) `,
        'background:#5865f2; color:#fff; font-weight:bold; padding:3px 6px; border-radius:4px 0 0 4px;',
        'background:#2b2d31; color:#00b0f4; font-weight:bold; padding:3px 6px; border-radius:0 4px 4px 0;',
    );
}

// Инициализация гардероба аватара, совместной доски, аннотаций экрана и версионирования
initWardrobeControls();
initWhiteboard();
initScreenAnnotations();
initVersioningUI();

// Запуск холста аватара для мгновенного отображения персонажа в лобби
initAvatarCanvas();
if (previewVideo && avatarStream) {
    previewVideo.srcObject = avatarStream;
}
updateTileMediaViews();

// Запуск превью медиа при открытии страницы (если поддерживается)
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    // Не запрашиваем принудительно доступ сразу чтобы не пугать диалогом, но готовим обработчики
    log(
        '🚀 Система готова к работе. Выберите гардероб аватара и создайте звонок.',
    );
}

// Horror Story Generator - Client-only
console.log('🔴 app.js chargé');

// Éléments DOM
const generateBtn = document.getElementById('generateBtn');
const loadingSection = document.getElementById('loadingSection');
const storySection = document.getElementById('storySection');
const slideshowSection = document.getElementById('slideshowSection');
const errorSection = document.getElementById('errorSection');
const loadingText = document.querySelector('.loading-text');
const sceneCanvas = document.getElementById('sceneCanvas');
const recordBtn = document.getElementById('recordBtn');

let currentStory = null;
let currentScenes = [];
let recording = false;
let mediaRecorder = null;
let recordedChunks = [];

let terminalPaused = false;
let autoScroll = true;
let persistEnabled = true;
let autoLangEnabled = true;
let terminalEl, terminalClearBtn, terminalPauseBtn, terminalCopyBtn, terminalExportBtn, terminalAutoscrollBtn;
let filterInfoEl, filterWarnEl, filterErrorEl, terminalSearchEl, terminalCountersEl;
const logStore = [];
const counters = { info: 0, warn: 0, error: 0 };
const filters = { info: true, warn: true, error: true };
let searchText = '';

document.addEventListener('DOMContentLoaded', () => {
    console.log('🟢 DOM prêt');
    setupEventListeners();
    setupTerminal();
    initVoices();
    initSettings();
    log('info', 'Application prête. Cliquez sur "Lire une histoire".');
});

function setupEventListeners() {
    console.log('🔧 Setup listeners');
    generateBtn.addEventListener('click', runClientOnlyFlow);
    document.getElementById('diagnoseBtn')?.addEventListener('click', runDiagnostics);
    document.getElementById('newVideoBtn')?.addEventListener('click', resetAndGenerate);
    document.getElementById('retryBtn')?.addEventListener('click', runClientOnlyFlow);
    recordBtn?.addEventListener('click', recordWebM);
    document.getElementById('testVoiceBtn')?.addEventListener('click', () => {
        speakTextSample('Cette voix est-elle correcte pour une histoire d\'horreur ?');
    });
    document.getElementById('autoMatchLang')?.addEventListener('change', (e) => {
        autoLangEnabled = !!e.target.checked; saveSettings();
    });
    document.getElementById('persistSettings')?.addEventListener('change', (e) => {
        persistEnabled = !!e.target.checked;
        if (persistEnabled) saveSettings();
        else localStorage.removeItem('ttsSettings');
    });
    document.getElementById('voiceSelect')?.addEventListener('change', saveSettings);
    document.getElementById('tonePreset')?.addEventListener('change', saveSettings);
    document.getElementById('voiceRate')?.addEventListener('input', saveSettings);
    document.getElementById('voicePitch')?.addEventListener('input', saveSettings);
    document.getElementById('voiceVolume')?.addEventListener('input', saveSettings);
}

async function runDiagnostics() {
    log('info', 'Diagnostic démarré…');
    try {
        log('info', `Origine: ${location.protocol}//${location.hostname}`);
        log('info', `HTTPS: ${location.protocol === 'https:'}`);
        log('info', `GitHub Pages: ${/github\.io$/i.test(location.hostname)}`);
        log('info', `UserAgent: ${navigator.userAgent}`);

        const hasSpeech = 'speechSynthesis' in window;
        log(hasSpeech ? 'info' : 'warn', `Web Speech supporté: ${hasSpeech}`);
        let voicesCount = 0;
        try {
            voicesCount = window.speechSynthesis.getVoices().length;
            log('info', `Voix disponibles: ${voicesCount}`);
        } catch (e) {
            log('warn', `Lecture des voix impossible: ${e.message}`);
        }

        const hasMediaRecorder = 'MediaRecorder' in window;
        log(hasMediaRecorder ? 'info' : 'warn', `MediaRecorder: ${hasMediaRecorder}`);
        const hasAudioContext = !!(window.AudioContext || window.webkitAudioContext);
        log(hasAudioContext ? 'info' : 'warn', `AudioContext: ${hasAudioContext}`);
        const canCapture = !!sceneCanvas?.captureStream;
        log(canCapture ? 'info' : 'warn', `Canvas.captureStream: ${canCapture}`);

        try {
            localStorage.setItem('__diag', 'ok');
            localStorage.removeItem('__diag');
            log('info', 'localStorage OK');
        } catch {
            log('warn', 'localStorage indisponible');
        }

        if ('permissions' in navigator) {
            try {
                const mic = await navigator.permissions.query({ name: 'microphone' });
                log('info', `Permission micro: ${mic.state}`);
            } catch {}
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const resp = await instrumentedFetch('https://www.reddit.com/r/scarystories/hot.json?limit=5', { signal: controller.signal });
            clearTimeout(timeout);
            log(resp.ok ? 'info' : 'warn', `Reddit status: ${resp.status}`);
        } catch (e) {
            log('warn', `Reddit inaccessible (attendu sur Pages/CORS): ${e.message}`);
        }

        log('info', 'Diagnostic terminé.');
    } catch (e) {
        log('error', `Diagnostic échoué: ${e.message}`);
    }
}

async function runClientOnlyFlow() {
    console.log('🚀 runClientOnlyFlow');
    try {
        hideAllSections();
        showSection(loadingSection);
        generateBtn.disabled = true;
        log('info', 'Début du flux client-only');

        updateLoadingStep('story', 'active');
        updateLoadingText('Récupération d\'une histoire d\'horreur...');

        const story = await fetchRandomRedditStory();
        currentStory = story;
        log('info', `Histoire récupérée: ${story.title} (u/${story.author})`);

        updateLoadingStep('story', 'completed');
        updateLoadingStep('audio', 'active');
        updateLoadingText('Narration IA en cours...');

        speakStory(`${story.title}. ${story.text}`);
        log('info', 'Narration démarrée via Web Speech');
        updateLoadingStep('audio', 'completed');

        updateLoadingStep('slideshow', 'active');
        updateLoadingText('Création du diaporama des scènes...');
        currentScenes = splitIntoScenes(story.text, 6);
        log('info', `Nombre de scènes: ${currentScenes.length}`);
        renderSlideshow(currentScenes);
        updateLoadingStep('slideshow', 'completed');

        displayStory(currentStory);

        hideSection(loadingSection);
        showSection(storySection);
        showSection(slideshowSection);
        generateBtn.disabled = false;

    } catch (error) {
        console.error('Erreur:', error);
        showError(error.message);
        generateBtn.disabled = false;
    }
}

async function fetchRandomRedditStory() {
    log('info', 'Appel à l\'API publique Reddit…');
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const resp = await instrumentedFetch('https://www.reddit.com/r/scarystories/hot.json?limit=100', { signal: controller.signal });
        clearTimeout(timeout);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const posts = (json.data.children || [])
            .map(c => c.data)
            .filter(p => p.selftext && p.selftext.length > 500 && p.selftext.length < 5000 && !p.over_18);
        const pick = posts[Math.floor(Math.random() * posts.length)];
        if (!pick) throw new Error('Aucune histoire valide');
        return {
            id: pick.id,
            title: pick.title,
            text: pick.selftext,
            author: pick.author,
            url: `https://reddit.com${pick.permalink}`
        };
    } catch (e) {
        log('warn', `Reddit indisponible (CORS/réseau). Utilisation d'une histoire de démo. Détail: ${e.message}`);
        return {
            id: 'demo',
            title: 'The Midnight Visitor',
            text: `I always thought the scratching sounds in my walls were just mice. I set traps, called an exterminator, even tried to seal up any holes I could find. But the scratching continued, night after night, always at exactly 3:13 AM.\n\nLast night, I decided to stay awake and investigate. Armed with a flashlight and a baseball bat, I waited in the darkness of my bedroom. At 3:13 AM, the scratching began. But this time, it wasn't coming from the walls.\n\nIt was coming from under my bed.`,
            author: 'DemoAuthor',
            url: 'https://reddit.com/r/scarystories'
        };
    }
}

function displayStory(story) {
    document.getElementById('storyTitle').textContent = story.title;
    document.getElementById('storyAuthor').textContent = `Par u/${story.author}`;
    document.getElementById('storyLink').href = story.url;
    const maxLength = 1000;
    let displayText = story.text;
    if (displayText.length > maxLength) displayText = displayText.substring(0, maxLength) + '...';
    document.getElementById('storyText').textContent = displayText;
}

function splitIntoScenes(text, maxScenes = 6) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const scenesPerSegment = Math.ceil(sentences.length / maxScenes);
    const scenes = [];
    for (let i = 0; i < sentences.length; i += scenesPerSegment) {
        const sceneText = sentences.slice(i, i + scenesPerSegment).join(' ').trim();
        if (sceneText) scenes.push(sceneText);
    }
    return scenes.slice(0, maxScenes);
}

function speakStory(text) {
    if (!('speechSynthesis' in window)) {
        log('warn', 'Web Speech non supporté');
        return;
    }
    speakScenes(splitIntoScenes(text, 6), '');
}

function speakScenes(scenes, title = '') {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const sampleText = scenes[0] || title || 'test';
    const lang = detectLanguage(sampleText);
    if (autoLangEnabled) selectBestVoiceForLang(lang);
    const voice = getSelectedVoice();
    const preset = getTonePreset();
    const items = [];
    if (title) items.push(`${title}.`);
    items.push(...scenes);
    log('info', `Lecture avec voix: ${voice?.name || 'par défaut'}, preset: ${preset.name}`);
    let i = 0;
    const speakNext = () => {
        if (i >= items.length) {
            log('info', 'Narration terminée');
            return;
        }
        const text = items[i++];
        const cfg = adjustToneForText(text, preset);
        const u = new SpeechSynthesisUtterance(text);
        u.lang = detectLanguage(text);
        if (voice) u.voice = voice;
        u.rate = clamp(cfg.rate, 0.5, 2.0);
        u.pitch = clamp(cfg.pitch, 0.1, 2.0);
        u.volume = clamp(cfg.volume, 0.0, 1.0);
        u.onend = () => setTimeout(speakNext, cfg.pauseMs || 250);
        u.onerror = (e) => {
            log('error', 'Erreur TTS', { error: e?.error });
            setTimeout(speakNext, 250);
        };
        try {
            window.speechSynthesis.speak(u);
        } catch (e) {
            log('error', e.message);
        }
    };
    speakNext();
}

function speakTextSample(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const voice = getSelectedVoice();
    const preset = getTonePreset();
    const cfg = adjustToneForText(text, preset);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = detectLanguage(text);
    if (voice) u.voice = voice;
    u.rate = cfg.rate;
    u.pitch = cfg.pitch;
    u.volume = cfg.volume;
    try {
        window.speechSynthesis.speak(u);
    } catch {}
}

function detectLanguage(text) {
    const englishHints = ['the', 'and', 'was', 'night', 'door', 'dark', 'I'];
    const count = englishHints.reduce((acc, w) => acc + (text.toLowerCase().includes(w) ? 1 : 0), 0);
    return count >= 3 ? 'en-US' : 'fr-FR';
}

function initVoices() {
    const fill = () => {
        const select = document.getElementById('voiceSelect');
        if (!select) return;
        const voices = window.speechSynthesis.getVoices();
        select.innerHTML = '';
        const options = voices.filter(v => ['fr', 'en'].includes((v.lang || '').slice(0, 2)))
            .map(v => `<option value="${v.name}">${v.name} (${v.lang})</option>`);
        select.insertAdjacentHTML('beforeend', options.join(''));
        applySavedVoice();
    };
    try { fill(); } catch {}
    window.speechSynthesis.onvoiceschanged = fill;
}

function getSelectedVoice() {
    const select = document.getElementById('voiceSelect');
    if (!select) return null;
    const name = select.value;
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.name === name) || null;
}

function selectBestVoiceForLang(lang) {
    const select = document.getElementById('voiceSelect');
    const voices = window.speechSynthesis.getVoices();
    const candidates = voices.filter(v => (v.lang || '').toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)));
    const preferred = candidates.find(v => /Microsoft|Google|Neural/i.test(v.name)) || candidates[0] || null;
    if (preferred && select) {
        select.value = preferred.name;
    }
}

function getTonePreset() {
    const id = document.getElementById('tonePreset')?.value || 'narrator';
    const base = {
        horror: { name: 'Horror', rate: getRange('voiceRate', 0.85), pitch: getRange('voicePitch', 0.85), volume: getRange('voiceVolume', 1.0), pauseMs: 350 },
        narrator: { name: 'Narrator', rate: getRange('voiceRate', 0.95), pitch: getRange('voicePitch', 0.90), volume: getRange('voiceVolume', 1.0), pauseMs: 250 },
        calm: { name: 'Calm', rate: getRange('voiceRate', 0.90), pitch: getRange('voicePitch', 0.80), volume: getRange('voiceVolume', 0.95), pauseMs: 300 },
        intense: { name: 'Intense', rate: getRange('voiceRate', 1.05), pitch: getRange('voicePitch', 1.10), volume: getRange('voiceVolume', 1.0), pauseMs: 200 }
    };
    return base[id] || base.narrator;
}

function adjustToneForText(text, preset) {
    const t = text.toLowerCase();
    let { rate, pitch, volume, pauseMs } = preset;
    const ex = (text.match(/!+/g) || []).length;
    const q = (text.match(/\?+/g) || []).length;
    rate += Math.min(0.05 * ex, 0.15);
    pitch += Math.min(0.03 * q, 0.12);
    const slowWords = ['dark', 'noir', 'silence', 'quiet', 'creak', 'blood', 'sang', 'tombe', 'midnight'];
    if (slowWords.some(w => t.includes(w))) {
        rate -= 0.05;
        pauseMs += 100;
    }
    const whisperWords = ['whisper', 'chuchot', 'softly'];
    if (whisperWords.some(w => t.includes(w))) {
        volume -= 0.1;
        pitch += 0.05;
    }
    return { rate, pitch, volume, pauseMs };
}

function getRange(id, def) {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) || def : def;
}

function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
}

function initSettings() {
    try {
        const raw = localStorage.getItem('ttsSettings');
        if (raw) {
            const s = JSON.parse(raw);
            persistEnabled = s.persistEnabled ?? true;
            autoLangEnabled = s.autoLangEnabled ?? true;
            document.getElementById('persistSettings')?.setAttribute('checked', persistEnabled ? 'checked' : '');
            document.getElementById('autoMatchLang')?.setAttribute('checked', autoLangEnabled ? 'checked' : '');
            document.getElementById('tonePreset')?.value = s.tonePreset ?? 'narrator';
            document.getElementById('voiceRate')?.setAttribute('value', s.voiceRate ?? 0.95);
            document.getElementById('voicePitch')?.setAttribute('value', s.voicePitch ?? 0.90);
            document.getElementById('voiceVolume')?.setAttribute('value', s.voiceVolume ?? 1.0);
            window.__savedVoiceName = s.voiceName || null;
        }
    } catch {}
}

function applySavedVoice() {
    const select = document.getElementById('voiceSelect');
    if (!select || !window.__savedVoiceName) return;
    const voices = window.speechSynthesis.getVoices();
    const exists = voices.some(v => v.name === window.__savedVoiceName);
    if (exists) select.value = window.__savedVoiceName;
}

function saveSettings() {
    if (!persistEnabled) return;
    try {
        const data = {
            persistEnabled,
            autoLangEnabled,
            voiceName: document.getElementById('voiceSelect')?.value || null,
            tonePreset: document.getElementById('tonePreset')?.value || 'narrator',
            voiceRate: getRange('voiceRate', 0.95),
            voicePitch: getRange('voicePitch', 0.90),
            voiceVolume: getRange('voiceVolume', 1.0)
        };
        localStorage.setItem('ttsSettings', JSON.stringify(data));
    } catch {}
}

function renderSlideshow(scenes) {
    if (!sceneCanvas) {
        log('error', 'Canvas introuvable');
        return;
    }
    const ctx = sceneCanvas.getContext('2d');
    let idx = 0;

    function drawScene(text) {
        const grd = ctx.createRadialGradient(640, 360, 50, 640, 360, 800);
        grd.addColorStop(0, '#111');
        grd.addColorStop(1, '#000');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, sceneCanvas.width, sceneCanvas.height);

        ctx.fillStyle = '#8b0000';
        ctx.font = 'bold 40px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText('HORROR STORY', sceneCanvas.width / 2, 70);

        ctx.fillStyle = '#fff';
        ctx.font = '24px Segoe UI';
        ctx.textAlign = 'left';
        wrapText(ctx, text, 80, 130, sceneCanvas.width - 160, 34);

        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, 0, sceneCanvas.width, sceneCanvas.height);
    }

    drawScene(scenes[0] || '');
    let timer = setInterval(() => {
        idx = (idx + 1) % scenes.length;
        drawScene(scenes[idx]);
        log('info', `Changement de scène: ${idx + 1}/${scenes.length}`);
    }, 5000);

    if (renderSlideshow._timer) clearInterval(renderSlideshow._timer);
    renderSlideshow._timer = timer;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}

async function recordWebM() {
    if (recording) return;
    if (!('MediaRecorder' in window)) {
        log('warn', 'MediaRecorder non supporté');
        return;
    }
    recording = true;
    recordedChunks = [];
    log('info', 'Enregistrement WebM démarré');

    const fps = 30;
    const canvasStream = sceneCanvas.captureStream(fps);

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
        log('warn', 'AudioContext non supporté — piste audio désactivée');
    }
    const ctx = AudioCtx ? new AudioCtx() : null;
    let dest, osc, gain;
    if (ctx) {
        dest = ctx.createMediaStreamDestination();
        osc = ctx.createOscillator();
        gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 20;
        gain.gain.value = 0.02;
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
    }

    const mixedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(dest ? dest.stream.getAudioTracks() : [])
    ]);

    mediaRecorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm;codecs=vp9,opus' });
    mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
        if (osc) osc.stop();
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `horror-story-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        recording = false;
        log('info', 'Enregistrement WebM terminé et téléchargé');
    };

    mediaRecorder.start();
    const totalMs = (currentScenes.length || 5) * 5000;
    setTimeout(() => mediaRecorder.stop(), totalMs);
}

function resetAndGenerate() {
    currentStory = null;
    currentScenes = [];
    hideAllSections();
    resetLoadingSteps();
    runClientOnlyFlow();
}

function showError(message) {
    hideAllSections();
    document.getElementById('errorMessage').textContent = message;
    showSection(errorSection);
}

function hideAllSections() {
    loadingSection.classList.add('hidden');
    storySection.classList.add('hidden');
    slideshowSection.classList.add('hidden');
    errorSection.classList.add('hidden');
}

function showSection(section) {
    section.classList.remove('hidden');
}

function hideSection(section) {
    if (section && section.classList) section.classList.add('hidden');
}

function updateLoadingStep(stepName, status) {
    const step = document.querySelector(`[data-step="${stepName}"]`);
    if (step) {
        step.classList.remove('active', 'completed');
        if (status) step.classList.add(status);
    }
}

function resetLoadingSteps() {
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active', 'completed');
    });
}

function updateLoadingText(text) {
    loadingText.textContent = text;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

window.addEventListener('unhandledrejection', (event) => {
    console.error('Erreur non gérée:', event.reason);
    showError('Une erreur inattendue s\'est produite. Veuillez réessayer.');
});

function setupTerminal() {
    terminalEl = document.getElementById('terminalOutput');
    terminalClearBtn = document.getElementById('terminalClear');
    terminalPauseBtn = document.getElementById('terminalPause');
    terminalCopyBtn = document.getElementById('terminalCopy');
    terminalExportBtn = document.getElementById('terminalExport');
    terminalAutoscrollBtn = document.getElementById('terminalAutoscroll');
    filterInfoEl = document.getElementById('filterInfo');
    filterWarnEl = document.getElementById('filterWarn');
    filterErrorEl = document.getElementById('filterError');
    terminalSearchEl = document.getElementById('terminalSearch');
    terminalCountersEl = document.getElementById('terminalCounters');
    if (!terminalEl) return;
    terminalClearBtn?.addEventListener('click', () => { terminalEl.textContent = ''; });
    terminalPauseBtn?.addEventListener('click', () => {
        terminalPaused = !terminalPaused;
        terminalPauseBtn.textContent = terminalPaused ? '▶️' : '⏸️';
    });
    terminalAutoscrollBtn?.addEventListener('click', () => {
        autoScroll = !autoScroll;
        terminalAutoscrollBtn.textContent = autoScroll ? '🔁' : '⏹️';
    });
    filterInfoEl?.addEventListener('change', () => {
        filters.info = !!filterInfoEl.checked;
        applyFilters();
    });
    filterWarnEl?.addEventListener('change', () => {
        filters.warn = !!filterWarnEl.checked;
        applyFilters();
    });
    filterErrorEl?.addEventListener('change', () => {
        filters.error = !!filterErrorEl.checked;
        applyFilters();
    });
    terminalSearchEl?.addEventListener('input', () => {
        searchText = terminalSearchEl.value.toLowerCase();
        applyFilters();
    });
    terminalCopyBtn?.addEventListener('click', () => {
        const text = logStore.map(e => `[${new Date(e.ts).toLocaleTimeString()}] ${e.level.toUpperCase()}: ${e.msg}`).join('\n');
        navigator.clipboard?.writeText(text).then(() => log('info', 'Logs copiés dans le presse-papiers'));
    });
    terminalExportBtn?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(logStore, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `terminal-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        log('info', 'Export JSON des logs téléchargé');
    });
    const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    console.log = (...args) => {
        log('info', args.join(' '));
        orig.log.apply(console, args);
    };
    console.warn = (...args) => {
        log('warn', args.join(' '));
        orig.warn.apply(console, args);
    };
    console.error = (...args) => {
        const err = args[0] instanceof Error ? args[0] : new Error(args.join(' '));
        log('error', err.message, { stack: err.stack });
        orig.error.apply(console, args);
    };
    console.info = (...args) => {
        log('info', args.join(' '));
        orig.info.apply(console, args);
    };
}

function log(level, msg, ctx = {}) {
    const entry = { ts: Date.now(), level, msg, ctx };
    logStore.push(entry);
    counters[level] = (counters[level] || 0) + 1;
    if (!terminalEl || terminalPaused) {
        console.log(`[${level.toUpperCase()}]`, msg, ctx);
        return;
    }
    updateCounters();
    const passes = filters[level] && (!searchText || (String(msg).toLowerCase().includes(searchText)));
    const time = new Date(entry.ts).toLocaleTimeString();
    const line = document.createElement('div');
    line.className = 'term-line';
    line.dataset.level = level;
    line.dataset.text = String(msg).toLowerCase();
    line.style.display = passes ? '' : 'none';
    const timeSpan = document.createElement('span');
    timeSpan.className = 'term-time';
    timeSpan.textContent = `[${time}]`;
    const badge = document.createElement('span');
    badge.className = `term-badge term-badge-${level}`;
    badge.textContent = level.toUpperCase();
    const msgSpan = document.createElement('span');
    msgSpan.className = 'term-msg';
    msgSpan.textContent = ` ${msg}`;
    line.appendChild(timeSpan);
    line.appendChild(badge);
    line.appendChild(msgSpan);
    if (ctx && (ctx.durationMs || ctx.type || ctx.status || ctx.error)) {
        const details = document.createElement('span');
        details.className = 'term-context';
        details.textContent = ` ${JSON.stringify(ctx)}`;
        line.appendChild(details);
    }
    if (ctx && ctx.stack) {
        const stackEl = document.createElement('div');
        stackEl.className = 'term-stack';
        stackEl.textContent = ctx.stack;
        line.appendChild(stackEl);
    }
    terminalEl.appendChild(line);
    if (autoScroll) terminalEl.scrollTop = terminalEl.scrollHeight;
}

function updateCounters() {
    if (!terminalCountersEl) return;
    terminalCountersEl.textContent = `I:${counters.info} W:${counters.warn} E:${counters.error}`;
}

function applyFilters() {
    Array.from(terminalEl.children).forEach(line => {
        const level = line.dataset.level;
        const text = line.dataset.text || '';
        const visibleByLevel = filters[level];
        const visibleBySearch = !searchText || text.includes(searchText);
        line.style.display = (visibleByLevel && visibleBySearch) ? '' : 'none';
    });
}

async function instrumentedFetch(url, options = {}) {
    const start = performance.now();
    log('info', `HTTP ${options.method || 'GET'} ${url}`, { type: 'fetch', phase: 'start' });
    try {
        const resp = await fetch(url, options);
        const dur = Math.round(performance.now() - start);
        log(resp.ok ? 'info' : 'warn', `HTTP ${resp.status} ${url} (${dur}ms)`, { type: 'fetch', status: resp.status, durationMs: dur });
        return resp;
    } catch (e) {
        const dur = Math.round(performance.now() - start);
        log('error', `HTTP error ${url} (${dur}ms)`, { type: 'fetch', durationMs: dur, error: e.message, stack: e.stack });
        throw e;
    }
}

console.log('✅ app.js complètement chargé');

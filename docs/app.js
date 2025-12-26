console.log('APP START');

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

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM READY');
    setupEventListeners();
    setupTerminal();
    initVoices();
    initSettings();
    log('info', 'Application prete');
});

function setupEventListeners() {
    console.log('SETUP LISTENERS');
    generateBtn.addEventListener('click', runClientOnlyFlow);
    const diagBtn = document.getElementById('diagnoseBtn');
    if (diagBtn) diagBtn.addEventListener('click', runDiagnostics);
    const newBtn = document.getElementById('newVideoBtn');
    if (newBtn) newBtn.addEventListener('click', resetAndGenerate);
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) retryBtn.addEventListener('click', runClientOnlyFlow);
    if (recordBtn) recordBtn.addEventListener('click', recordWebM);
    const testBtn = document.getElementById('testVoiceBtn');
    if (testBtn) testBtn.addEventListener('click', function() {
        speakTextSample('Test de la voix');
    });
    const autoLang = document.getElementById('autoMatchLang');
    if (autoLang) autoLang.addEventListener('change', function(e) {
        autoLangEnabled = e.target.checked;
        saveSettings();
    });
    const persist = document.getElementById('persistSettings');
    if (persist) persist.addEventListener('change', function(e) {
        persistEnabled = e.target.checked;
        if (persistEnabled) saveSettings();
        else localStorage.removeItem('ttsSettings');
    });
    const voiceSel = document.getElementById('voiceSelect');
    if (voiceSel) voiceSel.addEventListener('change', saveSettings);
    const tonePre = document.getElementById('tonePreset');
    if (tonePre) tonePre.addEventListener('change', saveSettings);
    const rate = document.getElementById('voiceRate');
    if (rate) rate.addEventListener('input', saveSettings);
    const pitch = document.getElementById('voicePitch');
    if (pitch) pitch.addEventListener('input', saveSettings);
    const vol = document.getElementById('voiceVolume');
    if (vol) vol.addEventListener('input', saveSettings);
}

async function runDiagnostics() {
    log('info', 'Diagnostic demarre');
    try {
        log('info', 'Origine: ' + location.protocol + '//' + location.hostname);
        log('info', 'HTTPS: ' + (location.protocol === 'https:'));
        const hasSpeech = 'speechSynthesis' in window;
        log(hasSpeech ? 'info' : 'warn', 'Web Speech: ' + hasSpeech);
        const hasMediaRecorder = 'MediaRecorder' in window;
        log(hasMediaRecorder ? 'info' : 'warn', 'MediaRecorder: ' + hasMediaRecorder);
        log('info', 'Diagnostic termine');
    } catch (e) {
        log('error', 'Diagnostic echoue: ' + e.message);
    }
}

async function runClientOnlyFlow() {
    console.log('RUN CLIENT FLOW');
    try {
        hideAllSections();
        showSection(loadingSection);
        generateBtn.disabled = true;
        log('info', 'Debut du flux');
        updateLoadingStep('story', 'active');
        updateLoadingText('Recuperation histoire...');
        const story = await fetchRandomRedditStory();
        currentStory = story;
        log('info', 'Histoire recuperee: ' + story.title);
        updateLoadingStep('story', 'completed');
        updateLoadingStep('audio', 'active');
        updateLoadingText('Narration IA...');
        speakStory(story.title + '. ' + story.text);
        log('info', 'Narration demarree');
        updateLoadingStep('audio', 'completed');
        updateLoadingStep('slideshow', 'active');
        updateLoadingText('Creation diaporama...');
        currentScenes = splitIntoScenes(story.text, 6);
        log('info', 'Scenes: ' + currentScenes.length);
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
    log('info', 'Appel API Reddit');
    try {
        const controller = new AbortController();
        const timeout = setTimeout(function() { controller.abort(); }, 8000);
        const resp = await instrumentedFetch('https://www.reddit.com/r/scarystories/hot.json?limit=100', { signal: controller.signal });
        clearTimeout(timeout);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const json = await resp.json();
        const posts = json.data.children.map(function(c) { return c.data; }).filter(function(p) {
            return p.selftext && p.selftext.length > 500 && p.selftext.length < 5000;
        });
        const pick = posts[Math.floor(Math.random() * posts.length)];
        if (!pick) throw new Error('Aucune histoire valide');
        return {
            id: pick.id,
            title: pick.title,
            text: pick.selftext,
            author: pick.author,
            url: 'https://reddit.com' + pick.permalink
        };
    } catch (e) {
        log('warn', 'Reddit indisponible, utilisation demo');
        return {
            id: 'demo',
            title: 'The Midnight Visitor',
            text: 'I always thought the scratching sounds in my walls were just mice. I set traps, called an exterminator, even tried to seal up any holes I could find. But the scratching continued, night after night, always at exactly 3:13 AM. Last night, I decided to stay awake and investigate. Armed with a flashlight and a baseball bat, I waited in the darkness of my bedroom. At 3:13 AM, the scratching began. But this time, it was not coming from the walls. It was coming from under my bed.',
            author: 'DemoAuthor',
            url: 'https://reddit.com/r/scarystories'
        };
    }
}

function displayStory(story) {
    document.getElementById('storyTitle').textContent = story.title;
    document.getElementById('storyAuthor').textContent = 'Par u/' + story.author;
    document.getElementById('storyLink').href = story.url;
    const maxLength = 1000;
    let displayText = story.text;
    if (displayText.length > maxLength) displayText = displayText.substring(0, maxLength) + '...';
    document.getElementById('storyText').textContent = displayText;
}

function splitIntoScenes(text, maxScenes) {
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
        log('warn', 'Web Speech non supporte');
        return;
    }
    speakScenes(splitIntoScenes(text, 6), '');
}

function speakScenes(scenes, title) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const sampleText = scenes[0] || title || 'test';
    const lang = detectLanguage(sampleText);
    if (autoLangEnabled) selectBestVoiceForLang(lang);
    const voice = getSelectedVoice();
    const preset = getTonePreset();
    const items = [];
    if (title) items.push(title + '.');
    items.push.apply(items, scenes);
    log('info', 'Lecture avec voix: ' + (voice ? voice.name : 'defaut'));
    let i = 0;
    const speakNext = function() {
        if (i >= items.length) {
            log('info', 'Narration terminee');
            return;
        }
        const text = items[i];
        i = i + 1;
        const cfg = adjustToneForText(text, preset);
        const u = new SpeechSynthesisUtterance(text);
        u.lang = detectLanguage(text);
        if (voice) u.voice = voice;
        u.rate = clamp(cfg.rate, 0.5, 2.0);
        u.pitch = clamp(cfg.pitch, 0.1, 2.0);
        u.volume = clamp(cfg.volume, 0.0, 1.0);
        u.onend = function() {
            setTimeout(speakNext, cfg.pauseMs || 250);
        };
        u.onerror = function(e) {
            log('error', 'Erreur TTS');
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
    } catch (e) {
        log('error', e.message);
    }
}

function detectLanguage(text) {
    const englishHints = ['the', 'and', 'was', 'night', 'door', 'dark', 'I'];
    let count = 0;
    for (let i = 0; i < englishHints.length; i++) {
        if (text.toLowerCase().indexOf(englishHints[i]) !== -1) count++;
    }
    return count >= 3 ? 'en-US' : 'fr-FR';
}

function initVoices() {
    const fill = function() {
        const select = document.getElementById('voiceSelect');
        if (!select) return;
        const voices = window.speechSynthesis.getVoices();
        select.innerHTML = '';
        const filtered = voices.filter(function(v) {
            const lang = v.lang || '';
            const prefix = lang.slice(0, 2);
            return prefix === 'fr' || prefix === 'en';
        });
        for (let i = 0; i < filtered.length; i++) {
            const v = filtered[i];
            const opt = document.createElement('option');
            opt.value = v.name;
            opt.textContent = v.name + ' (' + v.lang + ')';
            select.appendChild(opt);
        }
        applySavedVoice();
    };
    try { fill(); } catch (e) {}
    window.speechSynthesis.onvoiceschanged = fill;
}

function getSelectedVoice() {
    const select = document.getElementById('voiceSelect');
    if (!select) return null;
    const name = select.value;
    const voices = window.speechSynthesis.getVoices();
    for (let i = 0; i < voices.length; i++) {
        if (voices[i].name === name) return voices[i];
    }
    return null;
}

function selectBestVoiceForLang(lang) {
    const select = document.getElementById('voiceSelect');
    const voices = window.speechSynthesis.getVoices();
    const prefix = lang.toLowerCase().slice(0, 2);
    const candidates = voices.filter(function(v) {
        return (v.lang || '').toLowerCase().indexOf(prefix) === 0;
    });
    let preferred = null;
    for (let i = 0; i < candidates.length; i++) {
        if (/Microsoft|Google|Neural/i.test(candidates[i].name)) {
            preferred = candidates[i];
            break;
        }
    }
    if (!preferred && candidates.length > 0) preferred = candidates[0];
    if (preferred && select) {
        select.value = preferred.name;
    }
}

function getTonePreset() {
    const presetEl = document.getElementById('tonePreset');
    const id = presetEl ? presetEl.value : 'narrator';
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
    let rate = preset.rate;
    let pitch = preset.pitch;
    let volume = preset.volume;
    let pauseMs = preset.pauseMs;
    const exMatch = text.match(/!+/g);
    const ex = exMatch ? exMatch.length : 0;
    const qMatch = text.match(/\?+/g);
    const q = qMatch ? qMatch.length : 0;
    rate = rate + Math.min(0.05 * ex, 0.15);
    pitch = pitch + Math.min(0.03 * q, 0.12);
    const slowWords = ['dark', 'noir', 'silence', 'quiet', 'creak', 'blood', 'sang', 'tombe', 'midnight'];
    for (let i = 0; i < slowWords.length; i++) {
        if (t.indexOf(slowWords[i]) !== -1) {
            rate = rate - 0.05;
            pauseMs = pauseMs + 100;
            break;
        }
    }
    const whisperWords = ['whisper', 'chuchot', 'softly'];
    for (let i = 0; i < whisperWords.length; i++) {
        if (t.indexOf(whisperWords[i]) !== -1) {
            volume = volume - 0.1;
            pitch = pitch + 0.05;
            break;
        }
    }
    return { rate: rate, pitch: pitch, volume: volume, pauseMs: pauseMs };
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
            persistEnabled = s.persistEnabled !== false;
            autoLangEnabled = s.autoLangEnabled !== false;
            const persistEl = document.getElementById('persistSettings');
            if (persistEl) persistEl.checked = persistEnabled;
            const autoLangEl = document.getElementById('autoMatchLang');
            if (autoLangEl) autoLangEl.checked = autoLangEnabled;
            const toneEl = document.getElementById('tonePreset');
            if (toneEl && s.tonePreset) toneEl.value = s.tonePreset;
            const rateEl = document.getElementById('voiceRate');
            if (rateEl && s.voiceRate) rateEl.value = s.voiceRate;
            const pitchEl = document.getElementById('voicePitch');
            if (pitchEl && s.voicePitch) pitchEl.value = s.voicePitch;
            const volEl = document.getElementById('voiceVolume');
            if (volEl && s.voiceVolume) volEl.value = s.voiceVolume;
            window.__savedVoiceName = s.voiceName || null;
        }
    } catch (e) {}
}

function applySavedVoice() {
    const select = document.getElementById('voiceSelect');
    if (!select || !window.__savedVoiceName) return;
    const voices = window.speechSynthesis.getVoices();
    for (let i = 0; i < voices.length; i++) {
        if (voices[i].name === window.__savedVoiceName) {
            select.value = window.__savedVoiceName;
            return;
        }
    }
}

function saveSettings() {
    if (!persistEnabled) return;
    try {
        const voiceEl = document.getElementById('voiceSelect');
        const toneEl = document.getElementById('tonePreset');
        const data = {
            persistEnabled: persistEnabled,
            autoLangEnabled: autoLangEnabled,
            voiceName: voiceEl ? voiceEl.value : null,
            tonePreset: toneEl ? toneEl.value : 'narrator',
            voiceRate: getRange('voiceRate', 0.95),
            voicePitch: getRange('voicePitch', 0.90),
            voiceVolume: getRange('voiceVolume', 1.0)
        };
        localStorage.setItem('ttsSettings', JSON.stringify(data));
    } catch (e) {}
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
    const timer = setInterval(function() {
        idx = (idx + 1) % scenes.length;
        drawScene(scenes[idx]);
        log('info', 'Scene: ' + (idx + 1) + '/' + scenes.length);
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
            y = y + lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}

async function recordWebM() {
    if (recording) return;
    if (!('MediaRecorder' in window)) {
        log('warn', 'MediaRecorder non supporte');
        return;
    }
    recording = true;
    recordedChunks = [];
    log('info', 'Enregistrement WebM demarre');
    const fps = 30;
    const canvasStream = sceneCanvas.captureStream(fps);
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
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
    const videoTracks = canvasStream.getVideoTracks();
    const audioTracks = dest ? dest.stream.getAudioTracks() : [];
    const allTracks = videoTracks.concat(audioTracks);
    const mixedStream = new MediaStream(allTracks);
    mediaRecorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm;codecs=vp9,opus' });
    mediaRecorder.ondataavailable = function(e) {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = function() {
        if (osc) osc.stop();
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'horror-story-' + Date.now() + '.webm';
        a.click();
        URL.revokeObjectURL(url);
        recording = false;
        log('info', 'Enregistrement WebM termine');
    };
    mediaRecorder.start();
    const totalMs = (currentScenes.length || 5) * 5000;
    setTimeout(function() {
        mediaRecorder.stop();
    }, totalMs);
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
    const step = document.querySelector('[data-step="' + stepName + '"]');
    if (step) {
        step.classList.remove('active', 'completed');
        if (status) step.classList.add(status);
    }
}

function resetLoadingSteps() {
    const steps = document.querySelectorAll('.step');
    for (let i = 0; i < steps.length; i++) {
        steps[i].classList.remove('active', 'completed');
    }
}

function updateLoadingText(text) {
    loadingText.textContent = text;
}

window.addEventListener('unhandledrejection', function(event) {
    console.error('Erreur non geree:', event.reason);
    showError('Une erreur inattendue. Veuillez reessayer.');
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
    if (terminalClearBtn) terminalClearBtn.addEventListener('click', function() {
        terminalEl.textContent = '';
    });
    if (terminalPauseBtn) terminalPauseBtn.addEventListener('click', function() {
        terminalPaused = !terminalPaused;
        terminalPauseBtn.textContent = terminalPaused ? '▶️' : '⏸️';
    });
    if (terminalAutoscrollBtn) terminalAutoscrollBtn.addEventListener('click', function() {
        autoScroll = !autoScroll;
        terminalAutoscrollBtn.textContent = autoScroll ? '🔁' : '⏹️';
    });
    if (filterInfoEl) filterInfoEl.addEventListener('change', function() {
        filters.info = filterInfoEl.checked;
        applyFilters();
    });
    if (filterWarnEl) filterWarnEl.addEventListener('change', function() {
        filters.warn = filterWarnEl.checked;
        applyFilters();
    });
    if (filterErrorEl) filterErrorEl.addEventListener('change', function() {
        filters.error = filterErrorEl.checked;
        applyFilters();
    });
    if (terminalSearchEl) terminalSearchEl.addEventListener('input', function() {
        searchText = terminalSearchEl.value.toLowerCase();
        applyFilters();
    });
    if (terminalCopyBtn) terminalCopyBtn.addEventListener('click', function() {
        const lines = [];
        for (let i = 0; i < logStore.length; i++) {
            const e = logStore[i];
            const time = new Date(e.ts).toLocaleTimeString();
            lines.push('[' + time + '] ' + e.level.toUpperCase() + ': ' + e.msg);
        }
        const text = lines.join('\n');
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function() {
                log('info', 'Logs copies');
            });
        }
    });
    if (terminalExportBtn) terminalExportBtn.addEventListener('click', function() {
        const blob = new Blob([JSON.stringify(logStore, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'terminal-logs-' + Date.now() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        log('info', 'Export JSON telecharge');
    });
}

function log(level, msg, ctx) {
    if (!ctx) ctx = {};
    const entry = { ts: Date.now(), level: level, msg: msg, ctx: ctx };
    logStore.push(entry);
    counters[level] = (counters[level] || 0) + 1;
    console.log('[' + level.toUpperCase() + ']', msg);
    if (!terminalEl || terminalPaused) return;
    updateCounters();
    const passes = filters[level] && (!searchText || String(msg).toLowerCase().indexOf(searchText) !== -1);
    const time = new Date(entry.ts).toLocaleTimeString();
    const line = document.createElement('div');
    line.className = 'term-line';
    line.dataset.level = level;
    line.dataset.text = String(msg).toLowerCase();
    line.style.display = passes ? '' : 'none';
    const timeSpan = document.createElement('span');
    timeSpan.className = 'term-time';
    timeSpan.textContent = '[' + time + ']';
    const badge = document.createElement('span');
    badge.className = 'term-badge term-badge-' + level;
    badge.textContent = level.toUpperCase();
    const msgSpan = document.createElement('span');
    msgSpan.className = 'term-msg';
    msgSpan.textContent = ' ' + msg;
    line.appendChild(timeSpan);
    line.appendChild(badge);
    line.appendChild(msgSpan);
    terminalEl.appendChild(line);
    if (autoScroll) terminalEl.scrollTop = terminalEl.scrollHeight;
}

function updateCounters() {
    if (!terminalCountersEl) return;
    terminalCountersEl.textContent = 'I:' + counters.info + ' W:' + counters.warn + ' E:' + counters.error;
}

function applyFilters() {
    const lines = terminalEl.children;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const level = line.dataset.level;
        const text = line.dataset.text || '';
        const visibleByLevel = filters[level];
        const visibleBySearch = !searchText || text.indexOf(searchText) !== -1;
        line.style.display = (visibleByLevel && visibleBySearch) ? '' : 'none';
    }
}

async function instrumentedFetch(url, options) {
    if (!options) options = {};
    const start = performance.now();
    log('info', 'HTTP ' + (options.method || 'GET') + ' ' + url);
    try {
        const resp = await fetch(url, options);
        const dur = Math.round(performance.now() - start);
        log(resp.ok ? 'info' : 'warn', 'HTTP ' + resp.status + ' ' + url + ' (' + dur + 'ms)');
        return resp;
    } catch (e) {
        const dur = Math.round(performance.now() - start);
        log('error', 'HTTP error ' + url + ' (' + dur + 'ms): ' + e.message);
        throw e;
    }
}

console.log('APP LOADED');

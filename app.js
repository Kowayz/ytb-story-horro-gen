// Client-only logic at repo root (mirrors docs/app.js)
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
let terminalEl, terminalClearBtn, terminalPauseBtn;

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupTerminal();
  log('info', 'Application prête. Cliquez sur "Lire une histoire".');
});

function setupEventListeners() {
  generateBtn.addEventListener('click', runClientOnlyFlow);
  document.getElementById('newVideoBtn')?.addEventListener('click', resetAndGenerate);
  document.getElementById('retryBtn')?.addEventListener('click', runClientOnlyFlow);
  recordBtn?.addEventListener('click', recordWebM);
}

async function runClientOnlyFlow() {
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
  log('info', 'Appel à l’API publique Reddit…');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch('https://www.reddit.com/r/scarystories/hot.json?limit=100', { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const posts = (json.data.children || [])
      .map(c => c.data)
      .filter(p => p.selftext && p.selftext.length > 500 && p.selftext.length < 5000 && !p.over_18);
    const pick = posts[Math.floor(Math.random() * posts.length)];
    if (!pick) throw new Error('Aucune histoire valide');
    return { id: pick.id, title: pick.title, text: pick.selftext, author: pick.author, url: `https://reddit.com${pick.permalink}` };
  } catch (e) {
    log('warn', `Reddit indisponible (CORS/réseau). Utilisation d'une histoire de démo. Détail: ${e.message}`);
    return { id: 'demo', title: 'The Midnight Visitor', text: `I always thought the scratching sounds in my walls were just mice. I set traps, called an exterminator, even tried to seal up any holes I could find. But the scratching continued, night after night, always at exactly 3:13 AM.\n\nLast night, I decided to stay awake and investigate. Armed with a flashlight and a baseball bat, I waited in the darkness of my bedroom. At 3:13 AM, the scratching began. But this time, it wasn't coming from the walls.\n\nIt was coming from under my bed.`, author: 'DemoAuthor', url: 'https://reddit.com/r/scarystories' };
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
  if (!('speechSynthesis' in window)) { log('warn', 'Web Speech non supporté'); return; }
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = detectLanguage(text);
  utter.rate = 0.95;
  utter.pitch = 0.9;
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch (e) {
    log('error', `Échec de la narration: ${e.message}`);
  }
  utter.onend = () => log('info', 'Narration terminée');
}

function detectLanguage(text) {
  const englishHints = ['the', 'and', 'was', 'night', 'door', 'dark', 'I'];
  const count = englishHints.reduce((acc, w) => acc + (text.toLowerCase().includes(w) ? 1 : 0), 0);
  return count >= 3 ? 'en-US' : 'fr-FR';
}

function renderSlideshow(scenes) {
  if (!sceneCanvas) { log('error', 'Canvas introuvable'); return; }
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

  renderSlideshow._timer && clearInterval(renderSlideshow._timer);
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
  if (!('MediaRecorder' in window)) { log('warn', 'MediaRecorder non supporté'); return; }
  recording = true;
  recordedChunks = [];
  log('info', 'Enregistrement WebM démarré');

  const fps = 30;
  const canvasStream = sceneCanvas.captureStream(fps);

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) { log('warn', 'AudioContext non supporté — piste audio désactivée'); }
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
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
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

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

window.addEventListener('unhandledrejection', (event) => {
  console.error('Erreur non gérée:', event.reason);
  showError('Une erreur inattendue s\'est produite. Veuillez réessayer.');
});

function setupTerminal() {
  terminalEl = document.getElementById('terminalOutput');
  terminalClearBtn = document.getElementById('terminalClear');
  terminalPauseBtn = document.getElementById('terminalPause');
  if (!terminalEl) return;
  terminalClearBtn?.addEventListener('click', () => { terminalEl.textContent = ''; });
  terminalPauseBtn?.addEventListener('click', () => {
    terminalPaused = !terminalPaused;
    terminalPauseBtn.textContent = terminalPaused ? '▶️' : '⏸️';
  });
  const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = (...args) => { log('info', args.join(' ')); orig.log.apply(console, args); };
  console.warn = (...args) => { log('warn', args.join(' ')); orig.warn.apply(console, args); };
  console.error = (...args) => { log('error', args.join(' ')); orig.error.apply(console, args); };
  console.info = (...args) => { log('info', args.join(' ')); orig.info.apply(console, args); };
}

function log(level, msg) {
  if (!terminalEl || terminalPaused) return;
  const time = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = 'term-line';
  const timeSpan = document.createElement('span');
  timeSpan.className = 'term-time';
  timeSpan.textContent = `[${time}] `;
  const levelSpan = document.createElement('span');
  levelSpan.className = `term-level-${level}`;
  levelSpan.textContent = level.toUpperCase();
  const msgSpan = document.createElement('span');
  msgSpan.textContent = `: ${msg}`;
  line.appendChild(timeSpan);
  line.appendChild(levelSpan);
  line.appendChild(msgSpan);
  terminalEl.appendChild(line);
  terminalEl.scrollTop = terminalEl.scrollHeight;
}

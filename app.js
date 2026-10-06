// --- Circolo delle Quinte (Inizio da C / Do) ---
const CIRCLE_OF_FIFTHS = [
  { name: 'C',  midi: 60 },
  { name: 'G',  midi: 67 },
  { name: 'D',  midi: 62 },
  { name: 'A',  midi: 69 },
  { name: 'E',  midi: 64 },
  { name: 'B',  midi: 71 },
  { name: 'F#', midi: 66 },
  { name: 'Db', midi: 61 },
  { name: 'Ab', midi: 68 },
  { name: 'Eb', midi: 63 },
  { name: 'Bb', midi: 70 },
  { name: 'F',  midi: 65 }
];

const CHORD_TYPES = [
  { label: 'Maggiore',          quality: 'maj',  intervals: [0, 4, 7] },
  { label: 'Minore',            quality: 'min',  intervals: [0, 3, 7] },
  { label: 'Settima Dominante', quality: '7',    intervals: [0, 4, 7, 10] },
  { label: 'Settima Maggiore',  quality: 'maj7', intervals: [0, 4, 7, 11] },
  { label: 'Settima Minore',    quality: 'm7',   intervals: [0, 3, 7, 10] }
];

// --- Motore Audio (Web Audio API) ---
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = 0.7;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMasterVolume(val) {
    this.volume = val;
    if (this.masterGain) {
      this.masterGain.gain.value = val;
    }
  }

  playVoice(midiNote) {
    this.init();
    const now = this.ctx.currentTime;
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Oscillatore principale (sawtooth) + sub (triangle)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 1.002;

    // Filtro Passa-Basso Dinamico con Pluck
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.8);

    // Inviluppo Gain
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.9);
    osc2.stop(now + 0.9);
  }
}

// --- Inizializzazione Interfaccia ---
document.addEventListener('DOMContentLoaded', () => {
  const audioEngine = new AudioEngine();
  const matrixContainer = document.getElementById('chord-matrix');
  const currentChordDisplay = document.getElementById('current-chord');
  const masterVolInput = document.getElementById('master-vol');
  const canvas = document.getElementById('strum-canvas');
  const ctx = canvas.getContext('2d');

  let activeChord = null;
  let activeNotes = [];
  let lastStrumIndex = -1;
  let isStrumming = false;
  const ripples = [];

  // Cambio Accordo Attivo
  function setChord(rootName, rootMidi, quality, labelQuality, btnElement) {
    document.querySelectorAll('.chord-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');

    const chordDef = CHORD_TYPES.find(t => t.quality === quality);
    activeChord = { rootName, rootMidi, quality, labelQuality };
    currentChordDisplay.textContent = `${rootName} ${labelQuality}`;

    // Estensione note per lo Strumplate su 3 ottave
    activeNotes = [];
    for (let octave = -1; octave <= 1; octave++) {
      chordDef.intervals.forEach(interval => {
        activeNotes.push(rootMidi + interval + (octave * 12));
      });
    }
  }

  // Costruzione della Matrice di Pulsanti
  CHORD_TYPES.forEach(type => {
    const row = document.createElement('div');
    row.className = 'chord-row';
    row.dataset.quality = type.quality;

    const label = document.createElement('div');
    label.className = 'row-label';
    label.textContent = type.label;
    row.appendChild(label);

    const btnContainer = document.createElement('div');
    btnContainer.className = 'row-buttons';

    CIRCLE_OF_FIFTHS.forEach(root => {
      const btn = document.createElement('button');
      btn.className = 'chord-btn';
      btn.title = `${root.name} ${type.label}`;

      // LED verde integrato
      const led = document.createElement('span');
      led.className = 'btn-led';
      btn.appendChild(led);

      // Suona subito al mousedown/pointerdown
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        setChord(root.name, root.midi, type.quality, type.label, btn);
        audioEngine.playVoice(root.midi);
      });

      btnContainer.appendChild(btn);
    });

    row.appendChild(btnContainer);
    matrixContainer.appendChild(row);
  });

  // Master Volume
  masterVolInput.addEventListener('input', (e) => {
    audioEngine.setMasterVolume(parseFloat(e.target.value));
  });

  // Canvas Strumplate Dorato e Riflessi Metallici
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function drawStrumplate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Gradiente Metallico Dorato Vintage
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#d4af37');
    grad.addColorStop(0.25, '#fff0a6');
    grad.addColorStop(0.5, '#aa7c11');
    grad.addColorStop(0.75, '#f3e5ab');
    grad.addColorStop(1, '#8b6508');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Trama spazzolata orizzontale
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    for (let y = 0; y < canvas.height; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Effetti visivi ad onda (ripples)
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      r.radius += 2.5;
      r.alpha -= 0.035;
      if (r.alpha <= 0) ripples.splice(i, 1);
    }

    requestAnimationFrame(drawStrumplate);
  }
  drawStrumplate();

  // Gestione Pressione e Trascinamento Strumplate
  function handleStrum(e) {
    if (!isStrumming) return;
    const rect = canvas.getBoundingClientRect();
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;

    // Se non è stato premuto ancora alcun pulsante, imposta Do Maggiore come fallback
    if (!activeChord) {
      const defaultBtn = document.querySelector('.chord-row[data-quality="maj"] .chord-btn');
      const defaultRoot = CIRCLE_OF_FIFTHS[0];
      setChord(defaultRoot.name, defaultRoot.midi, 'maj', 'Maggiore', defaultBtn);
    }

    const noteCount = activeNotes.length;
    const index = Math.floor((y / canvas.height) * noteCount);
    const clampedIndex = Math.max(0, Math.min(noteCount - 1, index));

    if (clampedIndex !== lastStrumIndex) {
      audioEngine.playVoice(activeNotes[clampedIndex]);
      lastStrumIndex = clampedIndex;
      ripples.push({ x, y, radius: 4, alpha: 0.95 });
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    isStrumming = true;
    canvas.setPointerCapture(e.pointerId);
    handleStrum(e);
  });

  canvas.addEventListener('pointermove', handleStrum);

  const stopStrumming = () => {
    isStrumming = false;
    lastStrumIndex = -1;
  };

  canvas.addEventListener('pointerup', stopStrumming);
  canvas.addEventListener('pointercancel', stopStrumming);
});

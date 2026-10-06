/**
 * Omnichord Web Audio Engine Class
 * Handles sound synthesis using pure Web Audio API oscillators, filters and dynamic envelopes.
 */
class OmnichordAudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.volume = 0.8;
        this.sustainTime = 1.2;
        this.cutoffFreq = 2200;
        this.isInitialized = false;
    }

    // Initialize Web Audio Context on first user interaction
    init() {
        if (this.isInitialized) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        // Setup master gain node
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.isInitialized = true;
    }

    setVolume(val) {
        this.volume = val;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.05);
        }
    }

    setSustain(val) {
        this.sustainTime = val;
    }

    setCutoff(val) {
        this.cutoffFreq = val;
    }

    // Play a single synthesized retro pluck voice
    playNote(midiNote) {
        if (!this.isInitialized || !this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;
        const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

        // Twin oscillators for rich warm retro timbre
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        
        osc1.type = 'sawtooth';
        osc2.type = 'triangle';

        osc1.frequency.setValueAtTime(freq, now);
        osc2.frequency.setValueAtTime(freq * 1.002, now); // Slight detune for warmth

        // Lowpass filter envelope
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(this.cutoffFreq, now);
        filter.frequency.exponentialRampToValueAtTime(120, now + this.sustainTime);

        // Gain envelope (Pluck decay)
        const noteGain = this.ctx.createGain();
        noteGain.gain.setValueAtTime(0.3, now);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + this.sustainTime);

        // Connections
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(this.masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + this.sustainTime);
        osc2.stop(now + this.sustainTime);
    }

    // Arpeggiate chord notes in rapid succession (strum effect on button press)
    playChordStrum(midiNotes) {
        if (!this.isInitialized || !this.ctx) return;
        
        const notesToPlay = midiNotes.slice(0, 5);
        notesToPlay.forEach((note, index) => {
            setTimeout(() => {
                this.playNote(note);
            }, index * 40); // 40ms strum interval
        });
    }
}


// Circle of Fifths order starting from C
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

// 5 Matrix Rows Configurations
const MATRIX_ROWS = [
    { 
        id: 'maj', 
        label: '1ª Fila: Maggiori (Major)', 
        quality: 'maj',
        intervals: [0, 4, 7],
        suffix: '',
        badgeColor: 'bg-amber-600 text-white'
    },
    { 
        id: 'min', 
        label: '2ª Fila: Minori (Minor)', 
        quality: 'min',
        intervals: [0, 3, 7],
        suffix: 'm',
        badgeColor: 'bg-slate-700 text-white'
    },
    { 
        id: '7', 
        label: '3ª Fila: Settima Dominante (7th)', 
        quality: '7',
        intervals: [0, 4, 7, 10],
        suffix: '7',
        badgeColor: 'bg-red-700 text-white'
    },
    { 
        id: 'maj7', 
        label: '4ª Fila: Settima Maggiore (Maj7)', 
        quality: 'maj7',
        intervals: [0, 4, 7, 11],
        suffix: 'maj7',
        badgeColor: 'bg-emerald-700 text-white'
    },
    { 
        id: 'm7', 
        label: '5ª Fila: Settima Minore (m7)', 
        quality: 'm7',
        intervals: [0, 3, 7, 10],
        suffix: 'm7',
        badgeColor: 'bg-indigo-700 text-white'
    }
];

// Global State
const audioEngine = new OmnichordAudioEngine();
let currentChordObj = {
    rootName: 'C',
    rootMidi: 60,
    quality: 'maj',
    fullName: 'C'
};
let currentStrumNotes = [];

/**
 * Calculates strumplate octave note ranges for the current chord
 */
function calculateStrumNotes(rootMidi, intervals) {
    const notes = [];
    for (let octave = -1; octave <= 2; octave++) {
        for (let interval of intervals) {
            notes.push(rootMidi + interval + (octave * 12));
        }
    }
    return notes.sort((a, b) => a - b);
}

/**
 * Updates selected chord state and highlights matrix UI
 */
function setSelection(rootObj, rowObj) {
    currentChordObj = {
        rootName: rootObj.name,
        rootMidi: rootObj.midi,
        quality: rowObj.quality,
        fullName: `${rootObj.name}${rowObj.suffix}`
    };

    currentStrumNotes = calculateStrumNotes(rootObj.midi, rowObj.intervals);
    
    // Update display
    const displayEl = document.getElementById('current-chord-display');
    if (displayEl) {
        displayEl.textContent = currentChordObj.fullName;
    }

    // Highlight active button in matrix
    const allBtns = document.querySelectorAll('.matrix-chord-btn');
    allBtns.forEach(btn => {
        if (btn.dataset.chord === currentChordObj.fullName) {
            btn.classList.add('active', 'ring-2', 'ring-amber-500', 'bg-amber-200', 'text-amber-950');
        } else {
            btn.classList.remove('active', 'ring-2', 'ring-amber-500', 'bg-amber-200', 'text-amber-950');
        }
    });
}

/**
 * Builds the 5-row Accordion Buttons UI Matrix dynamically
 */
function buildMatrixUI() {
    const container = document.getElementById('matrix-container');
    if (!container) return;
    container.innerHTML = '';

    MATRIX_ROWS.forEach(row => {
        const rowWrapper = document.createElement('div');
        rowWrapper.className = 'flex flex-col gap-1';

        const rowHeader = document.createElement('div');
        rowHeader.className = 'text-[11px] font-bold text-slate-600 flex items-center gap-2';
        rowHeader.innerHTML = `<span class="px-2 py-0.5 rounded text-[10px] ${row.badgeColor}">${row.label}</span>`;
        rowWrapper.appendChild(rowHeader);

        const btnRow = document.createElement('div');
        btnRow.className = 'grid grid-cols-12 gap-1.5 sm:gap-2';

        CIRCLE_OF_FIFTHS.forEach(root => {
            const chordName = `${root.name}${row.suffix}`;
            const btn = document.createElement('button');
            btn.className = `matrix-chord-btn chord-btn bg-panelBeige hover:bg-amber-100 text-slate-800 font-bold py-2 sm:py-2.5 px-1 rounded-lg border-2 border-chassisDark text-xs sm:text-sm flex flex-col items-center justify-center font-mono`;
            btn.dataset.chord = chordName;
            btn.innerHTML = `<span>${chordName}</span>`;

            btn.addEventListener('click', () => {
                audioEngine.init();
                setSelection(root, row);
                audioEngine.playChordStrum(currentStrumNotes);
            });

            btnRow.appendChild(btn);
        });

        rowWrapper.appendChild(btnRow);
        container.appendChild(rowWrapper);
    });

    // Default selection: C Major
    setSelection(CIRCLE_OF_FIFTHS[0], MATRIX_ROWS[0]);
}


/**
 * Strumplate Canvas Interactivity Controller Class
 */
class StrumplateController {
    constructor(canvas, audioEngine) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioEngine = audioEngine;
        this.lastNoteIndex = -1;
        this.isInteracting = false;
        this.ripples = [];

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.setupEvents();
        this.animate();
    }

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    setupEvents() {
        const getCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const startInteract = (e) => {
            e.preventDefault();
            this.audioEngine.init();
            this.isInteracting = true;
            this.processInteraction(getCoords(e));
        };

        const moveInteract = (e) => {
            if (!this.isInteracting) return;
            e.preventDefault();
            this.processInteraction(getCoords(e));
        };

        const stopInteract = () => {
            this.isInteracting = false;
            this.lastNoteIndex = -1;
        };

        this.canvas.addEventListener('mousedown', startInteract);
        this.canvas.addEventListener('mousemove', moveInteract);
        window.addEventListener('mouseup', stopInteract);

        this.canvas.addEventListener('touchstart', startInteract, { passive: false });
        this.canvas.addEventListener('touchmove', moveInteract, { passive: false });
        window.addEventListener('touchend', stopInteract);
    }

    processInteraction(coords) {
        if (!currentStrumNotes.length) return;

        const width = this.canvas.width;
        const normalizedX = Math.max(0, Math.min(1, coords.x / width));
        const noteIndex = Math.floor(normalizedX * currentStrumNotes.length);

        if (noteIndex !== this.lastNoteIndex && noteIndex < currentStrumNotes.length) {
            this.lastNoteIndex = noteIndex;
            const noteToPlay = currentStrumNotes[noteIndex];
            this.audioEngine.playNote(noteToPlay);
            this.addRipple(coords.x, coords.y);
        }
    }

    addRipple(x, y) {
        this.ripples.push({
            x: x,
            y: y,
            radius: 5,
            alpha: 1.0
        });
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            this.ctx.beginPath();
            this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${r.alpha})`;
            this.ctx.fill();

            r.radius += 2.5;
            r.alpha -= 0.04;

            if (r.alpha <= 0) {
                this.ripples.splice(i, 1);
            }
        }

        requestAnimationFrame(() => this.animate());
    }
}


window.addEventListener('DOMContentLoaded', () => {
    // Build Accordion Matrix UI
    buildMatrixUI();

    // Initialize Canvas Strumplate
    const strumplate = new StrumplateController(
        document.getElementById('strumplate-canvas'), 
        audioEngine
    );

    // Audio Start Toggle Button Listener
    const btnAudio = document.getElementById('btn-start-audio');
    const powerLed = document.getElementById('power-led');
    
    if (btnAudio && powerLed) {
        btnAudio.addEventListener('click', () => {
            audioEngine.init();
            btnAudio.classList.add('hidden');
            powerLed.classList.remove('bg-red-600', 'text-red-500');
            powerLed.classList.add('bg-green-500', 'text-green-400');
        });
    }

    // Sliders Event Handlers
    const volumeSlider = document.getElementById('knob-volume');
    const sustainSlider = document.getElementById('knob-sustain');
    const cutoffSlider = document.getElementById('knob-cutoff');

    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) / 100;
            audioEngine.setVolume(val);
            document.getElementById('val-volume').textContent = `${e.target.value}%`;
        });
    }

    if (sustainSlider) {
        sustainSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) / 10;
            audioEngine.setSustain(val);
            document.getElementById('val-sustain').textContent = `${val.toFixed(1)}s`;
        });
    }

    if (cutoffSlider) {
        cutoffSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            audioEngine.setCutoff(val);
            document.getElementById('val-cutoff').textContent = `${val} Hz`;
        });
    }
});

/**
 * Web Audio API Engine Class for Synth Pluck Voices
 */
class WebAudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.volume = 0.8;
        this.sustainTime = 1.2;
        this.cutoffFreq = 2200;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.initialized = true;
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

    // Synthesize single pluck voice
    playNote(midiNote) {
        if (!this.initialized || !this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;
        const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

        // Twin oscillators (sawtooth + triangle) for rich retro timbre
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();

        osc1.type = 'sawtooth';
        osc2.type = 'triangle';

        osc1.frequency.setValueAtTime(freq, now);
        osc2.frequency.setValueAtTime(freq * 1.002, now); // Warm detune

        // Lowpass filter envelope
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(this.cutoffFreq, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + this.sustainTime);

        // Gain envelope (Pluck decay)
        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(0.35, now);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + this.sustainTime);

        // Connections
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(voiceGain);
        voiceGain.connect(this.masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + this.sustainTime);
        osc2.stop(now + this.sustainTime);
    }

    // Arpeggiate chord instantly on button press
    strumChord(midiNotes) {
        if (!this.initialized || !this.ctx) return;
        const notes = midiNotes.slice(0, 5);
        notes.forEach((note, idx) => {
            setTimeout(() => {
                this.playNote(note);
            }, idx * 35);
        });
    }
}

// Circle of Fifths order starting strictly from C (Do)
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

// 5 Matrix Row Configurations
const MATRIX_ROWS = [
    { 
        id: 'maj', 
        label: 'Maggiore', 
        intervals: [0, 4, 7], 
        suffix: '', 
        btnClass: 'row-maj',
        badgeStyle: 'bg-amber-200 text-amber-950 border-amber-300' 
    },
    { 
        id: 'min', 
        label: 'Minore', 
        intervals: [0, 3, 7], 
        suffix: 'm', 
        btnClass: 'row-min',
        badgeStyle: 'bg-sky-200 text-sky-950 border-sky-300' 
    },
    { 
        id: '7', 
        label: 'Settima Dominante', 
        intervals: [0, 4, 7, 10], 
        suffix: '7', 
        btnClass: 'row-7',
        badgeStyle: 'bg-rose-200 text-rose-950 border-rose-300' 
    },
    { 
        id: 'maj7', 
        label: 'Settima Maggiore', 
        intervals: [0, 4, 7, 11], 
        suffix: 'maj7', 
        btnClass: 'row-maj7',
        badgeStyle: 'bg-emerald-200 text-emerald-950 border-emerald-300' 
    },
    { 
        id: 'm7', 
        label: 'Settima Minore', 
        intervals: [0, 3, 7, 10], 
        suffix: 'm7', 
        btnClass: 'row-m7',
        badgeStyle: 'bg-purple-200 text-purple-950 border-purple-300' 
    }
];

// Global State Variables
const audio = new WebAudioEngine();
let selectedChordName = null;
let currentStrumNotes = calculateNotes(CIRCLE_OF_FIFTHS[0].midi, MATRIX_ROWS[0].intervals);

function calculateNotes(rootMidi, intervals) {
    const notes = [];
    for (let octave = -1; octave <= 2; octave++) {
        for (let interval of intervals) {
            notes.push(rootMidi + interval + (octave * 12));
        }
    }
    return notes.sort((a, b) => a - b);
}

function selectChord(rootObj, rowObj) {
    selectedChordName = `${rootObj.name}${rowObj.suffix}`;
    currentStrumNotes = calculateNotes(rootObj.midi, rowObj.intervals);

    document.getElementById('lbl-active-chord').textContent = selectedChordName;

    const allBtns = document.querySelectorAll('.matrix-btn');
    allBtns.forEach(btn => {
        if (btn.dataset.chord === selectedChordName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function createMatrixUI() {
    const container = document.getElementById('matrix-grid');
    if (!container) return;
    container.innerHTML = '';

    MATRIX_ROWS.forEach(row => {
        const rowWrapper = document.createElement('div');
        rowWrapper.className = 'flex items-center gap-3';

        const labelBox = document.createElement('div');
        labelBox.className = 'w-36 text-right shrink-0 pr-2';
        labelBox.innerHTML = `<span class="px-2.5 py-1 rounded-md text-xs font-bold border shadow-sm inline-block w-full ${row.badgeStyle}">${row.label}</span>`;
        rowWrapper.appendChild(labelBox);

        const btnGrid = document.createElement('div');
        btnGrid.className = 'flex items-center gap-2';

        CIRCLE_OF_FIFTHS.forEach(root => {
            const chordFullName = `${root.name}${row.suffix}`;
            const btn = document.createElement('button');
            
            btn.className = `matrix-btn ${row.btnClass}`;
            btn.dataset.chord = chordFullName;

            const led = document.createElement('span');
            led.className = 'btn-led';
            btn.appendChild(led);

            const handlePress = (e) => {
                e.preventDefault();
                audio.init();
                selectChord(root, row);
                audio.strumChord(currentStrumNotes);
            };

            btn.addEventListener('pointerdown', handlePress);
            btnGrid.appendChild(btn);
        });

        rowWrapper.appendChild(btnGrid);
        container.appendChild(rowWrapper);
    });

    document.getElementById('lbl-active-chord').textContent = 'Nessuno';
}

/**
 * Interactive Canvas Strumplate Controller
 */
class StrumplateController {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.lastIndex = -1;
        this.isInteracting = false;
        this.ripples = [];

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.bindEvents();
        this.animate();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    bindEvents() {
        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const start = (e) => {
            e.preventDefault();
            audio.init();
            this.isInteracting = true;
            this.triggerAt(getPos(e));
        };

        const move = (e) => {
            if (!this.isInteracting) return;
            e.preventDefault();
            this.triggerAt(getPos(e));
        };

        const stop = () => {
            this.isInteracting = false;
            this.lastIndex = -1;
        };

        this.canvas.addEventListener('mousedown', start);
        this.canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', stop);

        this.canvas.addEventListener('touchstart', start, { passive: false });
        this.canvas.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('touchend', stop);
    }

    triggerAt(pos) {
        if (!currentStrumNotes.length) return;

        const width = this.canvas.width;
        const normalizedX = Math.max(0, Math.min(1, pos.x / width));
        const index = Math.floor(normalizedX * currentStrumNotes.length);

        if (index !== this.lastIndex && index < currentStrumNotes.length) {
            this.lastIndex = index;
            const note = currentStrumNotes[index];
            audio.playNote(note);
            this.addLightEffect(pos.x, pos.y);
        }
    }

    addLightEffect(x, y) {
        this.ripples.push({
            x: x,
            y: y,
            radius: 4,
            alpha: 1.0
        });
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            
            const grad = this.ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.radius);
            grad.addColorStop(0, `rgba(255, 255, 255, ${r.alpha})`);
            grad.addColorStop(0.5, `rgba(255, 215, 0, ${r.alpha * 0.7})`);
            grad.addColorStop(1, `rgba(255, 215, 0, 0)`);

            this.ctx.beginPath();
            this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = grad;
            this.ctx.fill();

            r.radius += 3;
            r.alpha -= 0.035;

            if (r.alpha <= 0) {
                this.ripples.splice(i, 1);
            }
        }

        requestAnimationFrame(() => this.animate());
    }
}

// Initialization on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
    createMatrixUI();
    const strumplate = new StrumplateController(document.getElementById('strum-canvas'));

    const btnPower = document.getElementById('btn-power');
    const powerLed = document.getElementById('power-led');
    
    btnPower.addEventListener('click', () => {
        audio.init();
        btnPower.textContent = "🔊 Audio Attivo";
        btnPower.classList.replace('bg-amber-600', 'bg-emerald-600');
        powerLed.classList.replace('bg-red-600', 'bg-emerald-500');
        powerLed.classList.replace('shadow-[0_0_8px_#dc2626]', 'shadow-[0_0_10px_#10b981]');
    });

    document.getElementById('slider-volume').addEventListener('input', (e) => {
        audio.setVolume(parseFloat(e.target.value) / 100);
        document.getElementById('lbl-volume').textContent = `${e.target.value}%`;
    });

    document.getElementById('slider-sustain').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) / 10;
        audio.setSustain(val);
        document.getElementById('lbl-sustain').textContent = `${val.toFixed(1)}s`;
    });

    document.getElementById('slider-cutoff').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        audio.setCutoff(val);
        document.getElementById('lbl-cutoff').textContent = `${val} Hz`;
    });
});

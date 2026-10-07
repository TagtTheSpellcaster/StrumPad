/**
 * Web Audio API Engine Class for StrumPad Synth
 */
class WebAudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.volume = Math.pow(0.8, 1.5); // Inizializzato al valore percepito di 80% (0.8^1.5)
        this.cutoffFreq = 2200;
        this.resonanceQ = 1.0;
        this.filterType = 'lowpass';
        this.initialized = false;
        this.audioActive = false;
        
        // Performance modes
        this.droneMode = false;
        this.strumMode = false;
        this.arpMode = false;
        this.speedDelayMs = 35;

        this.waveform = 'sawtooth';
        this.activeDroneNodes = [];
        this.scheduledTimeouts = [];

        // ADSR Envelope Parameters
        this.attackTime = 0.10;
        this.decayTime = 0.50;
        this.sustainLevel = 0.60;
        this.releaseTime = 1.20;

        // LFO Parameters
        this.lfoRate = 5.0;
        this.lfoDepth = 0.0;
        this.vibratoEnabled = false;
        this.tremoloEnabled = false;

        // Preset Octave Offset
        this.octaveOffset = 0;
    }

    init() {
        if (!this.initialized) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            this.initialized = true;
        }

        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.audioActive = true;
    }

    setAudioState(active) {
        this.audioActive = active;
        if (!active) {
            this.stopAll();
            if (this.ctx) {
                try {
                    this.ctx.suspend();
                } catch (e) {}
            }
        } else {
            this.init();
        }
    }

    stopAll() {
        this.scheduledTimeouts.forEach(t => clearTimeout(t));
        this.scheduledTimeouts = [];

        this.activeDroneNodes.forEach(item => {
            try {
                if (item.gain) {
                    item.gain.gain.setValueAtTime(0.0001, this.ctx ? this.ctx.currentTime : 0);
                }
                item.oscillators.forEach(osc => {
                    try { osc.stop(); osc.disconnect(); } catch (e) {}
                });
            } catch (e) {}
        });
        this.activeDroneNodes = [];
    }

    setVolume(val) {
        // Conversione non lineare percettiva: 0 -> 0, 100 -> 1.0, curva esponenziale x^1.5
        const normalized = Math.max(0, Math.min(100, val)) / 100;
        this.volume = normalized === 0 ? 0 : Math.pow(normalized, 1.5);

        if (this.masterGain && this.ctx && this.audioActive) {
            this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.05);
        }
    }

    setFilter(type, cutoff, resonance) {
        this.filterType = type;
        this.cutoffFreq = cutoff;
        this.resonanceQ = resonance;
    }

    setLfo(rate, depth, vibrato, tremolo) {
        this.lfoRate = rate;
        this.lfoDepth = depth;
        this.vibratoEnabled = vibrato;
        this.tremoloEnabled = tremolo;
    }

    setDroneMode(enabled) {
        this.droneMode = enabled;
        if (enabled) {
            this.strumMode = false;
            this.arpMode = false;
            this.stopAll();
        }
    }

    setStrumMode(enabled) {
        if (this.droneMode) return;
        this.strumMode = enabled;
        if (enabled) {
            this.arpMode = false;
        }
    }

    setArpMode(enabled) {
        if (this.droneMode) return;
        this.arpMode = enabled;
        if (enabled) {
            this.strumMode = false;
        }
    }

    setSpeedDelay(ms) {
        this.speedDelayMs = ms;
    }

    setWaveform(type) {
        this.waveform = type;
    }

    setOctaveOffset(offset) {
        this.octaveOffset = offset || 0;
    }

    setAdsr(attack, decay, sustain, release) {
        this.attackTime = attack;
        this.decayTime = decay;
        this.sustainLevel = sustain;
        this.releaseTime = release;
    }

    playNote(midiNote) {
        if (!this.audioActive || !this.ctx) return;

        const now = this.ctx.currentTime;
        const actualMidiNote = midiNote + this.octaveOffset;
        const freq = 440 * Math.pow(2, (actualMidiNote - 69) / 12);

        if (this.droneMode) {
            const pipeHarmonics = [
                { mult: 0.5, vol: 0.25 },
                { mult: 1.0, vol: 0.35 },
                { mult: 2.0, vol: 0.18 },
                { mult: 3.0, vol: 0.08 },
                { mult: 4.0, vol: 0.04 }
            ];

            const voiceGain = this.ctx.createGain();
            voiceGain.gain.setValueAtTime(0.0001, now);
            voiceGain.gain.linearRampToValueAtTime(0.3, now + Math.max(0.05, this.attackTime));

            const filter = this.ctx.createBiquadFilter();
            filter.type = this.filterType;
            filter.frequency.setValueAtTime(this.cutoffFreq, now);
            filter.Q.setValueAtTime(this.resonanceQ, now);

            const oscList = [];
            pipeHarmonics.forEach(h => {
                const osc = this.ctx.createOscillator();
                osc.type = (h.mult === 1.0 || h.mult === 0.5) ? 'sine' : 'triangle';
                osc.frequency.setValueAtTime(freq * h.mult, now);

                const hGain = this.ctx.createGain();
                hGain.gain.value = h.vol;

                osc.connect(hGain);
                hGain.connect(filter);
                osc.start(now);
                oscList.push(osc);
            });

            filter.connect(voiceGain);
            voiceGain.connect(this.masterGain);

            this.activeDroneNodes.push({
                oscillators: oscList,
                gain: voiceGain
            });
        } else {
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();

            osc1.type = this.waveform;
            osc2.type = (this.waveform === 'sine') ? 'triangle' : this.waveform;

            osc1.frequency.setValueAtTime(freq, now);
            osc2.frequency.setValueAtTime(freq * 1.002, now);

            const filter = this.ctx.createBiquadFilter();
            filter.type = this.filterType;
            filter.Q.setValueAtTime(this.resonanceQ, now);

            if (this.filterType === 'lowpass') {
                filter.frequency.setValueAtTime(200, now);
                filter.frequency.linearRampToValueAtTime(this.cutoffFreq, now + this.attackTime);
                filter.frequency.exponentialRampToValueAtTime(
                    Math.max(50, this.cutoffFreq * this.sustainLevel), 
                    now + this.attackTime + this.decayTime
                );
            } else {
                filter.frequency.setValueAtTime(this.cutoffFreq, now);
            }

            const voiceGain = this.ctx.createGain();
            const peakGain = 0.4;
            const sustainGain = Math.max(0.0001, peakGain * this.sustainLevel);

            voiceGain.gain.setValueAtTime(0.0001, now);
            voiceGain.gain.linearRampToValueAtTime(peakGain, now + this.attackTime);
            voiceGain.gain.exponentialRampToValueAtTime(sustainGain, now + this.attackTime + this.decayTime);

            const noteDuration = this.attackTime + this.decayTime + 0.2;
            voiceGain.gain.setValueAtTime(sustainGain, now + noteDuration);
            voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + noteDuration + this.releaseTime);

            if (this.lfoDepth > 0 && (this.vibratoEnabled || this.tremoloEnabled)) {
                const lfo = this.ctx.createOscillator();
                lfo.frequency.setValueAtTime(this.lfoRate, now);

                if (this.vibratoEnabled) {
                    const vibratoGain = this.ctx.createGain();
                    // Modulazione proporzionale alla frequenza della nota (proporzione relativa in Hz)
                    vibratoGain.gain.setValueAtTime((this.lfoDepth / 100) * 0.03 * freq, now);
                    lfo.connect(vibratoGain);
                    vibratoGain.connect(osc1.frequency);
                    vibratoGain.connect(osc2.frequency);
                }

                if (this.tremoloEnabled) {
                    const tremoloGain = this.ctx.createGain();
                    tremoloGain.gain.setValueAtTime((this.lfoDepth / 100) * 0.3, now);
                    lfo.connect(tremoloGain);
                    tremoloGain.connect(voiceGain.gain);
                }

                lfo.start(now);
                lfo.stop(now + noteDuration + this.releaseTime + 0.1);
            }

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(voiceGain);
            voiceGain.connect(this.masterGain);

            osc1.start(now);
            osc2.start(now);
            const totalTime = noteDuration + this.releaseTime + 0.1;
            osc1.stop(now + totalTime);
            osc2.stop(now + totalTime);
        }
    }

    strumChord(midiNotes) {
        if (!this.audioActive || !this.ctx) return;

        if (this.droneMode) {
            this.stopAll();
            const chordNotes = midiNotes.slice(0, 4);
            chordNotes.forEach(note => this.playNote(note));
        } else if (this.strumMode || this.arpMode) {
            const notes = midiNotes.slice(0, this.arpMode ? 6 : 5);
            notes.forEach((note, idx) => {
                const t = setTimeout(() => {
                    if (this.audioActive) {
                        this.playNote(note);
                    }
                }, idx * this.speedDelayMs);
                this.scheduledTimeouts.push(t);
            });
        } else {
            const notes = midiNotes.slice(0, 4);
            notes.forEach(note => this.playNote(note));
        }
    }
}

/**
 * Renderizzatore Grafico CRT Anni '70 del Monitor ADSR
 */
class AdsrCanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    draw(attack, decay, sustain, release) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        ctx.fillStyle = '#020803';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(0, 60, 20, 0.4)';
        ctx.lineWidth = 1;

        const gridStepX = width / 10;
        for (let x = 0; x < width; x += gridStepX) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        const gridStepY = height / 6;
        for (let y = 0; y < height; y += gridStepY) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        const padding = 12;
        const drawW = width - (padding * 2);
        const drawH = height - (padding * 2);

        const totalRelativeTime = attack + decay + 1.0 + release;
        const attackW = (attack / totalRelativeTime) * drawW;
        const decayW = (decay / totalRelativeTime) * drawW;
        const sustainW = (1.0 / totalRelativeTime) * drawW;
        const releaseW = (release / totalRelativeTime) * drawW;

        const x0 = padding;
        const y0 = height - padding;

        const x1 = x0 + attackW;
        const y1 = padding;

        const x2 = x1 + decayW;
        const y2 = height - padding - (sustain * drawH);

        const x3 = x2 + sustainW;
        const y3 = y2;

        const x4 = x3 + releaseW;
        const y4 = height - padding;

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.lineTo(x4, y0);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, padding, 0, height - padding);
        grad.addColorStop(0, 'rgba(0, 255, 102, 0.25)');
        grad.addColorStop(1, 'rgba(0, 255, 102, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.lineTo(x4, y4);

        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        [ {x: x1, y: y1}, {x: x2, y: y2}, {x: x3, y: y3} ].forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        });
    }
}

// 8 Sound Presets Definitions mapped to UI/Synth Engine ranges
const SYNTH_PRESETS = {
    PIANO: {
        waveform: 'triangle',
        filterType: 'lowpass',
        cutoff: 6025,
        resonance: 1.2,
        attack: 0.01,
        decay: 1.05,
        sustain: 0.20,
        release: 1.00,
        lfoRate: 0.5,
        lfoDepth: 0,
        vibrato: false,
        tremolo: false,
        octaveOffset: 0
    },
    GUITAR: {
        waveform: 'sawtooth',
        filterType: 'lowpass',
        cutoff: 5235,
        resonance: 1.2,
        attack: 0.01,
        decay: 0.75,
        sustain: 0.15,
        release: 1.00,
        lfoRate: 0.5,
        lfoDepth: 0,
        vibrato: false,
        tremolo: false,
        octaveOffset: 0
    },
    BASS: {
        waveform: 'sawtooth',
        filterType: 'lowpass',
        cutoff: 2628,
        resonance: 2.7,
        attack: 0.01,
        decay: 0.90,
        sustain: 0.70,
        release: 0.75,
        lfoRate: 0.5,
        lfoDepth: 0,
        vibrato: false,
        tremolo: false,
        octaveOffset: -12
    },
    ORGAN: {
        waveform: 'square',
        filterType: 'lowpass',
        cutoff: 4445,
        resonance: 0.8,
        attack: 0.01,
        decay: 0.05,
        sustain: 1.00,
        release: 0.75,
        lfoRate: 0.5,
        lfoDepth: 0,
        vibrato: false,
        tremolo: false,
        octaveOffset: 0
    },
    STRINGS: {
        waveform: 'sawtooth',
        filterType: 'lowpass',
        cutoff: 3500,
        resonance: 0.3,
        attack: 0.25,
        decay: 0.25,
        sustain: 0.85,
        release: 1.00,
        lfoRate: 5.0,
        lfoDepth: 25,
        vibrato: true,
        tremolo: false,
        octaveOffset: 0
    },
    BRASS: {
        waveform: 'sawtooth',
        filterType: 'lowpass',
        cutoff: 5472,
        resonance: 1.5,
        attack: 0.12,
        decay: 0.50,
        sustain: 0.82,
        release: 0.90,
        lfoRate: 5.0,
        lfoDepth: 8,
        vibrato: true,
        tremolo: false,
        octaveOffset: 0
    },
    PAD: {
        waveform: 'triangle',
        filterType: 'lowpass',
        cutoff: 3260,
        resonance: 0.5,
        attack: 1.20,
        decay: 0.70,
        sustain: 0.88,
        release: 3.50,
        lfoRate: 2.0,
        lfoDepth: 6,
        vibrato: true,
        tremolo: false,
        octaveOffset: 0
    },
    LEAD: {
        waveform: 'sawtooth',
        filterType: 'lowpass',
        cutoff: 6262,
        resonance: 3.0,
        attack: 0.06,
        decay: 0.60,
        sustain: 0.78,
        release: 1.00,
        lfoRate: 5.5,
        lfoDepth: 12,
        vibrato: true,
        tremolo: false,
        octaveOffset: 0
    }
};
// ============================================================
// ADSP Canvas Renderer
// ============================================================

class AdsrCanvasRenderer {
    constructor(canvas, synth) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.synth = synth;
        this.animationId = null;
    }

    draw() {
        const canvas = this.canvas;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const w = canvas.width;
        const h = canvas.height;

        const attack = this.synth.attack;
        const decay = this.synth.decay;
        const sustain = this.synth.sustain;
        const release = this.synth.release;

        const totalTime = attack + decay + 1.2 + release;

        const x0 = 10;
        const yBottom = h - 10;
        const yTop = 10;

        const usableW = w - 20;
        const usableH = h - 20;

        const xAttack = x0 + (attack / totalTime) * usableW;
        const xDecay = xAttack + (decay / totalTime) * usableW;
        const xSustain = xDecay + (1.2 / totalTime) * usableW;
        const xRelease = xSustain + (release / totalTime) * usableW;

        const ySustain = yBottom - sustain * usableH;

        ctx.beginPath();
        ctx.moveTo(x0, yBottom);
        ctx.lineTo(xAttack, yTop);
        ctx.lineTo(xDecay, ySustain);
        ctx.lineTo(xSustain, ySustain);
        ctx.lineTo(xRelease, yBottom);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#78350f';
        ctx.font = '9px sans-serif';

        ctx.fillText('A', xAttack - 3, yTop + 9);
        ctx.fillText('D', xDecay - 3, ySustain - 5);
        ctx.fillText('S', xSustain / 2 + xDecay / 2 - 3, ySustain - 5);
        ctx.fillText('R', xRelease - 3, yBottom - 2);

        this.animationId = requestAnimationFrame(() => this.draw());
    }

    start() {
        if (!this.animationId) {
            this.draw();
        }
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}


// ============================================================
// SYNTH PRESETS
// ============================================================

const SYNTH_PRESETS = {
    PIANO: {
        osc1: 'triangle',
        osc2: 'sine',
        osc1Level: 0.80,
        osc2Level: 0.20,
        attack: 0.005,
        decay: 0.35,
        sustain: 0.35,
        release: 0.60,
        filterType: 'lowpass',
        filterFreq: 4200,
        filterQ: 0.7,
        lfoRate: 5.5,
        lfoDepth: 2,
        octaveOffset: 0
    },

    GUITAR: {
        osc1: 'triangle',
        osc2: 'sawtooth',
        osc1Level: 0.72,
        osc2Level: 0.18,
        attack: 0.005,
        decay: 0.45,
        sustain: 0.22,
        release: 0.55,
        filterType: 'lowpass',
        filterFreq: 3200,
        filterQ: 0.8,
        lfoRate: 5,
        lfoDepth: 1.5,
        octaveOffset: 0
    },

    BASS: {
        osc1: 'sawtooth',
        osc2: 'square',
        osc1Level: 0.72,
        osc2Level: 0.18,
        attack: 0.01,
        decay: 0.35,
        sustain: 0.45,
        release: 0.40,
        filterType: 'lowpass',
        filterFreq: 900,
        filterQ: 1.0,
        lfoRate: 4,
        lfoDepth: 1,
        octaveOffset: -12
    },

    ORGAN: {
        osc1: 'sine',
        osc2: 'square',
        osc1Level: 0.65,
        osc2Level: 0.25,
        attack: 0.03,
        decay: 0.10,
        sustain: 0.90,
        release: 0.20,
        filterType: 'lowpass',
        filterFreq: 5000,
        filterQ: 0.5,
        lfoRate: 5,
        lfoDepth: 0.5,
        octaveOffset: 0
    },

    STRINGS: {
        osc1: 'sawtooth',
        osc2: 'triangle',
        osc1Level: 0.52,
        osc2Level: 0.35,
        attack: 0.35,
        decay: 0.45,
        sustain: 0.72,
        release: 1.20,
        filterType: 'lowpass',
        filterFreq: 2600,
        filterQ: 0.6,
        lfoRate: 5.2,
        lfoDepth: 1.5,
        octaveOffset: 0
    },

    BRASS: {
        osc1: 'sawtooth',
        osc2: 'square',
        osc1Level: 0.62,
        osc2Level: 0.25,
        attack: 0.08,
        decay: 0.25,
        sustain: 0.68,
        release: 0.35,
        filterType: 'lowpass',
        filterFreq: 2300,
        filterQ: 1.2,
        lfoRate: 5,
        lfoDepth: 1,
        octaveOffset: 0
    },

    PAD: {
        osc1: 'sawtooth',
        osc2: 'triangle',
        osc1Level: 0.42,
        osc2Level: 0.38,
        attack: 0.65,
        decay: 0.60,
        sustain: 0.75,
        release: 1.80,
        filterType: 'lowpass',
        filterFreq: 1900,
        filterQ: 0.5,
        lfoRate: 0.8,
        lfoDepth: 2,
        octaveOffset: 0
    },

    LEAD: {
        osc1: 'sawtooth',
        osc2: 'square',
        osc1Level: 0.68,
        osc2Level: 0.20,
        attack: 0.015,
        decay: 0.18,
        sustain: 0.72,
        release: 0.30,
        filterType: 'lowpass',
        filterFreq: 3500,
        filterQ: 1.4,
        lfoRate: 5.8,
        lfoDepth: 2.5,
        octaveOffset: 0
    }
};


// ============================================================
// CHORD MATRIX
// ============================================================

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

const CHROMATIC_SCALE = [
    'C', 'Db', 'D', 'Eb', 'E', 'F',
    'F#', 'G', 'Ab', 'A', 'Bb', 'B'
];

const MATRIX_ROWS = [
    {
        id: 'maj',
        label: 'Major',
        intervals: [0, 4, 7],
        suffix: '',
        quality: 'major'
    },
    {
        id: 'min',
        label: 'Minor',
        intervals: [0, 3, 7],
        suffix: 'm',
        quality: 'minor'
    },
    {
        id: '7',
        label: 'Dominant 7th',
        intervals: [0, 4, 7, 10],
        suffix: '7',
        quality: 'dominant'
    },
    {
        id: 'maj7',
        label: 'Major 7th',
        intervals: [0, 4, 7, 11],
        suffix: 'maj7',
        quality: 'major7'
    },
    {
        id: 'm7',
        label: 'Minor 7th',
        intervals: [0, 3, 7, 10],
        suffix: 'm7',
        quality: 'minor7'
    },
    {
        id: 'dim',
        label: 'Diminished',
        intervals: [0, 3, 6],
        suffix: 'dim',
        quality: 'diminished'
    },
    {
        id: 'dim7',
        label: 'Diminished 7th',
        intervals: [0, 3, 6, 9],
        suffix: 'dim7',
        quality: 'diminished7'
    }
];


// ============================================================
// PROGRESSION / GENRE DATA
// ============================================================

const GENRES_DATA = {
    "Classical & Traditional": {
        "Circle Progression": "I - vi (I / IV) - ii (IV) - V (bVII)",
        "Simple Cadence": "I - IV (ii) - V (bVII) - I (vi)",
        "Pachelbel": "I - V (iii) - vi (IV) - iii (V) - IV (ii) - I (vi) - IV (ii) - V (bVII)",
        "Diminished Cadence": "I - vii° (V) - I",
        "Romanesca": "I - V (vi) - vi (IV) - III (I) - IV (ii) - I (vi) - IV (ii) - V (bVII)",
        "Andalusian Classical": "i - bVII (v) - bVI (iv) - V (bVII)"
    },

    "Jazz & Dixieland": {
        "Classic Jazz Cadence": "ii7 - V7 (bVII7) - Imaj7 (vi7 / iii7)",
        "Minor Jazz Cadence": "ii7 - V7 (bVII7) - i7 (bIIImaj7)",
        "Jazz Turnaround": "Imaj7 - vi7 (bIII7) - ii7 (IVmaj7) - V7 (bVII7)",
        "Dixieland Loop": "I - VI7 (bIII7) - II7 (bVI7) - V7 (bVII7)",
        "Rhythm Changes": "Imaj7 - VI7 (iii7) - ii7 (IVmaj7) - V7 (bVII7)",
        "Backdoor Progression": "IVmaj7 (ii7) - bVII7 (iv7) - Imaj7 (vi7)",
        "Tritone Substitution": "ii7 - bII7 (V7) - Imaj7 (vi7)",
        "Diminished Passing Chord": "Imaj7 - vii°7 (V7) - ii7 (IVmaj7) - V7 (bVII7)"
    },

    "Pop & Rock": {
        "Golden Pop": "I - V (bVII) - vi (I) - IV (ii)",
        "Golden Fifties": "I - vi (IV) - IV (ii) - V (bVII)",
        "Mixolydian Rock": "I - bVII (v) - IV (ii) - I (v)",
        "Andalusian Cadence": "vi - V (bVII) - IV (bVI) - III (V7)",
        "Rock Anthem": "I - bVII (V) - IV (ii) - I (vi)",
        "Descending Pop": "I - V (iii) - vi (IV) - IV (ii)"
    },

    "Country & Folk": {
        "Country Three-Chord": "I - IV (ii) - I (vi) - V (bVII)",
        "Twelve-Bar Country": "I7 - I7 (IV7) - IV7 (I7) - IV7 - I7 (vi7) - I7 - V7 (bVII7) - IV7 (ii7) - I7 - V7 (bVII7)",
        "Country Waltz": "I - IV (vi) - I - V (IV) - I - IV (ii) - V (bVII) - I",
        "Country Ballad": "I - vi (IV) - IV (ii) - V (bVII)",
        "Bluegrass Breakdown": "I - IV (ii) - V (bVII) - I (vi)",
        "Folk Ballad": "I - V (vi) - IV (ii) - I (vi)"
    },

    "Blues": {
        "12-Bar Blues": "I7 - IV7 (ii7) - I7 (vi7) - I7 (V7) - IV7 (ii7) - IV7 (V7) - I7 (vi7) - I7 (IV7) - V7 (bVII7) - IV7 (ii7) - I7 (vi7) - V7 (bVII7)",
        "Quick Change Blues": "I7 - IV7 (ii7) - I7 - I7 - IV7 (ii7) - IV7 - I7 (vi7) - I7 - V7 (bVII7) - IV7 (ii7) - I7 - V7 (bVII7)",
        "8-Bar Blues": "I7 - IV7 (ii7) - I7 - VI7 (IV7) - ii7 (IV7) - V7 (bVII7) - I7 (vi7) - V7",
        "16-Bar Blues": "I7 - I7 (IV7) - IV7 (ii7) - IV7 - I7 (vi7) - I7 - V7 (bVII7) - V7 - IV7 (ii7) - IV7 - I7 (vi7) - I7 - V7 (IV7) - IV7 - I7 - V7 (bVII7)",
        "Minor Blues": "i7 - i7 (iv7) - iv7 (bVI7) - iv7 - i7 (bVI7) - i7 - V7 (bVII7) - iv7 - i7 - iv7 (bVI7) - i7 - V7 (bVII7)",
        "Jazz Blues": "I7 - IV7 (ii7) - I7 (vi7) - VI7 (IV7) - ii7 - V7 (bVII7) - I7 (vi7) - VI7 - ii7 (IV7) - V7 (bVII7) - I7 - V7 (bVII7)"
    },

    "Funk & Disco": {
        "Classic Funk": "i7 - IV7 (bVIImaj7) - i7 - IV7",
        "Disco Vamp": "ii7 - V7 (bVII7) - Imaj7 (vi7) - V7",
        "Funk Turnaround": "i7 - bVII7 (IV7) - bVI7 (ii7) - V7 (bVII7)",
        "Funk Minor Groove": "i7 - iv7 (bVI7) - bVII7 (bVImaj7) - bVI7",
        "Disco Four-Chord": "i7 - VI7 (bIII7) - iv7 (bVII7) - V7 (bVII7)",
        "Funk Dominant Groove": "I7 - IV7 (ii7) - I7 (vi7) - V7 (bVII7)"
    },

    "Heavy Metal & Hard Rock": {
        "Power Metal": "i - bVI (iv) - bVII (v) - i (v)",
        "Aeolian Metal": "i - bVII (iv) - bVI (ii7) - bVII (v)",
        "Phrygian Metal": "i - bII (vii) - i (v) - bII",
        "Metal Gallop": "i - bVII (v) - bVI (iv) - bVII (v)",
        "Doom Metal": "i - bVI (iv) - bVII (v) - i",
        "Heavy Rock": "i - bVII (iv) - IV (bVI) - i (v)"
    },

    "Gospel & Soul": {
        "Gospel Cascade": "I - I7 (v7) - IV (ii) - iv (bVII7)",
        "Soul Preacher": "I - vi7 (bIII7) - IVmaj7 (ii7) - V7 (bVII7)",
        "Church Cadence": "I - bVII (v) - IV (ii) - I (vi)",
        "Gospel Walkdown": "I - vi (IV) - IV (ii) - V (bVII)",
        "Soul Ballad": "Imaj7 - vi7 (IVmaj7) - IVmaj7 (ii7) - V7 (bVII7)",
        "Gospel Turnaround": "I - vi7 (IVmaj7) - ii7 (IV) - V7 (bVII7)"
    },

    "Latin & Salsa": {
        "Classic Montuno": "i - bVII (v) - bVI (iv) - V7 (bVII7)",
        "Salsa Clave": "ii7 - V7 (bVII7) - Imaj7 (vi7) - VI7 (bIII7)",
        "Latin Vamp": "i - iv (bVI) - bVII (bVImaj7) - III7 (V7)",
        "Bossa Nova": "Imaj7 - bII7 (V7) - Imaj7 (vi7)",
        "Samba Progression": "Imaj7 - VI7 (iii7) - ii7 (IVmaj7) - V7 (bVII7)",
        "Minor Latin Groove": "i7 - iv7 (bVImaj7) - bVII7 (bVI7) - bVImaj7 (iv7)"
    },

    "Other Styles": {
        "Reggae Groove": "I - IV (ii) - I (vi) - IV",
        "Neo-Soul": "IVmaj7 - III7 (bVII7) - vi7 (Imaj7) - v7 (I7)",
        "Dream Pop": "Imaj7 - V (iii) - vi7 (IVmaj7) - IVmaj7 (ii7)",
        "Ambient Progression": "Imaj7 - IVmaj7 (ii7) - vi7 (IV) - V (bVII)",
        "Modal Groove": "i7 - bVII (iv7) - IV (bVI) - i7 (v)",
        "Cinematic": "i - bVI (iv) - III (bVII) - bVII (v)"
    }
};
// ============================================================
// GLOBAL STATE
// ============================================================

let selectedChordName = '';
let currentStrumNotes = [];
let progressionSteps = [];
let progressionCurrentIndex = 0;
let progressionKey = null;
let progressionMode = null;

// Smooth Voice Leading
let smoothVoicingEnabled = false;
let previousVoicing = null;


// ============================================================
// CHORD CALCULATION
// ============================================================

function calculateNotes(rootMidi, intervals) {
    const notes = [];

    for (let octave = -1; octave <= 2; octave++) {
        for (let interval of intervals) {
            notes.push(rootMidi + interval + (octave * 12));
        }
    }

    return notes.sort((a, b) => a - b);
}


/**
 * Calculates the closest practical inversion/register of the next chord
 * relative to the previously played voicing.
 *
 * The chord itself never changes: only inversion and octave placement do.
 * The algorithm minimizes total voice movement, then prefers common tones,
 * then a compact voicing and a small bass movement.
 */
function calculateSmoothVoicing(rootMidi, intervals, previousNotes) {
    const baseNotes = intervals
        .map(interval => rootMidi + interval)
        .sort((a, b) => a - b);

    if (!previousNotes || previousNotes.length !== baseNotes.length) {
        return baseNotes;
    }

    const candidates = [];
    const voiceCount = baseNotes.length;

    // Generate every inversion, then move it through a reasonable register.
    for (let inversion = 0; inversion < voiceCount; inversion++) {
        const inversionNotes = [
            ...baseNotes.slice(inversion),
            ...baseNotes.slice(0, inversion).map(note => note + 12)
        ];

        for (let shift = -36; shift <= 36; shift += 12) {
            const candidate = inversionNotes
                .map(note => note + shift)
                .sort((a, b) => a - b);

            let totalMovement = 0;
            let stationaryVoices = 0;

            for (let i = 0; i < voiceCount; i++) {
                const movement = Math.abs(candidate[i] - previousNotes[i]);

                totalMovement += movement;

                if (movement === 0) {
                    stationaryVoices++;
                }
            }

            const span = candidate[voiceCount - 1] - candidate[0];
            const bassMovement = Math.abs(candidate[0] - previousNotes[0]);

            candidates.push({
                notes: candidate,
                totalMovement,
                stationaryVoices,
                span,
                bassMovement
            });
        }
    }

    candidates.sort((a, b) => {
        // Primary criterion: minimum total voice movement.
        if (a.totalMovement !== b.totalMovement) {
            return a.totalMovement - b.totalMovement;
        }

        // Secondary criterion: preserve common tones.
        if (a.stationaryVoices !== b.stationaryVoices) {
            return b.stationaryVoices - a.stationaryVoices;
        }

        // Tertiary criterion: prefer a compact voicing.
        if (a.span !== b.span) {
            return a.span - b.span;
        }

        // Final criterion: keep the bass as close as possible.
        return a.bassMovement - b.bassMovement;
    });

    return candidates[0].notes;
}


// ============================================================
// CHORD SELECTION
// ============================================================

function selectChord(rootObj, rowObj) {
    selectedChordName = `${rootObj.name}${rowObj.suffix}`;

    if (smoothVoicingEnabled) {
        currentStrumNotes = calculateSmoothVoicing(
            rootObj.midi,
            rowObj.intervals,
            previousVoicing
        );

        previousVoicing = [...currentStrumNotes];
    } else {
        currentStrumNotes = calculateNotes(
            rootObj.midi,
            rowObj.intervals
        );
    }

    document.getElementById('lbl-active-chord').textContent =
        selectedChordName;

    const allBtns = document.querySelectorAll('.matrix-btn');

    allBtns.forEach(btn => {
        if (btn.dataset.chord === selectedChordName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    handleProgressionStep(
        selectedChordName,
        rootObj,
        rowObj
    );
}


// ============================================================
// PROGRESSION PARSER
// ============================================================

const ROMAN_SEMITONES = {
    'I': 0,
    'bII': 1,
    'II': 2,
    'bIII': 3,
    'III': 4,
    'IV': 5,
    'bV': 6,
    'V': 7,
    'bVI': 8,
    'VI': 9,
    'bVII': 10,
    'VII': 11
};


function parseDegreeToChord(token, keyMidi) {
    if (!token) return null;

    let cleanToken = token.trim();

    cleanToken = cleanToken.replace(
        /[()]/g,
        ''
    );

    let quality = 'maj';

    if (cleanToken.includes('dim7')) {
        quality = 'dim7';
    } else if (cleanToken.includes('dim')) {
        quality = 'dim';
    } else if (cleanToken.includes('maj7')) {
        quality = 'maj7';
    } else if (cleanToken.includes('m7')) {
        quality = 'm7';
    } else if (cleanToken.includes('7')) {
        quality = '7';
    } else if (/^[ivIV]+$/.test(cleanToken)) {
        quality = cleanToken === cleanToken.toUpperCase()
            ? 'maj'
            : 'min';
    }

    const degreeMatch = cleanToken.match(
        /^(b?)([ivIV]+)/
    );

    if (!degreeMatch) {
        return null;
    }

    const accidental = degreeMatch[1] || '';
    const roman = degreeMatch[2].toUpperCase();

    const degree = `${accidental}${roman}`;

    if (!(degree in ROMAN_SEMITONES)) {
        return null;
    }

    const semitone = ROMAN_SEMITONES[degree];

    const rootMidi = keyMidi + semitone;
    const rootName = CHROMATIC_SCALE[
        ((rootMidi % 12) + 12) % 12
    ];

    const row = MATRIX_ROWS.find(
        item => item.id === quality
    );

    if (!row) {
        return null;
    }

    return {
        rootMidi,
        rootName,
        quality,
        row,
        degree,
        token: cleanToken
    };
}


function parseProgressionPattern(pattern, keyMidi) {
    if (!pattern || typeof pattern !== 'string') {
        return [];
    }

    const tokens = pattern
        .split('-')
        .map(token => token.trim())
        .filter(Boolean);

    return tokens
        .map(token => {
            const alternatives = [];

            const mainMatch = token.match(
                /^([^(]+)(?:\(([^)]+)\))?$/
            );

            if (!mainMatch) {
                return null;
            }

            const mainToken = mainMatch[1].trim();
            const alternativeText = mainMatch[2];

            const mainChord = parseDegreeToChord(
                mainToken,
                keyMidi
            );

            if (!mainChord) {
                return null;
            }

            if (alternativeText) {
                alternativeText
                    .split('/')
                    .map(item => item.trim())
                    .filter(Boolean)
                    .forEach(alternative => {
                        const parsed = parseDegreeToChord(
                            alternative,
                            keyMidi
                        );

                        if (parsed) {
                            alternatives.push(parsed);
                        }
                    });
            }

            return {
                main: mainChord,
                alternatives
            };
        })
        .filter(Boolean);
}


function deduceKeyFromFirstStep(pattern) {
    if (!pattern || typeof pattern !== 'string') {
        return null;
    }

    const firstToken = pattern
        .split('-')[0]
        .trim();

    const cleaned = firstToken
        .replace(/\([^)]*\)/g, '')
        .trim();

    const match = cleaned.match(
        /^(b?)([ivIV]+)/
    );

    if (!match) {
        return null;
    }

    return 60;
}


// ============================================================
// PROGRESSION HANDLING
// ============================================================

function handleProgressionStep(
    chordName,
    rootObj,
    rowObj
) {
    if (!progressionSteps.length) {
        return;
    }

    const currentStep =
        progressionSteps[progressionCurrentIndex];

    if (!currentStep) {
        return;
    }

    const matchesMain =
        currentStep.main &&
        `${currentStep.main.rootName}${currentStep.main.row.suffix}` ===
        chordName;

    const matchesAlternative =
        currentStep.alternatives &&
        currentStep.alternatives.some(
            alternative =>
                `${alternative.rootName}${alternative.row.suffix}` ===
                chordName
        );

    if (matchesMain || matchesAlternative) {
        progressionCurrentIndex++;

        if (
            progressionCurrentIndex >=
            progressionSteps.length
        ) {
            progressionCurrentIndex = 0;
        }

        highlightNextStepOptions();
        updateProgressionChordsDisplay();
    }
}


function highlightNextStepOptions() {
    const allBtns = document.querySelectorAll(
        '.matrix-btn'
    );

    allBtns.forEach(btn => {
        btn.classList.remove(
            'progression-next',
            'progression-option'
        );
    });

    if (!progressionSteps.length) {
        return;
    }

    const currentStep =
        progressionSteps[progressionCurrentIndex];

    if (!currentStep) {
        return;
    }

    const targetChords = [];

    if (currentStep.main) {
        targetChords.push(
            `${currentStep.main.rootName}${currentStep.main.row.suffix}`
        );
    }

    currentStep.alternatives.forEach(alternative => {
        targetChords.push(
            `${alternative.rootName}${alternative.row.suffix}`
        );
    });

    allBtns.forEach(btn => {
        const chord = btn.dataset.chord;

        if (targetChords.includes(chord)) {
            btn.classList.add('progression-option');
        }

        if (
            currentStep.main &&
            chord ===
            `${currentStep.main.rootName}${currentStep.main.row.suffix}`
        ) {
            btn.classList.add('progression-next');
        }
    });
}


function updateProgressionChordsDisplay() {
    const display = document.getElementById(
        'progression-chords'
    );

    if (!display) {
        return;
    }

    display.innerHTML = '';

    progressionSteps.forEach((step, index) => {
        const item = document.createElement('span');

        item.textContent =
            `${step.main.rootName}${step.main.row.suffix}`;

        item.className =
            'progression-chord';

        if (index === progressionCurrentIndex) {
            item.classList.add('active');
        }

        display.appendChild(item);
    });
}
// ============================================================
// MATRIX UI
// ============================================================

function createMatrixUI() {
    const matrix = document.getElementById('chord-matrix');

    if (!matrix) {
        return;
    }

    matrix.innerHTML = '';

    MATRIX_ROWS.forEach(row => {
        const rowElement = document.createElement('div');
        rowElement.className = 'matrix-row';

        const label = document.createElement('div');
        label.className = 'matrix-row-label';
        label.textContent = row.label;

        rowElement.appendChild(label);

        CIRCLE_OF_FIFTHS.forEach(root => {
            const button = document.createElement('button');

            const chordName =
                `${root.name}${row.suffix}`;

            button.type = 'button';
            button.className = 'matrix-btn';
            button.dataset.chord = chordName;
            button.dataset.root = root.name;
            button.dataset.rootMidi = root.midi;
            button.dataset.row = row.id;

            button.textContent = chordName;

            button.addEventListener(
                'pointerdown',
                (event) => {
                    event.preventDefault();

                    selectChord(root, row);

                    if (
                        typeof audio !== 'undefined' &&
                        audio
                    ) {
                        audio.strumChord(
                            currentStrumNotes
                        );
                    }
                }
            );

            rowElement.appendChild(button);
        });

        matrix.appendChild(rowElement);
    });
}


// ============================================================
// GENRES / STYLES UI
// ============================================================

function initGenresAndStylesUI() {
    const genreSelect =
        document.getElementById('genre-select');

    const styleSelect =
        document.getElementById('style-select');

    const progressionInput =
        document.getElementById('progression-input');

    if (!genreSelect || !styleSelect) {
        return;
    }

    genreSelect.innerHTML = '';

    Object.keys(GENRES_DATA).forEach(genre => {
        const option =
            document.createElement('option');

        option.value = genre;
        option.textContent = genre;

        genreSelect.appendChild(option);
    });

    function populateStyles() {
        const genre = genreSelect.value;
        const styles = GENRES_DATA[genre] || {};

        styleSelect.innerHTML = '';

        Object.keys(styles).forEach(style => {
            const option =
                document.createElement('option');

            option.value = style;
            option.textContent = style;

            styleSelect.appendChild(option);
        });

        if (
            styleSelect.options.length &&
            progressionInput
        ) {
            progressionInput.value =
                styles[styleSelect.value] || '';
        }
    }

    genreSelect.addEventListener(
        'change',
        populateStyles
    );

    styleSelect.addEventListener(
        'change',
        () => {
            const genre = genreSelect.value;
            const style = styleSelect.value;

            if (progressionInput) {
                progressionInput.value =
                    GENRES_DATA[genre]?.[style] || '';
            }
        }
    );

    populateStyles();
}


// ============================================================
// DOM INITIALIZATION
// ============================================================

document.addEventListener(
    'DOMContentLoaded',
    () => {
        const canvas =
            document.getElementById('adsr-canvas');

        const audio =
            new WebAudioEngine();

        window.audio = audio;

        const adsrRenderer =
            canvas
                ? new AdsrCanvasRenderer(
                    canvas,
                    audio
                )
                : null;

        if (adsrRenderer) {
            adsrRenderer.start();
        }


        // ----------------------------------------------------
        // POWER
        // ----------------------------------------------------

        const powerButton =
            document.getElementById('power-button');

        const powerLed =
            document.getElementById('power-led');


        if (powerButton) {
            powerButton.addEventListener(
                'click',
                async () => {
                    if (!audio.audioActive) {
                        await audio.init();

                        if (powerLed) {
                            powerLed.classList.add(
                                'active'
                            );
                        }

                        powerButton.classList.add(
                            'active'
                        );
                    } else {
                        audio.stopAll();
                        audio.audioActive = false;

                        if (powerLed) {
                            powerLed.classList.remove(
                                'active'
                            );
                        }

                        powerButton.classList.remove(
                            'active'
                        );
                    }
                }
            );
        }


        // ----------------------------------------------------
        // SMOOTH VOICE LEADING TOGGLE
        // ----------------------------------------------------

        const smoothVoicingToggle =
            document.getElementById(
                'toggle-smooth-voicing'
            );

        if (smoothVoicingToggle) {
            smoothVoicingToggle.checked = false;

            smoothVoicingToggle.addEventListener(
                'change',
                (event) => {
                    smoothVoicingEnabled =
                        event.target.checked;

                    // Start a fresh voice-leading chain
                    // whenever the mode changes.
                    previousVoicing = null;
                }
            );
        }


        // ----------------------------------------------------
        // MASTER VOLUME
        // ----------------------------------------------------

        const masterVolume =
            document.getElementById(
                'master-volume'
            );

        const masterVolumeValue =
            document.getElementById(
                'master-volume-value'
            );

        if (masterVolume) {
            masterVolume.addEventListener(
                'input',
                (event) => {
                    const value =
                        Number(event.target.value);

                    audio.setMasterVolume(value);

                    if (masterVolumeValue) {
                        masterVolumeValue.textContent =
                            `${value}%`;
                    }
                }
            );

            audio.setMasterVolume(
                Number(masterVolume.value)
            );

            if (masterVolumeValue) {
                masterVolumeValue.textContent =
                    `${masterVolume.value}%`;
            }
        }


        // ----------------------------------------------------
        // SYNTH CONTROLS
        // ----------------------------------------------------

        const osc1Select =
            document.getElementById('osc1-type');

        const osc2Select =
            document.getElementById('osc2-type');

        const filterTypeSelect =
            document.getElementById(
                'filter-type'
            );

        const filterFreq =
            document.getElementById(
                'filter-frequency'
            );

        const filterQ =
            document.getElementById(
                'filter-q'
            );

        const attackControl =
            document.getElementById('attack');

        const decayControl =
            document.getElementById('decay');

        const sustainControl =
            document.getElementById('sustain');

        const releaseControl =
            document.getElementById('release');

        const lfoRate =
            document.getElementById('lfo-rate');

        const lfoDepth =
            document.getElementById('lfo-depth');


        if (osc1Select) {
            osc1Select.addEventListener(
                'change',
                () => {
                    audio.osc1Type =
                        osc1Select.value;
                }
            );
        }

        if (osc2Select) {
            osc2Select.addEventListener(
                'change',
                () => {
                    audio.osc2Type =
                        osc2Select.value;
                }
            );
        }

        if (filterTypeSelect) {
            filterTypeSelect.addEventListener(
                'change',
                () => {
                    audio.filterType =
                        filterTypeSelect.value;
                }
            );
        }

        if (filterFreq) {
            filterFreq.addEventListener(
                'input',
                () => {
                    audio.filterFreq =
                        Number(filterFreq.value);
                }
            );
        }

        if (filterQ) {
            filterQ.addEventListener(
                'input',
                () => {
                    audio.filterQ =
                        Number(filterQ.value);
                }
            );
        }

        if (attackControl) {
            attackControl.addEventListener(
                'input',
                () => {
                    audio.attack =
                        Number(attackControl.value);
                }
            );
        }

        if (decayControl) {
            decayControl.addEventListener(
                'input',
                () => {
                    audio.decay =
                        Number(decayControl.value);
                }
            );
        }

        if (sustainControl) {
            sustainControl.addEventListener(
                'input',
                () => {
                    audio.sustain =
                        Number(sustainControl.value);
                }
            );
        }

        if (releaseControl) {
            releaseControl.addEventListener(
                'input',
                () => {
                    audio.release =
                        Number(releaseControl.value);
                }
            );
        }

        if (lfoRate) {
            lfoRate.addEventListener(
                'input',
                () => {
                    audio.lfoRate =
                        Number(lfoRate.value);
                }
            );
        }

        if (lfoDepth) {
            lfoDepth.addEventListener(
                'input',
                () => {
                    audio.lfoDepth =
                        Number(lfoDepth.value);
                }
            );
        }


        // ----------------------------------------------------
        // PRESETS
        // ----------------------------------------------------

        const presetButtons =
            document.querySelectorAll(
                '[data-preset]'
            );

        function applyPreset(name) {
            const preset =
                SYNTH_PRESETS[name];

            if (!preset) {
                return;
            }

            audio.applyPreset(preset);

            if (osc1Select) {
                osc1Select.value =
                    preset.osc1;
            }

            if (osc2Select) {
                osc2Select.value =
                    preset.osc2;
            }

            if (filterTypeSelect) {
                filterTypeSelect.value =
                    preset.filterType;
            }

            if (filterFreq) {
                filterFreq.value =
                    preset.filterFreq;
            }

            if (filterQ) {
                filterQ.value =
                    preset.filterQ;
            }

            if (attackControl) {
                attackControl.value =
                    preset.attack;
            }

            if (decayControl) {
                decayControl.value =
                    preset.decay;
            }

            if (sustainControl) {
                sustainControl.value =
                    preset.sustain;
            }

            if (releaseControl) {
                releaseControl.value =
                    preset.release;
            }

            if (lfoRate) {
                lfoRate.value =
                    preset.lfoRate;
            }

            if (lfoDepth) {
                lfoDepth.value =
                    preset.lfoDepth;
            }

            presetButtons.forEach(button => {
                button.classList.toggle(
                    'active',
                    button.dataset.preset === name
                );
            });
        }

        presetButtons.forEach(button => {
            button.addEventListener(
                'click',
                () => {
                    applyPreset(
                        button.dataset.preset
                    );
                }
            );
        });

        applyPreset('PIANO');


        // ----------------------------------------------------
        // STRUM / ARP / DRONE MODES
        // ----------------------------------------------------

        const strumToggle =
            document.getElementById(
                'toggle-strum'
            );

        const arpToggle =
            document.getElementById(
                'toggle-arp'
            );

        const droneToggle =
            document.getElementById(
                'toggle-drone'
            );

        const speedControl =
            document.getElementById(
                'strum-speed'
            );


        if (strumToggle) {
            strumToggle.addEventListener(
                'change',
                event => {
                    audio.strumMode =
                        event.target.checked;

                    if (
                        audio.strumMode &&
                        arpToggle
                    ) {
                        arpToggle.checked = false;
                        audio.arpMode = false;
                    }
                }
            );
        }

        if (arpToggle) {
            arpToggle.addEventListener(
                'change',
                event => {
                    audio.arpMode =
                        event.target.checked;

                    if (
                        audio.arpMode &&
                        strumToggle
                    ) {
                        strumToggle.checked = false;
                        audio.strumMode = false;
                    }
                }
            );
        }

        if (droneToggle) {
            droneToggle.addEventListener(
                'change',
                event => {
                    audio.droneMode =
                        event.target.checked;
                }
            );
        }

        if (speedControl) {
            speedControl.addEventListener(
                'input',
                event => {
                    audio.speedDelayMs =
                        Number(event.target.value);
                }
            );
        }


        // ----------------------------------------------------
        // CHORD MATRIX
        // ----------------------------------------------------

        createMatrixUI();


        // ----------------------------------------------------
        // GENRES / PROGRESSIONS
        // ----------------------------------------------------

        initGenresAndStylesUI();


        const progressionInput =
            document.getElementById(
                'progression-input'
            );

        const progressionLoadButton =
            document.getElementById(
                'load-progression'
            );


        if (progressionLoadButton) {
            progressionLoadButton.addEventListener(
                'click',
                () => {
                    const pattern =
                        progressionInput
                            ? progressionInput.value.trim()
                            : '';

                    if (!pattern) {
                        progressionSteps = [];
                        progressionCurrentIndex = 0;
                        progressionKey = null;

                        highlightNextStepOptions();
                        updateProgressionChordsDisplay();

                        return;
                    }

                    progressionKey =
                        deduceKeyFromFirstStep(
                            pattern
                        );

                    progressionSteps =
                        parseProgressionPattern(
                            pattern,
                            progressionKey
                        );

                    progressionCurrentIndex = 0;

                    highlightNextStepOptions();
                    updateProgressionChordsDisplay();
                }
            );
        }


        // ----------------------------------------------------
        // INITIAL STATE
        // ----------------------------------------------------

        if (progressionInput) {
            progressionInput.value =
                'I - V - vi - IV';
        }

        progressionKey = 60;

        progressionSteps =
            parseProgressionPattern(
                'I - V - vi - IV',
                progressionKey
            );

        progressionCurrentIndex = 0;

        highlightNextStepOptions();
        updateProgressionChordsDisplay();
    }
);

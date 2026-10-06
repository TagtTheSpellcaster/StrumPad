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
        cutoff: 6025,      // 75% Cutoff range (100 - 8000 Hz)
        resonance: 1.2,     // 8% Resonance range (0.1 - 15.0 Q)
        attack: 0.01,       // 0% Attack
        decay: 1.05,        // 35% Decay range (0.05 - 3.0s)
        sustain: 0.20,      // 20% Sustain
        release: 1.00,      // 20% Release range (0.05 - 5.0s)
        lfoRate: 0.5,       // 0% Rate
        lfoDepth: 0,        // 0% Depth
        vibrato: false,
        tremolo: false,
        octaveOffset: 0
    },
    GUITAR: {
        waveform: 'sawtooth',
        filterType: 'lowpass',
        cutoff: 5235,      // 65% Cutoff range
        resonance: 1.2,     // 8% Resonance range
        attack: 0.01,       // 0% Attack
        decay: 0.75,        // 25% Decay range
        sustain: 0.15,      // 15% Sustain
        release: 1.00,      // 20% Release range
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
        octaveOffset: -12   // Trasposizione di -1 ottava (-12 semitoni)
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

// Chromatic Scale for intervals
const CHROMATIC_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// 5 Matrix Rows
const MATRIX_ROWS = [
    { id: 'maj',  label: 'Major',             intervals: [0, 4, 7],     suffix: '',     btnClass: 'row-maj',  badgeStyle: 'bg-amber-200 text-amber-950 border-amber-300' },
    { id: 'min',  label: 'Minor',             intervals: [0, 3, 7],     suffix: 'm',    btnClass: 'row-min',  badgeStyle: 'bg-sky-200 text-sky-950 border-sky-300' },
    { id: '7',    label: 'Dominant 7th',      intervals: [0, 4, 7, 10], suffix: '7',    btnClass: 'row-7',    badgeStyle: 'bg-rose-200 text-rose-950 border-rose-300' },
    { id: 'maj7', label: 'Major 7th',         intervals: [0, 4, 7, 11], suffix: 'maj7', btnClass: 'row-maj7', badgeStyle: 'bg-emerald-200 text-emerald-950 border-emerald-300' },
    { id: 'm7',   label: 'Minor 7th',         intervals: [0, 3, 7, 10], suffix: 'm7',   btnClass: 'row-m7',   badgeStyle: 'bg-purple-200 text-purple-950 border-purple-300' }
];

// Genres & Styles Table
const GENRES_DATA = {
    "Classical & Traditional": {
        "Circle of C (Major)": "I - vi (I / IV) - ii (IV) - V (bVII / viio)",
        "Simple / Plagal Cadence": "I - IV (ii) - V (bVII / viio) - I (vi)",
        "Pachelbel Progression": "I - V (iii) - vi (I) - iii (V) - IV (ii) - I (vi) - IV (ii) - V (bVII)"
    },
    "Jazz & Dixieland": {
        "Major ii - V - I": "ii7 - V7 (bVII7 / VIIo7) - Imaj7 (vi7 / iii7)",
        "Minor ii - V - I": "iiø7 - V7alt (bVII7) - imin7 (bIIImaj7)",
        "Rhythm Turnaround": "Imaj7 - vi7 (bIII7) - ii7 (IVmaj7) - V7 (bVII7)",
        "Dixieland / Ragtime Loop": "I - VI7 (bIII7) - II7 (bVI7) - V7 (bVII7)"
    },
    "Pop & Rock": {
        "Golden Pop Progression": "I - V (bVII) - vi (I) - IV (ii)",
        "The '50s Progression": "I - vi (I) - IV (ii) - V (bVII)",
        "Epic Mixolydian Rock": "I - bVII (v) - IV (ii) - I (v)",
        "Andalusian Cadence (Flamenco/Rock)": "vi - V (bVII) - IV (bVI) - III (V7)"
    },
    "Country, Folk & Blues": {
        "Three-Chord Country": "I - IV (ii) - I (vi) - V (bVII)",
        "Standard Blues (12-Bar)": "I7 - IV7 (ii7) - I7 (vi7) - V7 (bVII7) - IV7 (ii7) - I7 (vi7) - V7 (bVII7)",
        "Bluegrass Breakdown": "I - IV (ii) - V (bVII) - vi (I)"
    },
    "Funk & Disco": {
        "Classic Funk Groove": "i7 - IV7 (bVIImaj7)",
        "Disco Vamp": "ii7 - V7 (bVII7)",
        "Funky Turnaround": "i7 - bVII7 (IV7) - bVI7 (iiø7) - V7alt (bVII7)"
    },
    "Heavy Metal & Hard Rock": {
        "Power Metal Loop": "i - bVI (iv) - bVII (v) - i (v)",
        "Epic Metal Aeolian": "i - bVII (iv) - bVI (iiø) - bVII (v)",
        "Phrygian Metal Drive": "i - bII (vii) - i (v)"
    },
    "Gospel & Soul": {
        "Gospel Plagal Cascade": "I - I7 (v7) - IV (ii) - iv (bVII7)",
        "Soul Preacher": "I - vi7 (bIII7) - IVmaj7 (ii7) - V7 (bVII7)",
        "Church Cadence": "I - bVII (v) - IV (ii) - I (vi)"
    },
    "Latin & Salsa": {
        "Standard Montuno": "i - bVII (v) - bVI (iiø) - V7 (bVII7)",
        "Salsa Clave Loop": "ii7 - V7 (bVII7) - Imaj7 (vi7) - VI7 (bIII7)"
    },
    "Other Styles": {
        "Reggae Loop": "I - IV (ii)",
        "Bossa Nova / Nu-Jazz": "Imaj7 - bII7 (V7alt) - Imaj7 (vi7)",
        "R&B / Neo-Soul": "IVmaj7 - III7 (bVII7) - vi7 (Imaj7) - Vm7 (I7)"
    }
};

// Global State
const audio = new WebAudioEngine();
let selectedChordName = null;
let currentStrumNotes = calculateNotes(CIRCLE_OF_FIFTHS[0].midi, MATRIX_ROWS[0].intervals);

let activeProgressionSteps = [];
let currentProgressionStepIndex = -1;
let currentKeyRoot = null;

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

    handleProgressionStep(selectedChordName, rootObj, rowObj);
}

const ROMAN_SEMITONES = {
    'i': 0, 'I': 0,
    'bII': 1, 'bii': 1,
    'ii': 2, 'II': 2,
    'bIII': 3, 'biii': 3,
    'iii': 4, 'III': 4,
    'iv': 5, 'IV': 5,
    'bV': 6, 'bv': 6, 'viio': 6, 'VIIo': 6,
    'v': 7, 'V': 7, 'Vm': 7,
    'bVI': 8, 'bvi': 8,
    'vi': 9, 'VI': 9,
    'bVII': 10, 'bvii': 10,
    'vii': 11, 'VII': 11
};

function parseDegreeToChord(degreeStr, keyRootName) {
    let clean = degreeStr.trim();
    if (!clean) return null;

    clean = clean.replace('alt', '').replace('ø', 'm').replace('imin', 'im');

    const match = clean.match(/^(b[I|V|i|v]+|[I|V|i|v]+|viio|VIIo)/);
    if (!match) return null;

    const degreeToken = match[0];
    const rest = clean.slice(degreeToken.length);

    if (ROMAN_SEMITONES[degreeToken] === undefined) return null;

    const keyIndex = CHROMATIC_SCALE.indexOf(keyRootName);
    if (keyIndex === -1) return null;

    const targetSemitone = (keyIndex + ROMAN_SEMITONES[degreeToken]) % 12;
    const targetRoot = CHROMATIC_SCALE[targetSemitone];

    const isMinor = degreeToken === degreeToken.toLowerCase() && degreeToken !== 'I';

    let chordQualitySuffix = '';
    if (rest) {
        chordQualitySuffix = rest;
        if (isMinor && !chordQualitySuffix.startsWith('m')) {
            chordQualitySuffix = 'm' + chordQualitySuffix;
        }
    } else {
        chordQualitySuffix = isMinor ? 'm' : '';
    }

    return targetRoot + chordQualitySuffix;
}

function parseProgressionPattern(patternStr, keyRootName) {
    if (!patternStr) return [];

    const rawSteps = patternStr.split(' - ');
    const compiledSteps = [];

    rawSteps.forEach(stepText => {
        const parenMatch = stepText.match(/([^\(]+)(?:\(([^\)]+)\))?/);
        if (!parenMatch) return;

        const mainRaw = parenMatch[1].trim();
        const subRaw = parenMatch[2] ? parenMatch[2].trim() : null;

        const mainChord = parseDegreeToChord(mainRaw, keyRootName);
        const subChords = [];

        if (subRaw) {
            const subTokens = subRaw.split('/');
            subTokens.forEach(st => {
                const parsedSub = parseDegreeToChord(st.trim(), keyRootName);
                if (parsedSub) subChords.push(parsedSub);
            });
        }

        if (mainChord) {
            compiledSteps.push({
                main: mainChord,
                sub: subChords
            });
        }
    });

    return compiledSteps;
}

function handleProgressionStep(chordName, rootObj, rowObj) {
    const genreSelect = document.getElementById('select-genre');
    const styleSelect = document.getElementById('select-style');

    if (!genreSelect.value || !styleSelect.value) return;

    const patternStr = GENRES_DATA[genreSelect.value][styleSelect.value];
    if (!patternStr) return;

    if (currentProgressionStepIndex === -1) {
        const candidateSteps = parseProgressionPattern(patternStr, rootObj.name);
        if (!candidateSteps.length) return;

        const step1 = candidateSteps[0];
        const isMainMatch = (chordName === step1.main);
        const isSubMatch = step1.sub.includes(chordName);

        if (!isMainMatch && !isSubMatch) {
            clearHighlights();
            return;
        }

        currentKeyRoot = rootObj.name;
        activeProgressionSteps = candidateSteps;
        currentProgressionStepIndex = 0;

        updateProgressionChordsDisplay();
        highlightNextStepOptions(1);
        return;
    }

    const nextExpectedStepIndex = (currentProgressionStepIndex + 1) % activeProgressionSteps.length;
    const expectedStep = activeProgressionSteps[nextExpectedStepIndex];

    const isNextMain = (chordName === expectedStep.main);
    const isNextSub = expectedStep.sub.includes(chordName);

    if (isNextMain || isNextSub) {
        currentProgressionStepIndex = nextExpectedStepIndex;
        const nextStepIndexToHighlight = (currentProgressionStepIndex + 1) % activeProgressionSteps.length;
        highlightNextStepOptions(nextStepIndexToHighlight);
    } else {
        const newCandidateSteps = parseProgressionPattern(patternStr, rootObj.name);
        if (newCandidateSteps.length && (chordName === newCandidateSteps[0].main || newCandidateSteps[0].sub.includes(chordName))) {
            currentKeyRoot = rootObj.name;
            activeProgressionSteps = newCandidateSteps;
            currentProgressionStepIndex = 0;
            updateProgressionChordsDisplay();
            highlightNextStepOptions(1);
        } else {
            resetProgressionState();
        }
    }
}

function clearHighlights() {
    document.querySelectorAll('.matrix-btn').forEach(btn => {
        btn.classList.remove('highlight-main', 'highlight-sub');
    });
}

function highlightNextStepOptions(stepIndex) {
    clearHighlights();

    if (!activeProgressionSteps || !activeProgressionSteps[stepIndex]) return;

    const stepInfo = activeProgressionSteps[stepIndex];

    const mainBtn = document.querySelector(`.matrix-btn[data-chord="${stepInfo.main}"]`);
    if (mainBtn) mainBtn.classList.add('highlight-main');

    stepInfo.sub.forEach(subChord => {
        const subBtn = document.querySelector(`.matrix-btn[data-chord="${subChord}"]`);
        if (subBtn) subBtn.classList.add('highlight-sub');
    });
}

function updateProgressionChordsDisplay() {
    const chordsLabel = document.getElementById('lbl-progression-chords');
    if (!chordsLabel || !activeProgressionSteps.length) return;

    const formatted = activeProgressionSteps.map(s => {
        return s.sub.length ? `${s.main}(${s.sub.join('/')})` : s.main;
    }).join(' - ');

    chordsLabel.textContent = `Chords [${currentKeyRoot}]: ${formatted}`;
    chordsLabel.classList.remove('hidden');
}

function resetProgressionState() {
    currentProgressionStepIndex = -1;
    currentKeyRoot = null;
    activeProgressionSteps = [];
    clearHighlights();
    const chordsLabel = document.getElementById('lbl-progression-chords');
    if (chordsLabel) chordsLabel.classList.add('hidden');
}

function createMatrixUI() {
    const container = document.getElementById('matrix-grid');
    if (!container) return;
    container.innerHTML = '';

    // 1. Rigenera l'intestazione Vintage Anni '70 per le note in cima alle colonne
    const headerRowWrapper = document.createElement('div');
    headerRowWrapper.className = 'flex items-center gap-3 mb-1';

    const headerEmptyBox = document.createElement('div');
    headerEmptyBox.className = 'w-36 text-right shrink-0 pr-2';
    headerRowWrapper.appendChild(headerEmptyBox);

    const headerBtnGrid = document.createElement('div');
    headerBtnGrid.className = 'flex items-center gap-2';

    CIRCLE_OF_FIFTHS.forEach(root => {
        const headerBox = document.createElement('div');
        headerBox.className = 'w-[42px] h-[42px] flex items-center justify-center font-mono font-bold text-xs text-amber-950 bg-amber-100/80 border border-chassisDark rounded-lg shadow-inner';
        headerBox.textContent = root.name;
        headerBtnGrid.appendChild(headerBox);
    });

    headerRowWrapper.appendChild(headerBtnGrid);
    container.appendChild(headerRowWrapper);

    // 2. Genera le 5 righe della matrice di accordi
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
                if (audio.audioActive) {
                    audio.init();
                }
                selectChord(root, row);
                audio.strumChord(currentStrumNotes);
            };

            btn.addEventListener('pointerdown', handlePress);
            btnGrid.appendChild(btn);
        });

        rowWrapper.appendChild(btnGrid);
        container.appendChild(rowWrapper);
    });

    document.getElementById('lbl-active-chord').textContent = 'None';
}

function initGenresAndStylesUI() {
    const genreSelect = document.getElementById('select-genre');
    const styleSelect = document.getElementById('select-style');
    const progressionLabel = document.getElementById('lbl-progression');

    if (!genreSelect || !styleSelect || !progressionLabel) return;

    Object.keys(GENRES_DATA).forEach(genre => {
        const opt = document.createElement('option');
        opt.value = genre;
        opt.textContent = genre;
        genreSelect.appendChild(opt);
    });

    genreSelect.addEventListener('change', (e) => {
        const selectedGenre = e.target.value;
        resetProgressionState();

        styleSelect.innerHTML = '<option value="">-- Select Style --</option>';
        progressionLabel.textContent = 'Select a style';

        if (selectedGenre && GENRES_DATA[selectedGenre]) {
            styleSelect.disabled = false;
            const stylesObj = GENRES_DATA[selectedGenre];
            
            Object.keys(stylesObj).forEach(styleName => {
                const opt = document.createElement('option');
                opt.value = styleName;
                opt.textContent = styleName;
                styleSelect.appendChild(opt);
            });
        } else {
            styleSelect.disabled = true;
            styleSelect.innerHTML = '<option value="">-- Select a Genre First --</option>';
            progressionLabel.textContent = 'Select a genre and style';
        }
    });

    styleSelect.addEventListener('change', (e) => {
        const selectedGenre = genreSelect.value;
        const selectedStyle = e.target.value;
        resetProgressionState();

        if (selectedGenre && selectedStyle && GENRES_DATA[selectedGenre][selectedStyle]) {
            progressionLabel.textContent = GENRES_DATA[selectedGenre][selectedStyle];
        } else {
            progressionLabel.textContent = 'Select a style';
        }
    });
}

// DOM Initialization
window.addEventListener('DOMContentLoaded', () => {
    createMatrixUI();
    initGenresAndStylesUI();

    const adsrRenderer = new AdsrCanvasRenderer(document.getElementById('adsr-canvas'));

    const audioToggle = document.getElementById('toggle-audio');
    const audioStateLbl = document.getElementById('lbl-audio-state');
    const powerLed = document.getElementById('power-led');
    
    // Performance Toggles
    const droneToggle = document.getElementById('toggle-drone');
    const strumToggle = document.getElementById('toggle-strum');
    const arpToggle = document.getElementById('toggle-arp');
    const sliderSpeed = document.getElementById('slider-speed');
    const lblSpeed = document.getElementById('lbl-speed');

    function updateSpeedLimits() {
        if (arpToggle.checked) {
            sliderSpeed.min = "100";
            sliderSpeed.max = "500";
            if (parseInt(sliderSpeed.value) < 100) sliderSpeed.value = "200";
        } else {
            sliderSpeed.min = "10";
            sliderSpeed.max = "80";
            if (parseInt(sliderSpeed.value) > 80) sliderSpeed.value = "35";
        }
        lblSpeed.textContent = `${sliderSpeed.value} ms`;
        audio.setSpeedDelay(parseInt(sliderSpeed.value));
    }

    droneToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        if (enabled) {
            strumToggle.checked = false;
            arpToggle.checked = false;
        }
        audio.setDroneMode(enabled);
        updateSpeedLimits();
    });

    strumToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        if (enabled) {
            droneToggle.checked = false;
            arpToggle.checked = false;
            audio.setDroneMode(false);
        }
        audio.setStrumMode(enabled);
        updateSpeedLimits();
    });

    arpToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        if (enabled) {
            droneToggle.checked = false;
            strumToggle.checked = false;
            audio.setDroneMode(false);
        }
        audio.setArpMode(enabled);
        updateSpeedLimits();
    });

    sliderSpeed.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        lblSpeed.textContent = `${val} ms`;
        audio.setSpeedDelay(val);
    });

    // ADSR Sliders Elements
    const slAttack = document.getElementById('slider-attack');
    const slDecay = document.getElementById('slider-decay');
    const slSustain = document.getElementById('slider-sustain');
    const slRelease = document.getElementById('slider-release');

    const lblAttack = document.getElementById('lbl-attack');
    const lblDecay = document.getElementById('lbl-decay');
    const lblSustain = document.getElementById('lbl-sustain');
    const lblRelease = document.getElementById('lbl-release');

    function updateAdsr() {
        const a = parseFloat(slAttack.value);
        const d = parseFloat(slDecay.value);
        const s = parseFloat(slSustain.value);
        const r = parseFloat(slRelease.value);

        lblAttack.textContent = `${a.toFixed(2)}s`;
        lblDecay.textContent = `${d.toFixed(2)}s`;
        lblSustain.textContent = `${Math.round(s * 100)}%`;
        lblRelease.textContent = `${r.toFixed(2)}s`;

        audio.setAdsr(a, d, s, r);
        adsrRenderer.draw(a, d, s, r);
    }

    slAttack.addEventListener('input', updateAdsr);
    slDecay.addEventListener('input', updateAdsr);
    slSustain.addEventListener('input', updateAdsr);
    slRelease.addEventListener('input', updateAdsr);

    // Waveform Radio Buttons
    document.querySelectorAll('input[name="waveform"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            audio.setWaveform(e.target.value);
        });
    });

    // Filter Controls
    const sliderCutoff = document.getElementById('slider-cutoff');
    const sliderResonance = document.getElementById('slider-resonance');
    const lblCutoff = document.getElementById('lbl-cutoff');
    const lblResonance = document.getElementById('lbl-resonance');

    function updateFilters() {
        const checkedRadio = document.querySelector('input[name="filter-type"]:checked');
        const filterType = checkedRadio ? checkedRadio.value : 'lowpass';
        const cutoff = parseFloat(sliderCutoff.value);
        const resonance = parseFloat(sliderResonance.value);

        lblCutoff.textContent = `${cutoff} Hz`;
        lblResonance.textContent = resonance.toFixed(1);

        audio.setFilter(filterType, cutoff, resonance);
    }

    document.querySelectorAll('input[name="filter-type"]').forEach(radio => radio.addEventListener('change', updateFilters));
    sliderCutoff.addEventListener('input', updateFilters);
    sliderResonance.addEventListener('input', updateFilters);

    // LFO Controls
    const sliderLfoRate = document.getElementById('slider-lfo-rate');
    const sliderLfoDepth = document.getElementById('slider-lfo-depth');
    const toggleVibrato = document.getElementById('toggle-vibrato');
    const toggleTremolo = document.getElementById('toggle-tremolo');
    const lblLfoRate = document.getElementById('lbl-lfo-rate');
    const lblLfoDepth = document.getElementById('lbl-lfo-depth');

    function updateLfo() {
        const rate = parseFloat(sliderLfoRate.value);
        const depth = parseFloat(sliderLfoDepth.value);
        const vibrato = toggleVibrato.checked;
        const tremolo = toggleTremolo.checked;

        lblLfoRate.textContent = `${rate.toFixed(1)} Hz`;
        lblLfoDepth.textContent = `${Math.round(depth)}%`;

        audio.setLfo(rate, depth, vibrato, tremolo);
    }

    sliderLfoRate.addEventListener('input', updateLfo);
    sliderLfoDepth.addEventListener('input', updateLfo);
    toggleVibrato.addEventListener('change', updateLfo);
    toggleTremolo.addEventListener('change', updateLfo);

    // Function to load a Preset and sync all Controls & Audio Engine
    function loadPreset(presetKey) {
        const preset = SYNTH_PRESETS[presetKey];
        if (!preset) return;

        // Waveform
        const waveRadio = document.querySelector(`input[name="waveform"][value="${preset.waveform}"]`);
        if (waveRadio) waveRadio.checked = true;
        audio.setWaveform(preset.waveform);

        // Filter
        const filterRadio = document.querySelector(`input[name="filter-type"][value="${preset.filterType}"]`);
        if (filterRadio) filterRadio.checked = true;
        sliderCutoff.value = preset.cutoff;
        sliderResonance.value = preset.resonance;
        updateFilters();

        // ADSR
        slAttack.value = preset.attack;
        slDecay.value = preset.decay;
        slSustain.value = preset.sustain;
        slRelease.value = preset.release;
        updateAdsr();

        // LFO
        sliderLfoRate.value = preset.lfoRate;
        sliderLfoDepth.value = preset.lfoDepth;
        toggleVibrato.checked = preset.vibrato;
        toggleTremolo.checked = preset.tremolo;
        updateLfo();

        // Octave Offset
        audio.setOctaveOffset(preset.octaveOffset || 0);

        // Visual Selection Highlight
        const presetButtons = document.querySelectorAll('.preset-btn');
        presetButtons.forEach(btn => {
            if (btn.dataset.preset === presetKey) {
                btn.classList.add('active-preset');
            } else {
                btn.classList.remove('active-preset');
            }
        });
    }

    // Attach click events to Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.preset;
            loadPreset(key);
        });
    });

    // Default Load PIANO Preset on Startup
    loadPreset('PIANO');

    // Audio Power Switch
    audioToggle.checked = false;

    audioToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        audio.setAudioState(isEnabled);

        if (isEnabled) {
            audioStateLbl.textContent = "Audio ON";
            powerLed.classList.replace('bg-red-600', 'bg-emerald-500');
            powerLed.classList.replace('shadow-[0_0_8px_#dc2626]', 'shadow-[0_0_10px_#10b981]');
        } else {
            audioStateLbl.textContent = "Audio OFF";
            powerLed.classList.replace('bg-emerald-500', 'bg-red-600');
            powerLed.classList.replace('shadow-[0_0_10px_#10b981]', 'shadow-[0_0_8px_#dc2626]');
        }
    });

    // Master Volume Vertical Slider
    document.getElementById('slider-volume').addEventListener('input', (e) => {
        audio.setVolume(parseFloat(e.target.value));
        document.getElementById('lbl-volume').textContent = `${e.target.value}%`;
    });
});

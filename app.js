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
const CHROMATIC_SCALE = [
    'C', 'Db', 'D', 'Eb', 'E', 'F',
    'F#', 'G', 'Ab', 'A', 'Bb', 'B'
];

// 7 Matrix Rows (Inclusi Diminished e Diminished 7th)
const MATRIX_ROWS = [
    {
        id: 'maj',
        label: 'Major',
        intervals: [0, 4, 7],
        suffix: '',
        btnClass: 'row-maj',
        badgeStyle: 'bg-amber-200 text-amber-950 border-amber-300'
    },
    {
        id: 'min',
        label: 'Minor',
        intervals: [0, 3, 7],
        suffix: 'm',
        btnClass: 'row-min',
        badgeStyle: 'bg-sky-200 text-sky-950 border-sky-300'
    },
    {
        id: '7',
        label: 'Dominant 7th',
        intervals: [0, 4, 7, 10],
        suffix: '7',
        btnClass: 'row-7',
        badgeStyle: 'bg-rose-200 text-rose-950 border-rose-300'
    },
    {
        id: 'maj7',
        label: 'Major 7th',
        intervals: [0, 4, 7, 11],
        suffix: 'maj7',
        btnClass: 'row-maj7',
        badgeStyle: 'bg-emerald-200 text-emerald-950 border-emerald-300'
    },
    {
        id: 'm7',
        label: 'Minor 7th',
        intervals: [0, 3, 7, 10],
        suffix: 'm7',
        btnClass: 'row-m7',
        badgeStyle: 'bg-purple-200 text-purple-950 border-purple-300'
    },
    {
        id: 'dim',
        label: 'Diminished',
        intervals: [0, 3, 6],
        suffix: 'dim',
        btnClass: 'row-dim',
        badgeStyle: 'bg-stone-200 text-stone-900 border-stone-300'
    },
    {
        id: 'dim7',
        label: 'Diminished 7th',
        intervals: [0, 3, 6, 9],
        suffix: 'dim7',
        btnClass: 'row-dim7',
        badgeStyle: 'bg-slate-200 text-slate-900 border-slate-300'
    }
];

// Genres & Styles Table
const GENRES_DATA = {
    "Classical & Traditional": {
        "Circle Progression": "I - vi (I / IV) - ii (IV) - V (bVII)",
        "Simple Cadence": "I - IV (ii) - V (bVII) - I (vi)",
        "Pachelbel": "I - V (iii) - vi (I) - iii (V) - IV (ii) - I (vi) - IV (ii) - V (bVII)",
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
        "Twelve-Bar Country": "I7 - I7 (IV7) - IV7 (I7) - IV7 - I7 (vi7) - I7 - V7 (IV7) - IV7 (ii7) - I7 - V7 (bVII7)",
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

// Global State
const audio = new WebAudioEngine();
let selectedChordName = null;
let currentStrumNotes = calculateNotes(
    CIRCLE_OF_FIFTHS[0].midi,
    MATRIX_ROWS[0].intervals
);

let activeProgressionSteps = [];
let currentProgressionStepIndex = -1;
let currentKeyRoot = null;

// ============================================================
// SMOOTH VOICE LEADING
// ============================================================

let smoothVoicingEnabled = false;
let previousVoicing = null;

function calculateSmoothVoicing(rootMidi, intervals, previousNotes) {
    const baseNotes = intervals
        .map(interval => rootMidi + interval)
        .sort((a, b) => a - b);

    if (!previousNotes || previousNotes.length !== baseNotes.length) {
        return baseNotes;
    }

    const candidates = [];
    const voiceCount = baseNotes.length;

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
                const movement = Math.abs(
                    candidate[i] - previousNotes[i]
                );

                totalMovement += movement;

                if (movement === 0) {
                    stationaryVoices++;
                }
            }

            const span =
                candidate[voiceCount - 1] -
                candidate[0];

            const bassMovement =
                Math.abs(
                    candidate[0] -
                    previousNotes[0]
                );

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
        if (a.totalMovement !== b.totalMovement) {
            return a.totalMovement - b.totalMovement;
        }

        if (a.stationaryVoices !== b.stationaryVoices) {
            return b.stationaryVoices - a.stationaryVoices;
        }

        if (a.span !== b.span) {
            return a.span - b.span;
        }

        return a.bassMovement - b.bassMovement;
    });

    return candidates[0].notes;
}

function calculateNotes(rootMidi, intervals) {
    const notes = [];

    for (let octave = -1; octave <= 2; octave++) {
        for (let interval of intervals) {
            notes.push(
                rootMidi +
                interval +
                (octave * 12)
            );
        }
    }

    return notes.sort((a, b) => a - b);
}

function selectChord(rootObj, rowObj) {
    selectedChordName =
        `${rootObj.name}${rowObj.suffix}`;

    if (smoothVoicingEnabled) {
        currentStrumNotes =
            calculateSmoothVoicing(
                rootObj.midi,
                rowObj.intervals,
                previousVoicing
            );

        previousVoicing =
            [...currentStrumNotes];
    } else {
        currentStrumNotes =
            calculateNotes(
                rootObj.midi,
                rowObj.intervals
            );
    }

    document.getElementById(
        'lbl-active-chord'
    ).textContent =
        selectedChordName;

    const allBtns =
        document.querySelectorAll(
            '.matrix-btn'
        );

    allBtns.forEach(btn => {
        if (
            btn.dataset.chord ===
            selectedChordName
        ) {
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
    'II': 2,
    'III': 4,
    'IV': 5,
    'V': 7,
    'VI': 9,
    'VII': 11
};

function parseDegreeToChord(token, keyRootMidi) {
    if (!token) return null;

    let cleanToken = token.trim();

    const match = cleanToken.match(
        /^([b#]?)([ivIV]+)(maj7|m7|7|dim7|dim)?$/
    );

    if (!match) return null;

    const accidental = match[1];
    const roman = match[2];
    const quality = match[3] || '';

    const upperRoman = roman.toUpperCase();

    if (!ROMAN_SEMITONES.hasOwnProperty(upperRoman)) {
        return null;
    }

    let midi =
        keyRootMidi +
        ROMAN_SEMITONES[upperRoman];

    if (accidental === 'b') {
        midi -= 1;
    } else if (accidental === '#') {
        midi += 1;
    }

    const rootPitchClass =
        ((midi % 12) + 12) % 12;

    const rootName =
        CHROMATIC_SCALE[rootPitchClass];

    let suffix = '';

    if (quality) {
        suffix = quality;
    } else if (roman === roman.toLowerCase()) {
        suffix = 'm';
    }

    const rowObj =
        MATRIX_ROWS.find(
            row => row.suffix === suffix
        );

    if (!rowObj) return null;

    return {
        rootName,
        rootMidi: midi,
        suffix,
        rowObj,
        chordName: `${rootName}${suffix}`
    };
}

function parseProgressionPattern(pattern) {
    if (!pattern) return [];

    return pattern
        .split('-')
        .map(part => {
            const cleanPart =
                part
                    .trim()
                    .replace(/\([^)]*\)/g, '')
                    .trim();

            return cleanPart;
        })
        .filter(Boolean);
}

function deduceKeyFromFirstStep(pattern) {
    if (!pattern) return null;

    const match = pattern.match(
        /^([b#]?)([ivIV]+)/
    );

    if (!match) return null;

    const accidental = match[1];
    const roman = match[2].toUpperCase();

    if (!ROMAN_SEMITONES.hasOwnProperty(roman)) {
        return null;
    }

    const offset =
        ROMAN_SEMITONES[roman];

    let midi =
        60 - offset;

    if (accidental === 'b') {
        midi += 1;
    } else if (accidental === '#') {
        midi -= 1;
    }

    return midi;
}

function handleProgressionStep(
    chordName,
    rootObj,
    rowObj
) {
    if (
        !activeProgressionSteps ||
        activeProgressionSteps.length === 0
    ) {
        return;
    }

    const clickedIndex =
        activeProgressionSteps.findIndex(
            step =>
                step.chordName === chordName
        );

    if (clickedIndex === -1) {
        return;
    }

    if (
        clickedIndex ===
        currentProgressionStepIndex + 1
    ) {
        currentProgressionStepIndex =
            clickedIndex;

        highlightNextStepOptions();

        updateProgressionChordsDisplay();
    }
}

function highlightNextStepOptions() {
    const nextIndex =
        currentProgressionStepIndex + 1;

    document
        .querySelectorAll('.matrix-btn')
        .forEach(btn => {
            btn.classList.remove(
                'progression-next'
            );
        });

    if (
        nextIndex < 0 ||
        nextIndex >= activeProgressionSteps.length
    ) {
        return;
    }

    const nextStep =
        activeProgressionSteps[nextIndex];

    if (!nextStep) return;

    const nextChordName =
        nextStep.chordName;

    document
        .querySelectorAll('.matrix-btn')
        .forEach(btn => {
            if (
                btn.dataset.chord ===
                nextChordName
            ) {
                btn.classList.add(
                    'progression-next'
                );
            }
        });
}

function updateProgressionChordsDisplay() {
    const container =
        document.getElementById(
            'progression-chords'
        );

    if (!container) return;

    container.innerHTML = '';

    activeProgressionSteps.forEach(
        (step, index) => {
            const span =
                document.createElement('span');

            span.className =
                'progression-chord';

            if (
                index ===
                currentProgressionStepIndex
            ) {
                span.classList.add('current');
            }

            if (
                index <
                currentProgressionStepIndex
            ) {
                span.classList.add('played');
            }

            span.textContent =
                step.chordName;

            container.appendChild(span);

            if (
                index <
                activeProgressionSteps.length - 1
            ) {
                const separator =
                    document.createElement('span');

                separator.className =
                    'progression-separator';

                separator.textContent = '–';

                container.appendChild(
                    separator
                );
            }
        }
    );
}

function resetProgressionState() {
    activeProgressionSteps = [];
    currentProgressionStepIndex = -1;
    currentKeyRoot = null;

    const container =
        document.getElementById(
            'progression-chords'
        );

    if (container) {
        container.innerHTML = '';
    }

    document
        .querySelectorAll('.matrix-btn')
        .forEach(btn => {
            btn.classList.remove(
                'progression-next'
            );
        });
}

// ============================================================
// MATRIX UI
// ============================================================

function createMatrixUI() {
    const container =
        document.getElementById(
            'chord-matrix'
        );

    if (!container) return;

    container.innerHTML = '';

    MATRIX_ROWS.forEach(row => {
        const rowContainer =
            document.createElement('div');

        rowContainer.className =
            'matrix-row';

        const label =
            document.createElement('div');

        label.className =
            'matrix-row-label';

        label.textContent =
            row.label;

        rowContainer.appendChild(label);

        const btnGrid =
            document.createElement('div');

        btnGrid.className =
            'matrix-btn-grid';

        CIRCLE_OF_FIFTHS.forEach(root => {
            const btn =
                document.createElement('button');

            btn.type = 'button';
            btn.className =
                `matrix-btn ${row.btnClass}`;

            const chordName =
                `${root.name}${row.suffix}`;

            btn.dataset.chord =
                chordName;

            btn.dataset.root =
                root.name;

            btn.dataset.row =
                row.id;

            btn.innerHTML = `
                <span class="btn-chord-name">
                    ${chordName}
                </span>
            `;

            const led =
                document.createElement('span');

            led.className =
                'btn-led';

            btn.appendChild(led);

            const handlePress = (e) => {
                e.preventDefault();

                if (audio.audioActive) {
                    audio.init();
                }

                selectChord(
                    root,
                    row
                );

                audio.strumChord(
                    currentStrumNotes
                );
            };

            btn.addEventListener(
                'pointerdown',
                handlePress
            );

            btnGrid.appendChild(btn);
        });

        rowContainer.appendChild(
            btnGrid
        );

        container.appendChild(
            rowContainer
        );
    });

    document.getElementById(
        'lbl-active-chord'
    ).textContent = 'None';
}

// ============================================================
// GENRES & STYLES UI
// ============================================================

function initGenresAndStylesUI() {
    const genreSelect =
        document.getElementById(
            'select-genre'
        );

    const styleSelect =
        document.getElementById(
            'select-style'
        );

    const progressionLabel =
        document.getElementById(
            'lbl-progression'
        );

    if (
        !genreSelect ||
        !styleSelect ||
        !progressionLabel
    ) {
        return;
    }

    Object.keys(GENRES_DATA).forEach(
        genre => {
            const opt =
                document.createElement(
                    'option'
                );

            opt.value = genre;
            opt.textContent = genre;

            genreSelect.appendChild(opt);
        }
    );

    genreSelect.addEventListener(
        'change',
        (e) => {
            const selectedGenre =
                e.target.value;

            resetProgressionState();

            styleSelect.innerHTML =
                '<option value="">-- Select Style --</option>';

            progressionLabel.textContent =
                'Select a style';

            if (
                selectedGenre &&
                GENRES_DATA[selectedGenre]
            ) {
                styleSelect.disabled =
                    false;

                const stylesObj =
                    GENRES_DATA[
                        selectedGenre
                    ];

                Object.keys(stylesObj)
                    .forEach(styleName => {
                        const opt =
                            document.createElement(
                                'option'
                            );

                        opt.value =
                            styleName;

                        opt.textContent =
                            styleName;

                        styleSelect.appendChild(
                            opt
                        );
                    });
            } else {
                styleSelect.disabled =
                    true;

                styleSelect.innerHTML =
                    '<option value="">-- Select a Genre First --</option>';

                progressionLabel.textContent =
                    'Select a genre and style';
            }
        }
    );

    styleSelect.addEventListener(
        'change',
        (e) => {
            const selectedGenre =
                genreSelect.value;

            const selectedStyle =
                e.target.value;

            resetProgressionState();

            if (
                selectedGenre &&
                selectedStyle &&
                GENRES_DATA[selectedGenre][
                    selectedStyle
                ]
            ) {
                const pattern =
                    GENRES_DATA[
                        selectedGenre
                    ][selectedStyle];

                progressionLabel.textContent =
                    pattern;

                currentKeyRoot =
                    deduceKeyFromFirstStep(
                        pattern
                    );

                const tokens =
                    parseProgressionPattern(
                        pattern
                    );

                activeProgressionSteps =
                    tokens
                        .map(token =>
                            parseDegreeToChord(
                                token,
                                currentKeyRoot
                            )
                        )
                        .filter(Boolean)
                        .map(chord => ({
                            chordName:
                                chord.chordName,
                            rootName:
                                chord.rootName,
                            rootMidi:
                                chord.rootMidi,
                            rowObj:
                                chord.rowObj
                        }));

                highlightNextStepOptions();
                updateProgressionChordsDisplay();
            } else {
                progressionLabel.textContent =
                    'Select a style';
            }
        }
    );
}
// ============================================================
// DOM INITIALIZATION
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
    createMatrixUI();
    initGenresAndStylesUI();

    const adsrRenderer =
        new AdsrCanvasRenderer(
            document.getElementById(
                'adsr-canvas'
            )
        );

    const audioToggle =
        document.getElementById(
            'toggle-audio'
        );

    const audioStateLbl =
        document.getElementById(
            'lbl-audio-state'
        );

    const powerLed =
        document.getElementById(
            'power-led'
        );

    // Smooth Voice Leading Toggle
    const smoothVoicingToggle =
        document.getElementById(
            'toggle-smooth-voicing'
        );

    if (smoothVoicingToggle) {
        smoothVoicingToggle.checked = false;

        smoothVoicingToggle.addEventListener(
            'change',
            (e) => {
                smoothVoicingEnabled =
                    e.target.checked;

                // Start a fresh voice-leading
                // chain when the mode changes.
                previousVoicing = null;
            }
        );
    }

    // ========================================================
    // PERFORMANCE TOGGLES
    // ========================================================

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

    if (strumToggle) {
        strumToggle.addEventListener(
            'change',
            e => {
                audio.strumMode =
                    e.target.checked;

                if (
                    e.target.checked &&
                    arpToggle
                ) {
                    arpToggle.checked =
                        false;

                    audio.arpMode =
                        false;
                }
            }
        );
    }

    if (arpToggle) {
        arpToggle.addEventListener(
            'change',
            e => {
                audio.arpMode =
                    e.target.checked;

                if (
                    e.target.checked &&
                    strumToggle
                ) {
                    strumToggle.checked =
                        false;

                    audio.strumMode =
                        false;
                }
            }
        );
    }

    if (droneToggle) {
        droneToggle.addEventListener(
            'change',
            e => {
                audio.droneMode =
                    e.target.checked;
            }
        );
    }

    // ========================================================
    // STRUM / ARPEGGIO SPEED
    // ========================================================

    const speedControl =
        document.getElementById(
            'control-speed'
        );

    const speedValue =
        document.getElementById(
            'value-speed'
        );

    if (speedControl) {
        speedControl.addEventListener(
            'input',
            e => {
                const value =
                    Number(e.target.value);

                audio.speedDelayMs =
                    value;

                if (speedValue) {
                    speedValue.textContent =
                        `${value} ms`;
                }
            }
        );
    }

    // ========================================================
    // MASTER VOLUME
    // ========================================================

    const masterVolume =
        document.getElementById(
            'control-master-volume'
        );

    const masterVolumeValue =
        document.getElementById(
            'value-master-volume'
        );

    if (masterVolume) {
        masterVolume.addEventListener(
            'input',
            e => {
                const value =
                    Number(e.target.value);

                audio.setMasterVolume(
                    value
                );

                if (masterVolumeValue) {
                    masterVolumeValue.textContent =
                        `${value}%`;
                }
            }
        );
    }

    // ========================================================
    // WAVEFORM
    // ========================================================

    const waveformControl =
        document.getElementById(
            'select-waveform'
        );

    if (waveformControl) {
        waveformControl.addEventListener(
            'change',
            e => {
                audio.waveform =
                    e.target.value;
            }
        );
    }

    // ========================================================
    // FILTER TYPE
    // ========================================================

    const filterTypeControl =
        document.getElementById(
            'select-filter-type'
        );

    if (filterTypeControl) {
        filterTypeControl.addEventListener(
            'change',
            e => {
                audio.filterType =
                    e.target.value;
            }
        );
    }

    // ========================================================
    // FILTER CUTOFF
    // ========================================================

    const cutoffControl =
        document.getElementById(
            'control-cutoff'
        );

    const cutoffValue =
        document.getElementById(
            'value-cutoff'
        );

    if (cutoffControl) {
        cutoffControl.addEventListener(
            'input',
            e => {
                const value =
                    Number(e.target.value);

                audio.cutoff =
                    value;

                if (cutoffValue) {
                    cutoffValue.textContent =
                        `${value} Hz`;
                }
            }
        );
    }

    // ========================================================
    // FILTER RESONANCE
    // ========================================================

    const resonanceControl =
        document.getElementById(
            'control-resonance'
        );

    const resonanceValue =
        document.getElementById(
            'value-resonance'
        );

    if (resonanceControl) {
        resonanceControl.addEventListener(
            'input',
            e => {
                const value =
                    Number(e.target.value);

                audio.resonance =
                    value;

                if (resonanceValue) {
                    resonanceValue.textContent =
                        value.toFixed(1);
                }
            }
        );
    }

    // ========================================================
    // ADSR
    // ========================================================

    const attackControl =
        document.getElementById(
            'control-attack'
        );

    const decayControl =
        document.getElementById(
            'control-decay'
        );

    const sustainControl =
        document.getElementById(
            'control-sustain'
        );

    const releaseControl =
        document.getElementById(
            'control-release'
        );

    const attackValue =
        document.getElementById(
            'value-attack'
        );

    const decayValue =
        document.getElementById(
            'value-decay'
        );

    const sustainValue =
        document.getElementById(
            'value-sustain'
        );

    const releaseValue =
        document.getElementById(
            'value-release'
        );

    if (attackControl) {
        attackControl.addEventListener(
            'input',
            e => {
                const value =
                    Number(e.target.value);

                audio.attack =
                    value;

                if (attackValue) {
                    attackValue.textContent =
                        `${value.toFixed(2)} s`;
                }

                adsrRenderer.update(
                    audio.attack,
                    audio.decay,
                    audio.sustain,
                    audio.release
                );
            }
        );
    }

    if (decayControl) {
        decayControl.addEventListener(
            'input',
            e => {
                const value =
                    Number(e.target.value);

                audio.decay =
                    value;

                if (decayValue) {
                    decayValue.textContent =
                        `${value.toFixed(2)} s`;
                }

                adsrRenderer.update(
                    audio.attack,
                    audio.decay,
                    audio.sustain,
                    audio.release
                );
            }
        );
    }

    if (sustainControl) {
        sustainControl.addEventListener(
            'input',
            e => {
                const value =
                    Number(e.target.value);

                audio.sustain =
                    value;

                if (sustainValue) {
                    sustainValue.textContent =
                        `${Math.round(value * 100)}%`;
                }

                adsrRenderer.update(
                    audio.attack,
                    audio.decay,
                    audio.sustain,
                    audio.release
                );
            }
        );
    }

    if (releaseControl) {
        releaseControl.addEventListener(
            'input',
            e => {
                const value =
                    Number(e.target.value);

                audio.release =
                    value;

                if (releaseValue) {
                    releaseValue.textContent =
                        `${value.toFixed(2)} s`;
                }

                adsrRenderer.update(
                    audio.attack,
                    audio.decay,
                    audio.sustain,
                    audio.release
                );
            }
        );
    }

    // ========================================================
    // LFO
    // ========================================================

    const lfoRateControl =
        document.getElementById(
            'control-lfo-rate'
        );

    const lfoDepthControl =
        document.getElementById(
            'control-lfo-depth'
        );

    const lfoRateValue =
        document.getElementById(
            'value-lfo-rate'
        );

    const lfoDepthValue =
        document.getElementById(
            'value-lfo-depth'
        );

    const vibratoToggle =
        document.getElementById(
            'toggle-vibrato'
        );

    const tremoloToggle =
        document.getElementById(
            'toggle-tremolo'
        );

    if (lfoRateControl) {
        lfoRateControl.addEventListener(
            'input',
            e => {
                const value =
                    Number(e.target.value);

                audio.lfoRate =
                    value;

                if (lfoRateValue) {
                    lfoRateValue.textContent =
                        `${value.toFixed(1)} Hz`;
                }
            }
        );
    }

    if (lfoDepthControl) {
        lfoDepthControl.addEventListener(
            'input',
            e => {
                const value =
                    Number(e.target.value);

                audio.lfoDepth =
                    value;

                if (lfoDepthValue) {
                    lfoDepthValue.textContent =
                        `${value}%`;
                }
            }
        );
    }

    if (vibratoToggle) {
        vibratoToggle.addEventListener(
            'change',
            e => {
                audio.vibrato =
                    e.target.checked;
            }
        );
    }

    if (tremoloToggle) {
        tremoloToggle.addEventListener(
            'change',
            e => {
                audio.tremolo =
                    e.target.checked;
            }
        );
    }

    // ========================================================
    // PRESETS
    // ========================================================

    const presetButtons =
        document.querySelectorAll(
            '[data-preset]'
        );

    presetButtons.forEach(button => {
        button.addEventListener(
            'click',
            () => {
                const presetName =
                    button.dataset.preset;

                if (
                    SYNTH_PRESETS[
                        presetName
                    ]
                ) {
                    audio.applyPreset(
                        SYNTH_PRESETS[
                            presetName
                        ]
                    );

                    presetButtons.forEach(
                        btn => {
                            btn.classList.remove(
                                'active'
                            );
                        }
                    );

                    button.classList.add(
                        'active'
                    );

                    updateControlsFromAudio(
                        audio,
                        adsrRenderer
                    );
                }
            }
        );
    });

    // ========================================================
    // AUDIO POWER
    // ========================================================

    if (audioToggle) {
        audioToggle.addEventListener(
            'change',
            async e => {
                if (e.target.checked) {
                    await audio.init();

                    audio.audioActive =
                        true;

                    if (audioStateLbl) {
                        audioStateLbl.textContent =
                            'ON';
                    }

                    if (powerLed) {
                        powerLed.classList.add(
                            'active'
                        );
                    }
                } else {
                    audio.audioActive =
                        false;

                    audio.stopAll();

                    if (audioStateLbl) {
                        audioStateLbl.textContent =
                            'OFF';
                    }

                    if (powerLed) {
                        powerLed.classList.remove(
                            'active'
                        );
                    }
                }
            }
        );
    }

    // ========================================================
    // INITIAL STATE
    // ========================================================

    const pianoPreset =
        SYNTH_PRESETS.PIANO;

    audio.applyPreset(
        pianoPreset
    );

    updateControlsFromAudio(
        audio,
        adsrRenderer
    );

    if (masterVolume) {
        const initialVolume =
            Number(masterVolume.value);

        audio.setMasterVolume(
            initialVolume
        );

        if (masterVolumeValue) {
            masterVolumeValue.textContent =
                `${initialVolume}%`;
        }
    }
});

// ============================================================
// UPDATE UI FROM SYNTH STATE
// ============================================================

function updateControlsFromAudio(
    synth,
    adsrRenderer
) {
    const waveformControl =
        document.getElementById(
            'select-waveform'
        );

    const filterTypeControl =
        document.getElementById(
            'select-filter-type'
        );

    const cutoffControl =
        document.getElementById(
            'control-cutoff'
        );

    const resonanceControl =
        document.getElementById(
            'control-resonance'
        );

    const attackControl =
        document.getElementById(
            'control-attack'
        );

    const decayControl =
        document.getElementById(
            'control-decay'
        );

    const sustainControl =
        document.getElementById(
            'control-sustain'
        );

    const releaseControl =
        document.getElementById(
            'control-release'
        );

    const lfoRateControl =
        document.getElementById(
            'control-lfo-rate'
        );

    const lfoDepthControl =
        document.getElementById(
            'control-lfo-depth'
        );

    const vibratoToggle =
        document.getElementById(
            'toggle-vibrato'
        );

    const tremoloToggle =
        document.getElementById(
            'toggle-tremolo'
        );

    if (waveformControl) {
        waveformControl.value =
            synth.waveform;
    }

    if (filterTypeControl) {
        filterTypeControl.value =
            synth.filterType;
    }

    if (cutoffControl) {
        cutoffControl.value =
            synth.cutoff;
    }

    if (resonanceControl) {
        resonanceControl.value =
            synth.resonance;
    }

    if (attackControl) {
        attackControl.value =
            synth.attack;
    }

    if (decayControl) {
        decayControl.value =
            synth.decay;
    }

    if (sustainControl) {
        sustainControl.value =
            synth.sustain;
    }

    if (releaseControl) {
        releaseControl.value =
            synth.release;
    }

    if (lfoRateControl) {
        lfoRateControl.value =
            synth.lfoRate;
    }

    if (lfoDepthControl) {
        lfoDepthControl.value =
            synth.lfoDepth;
    }

    if (vibratoToggle) {
        vibratoToggle.checked =
            synth.vibrato;
    }

    if (tremoloToggle) {
        tremoloToggle.checked =
            synth.tremolo;
    }

    const cutoffValue =
        document.getElementById(
            'value-cutoff'
        );

    const resonanceValue =
        document.getElementById(
            'value-resonance'
        );

    const attackValue =
        document.getElementById(
            'value-attack'
        );

    const decayValue =
        document.getElementById(
            'value-decay'
        );

    const sustainValue =
        document.getElementById(
            'value-sustain'
        );

    const releaseValue =
        document.getElementById(
            'value-release'
        );

    const lfoRateValue =
        document.getElementById(
            'value-lfo-rate'
        );

    const lfoDepthValue =
        document.getElementById(
            'value-lfo-depth'
        );

    if (cutoffValue) {
        cutoffValue.textContent =
            `${synth.cutoff} Hz`;
    }

    if (resonanceValue) {
        resonanceValue.textContent =
            synth.resonance.toFixed(1);
    }

    if (attackValue) {
        attackValue.textContent =
            `${synth.attack.toFixed(2)} s`;
    }

    if (decayValue) {
        decayValue.textContent =
            `${synth.decay.toFixed(2)} s`;
    }

    if (sustainValue) {
        sustainValue.textContent =
            `${Math.round(
                synth.sustain * 100
            )}%`;
    }

    if (releaseValue) {
        releaseValue.textContent =
            `${synth.release.toFixed(2)} s`;
    }

    if (lfoRateValue) {
        lfoRateValue.textContent =
            `${synth.lfoRate.toFixed(1)} Hz`;
    }

    if (lfoDepthValue) {
        lfoDepthValue.textContent =
            `${synth.lfoDepth}%`;
    }

    if (adsrRenderer) {
        adsrRenderer.update(
            synth.attack,
            synth.decay,
            synth.sustain,
            synth.release
        );
    }
}

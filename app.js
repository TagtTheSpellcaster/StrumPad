/**
 * Web Audio API Engine Class for StrumPad Synth & Organ Drone Voices
 */
class WebAudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.volume = 0.8;
        this.sustainTime = 1.2;
        this.cutoffFreq = 2200;
        this.initialized = false;
        this.audioActive = false; // Starts OFF by default
        this.droneMode = false;
        this.activeDroneNodes = [];
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
            if (this.ctx && this.ctx.state === 'running') {
                this.ctx.suspend();
            }
        } else {
            this.init();
        }
    }

    stopAll() {
        this.activeDroneNodes.forEach(item => {
            try {
                const now = this.ctx ? this.ctx.currentTime : 0;
                if (item.gain && now) {
                    item.gain.gain.linearRampToValueAtTime(0.0001, now + 0.08);
                }
                setTimeout(() => {
                    item.oscillators.forEach(osc => {
                        try { osc.stop(); osc.disconnect(); } catch (e) {}
                    });
                }, 100);
            } catch (e) {}
        });
        this.activeDroneNodes = [];
    }

    setVolume(val) {
        this.volume = val;
        if (this.masterGain && this.ctx && this.audioActive) {
            this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.05);
        }
    }

    setSustain(val) {
        this.sustainTime = val;
    }

    setCutoff(val) {
        this.cutoffFreq = val;
    }

    setDroneMode(enabled) {
        this.droneMode = enabled;
        if (!enabled) {
            this.stopAll();
        }
    }

    playNote(midiNote) {
        if (!this.audioActive || !this.ctx) return;

        const now = this.ctx.currentTime;
        const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

        if (this.droneMode) {
            // ORGAN DRONE SYNTHESIS
            const pipeHarmonics = [
                { mult: 0.5, type: 'sub-octave', vol: 0.25 },
                { mult: 1.0, type: 'fundamental', vol: 0.35 },
                { mult: 2.0, type: 'octave', vol: 0.18 },
                { mult: 3.0, type: 'fifth', vol: 0.08 },
                { mult: 4.0, type: 'super-octave', vol: 0.04 }
            ];

            const voiceGain = this.ctx.createGain();
            voiceGain.gain.setValueAtTime(0.0001, now);
            voiceGain.gain.linearRampToValueAtTime(0.3, now + 0.06);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(Math.min(this.cutoffFreq * 1.5, 7000), now);

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
            // RETRO SYNTH PLUCK VOICE
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();

            osc1.type = 'sawtooth';
            osc2.type = 'triangle';

            osc1.frequency.setValueAtTime(freq, now);
            osc2.frequency.setValueAtTime(freq * 1.002, now);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(this.cutoffFreq, now);
            filter.frequency.exponentialRampToValueAtTime(100, now + this.sustainTime);

            const voiceGain = this.ctx.createGain();
            voiceGain.gain.setValueAtTime(0.35, now);
            voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + this.sustainTime);

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(voiceGain);
            voiceGain.connect(this.masterGain);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + this.sustainTime);
            osc2.stop(now + this.sustainTime);
        }
    }

    strumChord(midiNotes) {
        if (!this.audioActive || !this.ctx) return;

        if (this.droneMode) {
            this.stopAll();
            const chordNotes = midiNotes.slice(0, 4);
            chordNotes.forEach(note => this.playNote(note));
        } else {
            const notes = midiNotes.slice(0, 5);
            notes.forEach((note, idx) => {
                setTimeout(() => {
                    this.playNote(note);
                }, idx * 35);
            });
        }
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

// Translated Genres, Styles & Progressions Table
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

// DOM Initialization
window.addEventListener('DOMContentLoaded', () => {
    createMatrixUI();
    initGenresAndStylesUI();
    const strumplate = new StrumplateController(document.getElementById('strum-canvas'));

    const audioToggle = document.getElementById('toggle-audio');
    const audioStateLbl = document.getElementById('lbl-audio-state');
    const powerLed = document.getElementById('power-led');
    const droneToggle = document.getElementById('toggle-drone');

    // Master Audio Switch Event (OFF by default)
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

    // Drone Mode Switch Event
    droneToggle.addEventListener('change', (e) => {
        audio.setDroneMode(e.target.checked);
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

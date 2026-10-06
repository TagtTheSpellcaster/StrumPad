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

    playNote(midiNote) {
        if (!this.initialized || !this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;
        const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

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

// Circolo delle Quinte partire da C (Do)
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

// Scala CROMATICA ordinata per semitoni dal C per calcolo intervalli
const CHROMATIC_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// 5 Righe della Matrice
const MATRIX_ROWS = [
    { id: 'maj',  label: 'Maggiore',          intervals: [0, 4, 7],     suffix: '',     btnClass: 'row-maj',  badgeStyle: 'bg-amber-200 text-amber-950 border-amber-300' },
    { id: 'min',  label: 'Minore',            intervals: [0, 3, 7],     suffix: 'm',    btnClass: 'row-min',  badgeStyle: 'bg-sky-200 text-sky-950 border-sky-300' },
    { id: '7',    label: 'Settima Dominante', intervals: [0, 4, 7, 10], suffix: '7',    btnClass: 'row-7',    badgeStyle: 'bg-rose-200 text-rose-950 border-rose-300' },
    { id: 'maj7', label: 'Settima Maggiore',  intervals: [0, 4, 7, 11], suffix: 'maj7', btnClass: 'row-maj7', badgeStyle: 'bg-emerald-200 text-emerald-950 border-emerald-300' },
    { id: 'm7',   label: 'Settima Minore',    intervals: [0, 3, 7, 10], suffix: 'm7',   btnClass: 'row-m7',   badgeStyle: 'bg-purple-200 text-purple-950 border-purple-300' }
];

// Tabella Dati Generi, Stili e Progressioni Armoniche
const GENRES_DATA = {
    "Musica Classica & Tradizionale": {
        "Giro di Do (Do Maggiore)": "I - vi (I / IV) - ii (IV) - V (bVII / viio)",
        "Cadenza Semplice / Plagale": "I - IV (ii) - V (bVII / viio) - I (vi)",
        "Progressione di Pachelbel": "I - V (iii) - vi (I) - iii (V) - IV (ii) - I (vi) - IV (ii) - V (bVII)"
    },
    "Jazz & Dixieland": {
        "Il \"ii - V - I\" (Maggiore)": "ii7 - V7 (bVII7 / VIIo7) - Imaj7 (vi7 / iii7)",
        "Il \"ii - V - I\" (Minore)": "iiø7 - V7alt (bVII7) - imin7 (bIIImaj7)",
        "Turnaround (Anatomia di Rythm)": "Imaj7 - vi7 (bIII7) - ii7 (IVmaj7) - V7 (bVII7)",
        "Dixieland / Ragtime Loop": "I - VI7 (bIII7) - II7 (bVI7) - V7 (bVII7)"
    },
    "Pop & Rock": {
        "Progressione Pop d'Oro": "I - V (bVII) - vi (I) - IV (ii)",
        "The \"50s Progression\"": "I - vi (I) - IV (ii) - V (bVII)",
        "Rock Epico / Mixolidio": "I - bVII (v) - IV (ii) - I (v)",
        "Andamento Andaluso (Flamenco/Rock)": "vi - V (bVII) - IV (bVI) - III (V7)"
    },
    "Country, Folk & Blues": {
        "Three-Chords Country": "I - IV (ii) - I (vi) - V (bVII)",
        "Blues Standard (12 Battute)": "I7 - IV7 (ii7) - I7 (vi7) - V7 (bVII7) - IV7 (ii7) - I7 (vi7) - V7 (bVII7)",
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
        "Montuno Standard": "i - bVII (v) - bVI (iiø) - V7 (bVII7)",
        "Salsa Clave Loop": "ii7 - V7 (bVII7) - Imaj7 (vi7) - VI7 (bIII7)"
    },
    "Altri Stili": {
        "Reggae Loop": "I - IV (ii)",
        "Bossa Nova / Nu-Jazz": "Imaj7 - bII7 (V7alt) - Imaj7 (vi7)",
        "R&B / Neo-Soul": "IVmaj7 - III7 (bVII7) - vi7 (Imaj7) - Vm7 (I7)"
    }
};

// Variabili di Stato Globali
const audio = new WebAudioEngine();
let selectedChordName = null;
let currentStrumNotes = calculateNotes(CIRCLE_OF_FIFTHS[0].midi, MATRIX_ROWS[0].intervals);

// Stato dell'assistente progressioni
let activeProgressionSteps = []; // Array di passi [{ main: 'C', sub: ['Am', 'F'] }, ...]
let currentProgressionStepIndex = -1; // -1 = in attesa del primo accordo
let currentKeyRoot = null; // Nota fondamentale della tonalità impostata dall'utente

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

    // Gestione della progressione armonica guidata
    handleProgressionStep(selectedChordName, rootObj, rowObj);
}

/**
 * LOGICA TRADUZIONE GRADI ROMANI IN ACCORDI REALI
 */
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

    // Normalizzazioni per accordi speciali (es. alt, ø, m)
    clean = clean.replace('alt', '').replace('ø', 'm').replace('imin', 'im');

    // Estrai la radice romana (es: "Imaj7" -> degree "I", suffix "maj7")
    const match = clean.match(/^(b[I|V|i|v]+|[I|V|i|v]+|viio|VIIo)/);
    if (!match) return null;

    const degreeToken = match[0];
    const rest = clean.slice(degreeToken.length);

    if (ROMAN_SEMITONES[degreeToken] === undefined) return null;

    const keyIndex = CHROMATIC_SCALE.indexOf(keyRootName);
    if (keyIndex === -1) return null;

    const targetSemitone = (keyIndex + ROMAN_SEMITONES[degreeToken]) % 12;
    const targetRoot = CHROMATIC_SCALE[targetSemitone];

    // Determina la qualità (Maiuscolo = Maggiore, Minuscolo = Minore)
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

/**
 * PARSER DELLA STRINGA DELLA PROGRESSIONE
 */
function parseProgressionPattern(patternStr, keyRootName) {
    if (!patternStr) return [];

    // Split per gli step principali tramite tiretto ' - '
    const rawSteps = patternStr.split(' - ');
    const compiledSteps = [];

    rawSteps.forEach(stepText => {
        // Separa eventuale parte principale e sostitutivi tra parentesi
        // Es: "I7 (v7)" oppure "vi (I / IV)" oppure "I"
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

/**
 * GESTORE LOGICA AVANZAMENTO PROGRESSIONE PASSO-PASSO
 */
function handleProgressionStep(chordName, rootObj, rowObj) {
    const genreSelect = document.getElementById('select-genre');
    const styleSelect = document.getElementById('select-style');

    if (!genreSelect.value || !styleSelect.value) return;

    const patternStr = GENRES_DATA[genreSelect.value][styleSelect.value];
    if (!patternStr) return;

    // STEP 1: Rilevazione Tonalità e Verifiche
    if (currentProgressionStepIndex === -1) {
        // Calcola progressione ipotetica con la nota premuta come Key
        const candidateSteps = parseProgressionPattern(patternStr, rootObj.name);
        if (!candidateSteps.length) return;

        const step1 = candidateSteps[0];
        
        // Verifica se l'accordo premuto è compatibile con il Step 1 principale o uno dei suoi sostituti
        const isMainMatch = (chordName === step1.main);
        const isSubMatch = step1.sub.includes(chordName);

        if (!isMainMatch && !isSubMatch) {
            // Non compatibile: riproduce suono normale ma rimane in attesa
            clearHighlights();
            return;
        }

        // Compatibile! Imposta tonalità base e avvia
        currentKeyRoot = rootObj.name;
        activeProgressionSteps = candidateSteps;
        currentProgressionStepIndex = 0; // Passo 1 completato

        updateProgressionChordsDisplay();
        highlightNextStepOptions(1); // Evidenzia lo STEP 2
        return;
    }

    // STEP 2, 3, N... Avanzamento della progressione
    const nextExpectedStepIndex = (currentProgressionStepIndex + 1) % activeProgressionSteps.length;
    const expectedStep = activeProgressionSteps[nextExpectedStepIndex];

    const isNextMain = (chordName === expectedStep.main);
    const isNextSub = expectedStep.sub.includes(chordName);

    if (isNextMain || isNextSub) {
        // L'utente ha premuto l'accordo suggerito! Avanza
        currentProgressionStepIndex = nextExpectedStepIndex;
        
        const nextStepIndexToHighlight = (currentProgressionStepIndex + 1) % activeProgressionSteps.length;
        highlightNextStepOptions(nextStepIndexToHighlight);
    } else {
        // Se l'utente preme un accordo fuori sequenza ma compatibile col primo passo della nuova tonalità
        const newCandidateSteps = parseProgressionPattern(patternStr, rootObj.name);
        if (newCandidateSteps.length && (chordName === newCandidateSteps[0].main || newCandidateSteps[0].sub.includes(chordName))) {
            currentKeyRoot = rootObj.name;
            activeProgressionSteps = newCandidateSteps;
            currentProgressionStepIndex = 0;
            updateProgressionChordsDisplay();
            highlightNextStepOptions(1);
        } else {
            // Accordo totalmente fuori sequenza: resetta il loop visivo
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

    // Evidenzia accordo principale (Alta luminosità)
    const mainBtn = document.querySelector(`.matrix-btn[data-chord="${stepInfo.main}"]`);
    if (mainBtn) mainBtn.classList.add('highlight-main');

    // Evidenzia accordi sostitutivi (Bassa luminosità)
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

    chordsLabel.textContent = `Accordi [${currentKeyRoot}]: ${formatted}`;
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

    document.getElementById('lbl-active-chord').textContent = 'Nessuno';
}

/**
 * Gestore Caselle Generi, Stili e Progressioni Armoniche
 */
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

        styleSelect.innerHTML = '<option value="">-- Seleziona Stile --</option>';
        progressionLabel.textContent = 'Seleziona uno stile';

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
            styleSelect.innerHTML = '<option value="">-- Seleziona Prima un Genere --</option>';
            progressionLabel.textContent = 'Seleziona un genere e uno stile';
        }
    });

    styleSelect.addEventListener('change', (e) => {
        const selectedGenre = genreSelect.value;
        const selectedStyle = e.target.value;
        resetProgressionState();

        if (selectedGenre && selectedStyle && GENRES_DATA[selectedGenre][selectedStyle]) {
            progressionLabel.textContent = GENRES_DATA[selectedGenre][selectedStyle];
        } else {
            progressionLabel.textContent = 'Seleziona uno stile';
        }
    });
}

/**
 * Controller Canvas Strumplate Interattivo
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

// Inizializzazione al caricamento DOM
window.addEventListener('DOMContentLoaded', () => {
    createMatrixUI();
    initGenresAndStylesUI();
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

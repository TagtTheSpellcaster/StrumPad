# StrumPad

[![Version](https://img.shields.io/badge/version-1.3.3-blue.svg)](https://github.com/TagtTheSpellcaster/StrumPad)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0.html)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-Native-8B5CF6.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-CDN-06B6D4.svg)](https://tailwindcss.com/)

**▶ [Launch StrumPad](https://tagtthespellcaster.github.io/StrumPad/)**

**StrumPad v1.3.3** is a browser-based, vintage-style **chord machine and analog-modeled synthesizer** designed for playing chords, exploring harmonic progressions, and experimenting with sound.

Its main purpose is harmonic exploration: select a musical style, choose a progression, establish the key by playing its first chord, and then follow the visual guidance provided by the **Harmonic Progression Assistant**.

StrumPad combines:

- an interactive **Circle of Fifths chord matrix**
- several performance modes and voice-leading optimization
- an analog-style synthesis engine with integrated octave transposition
- eight instrument presets
- a **Harmonic Progression Assistant**

The application is built entirely with browser technologies and generates sound in real time through the **Web Audio API**. No external audio samples are required.

---

## Features

### Interactive Chord Matrix

The main instrument is a chord matrix arranged according to the **Circle of Fifths**.

The twelve chord roots are presented in this order:

**C · G · D · A · E · B · F# · Db · Ab · Eb · Bb · F**

The matrix contains seven harmonic rows:

- Major
- Minor
- Dominant 7th
- Major 7th
- Minor 7th
- Diminished
- Diminished 7th

Clicking a button selects and plays the corresponding chord.

The currently selected chord is displayed in the **Selected Chord** indicator.

---

### Performance Modes & Voice Leading

StrumPad provides four performance toggles to control chord behavior and voice movement:

- **Drone Mode** — sustains the selected chord with an organ-like sound using additional harmonics.
- **Strum Mode** — plays the notes of a chord sequentially to simulate a guitar-style strum.
- **Arpeggiator** — plays chord notes sequentially in an ascending pattern.
- **Smooth Voice Leading** — dynamically calculates chord inversions to minimize total movement between consecutive voices, favoring common notes and compact spans.

When none of the rhythm/arpeggio modes is active, the chord is played as a simultaneous chord.

The **Strum / Arp Speed** control determines the delay between notes in Strum Mode and the Arpeggiator.

Only one main performance mode (Drone, Strum, or Arpeggio) can be active at a time, while **Smooth Voice Leading** can be combined with any mode.

#### Automatic Voice Leading Reset
When playing through a harmonic progression with **Smooth Voice Leading** enabled, StrumPad automatically anchors the first chord of a new cycle back to its original fundamental voicing as soon as the **Harmonic Progression Assistant** completes the sequence and restarts from step 1. This prevents cumulative octave drift over repeated cycles.

---

### Analog Synthesis Engine

StrumPad uses the **Web Audio API** for real-time sound generation.

The synthesis engine provides:

- Sawtooth, Square, Triangle, and Sine waveforms
- Low-pass and High-pass filters
- Adjustable Cutoff frequency
- Adjustable Resonance
- **Octave Transposition Slider** (-2, -1, 0, +1, +2 octaves)
- ADSR envelope
- LFO Rate and Depth
- Vibrato
- Tremolo
- Master Volume

The master volume uses a non-linear perceptual response rather than a simple linear amplitude scale.

---

### ADSR Envelope Generator

The synthesis engine includes four envelope parameters:

- **Attack**
- **Decay**
- **Sustain**
- **Release**

The current envelope is displayed graphically on a vintage CRT-style monitor.

Changing the ADSR controls updates the envelope and the sound engine in real time.

---

### Synth Presets

StrumPad includes eight predefined instrument-style presets:

- **PIANO**
- **GUITAR**
- **BASS**
- **ORGAN**
- **STRINGS**
- **BRASS**
- **PAD**
- **LEAD**

Selecting a preset automatically updates the synthesis parameters, envelope, filter settings, and octave offsets to match the selected instrument configuration.

---

# Harmonic Progression Assistant

The **Harmonic Progression Assistant** is the central feature of StrumPad.

It is designed to turn the chord matrix into an interactive harmonic guide rather than simply a collection of independent chords.

The assistant contains predefined harmonic progressions organized by musical genre and style.

Available categories include:

- Classical & Traditional
- Jazz & Dixieland
- Pop & Rock
- Country & Folk
- Blues
- Funk & Disco
- Heavy Metal & Hard Rock
- Gospel & Soul
- Latin & Salsa
- Other Styles

Each style contains a progression expressed using **Roman numeral notation**.

For example:

```text
Golden Pop
I - V (bVII) - vi (I) - IV (ii)

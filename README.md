# StrumPad

[![Version](https://img.shields.io/badge/version-1.1.2-blue.svg)](https://github.com/TagtTheSpellcaster/StrumPad)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0.html)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-Native-8B5CF6.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-CDN-06B6D4.svg)](https://tailwindcss.com/)

**▶ [Launch StrumPad](https://tagtthespellcaster.github.io/StrumPad/)**

**StrumPad v1.1.2** is a browser-based, vintage-style **chord machine and analog-modeled synthesizer** designed for playing chords, exploring harmonic progressions, and experimenting with sound.

Its main purpose is harmonic exploration: select a musical style, choose a progression, establish the key by playing its first chord, and then follow the visual guidance provided by the **Harmonic Progression Assistant**.

StrumPad combines:

- an interactive **Circle of Fifths chord matrix**
- several performance modes
- an analog-style synthesis engine
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

### Performance Modes

StrumPad provides three optional performance modes:

- **Drone Mode** — sustains the selected chord with an organ-like sound using additional harmonics.
- **Strum Mode** — plays the notes of a chord sequentially to simulate a guitar-style strum.
- **Arpeggiator** — plays chord notes sequentially in an ascending pattern.

When none of these modes is active, the chord is played normally as a simultaneous chord.

The **Strum / Arp Speed** control determines the delay between notes in Strum Mode and the Arpeggiator.

Only one performance mode can be active at a time.

---

### Analog Synthesis Engine

StrumPad uses the **Web Audio API** for real-time sound generation.

The synthesis engine provides:

- Sawtooth, Square, Triangle, and Sine waveforms
- Low-pass and High-pass filters
- Adjustable Cutoff frequency
- Adjustable Resonance
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

Selecting a preset automatically updates the synthesis parameters to the corresponding sound configuration.

The BASS preset also uses a dedicated octave offset.

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
```

or:

```text
Classic Jazz Cadence
ii7 - V7 (bVII7) - Imaj7 (vi7 / iii7)
```

Parentheses indicate alternative chord choices for a progression step.

---

## Using the Progression Assistant

The basic workflow is:

### 1. Select a Musical Genre

In the **Progression Assistant** panel, open the **Musical Genre** menu.

Choose a category such as:

```text
Jazz & Dixieland
```

---

### 2. Select a Style

Once a genre has been selected, the **Style** menu becomes available.

Choose the progression you want to explore.

For example:

```text
Classic Jazz Cadence
```

The selected progression is displayed in the **Harmonic Progression** area.

---

### 3. Read the Progression

The progression is expressed using Roman numerals relative to an implicit key.

For example:

```text
I - V (bVII) - vi (I) - IV (ii)
```

The actual chord names depend on the key in which the progression is played.

StrumPad does not require a separate key selector.

---

### 4. Play the First Chord

Play the chord corresponding to the **first step of the progression**.

The first chord establishes the tonal reference used by the assistant.

For example, if the progression begins with:

```text
I
```

and you press **C Major**, StrumPad establishes C as the tonic and calculates the remaining progression from C.

If a progression begins with another degree, such as:

```text
ii7
```

StrumPad uses the relationship between that chord and the Roman numeral to determine the underlying tonic.

This allows the same progression to be played in different keys without manually changing the key.

---

### 5. Follow the Highlights

Once the key has been established, StrumPad highlights the chords corresponding to the next progression step.

Two types of highlights are used:

- **Solid orange highlight** — primary progression choice.
- **Dashed blue highlight** — alternative progression choice.

For example:

```text
I - V (bVII) - vi (I) - IV (ii)
```

After playing `I`, the matrix highlights the chords corresponding to `V` and `bVII`.

You can then choose the primary chord or the alternative.

---

### 6. Continue Through the Progression

Press one of the highlighted chords.

StrumPad advances to the next step and updates the highlighted choices.

Continue following the highlighted chords until the progression is complete.

This allows the player to explore the harmonic structure while remaining free to choose between alternative chords.

---

## Progression Notation

StrumPad supports several forms of Roman numeral notation.

### Basic Degrees

```text
I      tonic major
ii     minor second degree
V      dominant
vi     minor sixth degree
```

### Altered Degrees

```text
bII
bVI
bVII
```

### Seventh Chords

```text
I7
ii7
V7
Imaj7
vi7
```

### Diminished Chords

```text
vii°
vii°7
```

The progression parser also recognizes:

```text
dim
dim7
```

as diminished chord notation.

### Alternative Chords

Parentheses indicate alternatives:

```text
V (bVII)
```

This means that the progression step can use either the primary `V` chord or the alternative `bVII`.

Multiple alternatives can also be specified:

```text
Imaj7 (vi7 / iii7)
```

---

# How the Sound Engine Works

StrumPad's audio engine is implemented in the `WebAudioEngine` JavaScript class.

### Chord Generation

Each matrix chord is defined by a root MIDI note and an interval structure.

For example:

```text
Major           [0, 4, 7]
Minor           [0, 3, 7]
Dominant 7th    [0, 4, 7, 10]
Major 7th       [0, 4, 7, 11]
Minor 7th       [0, 3, 7, 10]
Diminished      [0, 3, 6]
Diminished 7th  [0, 3, 6, 9]
```

The engine generates the corresponding MIDI notes and uses them to create the individual voices.

---

### Oscillators

For normal chord playback, StrumPad creates two oscillators per note.

The second oscillator is slightly detuned to provide a subtle layered sound.

The available oscillator shapes are:

- Sawtooth
- Square
- Triangle
- Sine

---

### Filter

Each voice passes through a Web Audio `BiquadFilterNode`.

The filter can operate as:

- Low-pass
- High-pass

The Cutoff and Resonance controls can be adjusted independently.

With the low-pass filter selected, the cutoff also interacts with the envelope, producing a more dynamic tonal response during the note.

---

### Envelope

The ADSR envelope controls the amplitude of each note:

```text
Attack → Decay → Sustain → Release
```

The envelope is applied to the voice gain and is also represented graphically by the CRT display.

---

### LFO

A low-frequency oscillator provides modulation.

It can be used for:

- **Vibrato** — modulation of oscillator pitch.
- **Tremolo** — modulation of voice volume.

The LFO Rate and Depth are independently adjustable.

---

# Interface Overview

```text
+-----------------------------------------------------------------------+
| STRUMPAD v1.0.1  [VINTAGE CHORD MACHINE]              [Audio Power]   |
+-----------------------------------------------------------------------+
| PERFORMANCE MODES          | SYNTHESIS ENGINE & MASTER OUTPUT         |
| - Drone / Strum / Arp      | - ADSR Envelope + CRT Monitor            |
| - Speed Slider             | - Waveform & Filter Controls             |
| - Selected Chord Display   | - LFO Modulation & Presets               |
|                            | - Master Volume                           |
+-----------------------------------------------------------------------+
| CHORD MATRIX (Circle of Fifths)    | PROGRESSION ASSISTANT            |
| [ C ] [ G ] [ D ] [ A ] ...        | - Musical Genre                  |
| - Major / Minor / 7th / Maj7 / ... | - Style                           |
|                                    | - Harmonic Progression            |
+-----------------------------------------------------------------------+
```

---

# Getting Started

StrumPad requires no installation or build process.

### 1. Clone or Download the Repository

```bash
git clone https://github.com/TagtTheSpellcaster/StrumPad.git
```

Alternatively, download the repository as a ZIP archive.

### 2. Open the Application

Open:

```text
index.html
```

in a modern web browser.

Recommended browsers include:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Safari

### 3. Enable Audio

The application starts with audio disabled.

Turn the **Audio Power** switch in the upper-right corner to **ON**.

This initializes the browser's Web Audio context.

### 4. Play a Chord

Click any button in the **Chord Matrix**.

The selected chord will:

- appear in the Selected Chord indicator;
- be played using the current synthesis settings;
- become the current chord for the performance modes.

### 5. Explore the Progression Assistant

For the main harmonic workflow:

1. Select a **Musical Genre**.
2. Select a **Style**.
3. Read the displayed progression.
4. Play the chord corresponding to the first progression step.
5. Follow the orange and blue highlights in the chord matrix.
6. Choose the highlighted chord you want to play.
7. Continue through the progression.

The progression assistant determines the working key from the first chord you play, allowing the same progression to be explored in different keys.

---

# Project Structure

```text
StrumPad/
├── index.html
├── styles.css
├── app.js
└── README.md
```

### `index.html`

Contains the application interface and responsive layout.

### `styles.css`

Contains custom visual styling, including:

- chord matrix colors
- physical button effects
- LEDs
- vertical sliders
- preset buttons
- CRT display styling

### `app.js`

Contains the application logic, including:

- Web Audio API synthesis
- chord generation
- Circle of Fifths matrix generation
- performance modes
- ADSR envelope handling
- filters
- LFO modulation
- synth presets
- harmonic progression parsing
- key deduction
- progression highlighting

---

# Technology

StrumPad is built using:

- **HTML5**
- **CSS3**
- **Vanilla JavaScript**
- **Tailwind CSS**
- **Web Audio API**

There is no JavaScript framework and no build system.

Tailwind CSS is loaded through its CDN, allowing the application to run directly from the source files.

No external audio samples are required.

---

# Design Philosophy

StrumPad is intentionally designed as a compact electronic instrument rather than a full digital audio workstation.

Its primary purpose is to make **harmonic exploration immediate and visual**:

- choose a progression;
- establish its key by playing the first chord;
- follow the highlighted alternatives;
- experiment with different chords and sounds;
- hear how the progression changes when played in different keys.

The vintage hardware-inspired interface is part of the concept: StrumPad is meant to feel like a small piece of electronic musical equipment rather than a conventional web application.

---

# Roadmap

## Version 1.x

The 1.x series focuses on:

- chord playback
- harmonic progression exploration
- performance modes
- analog-style synthesis
- sound presets
- responsive hardware-inspired interface

## Version 2.0

A future major version is planned to expand StrumPad into a more complete accompaniment instrument.

The planned features include:

- **Dynamic Drum Machine** — an on-the-fly rhythm generation engine capable of creating drum accompaniment patterns appropriate to the selected musical genre and style.
- **Chord Sequence Automation** — automatic playback of harmonic chord sequences, with the sequence adapted to the selected genre and style.

The goal is to allow StrumPad to generate a complete **rhythmic and harmonic accompaniment** based on the musical style selected in the Progression Assistant, while retaining the interactive chord matrix and manual control of the instrument.

---

# License

StrumPad is released under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

See the [GNU AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html) for the full license text.

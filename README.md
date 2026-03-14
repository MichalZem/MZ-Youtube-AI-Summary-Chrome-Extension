# 🎬 MZ YouTube AI Summary — Chrome Extension

**Summarize any YouTube video with one click using ChatGPT, Claude, Gemini, or Grok.**

Extrahuje titulky z YouTube videa a odešle je do vybrané AI služby k vytvoření shrnutí.

### 🌐 Language / Jazyk

> **[🇨🇿 Česky](#-česky)** · **[🇬🇧 English](#-english)**

---

## 🇨🇿 Česky

### Co rozšíření dělá

Rozšíření přidá na YouTube stránku zelené tlačítko **"✨ AI Summary"** (vedle mikrofonu v horní liště). Po kliknutí:

1. Automaticky extrahuje titulky z aktuálního videa
2. Sestaví prompt s titulky a názvem videa
3. Otevře novou záložku s vybranou AI službou (ChatGPT, Claude, Gemini nebo Grok)
4. Vloží prompt do textového pole a automaticky odešle

Alternativně lze použít **ikonu rozšíření v toolbaru Chrome** (levý klik = spustí shrnutí).

### Funkce

- **Výběr AI služby** — ChatGPT, Claude, Gemini, Grok
- **Editovatelný prompt** — plně přizpůsobitelná šablona s placeholdery
- **Časové značky** — volitelné seskupení titulků po ~20 sekundách ve formátu `[01:30] text`
- **Inteligentní dělení** — při zapnutých značkách se text zalamuje na konci vět
- **Nastavení** — pravý klik na ikonu rozšíření → Settings

### Instalace

1. Stáhni nebo naklonuj tento repozitář
2. Otevři `chrome://extensions/` v Chrome
3. Zapni **Developer mode** (vpravo nahoře)
4. Klikni **Load unpacked** a vyber složku s rozšířením
5. Refreshni YouTube stránku (F5)

### Nastavení

Pravý klik na ikonu rozšíření v toolbaru → **Settings**:

| Nastavení | Popis |
|-----------|-------|
| **AI Service** | Výběr cílové AI služby |
| **Include timestamps** | Zapne/vypne časové značky u titulků |
| **Prompt Template** | Šablona promptu s placeholdery |

#### Placeholdery v šabloně

| Placeholder | Nahradí se za |
|-------------|---------------|
| `{title}` | Název YouTube videa |
| `{url}` | URL videa |
| `{lang}` | Jazyk titulků |
| `{subtitles}` | Text titulků |

### Jak to funguje technicky

YouTube od roku 2025 vyžaduje **PO Token** (Proof of Origin) pro přístup k titulkům přes timedtext API. Rozšíření tento token získá chytrým trikem:

1. Dvakrát klikne na CC tlačítko přehrávače (zapne/vypne titulky)
2. YouTube přehrávač sám stáhne titulky s platným PO tokenem
3. Rozšíření zachytí URL tohoto requestu z `performance.getEntriesByType("resource")`
4. Extrahuje `pot` parametr a použije ho pro vlastní stažení titulků

### Požadavky

- Google Chrome (Manifest V3)
- Video musí mít dostupné titulky (automatické nebo manuální)

---

## 🇬🇧 English

### What it does

The extension adds a green **"✨ AI Summary"** button to YouTube pages (next to the voice search microphone). When clicked:

1. Automatically extracts subtitles from the current video
2. Builds a prompt with the subtitles and video title
3. Opens a new tab with the selected AI service (ChatGPT, Claude, Gemini, or Grok)
4. Pastes the prompt into the input field and submits it automatically

Alternatively, use the **extension toolbar icon** (left-click = run summarization).

### Features

- **AI service selection** — ChatGPT, Claude, Gemini, Grok
- **Editable prompt** — fully customizable template with placeholders
- **Timestamps** — optional subtitle grouping in ~20-second chunks as `[01:30] text`
- **Smart splitting** — when timestamps are enabled, text breaks at sentence boundaries
- **Settings** — right-click the extension icon → Settings

### Installation

1. Download or clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the extension folder
5. Refresh the YouTube page (F5)

### Settings

Right-click the extension icon in the toolbar → **Settings**:

| Setting | Description |
|---------|-------------|
| **AI Service** | Choose the target AI service |
| **Include timestamps** | Enable/disable timestamps in subtitles |
| **Prompt Template** | Prompt template with placeholders |

#### Template placeholders

| Placeholder | Replaced with |
|-------------|---------------|
| `{title}` | YouTube video title |
| `{url}` | Video URL |
| `{lang}` | Subtitle language |
| `{subtitles}` | Subtitle text |

### How it works technically

Since 2025, YouTube requires a **PO Token** (Proof of Origin) to access subtitles via the timedtext API. The extension obtains this token using a clever technique:

1. Clicks the CC button on the player twice (toggles subtitles on/off)
2. The YouTube player itself fetches subtitles with a valid PO token
3. The extension captures the request URL from `performance.getEntriesByType("resource")`
4. Extracts the `pot` parameter and uses it to fetch the subtitles independently

### Requirements

- Google Chrome (Manifest V3)
- Video must have available subtitles (auto-generated or manual)

---

## 📁 Project structure

```
├── manifest.json            — Extension configuration (Manifest V3)
├── background.js            — Service worker: subtitle extraction, PO token, prompt building
├── youtube-button.js        — Content script: "AI Summary" button on YouTube pages
├── inject.js                — Content script: prompt injection on AI service pages
├── options.html             — Settings page UI
├── options.js               — Settings page logic (auto-save)
├── icon48.png               — Extension icon 48x48
├── icon128.png              — Extension icon 128x128
└── _locales/
    ├── en/messages.json     — English localization
    └── cs/messages.json     — Czech localization
```

## 📄 License

MIT

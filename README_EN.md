# 🔬 Research Assistant

[中文](./README.md)

A cross-platform desktop application built with Tauri for research group meetings. Integrates voice transcription, literature management, AI summarization, knowledge base, and task tracking.

## Features

| Module | Capabilities |
|--------|-------------|
| 📝 **Meetings** | Schedule meetings, record & transcribe (local/cloud Whisper), AI summaries, Markdown notes, action items |
| 📚 **Literature** | Drag-and-drop PDF import, auto metadata lookup (CrossRef/SemanticScholar), AI structured analysis |
| 📂 **Works** | Research project grouping, progress tracking with progress bars, milestone management |
| ✏️ **Notes** | Full Markdown editor, `[[wikilinks]]`, multi-tag categorization, backlinks |
| 🧠 **Knowledge Base** | LanceDB vector store, semantic search, one-click re-index |
| 🤖 **AI Engine** | Local/cloud dual mode — Whisper + Ollama (free & offline), OpenAI API (on-demand) |
| ⏰ **Desktop Widget** | Floating countdown window, next meeting reminder |
| 🔍 **Global Search** | SQLite full-text + RAG semantic search |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri 2.0 (Rust) |
| Frontend | React 19 + TypeScript + Tailwind CSS v4 |
| AI Backend | Python FastAPI |
| ASR | faster-whisper (local) / OpenAI Whisper API (cloud) |
| LLM | Ollama (local) / OpenAI API (cloud) |
| Vector DB | LanceDB + sentence-transformers |
| Metadata | SQLite (via rusqlite) |
| PDF Parsing | PyMuPDF + CrossRef / Semantic Scholar API |
| Notes Editor | Milkdown (WYSIWYG Markdown) |

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Rust** ≥ 1.77
- **Python** ≥ 3.10
- Windows: WebView2 (usually pre-installed)

### Install

```bash
npm install
pip install -r python-backend/requirements.txt
```

### Development

```bash
# Start Python backend
python python-backend/main.py

# Start Tauri desktop app
npm run tauri:dev
```

### Local Mode (no API key needed)

| Component | Setup |
|-----------|-------|
| Speech-to-text | Select "Local Whisper" in Settings (auto-downloads model on first use) |
| AI Summarization | Install [Ollama](https://ollama.com) → `ollama pull qwen2.5:3b` → Select Ollama in Settings |

> In full local mode, all data processing is completely offline and privacy-safe.

### Production Build

```bash
npm run tauri:build
```

## Project Structure

```
├── src-tauri/              # Tauri backend (Rust)
│   ├── src/lib.rs           # Database, IPC commands, window management
│   └── tauri.conf.json
├── src/                    # Frontend (React + TypeScript)
│   ├── pages/               # Page components
│   ├── components/          # Shared components
│   ├── lib/                 # API client, data layer, utilities
│   └── stores/              # Zustand state store
├── python-backend/         # AI services (FastAPI)
│   ├── main.py
│   └── services/            # ASR / LLM / PDF / RAG services
└── package.json
```

## License

MIT

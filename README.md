# 🔬 组会科研助手 Research Assistant

[English](./README_EN.md)

一个基于 Tauri 的跨平台桌面应用，专为科研组会场景设计。集录音转写、文献管理、AI 摘要、知识库、待办追踪于一体。

## 功能概览

| 模块 | 功能 |
|------|------|
| 📝 **组会管理** | 日程创建、录音转写（本地/云端 Whisper）、AI 摘要生成、Markdown 笔记、待办事项 |
| 📚 **文献管理** | PDF 拖入自动解析、联网查询元数据（CrossRef / Semantic Scholar）、AI 结构化分析 |
| 📂 **研究工作** | 研究方向分类、组会/文献归类、进度条追踪、里程碑管理 |
| ✏️ **笔记系统** | 全功能 Markdown 编辑器、`[[双链]]` 引用、多标签分类、反向链接 |
| 🧠 **知识库** | LanceDB 向量存储、语义搜索、一键重建索引 |
| 🤖 **AI 引擎** | 本地/云端双模式 — Whisper + Ollama 免费离线，OpenAI API 按需使用 |
| ⏰ **桌面组件** | 悬浮倒计时窗口、下次组会提醒 |
| 🔍 **全局搜索** | SQLite 全文搜索 + RAG 语义搜索 |

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Tauri 2.0 (Rust) |
| 前端 | React 19 + TypeScript + Tailwind CSS v4 |
| AI 后端 | Python FastAPI |
| 语音识别 | faster-whisper (本地) / OpenAI Whisper API (云端) |
| 大语言模型 | Ollama (本地) / OpenAI API (云端) |
| 向量数据库 | LanceDB + sentence-transformers |
| 元数据 | SQLite (via rusqlite) |
| 文献解析 | PyMuPDF + CrossRef / Semantic Scholar API |
| 笔记编辑 | Milkdown (WYSIWYG Markdown) |

## 快速开始

### 环境要求

- **Node.js** ≥ 18
- **Rust** ≥ 1.77
- **Python** ≥ 3.10
- Windows: WebView2（通常已预装）

### 安装依赖

```bash
# 前端依赖
npm install

# Python 后端依赖
pip install -r python-backend/requirements.txt
```

### 启动开发模式

```bash
# 1. 启动 Python 后端
python python-backend/main.py

# 2. 启动 Tauri 桌面应用
npm run tauri:dev
```

### 本地方案（无需 API Key）

| 组件 | 使用方式 |
|------|---------|
| 语音转文字 | 设置中选择「本地 Whisper」，首次自动下载模型 |
| AI 摘要 | 安装 [Ollama](https://ollama.com) → `ollama pull qwen2.5:3b` → 设置选 Ollama |

> 全本地模式下，数据处理完全离线，隐私安全。

### 打包生产版本

```bash
npm run tauri:build
```

## 项目结构

```
├── src-tauri/              # Tauri 主进程 (Rust)
│   ├── src/lib.rs           # 数据库、IPC 命令、窗口管理
│   └── tauri.conf.json      # Tauri 配置
├── src/                    # 前端 (React + TypeScript)
│   ├── pages/               # 页面组件
│   │   ├── MeetingsPage     # 组会管理
│   │   ├── LiteraturePage   # 文献管理
│   │   ├── WorksPage        # 研究工作
│   │   ├── NotesPage        # 笔记管理
│   │   └── SettingsPage     # 设置
│   ├── components/          # 通用组件
│   ├── lib/                 # API 客户端、数据层、工具
│   └── stores/              # Zustand 状态管理
├── python-backend/         # AI 服务 (FastAPI)
│   ├── main.py              # 入口
│   └── services/            # ASR / LLM / PDF / RAG 服务
└── package.json
```

## License

MIT

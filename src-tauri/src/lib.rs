use rusqlite::{Connection, OptionalExtension};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

pub struct AppState {
    pub db: Mutex<Connection>,
    pub python_process: Mutex<Option<Child>>,
}

fn get_data_dir() -> PathBuf {
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("my-assistant");
    std::fs::create_dir_all(&dir).ok();
    dir
}

fn init_database(conn: &Connection) {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS meetings (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            duration_secs INTEGER DEFAULT 0,
            audio_path TEXT,
            transcript TEXT,
            summary TEXT,
            work_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS literature (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            authors TEXT,
            year INTEGER,
            journal TEXT,
            doi TEXT,
            keywords TEXT,
            category TEXT,
            abstract TEXT,
            pdf_path TEXT,
            extracted_text TEXT,
            summary TEXT,
            structured_notes TEXT,
            work_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS works (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            color TEXT DEFAULT '#3b82f6',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS literature_meetings (
            literature_id TEXT NOT NULL,
            meeting_id TEXT NOT NULL,
            PRIMARY KEY (literature_id, meeting_id),
            FOREIGN KEY (literature_id) REFERENCES literature(id),
            FOREIGN KEY (meeting_id) REFERENCES meetings(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            source_type TEXT NOT NULL DEFAULT 'standalone',
            source_id TEXT,
            linked_note_ids TEXT DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS fts_notes USING fts5(
            content,
            source_type,
            source_id
        );
        ",
    )
    .expect("Failed to initialize database");
}

fn start_python_backend() -> Option<Child> {
    // Try multiple Python paths - Anaconda first
    let python_candidates = [
        r"D:\Anaconda\python.exe",
        r"D:\msys64\mingw64\bin\python.exe",
        "python3",
        "python",
    ];

    let python_cmd = python_candidates.iter().find(|p| {
        Command::new(p).arg("--version").output().is_ok()
    }).unwrap_or(&"python");

    let backend_dir = std::env::current_dir()
        .unwrap_or_default()
        .join("python-backend");

    if !backend_dir.join("main.py").exists() {
        log::warn!("Python backend not found at {:?}, skipping...", backend_dir);
        return None;
    }

    match Command::new(python_cmd)
        .arg("main.py")
        .current_dir(&backend_dir)
        .spawn()
    {
        Ok(child) => {
            log::info!("Python backend started with PID: {} ({})", child.id(), python_cmd);
            Some(child)
        }
        Err(e) => {
            log::error!("Failed to start Python backend ({}): {}", python_cmd, e);
            None
        }
    }
}

#[tauri::command]
fn get_meetings(state: tauri::State<AppState>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, title, date, duration_secs, summary, created_at FROM meetings ORDER BY date DESC")
        .map_err(|e| e.to_string())?;

    let meetings = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "date": row.get::<_, String>(2)?,
                "duration_secs": row.get::<_, i64>(3)?,
                "summary": row.get::<_, Option<String>>(4)?,
                "created_at": row.get::<_, String>(5)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(meetings)
}

#[tauri::command]
fn get_literature(state: tauri::State<AppState>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, title, authors, year, journal, doi, keywords, category, abstract, summary, structured_notes, created_at FROM literature ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "authors": row.get::<_, Option<String>>(2)?,
                "year": row.get::<_, Option<i32>>(3)?,
                "journal": row.get::<_, Option<String>>(4)?,
                "doi": row.get::<_, Option<String>>(5)?,
                "keywords": row.get::<_, Option<String>>(6)?,
                "category": row.get::<_, Option<String>>(7)?,
                "abstract": row.get::<_, Option<String>>(8)?,
                "summary": row.get::<_, Option<String>>(9)?,
                "structured_notes": row.get::<_, Option<String>>(10)?,
                "created_at": row.get::<_, String>(11)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
fn get_setting(state: tauri::State<AppState>, key: String) -> Result<Option<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row([&key], |row| row.get::<_, String>(0))
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
fn set_setting(state: tauri::State<AppState>, key: String, value: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
        [&key, &value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_data_dir_path() -> String {
    get_data_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn create_meeting(
    state: tauri::State<AppState>,
    id: String,
    title: String,
    date: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO meetings (id, title, date) VALUES (?1, ?2, ?3)",
        [&id, &title, &date],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_meeting(
    state: tauri::State<AppState>,
    id: String,
    transcript: Option<String>,
    summary: Option<String>,
    duration_secs: Option<i64>,
    audio_path: Option<String>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE meetings SET
            transcript = COALESCE(?2, transcript),
            summary = COALESCE(?3, summary),
            duration_secs = COALESCE(?4, duration_secs),
            audio_path = COALESCE(?5, audio_path),
            updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![id, transcript, summary, duration_secs, audio_path],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn create_literature(
    state: tauri::State<AppState>,
    id: String,
    title: String,
    authors: Option<String>,
    year: Option<i32>,
    journal: Option<String>,
    doi: Option<String>,
    keywords: Option<String>,
    category: Option<String>,
    abstract_text: Option<String>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO literature (id, title, authors, year, journal, doi, keywords, category, abstract) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![id, title, authors, year, journal, doi, keywords, category, abstract_text],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_literature(
    state: tauri::State<AppState>,
    id: String,
    extracted_text: Option<String>,
    summary: Option<String>,
    pdf_path: Option<String>,
    structured_notes: Option<String>,
    keywords: Option<String>,
    category: Option<String>,
    abstract_text: Option<String>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE literature SET
            extracted_text = COALESCE(?2, extracted_text),
            summary = COALESCE(?3, summary),
            pdf_path = COALESCE(?4, pdf_path),
            structured_notes = COALESCE(?5, structured_notes),
            keywords = COALESCE(?6, keywords),
            category = COALESCE(?7, category),
            abstract = COALESCE(?8, abstract),
            updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![id, extracted_text, summary, pdf_path, structured_notes, keywords, category, abstract_text],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn link_literature_meeting(
    state: tauri::State<AppState>,
    literature_id: String,
    meeting_id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR IGNORE INTO literature_meetings (literature_id, meeting_id) VALUES (?1, ?2)",
        [&literature_id, &meeting_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn search_all(
    state: tauri::State<AppState>,
    query: String,
) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare("SELECT 'meeting' as type, id, title, summary FROM meetings WHERE title LIKE ?1 OR summary LIKE ?1 LIMIT 20")
        .map_err(|e| e.to_string())?;

    let ml: Vec<serde_json::Value> = stmt
        .query_map([&format!("%{}%", query)], |row| {
            Ok(serde_json::json!({
                "type": "meeting",
                "id": row.get::<_, String>(1)?,
                "title": row.get::<_, String>(2)?,
                "summary": row.get::<_, Option<String>>(3)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut lst = db
        .prepare("SELECT 'literature' as type, id, title, summary, authors FROM literature WHERE title LIKE ?1 OR authors LIKE ?1 OR summary LIKE ?1 LIMIT 20")
        .map_err(|e| e.to_string())?;

    let ll: Vec<serde_json::Value> = lst
        .query_map([&format!("%{}%", query)], |row| {
            Ok(serde_json::json!({
                "type": "literature",
                "id": row.get::<_, String>(1)?,
                "title": row.get::<_, String>(2)?,
                "summary": row.get::<_, Option<String>>(3)?,
                "authors": row.get::<_, Option<String>>(4)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ml.into_iter().chain(ll).collect())
}

#[tauri::command]
fn get_meeting_literature(
    state: tauri::State<AppState>,
    meeting_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT l.id, l.title, l.authors, l.year, l.summary
             FROM literature l
             JOIN literature_meetings lm ON l.id = lm.literature_id
             WHERE lm.meeting_id = ?1"
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([&meeting_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "authors": row.get::<_, Option<String>>(2)?,
                "year": row.get::<_, Option<i32>>(3)?,
                "summary": row.get::<_, Option<String>>(4)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
fn get_literature_meetings(
    state: tauri::State<AppState>,
    literature_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT m.id, m.title, m.date
             FROM meetings m
             JOIN literature_meetings lm ON m.id = lm.meeting_id
             WHERE lm.literature_id = ?1"
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([&literature_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "date": row.get::<_, String>(2)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

// ---------- Widget ----------

#[tauri::command]
fn toggle_widget(app: tauri::AppHandle) -> Result<bool, String> {
    let label = "widget";
    if let Some(w) = app.get_webview_window(label) {
        w.close().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        WebviewWindowBuilder::new(&app, label, WebviewUrl::App("/?widget".into()))
            .title("组会提醒")
            .inner_size(300.0, 200.0)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .transparent(true)
            .visible(true)
            .build()
            .map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
fn widget_visible(app: tauri::AppHandle) -> Result<bool, String> {
    Ok(app.get_webview_window("widget").is_some())
}

#[tauri::command]
fn set_reminder(state: tauri::State<AppState>, meeting_id: String, title: String, date: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO settings (key, value) VALUES ('reminder_meeting_id', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1",
        [&meeting_id],
    ).map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO settings (key, value) VALUES ('reminder_meeting_title', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1",
        [&title],
    ).map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO settings (key, value) VALUES ('reminder_meeting_date', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1",
        [&date],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_reminder(state: tauri::State<AppState>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let id: Option<String> = db.query_row(
        "SELECT value FROM settings WHERE key = 'reminder_meeting_id'", [],
        |row| row.get(0),
    ).optional().map_err(|e| e.to_string())?;

    let title: Option<String> = db.query_row(
        "SELECT value FROM settings WHERE key = 'reminder_meeting_title'", [],
        |row| row.get(0),
    ).optional().map_err(|e| e.to_string())?;

    let date: Option<String> = db.query_row(
        "SELECT value FROM settings WHERE key = 'reminder_meeting_date'", [],
        |row| row.get(0),
    ).optional().map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "meeting_id": id,
        "title": title,
        "date": date,
    }))
}

// ---------- Works ----------

#[tauri::command]
fn get_works(state: tauri::State<AppState>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db.prepare("SELECT id, name, description, color FROM works ORDER BY created_at").map_err(|e| e.to_string())?;
    let items = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "description": row.get::<_, String>(2)?,
            "color": row.get::<_, String>(3)?,
        }))
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(items)
}

#[tauri::command]
fn create_work(state: tauri::State<AppState>, id: String, name: String, description: String, color: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("INSERT INTO works (id, name, description, color) VALUES (?1, ?2, ?3, ?4)", rusqlite::params![id, name, description, color]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_work(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM works WHERE id = ?1", [&id]).map_err(|e| e.to_string())?;
    db.execute("UPDATE meetings SET work_id = NULL WHERE work_id = ?1", [&id]).map_err(|e| e.to_string())?;
    db.execute("UPDATE literature SET work_id = NULL WHERE work_id = ?1", [&id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn assign_meeting_to_work(state: tauri::State<AppState>, meeting_id: String, work_id: Option<String>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("UPDATE meetings SET work_id = ?1 WHERE id = ?2", rusqlite::params![work_id, meeting_id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn assign_literature_to_work(state: tauri::State<AppState>, literature_id: String, work_id: Option<String>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("UPDATE literature SET work_id = ?1 WHERE id = ?2", rusqlite::params![work_id, literature_id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------- Notes ----------

#[tauri::command]
fn get_notes(state: tauri::State<AppState>, source_type: Option<String>, source_id: Option<String>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let sql = if source_type.is_some() && source_id.is_some() {
        "SELECT id, title, content, source_type, source_id, linked_note_ids, created_at, updated_at FROM notes WHERE source_type = ?1 AND source_id = ?2 ORDER BY updated_at DESC"
    } else if source_type.is_some() {
        "SELECT id, title, content, source_type, source_id, linked_note_ids, created_at, updated_at FROM notes WHERE source_type = ?1 ORDER BY updated_at DESC"
    } else {
        "SELECT id, title, content, source_type, source_id, linked_note_ids, created_at, updated_at FROM notes ORDER BY updated_at DESC"
    };
    let mut stmt = db.prepare(sql).map_err(|e| e.to_string())?;
    let items: Vec<serde_json::Value> = if source_type.is_some() && source_id.is_some() {
        stmt.query_map(rusqlite::params![source_type.unwrap(), source_id.unwrap()], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?, "title": row.get::<_, String>(1)?, "content": row.get::<_, String>(2)?,
                "source_type": row.get::<_, String>(3)?, "source_id": row.get::<_, Option<String>>(4)?,
                "linked_note_ids": row.get::<_, String>(5)?, "created_at": row.get::<_, String>(6)?, "updated_at": row.get::<_, String>(7)?,
            }))
        }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    } else if source_type.is_some() {
        stmt.query_map([&source_type.unwrap()], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?, "title": row.get::<_, String>(1)?, "content": row.get::<_, String>(2)?,
                "source_type": row.get::<_, String>(3)?, "source_id": row.get::<_, Option<String>>(4)?,
                "linked_note_ids": row.get::<_, String>(5)?, "created_at": row.get::<_, String>(6)?, "updated_at": row.get::<_, String>(7)?,
            }))
        }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    } else {
        stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?, "title": row.get::<_, String>(1)?, "content": row.get::<_, String>(2)?,
                "source_type": row.get::<_, String>(3)?, "source_id": row.get::<_, Option<String>>(4)?,
                "linked_note_ids": row.get::<_, String>(5)?, "created_at": row.get::<_, String>(6)?, "updated_at": row.get::<_, String>(7)?,
            }))
        }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };
    Ok(items)
}

#[tauri::command]
fn save_note(state: tauri::State<AppState>, id: String, title: String, content: String, source_type: String, source_id: Option<String>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO notes (id, title, content, source_type, source_id) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET title = ?2, content = ?3, source_type = ?4, source_id = ?5, updated_at = datetime('now')",
        rusqlite::params![id, title, content, source_type, source_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_note(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM notes WHERE id = ?1", [&id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data_dir = get_data_dir();
    let db_path = data_dir.join("assistant.db");
    let conn = Connection::open(&db_path).expect("Failed to open database");
    init_database(&conn);

    let python_process = start_python_backend();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(AppState {
            db: Mutex::new(conn),
            python_process: Mutex::new(python_process),
        })
        .invoke_handler(tauri::generate_handler![
            get_meetings,
            get_literature,
            get_setting,
            set_setting,
            get_data_dir_path,
            create_meeting,
            update_meeting,
            create_literature,
            update_literature,
            link_literature_meeting,
            search_all,
            get_meeting_literature,
            get_literature_meetings,
            toggle_widget,
            widget_visible,
            set_reminder,
            get_reminder,
            get_works,
            create_work,
            delete_work,
            assign_meeting_to_work,
            assign_literature_to_work,
            get_notes,
            save_note,
            delete_note,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                if let Some(state) = app.try_state::<AppState>() {
                    if let Ok(mut proc) = state.python_process.lock() {
                        if let Some(ref mut child) = *proc {
                            let _ = child.kill();
                            log::info!("Python backend process killed");
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

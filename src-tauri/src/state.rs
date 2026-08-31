use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::collections::VecDeque;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DragItem {
    pub id: String,
    pub r#type: String, // "media" | "clip"
    pub name: String,
    pub color: Option<String>,
    pub start: Option<f64>,
    pub duration: Option<f64>,
    pub trim_in: Option<f64>,
    pub src: Option<String>,
    pub has_audio: Option<bool>,
    pub waveform: Option<Vec<f32>>,
    pub linked_clip_id: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub name: String,
    pub r#type: String, // "video" | "audio"
    pub is_locked: Option<bool>,
    pub is_muted: Option<bool>,
    pub items: Vec<DragItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DocumentState {
    pub tracks: Vec<Track>,
    pub media_items: Vec<DragItem>,
}

pub struct AppState {
    pub state: Mutex<DocumentState>,
    pub past: Mutex<VecDeque<DocumentState>>,
    pub future: Mutex<VecDeque<DocumentState>>,
    pub project_file_path: Mutex<Option<String>>,
}

impl Default for AppState {
    fn default() -> Self {
        // Initialize with default tracks (V2, V1, A1, A2) like Premiere Pro
        let initial_state = DocumentState {
            tracks: vec![
                Track { id: "v2".to_string(), name: "V2".to_string(), r#type: "video".to_string(), is_locked: Some(false), is_muted: Some(false), items: vec![] },
                Track { id: "v1".to_string(), name: "V1".to_string(), r#type: "video".to_string(), is_locked: Some(false), is_muted: Some(false), items: vec![] },
                Track { id: "a1".to_string(), name: "A1".to_string(), r#type: "audio".to_string(), is_locked: Some(false), is_muted: Some(false), items: vec![] },
                Track { id: "a2".to_string(), name: "A2".to_string(), r#type: "audio".to_string(), is_locked: Some(false), is_muted: Some(false), items: vec![] },
            ],
            media_items: vec![],
        };

        Self {
            state: Mutex::new(initial_state),
            past: Mutex::new(VecDeque::new()),
            future: Mutex::new(VecDeque::new()),
            project_file_path: Mutex::new(None),
        }
    }
}

impl AppState {
    pub fn commit_history(&self) {
        let current_state = self.state.lock().unwrap().clone();
        let mut past = self.past.lock().unwrap();
        
        past.push_back(current_state);
        if past.len() > 50 {
            past.pop_front();
        }

        self.future.lock().unwrap().clear();
    }

    pub fn undo(&self) -> Option<DocumentState> {
        let mut past = self.past.lock().unwrap();
        if let Some(previous_state) = past.pop_back() {
            let mut current = self.state.lock().unwrap();
            
            let mut future = self.future.lock().unwrap();
            future.push_back(current.clone());

            *current = previous_state.clone();
            return Some(previous_state);
        }
        None
    }

    pub fn redo(&self) -> Option<DocumentState> {
        let mut future = self.future.lock().unwrap();
        if let Some(next_state) = future.pop_back() {
            let mut current = self.state.lock().unwrap();
            
            let mut past = self.past.lock().unwrap();
            past.push_back(current.clone());

            *current = next_state.clone();
            return Some(next_state);
        }
        None
    }
}

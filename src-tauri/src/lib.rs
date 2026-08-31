mod engine;
mod commands;

use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    engine::init();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Build Native OS Application Menu (macOS menu bar / Windows window menu)
            let file_menu = SubmenuBuilder::new(app, "File")
                .text("import_media", "Import Media...\tCmdOrCtrl+I")
                .separator()
                .text("export_frame", "Export Frame...\tCmdOrCtrl+Shift+E")
                .separator()
                .close_window()
                .quit()
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .separator()
                .text("delete_clip", "Delete Clip\tBackspace")
                .build()?;

            let clip_menu = SubmenuBuilder::new(app, "Clip")
                .text("razor_cut", "Razor Cut at Playhead\tC")
                .build()?;

            let seq_menu = SubmenuBuilder::new(app, "Sequence")
                .text("mark_in", "Mark In\t{")
                .text("mark_out", "Mark Out\t}")
                .separator()
                .text("play_pause", "Play / Pause\tSpace")
                .build()?;

            let help_menu = SubmenuBuilder::new(app, "Help")
                .text("about_app", "About Cekcok Kroma")
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&file_menu, &edit_menu, &clip_menu, &seq_menu, &help_menu])
                .build()?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            let action_id = event.id().as_ref();
            // Emit menu event to frontend window
            let _ = app.emit("native-menu-action", action_id);
        })
        .register_uri_scheme_protocol("kromavideo", |_app, request| {
            let uri = request.uri().to_string();
            let mut path = "";
            let mut t = "0";
            if let Some(query) = uri.split('?').nth(1) {
                for param in query.split('&') {
                    if param.starts_with("path=") {
                        path = &param[5..];
                    } else if param.starts_with("t=") {
                        t = &param[2..];
                    }
                }
            }
            
            let path = urlencoding::decode(path).unwrap_or(std::borrow::Cow::Borrowed("")).into_owned();

            if path.is_empty() {
                return tauri::http::Response::builder()
                    .status(400)
                    .body(Vec::new())
                    .unwrap();
            }

            let output = std::process::Command::new("ffmpeg")
                .args([
                    "-ss", t,
                    "-i", &path,
                    "-vframes", "1",
                    "-s", "160x90",
                    "-threads", "1",
                    "-f", "image2",
                    "-vcodec", "mjpeg",
                    "-"
                ])
                .output()
                .expect("Failed to execute ffmpeg");

            tauri::http::Response::builder()
                .header("Content-Type", "image/jpeg")
                .header("Access-Control-Allow-Origin", "*")
                .body(output.stdout)
                .unwrap()
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_video_metadata,
            commands::get_audio_waveform,
            commands::export_frame
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

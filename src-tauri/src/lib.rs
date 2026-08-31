mod engine;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    engine::init();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .register_uri_scheme_protocol("kromavideo", |_app, request| {
            let uri = request.uri().to_string();
            // uri looks like kromavideo://localhost/?path=/Users/...&t=2.5
            // Extract path and t manually
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
            
            // decode URL path
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
                    "-" // output to stdout
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
            commands::get_video_metadata
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

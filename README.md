# Cekcok Kroma

Cekcok Kroma is a lightweight, highly functional video editor ("bootleg Premiere Pro") built with modern web technologies and a Rust-first backend.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite
- **Styling**: TailwindCSS v4, Framer Motion
- **State Management**: Zustand
- **Backend**: Rust, Tauri v2
- **Updates**: Auto-updating via Tauri Updater & MinIO S3

## Setup

1. Make sure you have `pnpm` and `Rust` installed.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run the development server:
   ```bash
   pnpm tauri dev
   ```

## Architecture
- `src/features/*`: Feature-driven frontend architecture containing Media Bin, Timeline, and Preview components.
- `src/stores/useDragStore.ts`: Global state for cross-panel drag and drop interactions.
- `src-tauri/src/engine`: Core video processing engine in Rust.
- `src-tauri/src/commands`: Tauri commands to bridge frontend and backend.

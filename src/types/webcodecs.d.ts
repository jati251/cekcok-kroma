// WebCodecs type declarations for browser and Tauri environments

interface VideoDecoderConfig {
  codec: string;
  codedWidth?: number;
  codedHeight?: number;
  description?: BufferSource;
  hardwareAcceleration?: "no-preference" | "prefer-hardware" | "prefer-software";
}

interface EncodedVideoChunkInit {
  type: "key" | "delta";
  timestamp: number;
  duration?: number;
  data: BufferSource;
}

declare class EncodedVideoChunk {
  readonly type: "key" | "delta";
  readonly timestamp: number;
  readonly duration: number | null;
  readonly byteLength: number;
  constructor(init: EncodedVideoChunkInit);
  copyTo(destination: BufferSource): void;
}

interface VideoDecoderInit {
  output: (frame: VideoFrame) => void;
  error: (error: DOMException | Error) => void;
}

declare class VideoDecoder {
  readonly state: "unconfigured" | "configured" | "closed";
  readonly decodeQueueSize: number;
  constructor(init: VideoDecoderInit);
  configure(config: VideoDecoderConfig): void;
  decode(chunk: EncodedVideoChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
}

interface VideoFrame {
  readonly timestamp: number;
  readonly duration: number | null;
  readonly displayWidth: number;
  readonly displayHeight: number;
  close(): void;
  clone(): VideoFrame;
}

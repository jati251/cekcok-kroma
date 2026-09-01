declare module "mp4box" {
  export interface MP4ArrayBuffer extends ArrayBuffer {
    fileStart: number;
  }

  export interface MP4VideoTrack {
    id: number;
    codec: string;
    bitrate: number;
    video: {
      width: number;
      height: number;
    };
  }

  export interface MP4Info {
    videoTracks: MP4VideoTrack[];
    duration: number;
    timescale: number;
  }

  export interface MP4Sample {
    track_id: number;
    description: unknown;
    is_sync: boolean;
    is_leading: number;
    depends_on: number;
    is_depended_on: number;
    has_redundancy: number;
    degradation_priority: number;
    offset: number;
    size: number;
    dts: number;
    cts: number;
    duration: number;
    timescale: number;
    data: Uint8Array;
  }

  export interface MP4CodecBox {
    write: (stream: MP4DataStream) => void;
  }

  export interface MP4StsdEntry {
    avcC?: MP4CodecBox;
    hvcC?: MP4CodecBox;
    vpcC?: MP4CodecBox;
    av1C?: MP4CodecBox;
  }

  export interface MP4TrackBox {
    mdia: {
      minf: {
        stbl: {
          stsd: {
            entries: MP4StsdEntry[];
          };
        };
      };
    };
  }

  export interface MP4BoxFile {
    onReady?: (info: MP4Info) => void;
    onError?: (e: string) => void;
    onSamples?: (id: number, user: unknown, samples: MP4Sample[]) => void;
    appendBuffer(data: MP4ArrayBuffer): number;
    setExtractionOptions(id: number, user?: unknown, options?: { nbSamples?: number }): void;
    start(): void;
    stop(): void;
    flush(): void;
    getTrackById(id: number): MP4TrackBox | undefined;
  }

  export class DataStream {
    static readonly BIG_ENDIAN: boolean;
    buffer: ArrayBuffer;
    constructor(buffer?: ArrayBuffer, byteOffset?: number, endianness?: boolean);
  }

  export type MP4DataStream = DataStream;

  export function createFile(): MP4BoxFile;
}

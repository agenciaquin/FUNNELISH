declare module 'opus-recorder' {
  interface RecorderOptions {
    encoderPath?: string;
    numberOfChannels?: number;
    encoderSampleRate?: number;
    maxFramesPerPage?: number;
    encoderComplexity?: number;
    streamPages?: boolean;
  }

  class Recorder {
    constructor(options?: RecorderOptions);
    ondataavailable: ((typedArray: Uint8Array) => void) | null;
    onstart: (() => void) | null;
    onstop: (() => void) | null;
    start(): Promise<void>;
    stop(): void;
    pause(): void;
    resume(): void;
  }

  export default Recorder;
}

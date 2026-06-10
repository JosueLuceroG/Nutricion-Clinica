import { createWorker, type Worker } from "tesseract.js";

const LOG_CONFIG = {
  logger: undefined as ((msg: { status: string; progress: number }) => void) | undefined,
};

export interface OcrOptions {
  language?: string;
  image: Blob | File;
  onProgress?: (percent: number) => void;
}

export interface OcrResult {
  text: string;
  confidence: number;
  duration: number;
}

let _worker: Worker | null = null;
let _workerLoadPromise: Promise<Worker> | null = null;

async function getWorker(language = "spa+eng"): Promise<Worker> {
  if (_worker) return _worker;
  if (!_workerLoadPromise) {
    _workerLoadPromise = (async () => {
      const w = await createWorker(language, 1, LOG_CONFIG);
      _worker = w;
      return w;
    })();
  }
  return _workerLoadPromise;
}

export async function terminateWorker(): Promise<void> {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
    _workerLoadPromise = null;
  }
}

export async function recognizeText(options: OcrOptions): Promise<OcrResult> {
  const { image, onProgress } = options;
  const language = options.language ?? "spa+eng";

  if (onProgress) {
    LOG_CONFIG.logger = (msg) => {
      if (msg.status === "recognizing text") {
        onProgress(msg.progress);
      }
    };
  }

  const worker = await getWorker(language);

  const start = performance.now();
  const { data } = await worker.recognize(image);

  const duration = performance.now() - start;

  return {
    text: data.text,
    confidence: data.confidence,
    duration,
  };
}

export async function recognizeImageFromFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<OcrResult> {
  return recognizeText({ image: file, onProgress });
}

/**
 * Every failure the user can hit is mapped to a code with a clear Spanish message and at least
 * one way out ("siempre un mensaje claro y una salida"). Workers send `{ code, detail }` across
 * `postMessage`, so errors are plain data that survive structured cloning.
 */
export type AppErrorCode =
  | 'unsupported-format'
  | 'file-too-large'
  | 'media-too-long'
  | 'decode-failed'
  | 'no-audio-track'
  | 'webgpu-unavailable'
  | 'model-download-failed'
  | 'offline-model-missing'
  | 'out-of-memory'
  | 'transcription-failed'
  | 'no-speech'
  | 'export-unsupported'
  | 'export-failed'
  | 'storage-failed'
  | 'unknown';

export interface AppErrorData {
  code: AppErrorCode;
  /** Technical detail for the console / bug reports. Never shown as the main message. */
  detail?: string;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly detail: string | undefined;

  constructor(code: AppErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
  }

  toData(): AppErrorData {
    return this.detail === undefined
      ? { code: this.code }
      : { code: this.code, detail: this.detail };
  }

  static fromData(data: AppErrorData): AppError {
    return new AppError(data.code, data.detail);
  }
}

/** Best-effort classification of unknown errors (WASM/WebGPU/WebCodecs throw very different things). */
export function toAppError(error: unknown, fallback: AppErrorCode = 'unknown'): AppError {
  if (error instanceof AppError) return error;
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (looksLikeOutOfMemory(detail)) return new AppError('out-of-memory', detail);
  return new AppError(fallback, detail);
}

export function looksLikeOutOfMemory(message: string): boolean {
  return /out of memory|outofmemory|array buffer allocation failed|allocation failed|memory access out of bounds|could not allocate|RangeError: (?:Invalid typed array length|Array buffer)|device (?:was )?lost|failed to execute 'mapAsync'/i.test(
    message,
  );
}

export type RecoveryAction =
  | 'choose-another-file'
  | 'use-wasm'
  | 'smaller-model'
  | 'retry'
  | 'download-subtitles'
  | 'export-webm'
  | 'go-online'
  | 'trim-media'
  | 'dismiss';

export interface ErrorMessage {
  title: string;
  description: string;
  actions: RecoveryAction[];
}

export const ERROR_MESSAGES: Record<AppErrorCode, ErrorMessage> = {
  'unsupported-format': {
    title: 'Formato no soportado',
    description:
      'Usa un video MP4, MOV o WEBM, o un audio MP3, WAV o M4A. Si tu archivo viene de otra app, expórtalo a MP4.',
    actions: ['choose-another-file'],
  },
  'file-too-large': {
    title: 'El archivo es demasiado grande',
    description:
      'Tu navegador no puede manejar un archivo tan pesado. Recórtalo o expórtalo con menor calidad e inténtalo de nuevo.',
    actions: ['choose-another-file', 'trim-media'],
  },
  'media-too-long': {
    title: 'El video es demasiado largo',
    description:
      'Para no agotar la memoria, Letritas transcribe hasta 2 horas por archivo. Divide el video en partes más cortas.',
    actions: ['choose-another-file', 'trim-media'],
  },
  'decode-failed': {
    title: 'No pudimos leer el audio',
    description:
      'El archivo puede estar dañado o usar un códec que tu navegador no soporta. Prueba exportarlo de nuevo como MP4 (H.264 + AAC).',
    actions: ['choose-another-file'],
  },
  'no-audio-track': {
    title: 'Este archivo no tiene audio',
    description:
      'No encontramos ninguna pista de audio que transcribir. Elige un video con sonido.',
    actions: ['choose-another-file'],
  },
  'webgpu-unavailable': {
    title: 'WebGPU no está disponible',
    description:
      'Tu navegador o tu tarjeta gráfica no ofrecen WebGPU. Podemos usar WASM (el procesador): funciona igual, solo es más lento.',
    actions: ['use-wasm'],
  },
  'model-download-failed': {
    title: 'No se pudo descargar el modelo',
    description:
      'Revisa tu conexión e inténtalo de nuevo. El modelo se descarga una sola vez y luego queda guardado en tu navegador.',
    actions: ['retry', 'smaller-model'],
  },
  'offline-model-missing': {
    title: 'Necesitas internet una vez',
    description:
      'Este modelo todavía no está guardado en tu navegador. Conéctate para descargarlo; después funcionará sin internet.',
    actions: ['go-online', 'retry'],
  },
  'out-of-memory': {
    title: 'Tu equipo se quedó sin memoria',
    description:
      'Prueba con un modelo más pequeño, cierra otras pestañas o usa un archivo más corto.',
    actions: ['smaller-model', 'use-wasm', 'retry'],
  },
  'transcription-failed': {
    title: 'La transcripción falló',
    description:
      'Algo salió mal mientras la IA procesaba el audio. Inténtalo otra vez o prueba con otro modelo.',
    actions: ['retry', 'smaller-model', 'use-wasm'],
  },
  'no-speech': {
    title: 'No encontramos voz',
    description:
      'La IA no detectó palabras en este audio. Revisa que el video tenga voz audible o elige otro idioma.',
    actions: ['retry', 'choose-another-file'],
  },
  'export-unsupported': {
    title: 'Tu navegador no puede crear el video',
    description:
      'Este navegador no puede codificar video. Descarga los subtítulos (SRT o ASS) y quémalos con tu editor, o prueba en Chrome o Edge.',
    actions: ['download-subtitles'],
  },
  'export-failed': {
    title: 'No se pudo exportar el video',
    description:
      'La exportación se interrumpió. Inténtalo de nuevo, prueba en formato WebM o descarga solo los subtítulos.',
    actions: ['retry', 'export-webm', 'download-subtitles'],
  },
  'storage-failed': {
    title: 'No se pudo guardar el proyecto',
    description:
      'El almacenamiento del navegador está lleno o bloqueado (por ejemplo, en modo incógnito). Tus subtítulos siguen aquí: descárgalos para no perderlos.',
    actions: ['download-subtitles', 'dismiss'],
  },
  unknown: {
    title: 'Algo salió mal',
    description:
      'Ocurrió un error inesperado. Inténtalo de nuevo; si se repite, recarga la página.',
    actions: ['retry', 'dismiss'],
  },
};

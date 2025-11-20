
export interface SubtitleChunk {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface StyleConfig {
  fontFamily: string;
  fontSize: number;
  colorText: string;
  colorBg: string;
  bgOpacity: number;
  positionY: number;
}

export interface WorkerMessage {
  status: 'loading' | 'downloading' | 'processing' | 'complete' | 'error' | 'progress' | 'fallback';
  msg?: string;
  percent?: number;
  output?: any;
  buffer?: ArrayBuffer;
}

export type OutputFormat = 'vertical' | 'horizontal';

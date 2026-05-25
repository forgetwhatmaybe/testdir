import { postJson } from './client';

export interface ProcessAudioParams {
  action: 'crop' | 'convert' | 'effects' | 'merge' | 'volume' | 'normalize' | 'waveform';
  input_path: string;
  project: string;
  start_time?: number;
  end_time?: number;
  output_format?: string;
  volume_db?: number;
  normalize?: boolean;
  fade_in?: number;
  fade_out?: number;
  reverb_level?: number;
  eq_settings?: string;
  compressor_settings?: string;
  limiter_settings?: string;
  noise_reduction?: boolean;
  pitch_shift?: number;
}

export interface ProcessAudioResponse {
  success: boolean;
  output_path?: string;
  message?: string;
  waveform?: number[];
}

export function processAudio(params: ProcessAudioParams): Promise<ProcessAudioResponse> {
  const { action, ...body } = params;
  return postJson<ProcessAudioResponse>(`/audio/process?action=${action}`, body);
}

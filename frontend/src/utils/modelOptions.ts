/** 各节点参数选项常量。与 testdir 中的 PyQt5 实现对齐。*/

// ---- 可灵 ----
export const KLING_MODELS = [
  'kling-v3-omni', 'kling-v3', 'kling-video-o1', 'kling-v2-6', 'kling-v2-5-turbo',
  'kling-v2-master', 'kling-v2-1-master', 'kling-v2-1', 'kling-v2',
  'kling-v1-6', 'kling-v1-5', 'kling-v1',
];

export function klingDurationOptions(model: string): number[] {
  if (model === 'kling-v3' || model === 'kling-v3-omni') {
    return [3, 4, 5, 7, 10, 12, 15];
  }
  return [5, 10];
}

const KLING_FIRST_LAST: Record<string, { std: boolean; pro: boolean }> = {
  'kling-v3-omni':       { std: true,  pro: true  },
  'kling-v3':            { std: true,  pro: true  },
  'kling-video-o1':      { std: true,  pro: true  },
  'kling-v1':            { std: false, pro: true  },
  'kling-v1-5':          { std: false, pro: true  },
  'kling-v1-6':          { std: false, pro: true  },
  'kling-v2':            { std: false, pro: false },
  'kling-v2-master':     { std: false, pro: false },
  'kling-v2-1':          { std: false, pro: true  },
  'kling-v2-1-master':   { std: false, pro: false },
  'kling-v2-5-turbo':    { std: false, pro: true  },
  'kling-v2-6':          { std: false, pro: true  },
};

export function klingSupportsFirstLast(model: string, resolution: '720p' | '1080p'): boolean {
  const m = KLING_FIRST_LAST[model];
  if (!m) return false;
  return resolution === '720p' ? m.std : m.pro;
}

// ---- 即梦 ----
export const JIMENG_MODELS = ['jimeng_v1', 'jimeng_v2', 'jimeng_v30', 'jimeng_v30_pro'];
export const JIMENG_DURATIONS = [5, 10];
// 仅 jimeng_v30 暴露 720P/1080P；其他不显示分辨率
export function jimengShowsResolution(model: string): boolean {
  return model === 'jimeng_v30';
}
// jimeng_v30_pro 仅图生视频
export function jimengAllowFirstLast(model: string): boolean {
  return model !== 'jimeng_v30_pro';
}

// ---- Gemini ----
export const GEMINI_MODELS = [
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
  'gemini-2.5-flash-preview-image-generation',
  'gemini-2.0-flash-preview-image-generation',
];
export const GEMINI_ASPECT = ['16:9', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '21:9'];
export const GEMINI_SIZES = ['1K', '2K', '4K'];
export function geminiSupportsImageSize(model: string): boolean {
  return model.includes('pro') || model.includes('3.1-flash');
}
export const GEMINI_REFS_MAX = 14;

// ---- Veo3 ----
export const VEO3_MODELS = [
  'veo_3_1', 'veo_3_1-fast', 'veo3.1', 'veo3.1-fast', 'veo3.1-pro', 'veo3.1-4k', 'veo3.1-pro-4k',
  'veo3', 'veo3-pro', 'veo3-fast', 'veo3-fast-frames', 'veo3-frames', 'veo3-pro-frames',
  'veo2-pro', 'veo2-fast', 'veo2-fast-frames', 'veo2-fast-components', 'veo2-pro-components',
];

// ---- 文本视觉 ----
export const TEXT_VISION_MODELS = ['gpt-5.4', 'gemini-3.1-pro-preview'];
export function thinkingOptions(model: string): string[] {
  return model.startsWith('gpt')
    ? ['none', 'low', 'medium', 'high', 'xhigh']
    : ['low', 'medium', 'high'];
}
export const FORMAT_MODES = ['无', '图片反推json', 'json格式'];

export function normalizeGenerationMode(
  mode: string | undefined,
  generationMode: string | undefined,
  fallback: string,
): string {
  const raw = mode || generationMode || fallback;
  return {
    image_to_video: 'image2video',
    first_last_frame: 'first_last',
    multimodal: 'reference',
  }[raw] || raw;
}

// ---- 图片修改 ----
export const IMAGE_EDIT_MODES = [
  { value: 'kling_expand',  label: '可灵扩图' },
  { value: 'jimeng_super',  label: '即梦超清' },
  { value: 'jimeng_inpaint',label: '即梦局部重绘' },
];

// ---- Seedance 2.0 ----
export const SEEDANCE_MODES = [
  { value: 'reference', label: '参考生视频' },
  { value: 'image2video', label: '图生视频' },
  { value: 'first_last', label: '首尾帧' },
];
export const SEEDANCE_QUALITIES = ['480p', '720p', '1080p'];
export const SEEDANCE_ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'];

// ---- Token 估算 ----
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // 中文 1 字符约 1 token，英文按 4 字符 1 token 粗估
  let zh = 0;
  let other = 0;
  for (const ch of text) {
    if (/[一-鿿]/.test(ch)) zh += 1;
    else other += 1;
  }
  return zh + Math.ceil(other / 4);
}

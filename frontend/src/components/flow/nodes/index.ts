import ImageNode from './ImageNode';
import VideoNode from './VideoNode';
import AudioNode from './AudioNode';
import KlingNode from './KlingNode';
import JimengNode from './JimengNode';
import GeminiNode from './GeminiNode';
import Veo3Node from './Veo3Node';
import Seedance2Node from './Seedance2Node';
import ImageEditNode from './ImageEditNode';
import TextVisionNode from './TextVisionNode';
import TextDisplayNode from './TextDisplayNode';
import OutputNode from './OutputNode';
import StoryboardNode from './StoryboardNode';

export const nodeTypes = {
  image: ImageNode,
  video: VideoNode,
  audio: AudioNode,
  kling: KlingNode,
  jimeng: JimengNode,
  gemini: GeminiNode,
  veo3: Veo3Node,
  seedance2: Seedance2Node,
  image_edit: ImageEditNode,
  text_vision: TextVisionNode,
  text_display: TextDisplayNode,
  output: OutputNode,
  storyboard: StoryboardNode,
};

export const nodeMeta: Record<string, { label: string; color: string; group: string }> = {
  image:        { label: '图片上传',     color: '#4caf50', group: '素材' },
  video:        { label: '视频上传',     color: '#2196f3', group: '素材' },
  audio:        { label: '音频上传',     color: '#80cbc4', group: '素材' },
  kling:        { label: '可灵生视频',   color: '#7e57c2', group: '生视频' },
  jimeng:       { label: '即梦生视频',   color: '#ff7043', group: '生视频' },
  veo3:         { label: 'Veo3 生视频',  color: '#42a5f5', group: '生视频' },
  seedance2:    { label: 'Seedance 2.0', color: '#9c27b0', group: '生视频' },
  gemini:       { label: '香蕉生图',     color: '#ffb300', group: '生图' },
  image_edit:   { label: '图片修改',     color: '#ec407a', group: '生图' },
  text_vision:  { label: '文本识图',     color: '#26a69a', group: '文本' },
  text_display: { label: '文本显示',     color: '#9ccc65', group: '文本' },
  output:       { label: '视频/图片输出', color: '#90a4ae', group: '输出' },
  storyboard:   { label: '图片分镜处理', color: '#7b1fa2', group: '素材' },
};

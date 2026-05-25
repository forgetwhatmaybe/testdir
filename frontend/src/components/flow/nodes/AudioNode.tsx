import { memo, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Button, Upload, App as AntApp, Dropdown, Slider, Progress, Space, Select, Tooltip, Menu, InputNumber, ColorPicker, Switch, Collapse, Divider, Modal } from 'antd';
import { 
  UploadOutlined, PlayCircleOutlined, PauseOutlined, StopOutlined, 
  SoundOutlined, ScissorOutlined, SettingOutlined, FolderOpenOutlined, 
  ReloadOutlined, DownloadOutlined, InfoCircleOutlined, EditOutlined, 
  DeleteOutlined, CopyOutlined, ExportOutlined, AudioOutlined, 
  RetweetOutlined, FilterOutlined, ThunderboltOutlined, SyncOutlined,
  ExpandOutlined, MoreOutlined, SaveOutlined, FileAddOutlined,
  NodeExpandOutlined, DragOutlined, CaretRightOutlined, ApiOutlined,
  FastForwardOutlined, FastBackwardOutlined, StepForwardOutlined,
  StepBackwardOutlined, AlertOutlined, CheckCircleOutlined,
  CloseCircleOutlined, LoadingOutlined, SwapOutlined
} from '@ant-design/icons';
import NodeShell from './shared/NodeShell';
import { useFlowStore } from '../../../store/flowStore';
import { useProjectStore } from '../../../store/projectStore';
import { uploadFile, openFolder, downloadFile } from '../../../api/files';
import { processAudio } from '../../../api/audio';

type Data = {
  audio_path?: string;
  volume?: number;
  startTime?: number;
  endTime?: number;
  format?: string;
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  audio_name?: string;
  audio_size?: number;
  audio_type?: string;
  waveform_color?: string;
  waveform_thickness?: number;
  waveform_style?: 'bars' | 'line' | 'wave' | 'spectrum';
  show_advanced?: boolean;
  loop_playback?: boolean;
  auto_play?: boolean;
  normalize_audio?: boolean;
  fade_in?: number;
  fade_out?: number;
  reverb_level?: number;
  eq_settings?: string;
  compressor_settings?: string;
  limiter_settings?: string;
  playback_rate?: number;
  pitch_shift?: number;
  noise_reduction?: boolean;
};

const lightenColor = (color: string, amount: number) => {
  const hex = color.replace('#', '');
  const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + Math.floor(255 * amount));
  const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + Math.floor(255 * amount));
  const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + Math.floor(255 * amount));
  return `rgb(${r},${g},${b})`;
};

const darkenColor = (color: string, amount: number) => {
  const hex = color.replace('#', '');
  const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - Math.floor(255 * amount));
  const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - Math.floor(255 * amount));
  const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - Math.floor(255 * amount));
  return `rgb(${r},${g},${b})`;
};

const AudioNodeComponent = memo(function AudioNodeComponent({ id, data, selected }: NodeProps<Data>) {
  const { message } = AntApp.useApp();
  const project = useProjectStore((s) => s.current);
  const nodes = useFlowStore((s) => s.nodes);
  const setNodes = useFlowStore((s) => s.setNodes);
  const pushHistory = useFlowStore((s) => s.pushHistory);
  const deleteNode = useFlowStore((s) => s.deleteNode);
  const duplicateNode = useFlowStore((s) => s.duplicateNode);

  const [volume, setVolume] = useState<number>(data.volume ?? 80);
  const [isPlaying, setIsPlaying] = useState<boolean>(data.isPlaying ?? false);
  const [currentTime, setCurrentTime] = useState<number>(data.currentTime ?? 0);
  const [duration, setDuration] = useState<number>(data.duration ?? 0);
  const [startTime, setStartTime] = useState<number>(data.startTime ?? 0);
  const [endTime, setEndTime] = useState<number>(data.endTime ?? 0);
  const [format, setFormat] = useState<string>(data.format ?? 'mp3');
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(data.show_advanced ?? false);
  const [waveformColor, setWaveformColor] = useState<string>(data.waveform_color ?? '#00bcd4');
  const [waveformStyle, setWaveformStyle] = useState<string>(data.waveform_style ?? 'bars');
  const [waveformThickness, setWaveformThickness] = useState<number>(data.waveform_thickness ?? 2);
  const [loopPlayback, setLoopPlayback] = useState<boolean>(data.loop_playback ?? false);
  const [autoPlay, setAutoPlay] = useState<boolean>(data.auto_play ?? false);
  const [normalizeAudio, setNormalizeAudio] = useState<boolean>(data.normalize_audio ?? false);
  const [fadeIn, setFadeIn] = useState<number>(data.fade_in ?? 0);
  const [fadeOut, setFadeOut] = useState<number>(data.fade_out ?? 0);
  const [reverbLevel, setReverbLevel] = useState<number>(data.reverb_level ?? 0);
  const [eqSettings, setEqSettings] = useState<string>(data.eq_settings ?? 'flat');
  const [compressorSettings, setCompressorSettings] = useState<string>(data.compressor_settings ?? 'off');
  const [limiterSettings, setLimiterSettings] = useState<string>(data.limiter_settings ?? 'off');
  const [playbackRate, setPlaybackRate] = useState<number>(data.playback_rate ?? 1.0);
  const [pitchShift, setPitchShift] = useState<number>(data.pitch_shift ?? 0);
  const [noiseReduction, setNoiseReduction] = useState<boolean>(data.noise_reduction ?? false);
  const [audioMetadata, setAudioMetadata] = useState<any>({});
  const [showMetaModal, setShowMetaModal] = useState<boolean>(false);
  const [spectrumIntensity, setSpectrumIntensity] = useState<number>(0);
  const [processingAction, setProcessingAction] = useState<string>('');
  const [borderPhase, setBorderPhase] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const borderAnimRef = useRef<number | null>(null);
  const gradientDirection = useRef(0);

  /* ---- Spectrum border animation loop ---- */
  useEffect(() => {
    if (isPlaying) {
      const animateBorder = () => {
        gradientDirection.current += 1.5;
        setBorderPhase(gradientDirection.current % 360);
        borderAnimRef.current = requestAnimationFrame(animateBorder);
      };
      borderAnimRef.current = requestAnimationFrame(animateBorder);
      return () => { if (borderAnimRef.current) cancelAnimationFrame(borderAnimRef.current); };
    } else {
      setBorderPhase(0);
    }
  }, [isPlaying]);

  /* ---- Init audio ---- */
  useEffect(() => {
    if (data.audio_path && project) {
      const audioUrl = `/${project}/${data.audio_path}`;
      if (!audioRef.current) {
        const a = new Audio(audioUrl);
        a.volume = volume / 100;
        a.loop = loopPlayback;
        a.playbackRate = playbackRate;
        audioRef.current = a;

        a.addEventListener('loadedmetadata', () => {
          const d = a.duration || 0;
          setDuration(d);
          if (endTime === 0) setEndTime(d);
          generateWaveform();
          loadAudioMetadata();
        });
        a.addEventListener('timeupdate', () => { setCurrentTime(a.currentTime); });
        a.addEventListener('ended', () => {
          if (!loopPlayback) { setIsPlaying(false); a.currentTime = startTime; setCurrentTime(startTime); }
        });
        if (autoPlay) { a.play(); setIsPlaying(true); }
      }
    }
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (borderAnimRef.current) cancelAnimationFrame(borderAnimRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
    };
  }, [data.audio_path, project]);

  useEffect(() => { if (audioRef.current) audioRef.current.loop = loopPlayback; }, [loopPlayback]);
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = playbackRate; }, [playbackRate]);

  /* waveform redraw */
  useEffect(() => { drawWaveform(); }, [waveformData, currentTime, duration, waveformColor, waveformStyle, waveformThickness, spectrumIntensity]);

  /* spectrum animation loop */
  useEffect(() => {
    if (waveformStyle === 'spectrum' && isPlaying) {
      const animate = () => { drawSpectrumFrame(); animationRef.current = requestAnimationFrame(animate); };
      animationRef.current = requestAnimationFrame(animate);
      return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
    }
  }, [waveformStyle, isPlaying]);

  /* ---- Helpers ---- */
  const updateNodeData = (nd: Partial<Data>) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, data: { ...(n.data as object), ...nd } } : n));
    pushHistory();
  };

  const onUpload = async (file: File) => {
    if (!project) { message.error('No project'); return false; }
    try {
      const r = await uploadFile(project, file);
      updateNodeData({ audio_path: r.rel_path, audio_name: file.name });
      message.success('Uploaded');
    } catch (e: any) { message.error(e.message); }
    return false;
  };

  const loadAudioMetadata = async () => {
    if (!data.audio_path || !project) return;
    try {
      const resp = await fetch(`/${project}/${data.audio_path}`);
      const blob = await resp.blob();
      const a = new Audio(URL.createObjectURL(blob));
      a.addEventListener('loadedmetadata', () => {
        setAudioMetadata({
          name: data.audio_path!.split('/').pop() || '',
          size: blob.size,
          type: blob.type,
          duration: a.duration,
          bitrate: Math.round(blob.size * 8 / a.duration / 1000),
        });
      });
    } catch {}
  };

  const generateWaveform = async () => {
    if (!data.audio_path || !project) return;
    try {
      const resp = await fetch(`/${project}/${data.audio_path}`);
      const ab = await resp.arrayBuffer();
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buf = await ctx.decodeAudioData(ab);
      const ch = buf.getChannelData(0);
      const samples = 200;
      const bs = Math.floor(ch.length / samples);
      const wf: number[] = [];
      for (let i = 0; i < samples; i++) {
        let s = 0;
        for (let j = 0; j < bs && (i * bs + j) < ch.length; j++) s += Math.abs(ch[i * bs + j]);
        wf.push(s / bs);
      }
      setWaveformData(wf);
      ctx.close();
    } catch {}
  };

  /* ---- Canvas drawing ---- */
  const drawWaveform = () => {
    const c = canvasRef.current; if (!c || waveformData.length === 0) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width, H = c.height, bw = W / waveformData.length;
    const cx = duration > 0 ? (currentTime / duration) * W : 0;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, H);

    if (waveformStyle === 'bars') {
      waveformData.forEach((v, i) => {
        const x = i * bw, bh = Math.max(1, v * H * 2.2), y = (H - bh) / 2;
        const g = ctx.createLinearGradient(x, y, x + bw, y + bh);
        g.addColorStop(0, waveformColor);
        g.addColorStop(0.5, lightenColor(waveformColor, 0.25));
        g.addColorStop(1, darkenColor(waveformColor, 0.25));
        ctx.fillStyle = g;
        ctx.fillRect(x, y, bw - 1, bh);
      });
    } else {
      ctx.beginPath();
      ctx.lineWidth = waveformThickness;
      ctx.lineCap = 'round';
      const lg = ctx.createLinearGradient(0, 0, W, 0);
      lg.addColorStop(0, waveformColor);
      lg.addColorStop(0.5, lightenColor(waveformColor, 0.4));
      lg.addColorStop(1, waveformColor);
      ctx.strokeStyle = lg;
      const cy = H / 2, amp = H * 0.42;
      waveformData.forEach((v, i) => {
        const x = i * bw;
        const y = cy - (v * amp * (waveformStyle === 'wave' ? Math.sin(i * 0.08) : 1));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    /* playhead glow */
    ctx.shadowColor = '#ff4081';
    ctx.shadowBlur = isPlaying ? 16 + spectrumIntensity * 8 : 12;
    ctx.strokeStyle = '#ff4081';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    ctx.shadowBlur = 0;

    /* Active region highlight during playback */
    if (isPlaying && cx > 0) {
      const hlGrad = ctx.createLinearGradient(0, 0, cx, 0);
      hlGrad.addColorStop(0, 'rgba(0, 188, 212, 0.12)');
      hlGrad.addColorStop(1, 'rgba(255, 64, 129, 0.08)');
      ctx.fillStyle = hlGrad;
      ctx.fillRect(0, 0, cx, H);
    }
  };

  const drawSpectrumFrame = () => {
    const c = canvasRef.current; if (!c || !analyserRef.current) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width, H = c.height;
    const bl = analyserRef.current.frequencyBinCount;
    const da = new Uint8Array(bl);
    analyserRef.current.getByteFrequencyData(da);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, H);
    const bw = (W / bl) * 2.5;
    let x = 0;
    for (let i = 0; i < bl; i++) {
      const bh = da[i] * (H / 256);
      const g = ctx.createLinearGradient(0, H - bh, 0, H);
      g.addColorStop(0, waveformColor);
      g.addColorStop(0.5, lightenColor(waveformColor, 0.4));
      g.addColorStop(1, darkenColor(waveformColor, 0.3));
      ctx.fillStyle = g;
      ctx.fillRect(x, H - bh, bw - 1, bh);
      x += bw;
    }
    const total = da.reduce((a, b) => a + b, 0) / bl;
    setSpectrumIntensity(total / 255);
  };

  /* ---- Actions ---- */
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); if (animationRef.current) cancelAnimationFrame(animationRef.current); }
    else {
      if (audioRef.current.currentTime >= endTime) { audioRef.current.currentTime = startTime; setCurrentTime(startTime); }
      audioRef.current.play(); setIsPlaying(true);
      const upd = () => { if (audioRef.current) { setCurrentTime(audioRef.current.currentTime); if (audioRef.current.currentTime < endTime) animationRef.current = requestAnimationFrame(upd); else { stopAudio(); } } };
      animationRef.current = requestAnimationFrame(upd);
      if (waveformStyle === 'spectrum') setupAudioContext();
    }
    updateNodeData({ isPlaying: !isPlaying });
  };

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = startTime; }
    setIsPlaying(false); setCurrentTime(startTime);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    updateNodeData({ isPlaying: false, currentTime: startTime });
  };

  const setupAudioContext = () => {
    if (!audioRef.current || !canvasRef.current) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AC();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      const src = audioContextRef.current.createMediaElementSource(audioRef.current);
      src.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    } catch {}
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v / 100;
    updateNodeData({ volume: v });
  };

  const handleCrop = async () => {
    if (!data.audio_path || !project) { message.error('No audio file'); return; }
    setIsProcessing(true); setProgress(0); setProcessingAction('crop');
    try {
      const iv = setInterval(() => setProgress(p => p >= 90 ? p : p + 10), 200);
      const result = await processAudio({ action: 'crop', input_path: data.audio_path, start_time: startTime, end_time: endTime, output_format: format, project });
      clearInterval(iv); setProgress(100);
      updateNodeData({ audio_path: result.output_path });
      message.success('Cropped');
      setTimeout(() => { setProgress(0); setProcessingAction(''); }, 1000);
    } catch (e: any) { message.error(e.message); setIsProcessing(false); setProcessingAction(''); }
    finally { setIsProcessing(false); }
  };

  const handleConvert = async () => {
    if (!data.audio_path || !project) { message.error('No audio file'); return; }
    setIsProcessing(true); setProgress(0); setProcessingAction('convert');
    try {
      const iv = setInterval(() => setProgress(p => p >= 90 ? p : p + 10), 200);
      const result = await processAudio({ action: 'convert', input_path: data.audio_path, output_format: format, project });
      clearInterval(iv); setProgress(100);
      updateNodeData({ audio_path: result.output_path });
      message.success(`Converted to ${format.toUpperCase()}`);
      setTimeout(() => { setProgress(0); setProcessingAction(''); }, 1000);
    } catch (e: any) { message.error(e.message); setIsProcessing(false); setProcessingAction(''); }
    finally { setIsProcessing(false); }
  };

  const handleApplyEffects = async () => {
    if (!data.audio_path || !project) { message.error('No audio file'); return; }
    setIsProcessing(true); setProgress(0); setProcessingAction('effects');
    try {
      const iv = setInterval(() => setProgress(p => p >= 90 ? p : p + 10), 200);
      const result = await processAudio({
        action: 'effects',
        input_path: data.audio_path,
        normalize: normalizeAudio,
        fade_in: fadeIn,
        fade_out: fadeOut,
        reverb_level: reverbLevel,
        eq_settings: eqSettings,
        compressor_settings: compressorSettings,
        limiter_settings: limiterSettings,
        noise_reduction: noiseReduction,
        pitch_shift: pitchShift,
        project
      });
      clearInterval(iv); setProgress(100);
      updateNodeData({ audio_path: result.output_path });
      message.success('Effects applied');
      setTimeout(() => { setProgress(0); setProcessingAction(''); }, 1000);
    } catch (e: any) { message.error(e.message); setIsProcessing(false); setProcessingAction(''); }
    finally { setIsProcessing(false); }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60), se = Math.floor(s % 60);
    return `${m}:${se.toString().padStart(2, '0')}`;
  };

  const fileName = data.audio_path?.split('/').pop() || '';
  const display = fileName.length > 20 ? `${fileName.slice(0, 17)}...` : fileName;

  /* ---- Right-click context menu ---- */
  const contextMenuItems: any[] = [
    { key: 'play', icon: isPlaying ? <PauseOutlined /> : <CaretRightOutlined />, label: isPlaying ? 'Pause' : 'Play' },
    { key: 'stop', icon: <StopOutlined />, label: 'Stop' },
    { type: 'divider' },
    { key: 'folder', icon: <FolderOpenOutlined />, label: 'Open Containing Folder', disabled: !data.audio_path },
    { key: 'download', icon: <DownloadOutlined />, label: 'Download Audio', disabled: !data.audio_path },
    { key: 'metadata', icon: <InfoCircleOutlined />, label: 'Audio Info', disabled: !data.audio_path },
    { type: 'divider' },
    { key: 'crop', icon: <ScissorOutlined />, label: 'Crop Audio', disabled: !data.audio_path },
    { key: 'convert', icon: <RetweetOutlined />, label: 'Convert Format', disabled: !data.audio_path },
    { key: 'effects', icon: <FilterOutlined />, label: 'Apply Effects', disabled: !data.audio_path },
    { type: 'divider' },
    { key: 'regenerate', icon: <ReloadOutlined />, label: 'Regenerate Waveform', disabled: !data.audio_path },
    { key: 'advanced', icon: <SettingOutlined />, label: showAdvanced ? 'Hide Advanced' : 'Show Advanced' },
    { type: 'divider' },
    { key: 'duplicate', icon: <CopyOutlined />, label: 'Duplicate Node' },
    { key: 'delete', icon: <DeleteOutlined />, label: 'Delete Node', danger: true },
  ];

  const handleContextMenu = (e: any) => {
    switch (e.key) {
      case 'play': togglePlay(); break;
      case 'stop': stopAudio(); break;
      case 'folder': if (data.audio_path) openFolder(`${project}/${data.audio_path}`); break;
      case 'download': if (data.audio_path) downloadFile(project!, data.audio_path); break;
      case 'metadata': setShowMetaModal(true); break;
      case 'crop': handleCrop(); break;
      case 'convert': handleConvert(); break;
      case 'effects': handleApplyEffects(); break;
      case 'regenerate': generateWaveform(); break;
      case 'advanced': setShowAdvanced(!showAdvanced); updateNodeData({ show_advanced: !showAdvanced }); break;
      case 'duplicate': duplicateNode(id); break;
      case 'delete': Modal.confirm({ title: 'Delete Audio Node?', content: 'This will remove the node from the flow.', okText: 'Delete', okType: 'danger', cancelText: 'Cancel', onOk: () => deleteNode(id) }); break;
    }
  };

  /* Dynamic spectrum border computed values */
  const borderHue = useMemo(() => {
    return isPlaying ? `hue-rotate(${borderPhase}deg)` : 'hue-rotate(0deg)';
  }, [isPlaying, borderPhase]);

  const borderGlow = useMemo(() => {
    const i = isPlaying ? spectrumIntensity : 0;
    const alpha = 0.35 + i * 0.55;
    return `0 0 ${10 + i * 18}px rgba(0, 188, 212, ${alpha}), inset 0 0 ${5 + i * 10}px rgba(0, 188, 212, ${alpha * 0.5}), 0 0 ${20 + i * 25}px rgba(0, 188, 212, ${alpha * 0.25})`;
  }, [isPlaying, spectrumIntensity]);

  return (
    <NodeShell type="audio" selected={selected} title="Audio Node" color="#00bcd4" variant="audio" nodeId={id}>
      <Dropdown menu={{ items: contextMenuItems, onClick: handleContextMenu }} trigger={['contextMenu']}>
        <div
          className="audio-node-container"
          style={{
            padding: '8px',
            background: 'linear-gradient(135deg, #0a1929 0%, #0d2837 100%)',
            borderRadius: '10px',
            border: '2px solid rgba(0, 188, 212, 0.4)',
            boxShadow: borderGlow,
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
            position: 'relative',
            overflow: 'hidden',
            filter: isPlaying ? borderHue : undefined,
            animation: isPlaying ? 'audioNodePulse 1.5s ease-in-out infinite' : 'none',
          }}
        >
          {/* Animated spectrum border — top */}
          <div
            className="audio-spectrum-border audio-spectrum-border-top"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
              background: `linear-gradient(90deg, transparent 0%, ${waveformColor} 20%, #ff4081 50%, ${waveformColor} 80%, transparent 100%)`,
              backgroundSize: '200% 100%',
              animation: `audioBorderShine ${isPlaying ? 1.2 : 3}s linear infinite`,
              opacity: isPlaying ? 1 : 0.35,
              filter: isPlaying ? `drop-shadow(0 0 6px ${waveformColor})` : 'none',
            }}
          />
          {/* Animated spectrum border — bottom */}
          <div
            className="audio-spectrum-border audio-spectrum-border-bottom"
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px',
              background: `linear-gradient(90deg, transparent 0%, ${waveformColor} 20%, #ff4081 50%, ${waveformColor} 80%, transparent 100%)`,
              backgroundSize: '200% 100%',
              animation: `audioBorderShine ${isPlaying ? 1.2 : 3}s linear infinite reverse`,
              opacity: isPlaying ? 1 : 0.35,
              filter: isPlaying ? `drop-shadow(0 0 6px ${waveformColor})` : 'none',
            }}
          />
          {/* Animated spectrum border — left */}
          <div
            className="audio-spectrum-border audio-spectrum-border-left"
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px',
              background: `linear-gradient(180deg, rgba(0,188,212,0.8), rgba(255,64,129,0.8), rgba(0,188,212,0.8))`,
              backgroundSize: '100% 200%',
              animation: `audioBorderVertical ${isPlaying ? 2 : 4}s linear infinite`,
              opacity: isPlaying ? 0.9 : 0.2,
              filter: isPlaying ? `drop-shadow(0 0 4px ${waveformColor})` : 'none',
            }}
          />
          {/* Animated spectrum border — right */}
          <div
            className="audio-spectrum-border audio-spectrum-border-right"
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: '2px',
              background: `linear-gradient(180deg, rgba(255,64,129,0.8), rgba(0,188,212,0.8), rgba(255,64,129,0.8))`,
              backgroundSize: '100% 200%',
              animation: `audioBorderVertical ${isPlaying ? 2 : 4}s linear infinite reverse`,
              opacity: isPlaying ? 0.9 : 0.2,
              filter: isPlaying ? `drop-shadow(0 0 4px #ff4081)` : 'none',
            }}
          />

          {/* Playing particle overlay */}
          {isPlaying && (
            <div
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: `radial-gradient(ellipse at center, rgba(0,188,212,${0.03 + spectrumIntensity * 0.08}) 0%, transparent 70%)`,
                pointerEvents: 'none',
                animation: 'audioParticlePulse 2s ease-in-out infinite',
              }}
            />
          )}

          {/* Waveform Canvas */}
          {data.audio_path && waveformData.length > 0 && (
            <div style={{ marginBottom: 6, position: 'relative' }}>
              <canvas
                ref={canvasRef}
                width={280}
                height={64}
                style={{
                  width: '100%', height: 64, borderRadius: 6,
                  cursor: 'pointer', background: 'rgba(0,0,0,0.3)',
                  border: `1px solid ${waveformColor}33`,
                  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                  boxShadow: isPlaying ? `inset 0 0 12px rgba(0,188,212,0.15)` : 'none',
                }}
                onClick={(e) => {
                  if (!duration) return;
                  const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  const t = pct * duration;
                  setCurrentTime(t);
                  if (audioRef.current) audioRef.current.currentTime = t;
                  updateNodeData({ currentTime: t });
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#80deea', marginTop: 3, fontWeight: 500 }}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Main controls row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ 
                fontSize: 20, 
                color: waveformColor, 
                textShadow: isPlaying ? `0 0 12px ${waveformColor}, 0 0 24px ${waveformColor}` : `0 0 6px ${waveformColor}`,
                animation: isPlaying ? 'audioIconPulse 0.8s ease-in-out infinite' : 'none',
                transition: 'text-shadow 0.3s ease',
              }}>
                {data.audio_path ? '\u{1F3B5}' : '\u{1F3A4}'}
              </span>
              <span style={{ fontSize: 11, color: '#80deea', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {data.audio_path ? display : 'No audio selected'}
              </span>
            </div>
            {data.audio_path && (
              <Space size={2}>
                <Tooltip title="Skip Back 5s"><Button type="text" size="small" icon={<StepBackwardOutlined />} className="audio-ctrl-btn" style={{ color: '#80deea' }} onClick={() => { if (audioRef.current) { const t = Math.max(startTime, audioRef.current.currentTime - 5); audioRef.current.currentTime = t; setCurrentTime(t); } }} /></Tooltip>
                <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
                  <Button type="text" size="small" icon={isPlaying ? <PauseOutlined /> : <PlayCircleOutlined />} onClick={togglePlay}
                    className={`audio-ctrl-btn audio-play-btn ${isPlaying ? 'playing' : ''}`}
                    style={{ 
                      color: isPlaying ? '#ff4081' : '#80deea', 
                      fontSize: 17,
                      animation: isPlaying ? 'audioPlayBtnPulse 1s ease-in-out infinite' : 'none',
                    }} 
                  />
                </Tooltip>
                <Tooltip title="Stop"><Button type="text" size="small" icon={<StopOutlined />} className="audio-ctrl-btn" onClick={stopAudio} style={{ color: '#80deea' }} /></Tooltip>
                <Tooltip title="Skip Forward 5s"><Button type="text" size="small" icon={<StepForwardOutlined />} className="audio-ctrl-btn" style={{ color: '#80deea' }} onClick={() => { if (audioRef.current) { const t = Math.min(endTime, audioRef.current.currentTime + 5); audioRef.current.currentTime = t; setCurrentTime(t); } }} /></Tooltip>
              </Space>
            )}
          </div>

          {/* Processing progress */}
          {isProcessing && (
            <div style={{ marginBottom: 6 }}>
              <Progress percent={progress} size="small" strokeColor={{ from: waveformColor, to: '#0097a7' }} format={() => `${processingAction}...`} />
            </div>
          )}

          {data.audio_path && (
            <div style={{ padding: 6, background: 'rgba(0,0,0,0.25)', borderRadius: 6, marginBottom: 6 }}>
              {/* Volume */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <SoundOutlined style={{ color: '#80deea', fontSize: 13, animation: isPlaying ? 'audioIconPulse 1.5s ease-in-out infinite' : 'none' }} />
                <Slider min={0} max={100} value={volume} onChange={handleVolumeChange} style={{ flex: 1 }}
                  styles={{ track: { background: `linear-gradient(90deg, ${waveformColor}, #00bcd4)` }, handle: { borderColor: waveformColor } }} />
                <span style={{ color: '#80deea', fontSize: 11, width: 28 }}>{volume}%</span>
              </div>

              {/* Crop row */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 11, color: '#80deea' }}><ScissorOutlined /> Crop Range</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <InputNumber size="small" min={0} max={duration} step={0.1} value={startTime} onChange={v => setStartTime(v || 0)} style={{ width: 56 }} />
                  <span style={{ color: '#80deea' }}>-</span>
                  <InputNumber size="small" min={0} max={duration} step={0.1} value={endTime} onChange={v => setEndTime(v || 0)} style={{ width: 56 }} />
                  <span style={{ color: '#80deea', fontSize: 11 }}>s</span>
                  <Tooltip title="Crop Audio"><Button size="small" type="primary" icon={<ScissorOutlined />} onClick={handleCrop} disabled={isProcessing} style={{ background: `linear-gradient(135deg, ${waveformColor}, #0097a7)`, border: 'none' }} /></Tooltip>
                </div>
              </div>

              {/* Convert row */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 11, color: '#80deea' }}><RetweetOutlined /> Convert</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Select size="small" value={format} onChange={setFormat} style={{ flex: 1 }} popupMatchSelectWidth={false}>
                    <Select.Option value="mp3">MP3</Select.Option>
                    <Select.Option value="wav">WAV</Select.Option>
                    <Select.Option value="flac">FLAC</Select.Option>
                    <Select.Option value="aac">AAC</Select.Option>
                    <Select.Option value="ogg">OGG</Select.Option>
                    <Select.Option value="m4a">M4A</Select.Option>
                  </Select>
                  <Tooltip title="Convert"><Button size="small" type="primary" icon={<SwapOutlined />} onClick={handleConvert} disabled={isProcessing} style={{ background: `linear-gradient(135deg, ${waveformColor}, #0097a7)`, border: 'none' }} /></Tooltip>
                </div>
              </div>
            </div>
          )}

          {/* Advanced panel */}
          {showAdvanced && data.audio_path && (
            <div 
              className="panel-expand"
              style={{ padding: 6, background: 'rgba(0,0,0,0.2)', borderRadius: 6, marginBottom: 6, maxHeight: 220, overflowY: 'auto' }}
            >
              <div style={{ fontSize: 11, color: '#80deea', marginBottom: 6, fontWeight: 'bold', textShadow: `0 0 6px ${waveformColor}33` }}>
                Advanced Audio Settings
              </div>

              {/* Waveform style */}
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#80deea', width: 50 }}>Style:</span>
                <Select size="small" value={waveformStyle} onChange={v => { setWaveformStyle(v); updateNodeData({ waveform_style: v as any }); }} style={{ flex: 1 }}>
                  <Select.Option value="bars">Bars</Select.Option>
                  <Select.Option value="line">Line</Select.Option>
                  <Select.Option value="wave">Wave</Select.Option>
                  <Select.Option value="spectrum">Live Spectrum</Select.Option>
                </Select>
              </div>

              {/* Waveform color */}
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#80deea', width: 50 }}>Color:</span>
                <ColorPicker size="small" value={waveformColor} onChange={(c) => { setWaveformColor(c.toHexString()); updateNodeData({ waveform_color: c.toHexString() }); }} />
                <span style={{ fontSize: 10, color: waveformColor }}>{waveformColor}</span>
              </div>

              <Divider style={{ margin: '4px 0', borderColor: '#1a4a55' }} />

              {/* Playback */}
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#80deea' }}>Loop</span>
                <Switch size="small" checked={loopPlayback} onChange={v => { setLoopPlayback(v); updateNodeData({ loop_playback: v }); }} />
              </div>
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#80deea' }}>Auto-play</span>
                <Switch size="small" checked={autoPlay} onChange={v => { setAutoPlay(v); updateNodeData({ auto_play: v }); }} />
              </div>

              {/* Playback rate */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <FastForwardOutlined style={{ fontSize: 10, color: '#80deea' }} />
                  <span style={{ fontSize: 11, color: '#80deea' }}>Speed: {playbackRate.toFixed(1)}x</span>
                </div>
                <Slider min={0.5} max={2.0} step={0.1} value={playbackRate} onChange={v => { setPlaybackRate(v); updateNodeData({ playback_rate: v }); }} style={{ margin: 0 }} />
              </div>

              <Divider style={{ margin: '4px 0', borderColor: '#1a4a55' }} />

              {/* Effects toggles */}
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#80deea' }}>Normalize</span>
                <Switch size="small" checked={normalizeAudio} onChange={v => { setNormalizeAudio(v); updateNodeData({ normalize_audio: v }); }} />
              </div>
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#80deea' }}>Noise Reduction</span>
                <Switch size="small" checked={noiseReduction} onChange={v => { setNoiseReduction(v); updateNodeData({ noise_reduction: v }); }} />
              </div>

              {/* Fade in/out */}
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#80deea' }}>Fade In: {fadeIn}s</span>
                <Slider min={0} max={5} step={0.1} value={fadeIn} onChange={v => { setFadeIn(v); updateNodeData({ fade_in: v }); }} style={{ margin: 0 }} />
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#80deea' }}>Fade Out: {fadeOut}s</span>
                <Slider min={0} max={5} step={0.1} value={fadeOut} onChange={v => { setFadeOut(v); updateNodeData({ fade_out: v }); }} style={{ margin: 0 }} />
              </div>

              {/* Reverb */}
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#80deea' }}>Reverb: {reverbLevel}%</span>
                <Slider min={0} max={100} step={5} value={reverbLevel} onChange={v => { setReverbLevel(v); updateNodeData({ reverb_level: v }); }} style={{ margin: 0 }} />
              </div>

              {/* Pitch shift */}
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#80deea' }}>Pitch: {pitchShift > 0 ? '+' : ''}{pitchShift} semitones</span>
                <Slider min={-12} max={12} step={1} value={pitchShift} onChange={v => { setPitchShift(v); updateNodeData({ pitch_shift: v }); }} style={{ margin: 0 }} />
              </div>

              {/* EQ */}
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#80deea' }}>EQ Preset</span>
                <Select size="small" value={eqSettings} onChange={v => { setEqSettings(v); updateNodeData({ eq_settings: v }); }} style={{ width: '100%' }}>
                  <Select.Option value="flat">Flat</Select.Option>
                  <Select.Option value="bass_boost">Bass Boost</Select.Option>
                  <Select.Option value="treble_boost">Treble Boost</Select.Option>
                  <Select.Option value="vocal_boost">Vocal Boost</Select.Option>
                  <Select.Option value="loudness">Loudness</Select.Option>
                  <Select.Option value="podcast">Podcast</Select.Option>
                </Select>
              </div>

              {/* Compressor */}
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#80deea' }}>Compressor</span>
                <Select size="small" value={compressorSettings} onChange={v => { setCompressorSettings(v); updateNodeData({ compressor_settings: v }); }} style={{ width: '100%' }}>
                  <Select.Option value="off">Off</Select.Option>
                  <Select.Option value="light">Light</Select.Option>
                  <Select.Option value="medium">Medium</Select.Option>
                  <Select.Option value="heavy">Heavy</Select.Option>
                </Select>
              </div>

              {/* Limiter */}
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#80deea' }}>Limiter</span>
                <Select size="small" value={limiterSettings} onChange={v => { setLimiterSettings(v); updateNodeData({ limiter_settings: v }); }} style={{ width: '100%' }}>
                  <Select.Option value="off">Off</Select.Option>
                  <Select.Option value="-0.1dB">-0.1dB (Soft)</Select.Option>
                  <Select.Option value="-0.3dB">-0.3dB (Standard)</Select.Option>
                  <Select.Option value="-1dB">-1dB (Hard)</Select.Option>
                </Select>
              </div>

              <Button size="small" block icon={<FilterOutlined />} onClick={handleApplyEffects} disabled={isProcessing} style={{ background: `linear-gradient(135deg, ${waveformColor}, #0097a7)`, border: 'none', color: '#fff' }}>Apply All Effects</Button>
            </div>
          )}

          {/* Toggle advanced */}
          {data.audio_path && (
            <Button size="small" block icon={showAdvanced ? <CaretRightOutlined /> : <SettingOutlined />} onClick={() => { setShowAdvanced(!showAdvanced); updateNodeData({ show_advanced: !showAdvanced }); }} style={{ marginBottom: 6, background: 'rgba(0,188,212,0.1)', border: `1px solid ${waveformColor}44`, color: '#80deea', fontSize: 11 }}>
              {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
            </Button>
          )}
        </div>
      </Dropdown>

      <Upload showUploadList={false} beforeUpload={onUpload} accept="audio/*">
        <Button size="small" block icon={<UploadOutlined />} style={{ background: 'linear-gradient(135deg, #0d2837, rgba(0,188,212,0.08))', border: '1px solid rgba(0,188,212,0.3)', color: '#80deea' }}>
          Select Audio
        </Button>
      </Upload>

      {/* Metadata Modal */}
      <Modal title="Audio Information" open={showMetaModal} onCancel={() => setShowMetaModal(false)} footer={null} width={400}>
        <div style={{ color: '#e0e0e0', fontSize: 13 }}>
          {audioMetadata.name && <p><strong>Name:</strong> {audioMetadata.name}</p>}
          {audioMetadata.type && <p><strong>Format:</strong> {audioMetadata.type}</p>}
          {audioMetadata.duration && <p><strong>Duration:</strong> {formatTime(audioMetadata.duration)}</p>}
          {audioMetadata.size && <p><strong>Size:</strong> {(audioMetadata.size / 1024 / 1024).toFixed(2)} MB</p>}
          {audioMetadata.bitrate && <p><strong>Bitrate:</strong> {audioMetadata.bitrate} kbps</p>}
          <p><strong>Volume:</strong> {volume}%</p>
          <p><strong>Playback Speed:</strong> {playbackRate}x</p>
          <p><strong>Loop:</strong> {loopPlayback ? 'Yes' : 'No'}</p>
        </div>
      </Modal>

      <Handle type="source" position={Position.Right} id="out" className="handle-audio" />
    </NodeShell>
  );
});

export default AudioNodeComponent;
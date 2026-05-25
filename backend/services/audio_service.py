"""音频处理服务 - 格式转换、裁剪、合并、音量调整、波形分析"""
import os
import subprocess
import tempfile
import shutil
import json
import struct
import wave
from typing import Optional, Dict, Any, List, Tuple
from pathlib import Path


class AudioService:
    """音频处理核心服务"""

    SUPPORTED_FORMATS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus']
    SUPPORTED_CONVERSIONS = {
        'mp3': ['wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'],
        'wav': ['mp3', 'flac', 'aac', 'ogg', 'm4a', 'opus'],
        'flac': ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'opus'],
        'aac': ['mp3', 'wav', 'flac', 'ogg', 'm4a'],
        'ogg': ['mp3', 'wav', 'flac', 'aac', 'm4a'],
        'm4a': ['mp3', 'wav', 'flac', 'aac', 'ogg'],
        'opus': ['mp3', 'wav', 'flac', 'ogg'],
    }

    def __init__(self, project: str, base_dir: str):
        self.project = project
        self.base_dir = base_dir
        self.project_dir = os.path.join(base_dir, project)

    def _get_full_path(self, rel_path: str) -> str:
        """获取文件完整路径"""
        return os.path.join(self.project_dir, rel_path)

    def _check_ffmpeg(self) -> bool:
        """检查 FFmpeg 是否可用"""
        try:
            subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def _get_output_path(self, input_path: str, new_format: str, suffix: str = '') -> str:
        """生成输出文件路径"""
        base = os.path.splitext(input_path)[0]
        if suffix:
            base = f"{base}_{suffix}"
        return f"{base}.{new_format}"

    def get_audio_info(self, file_path: str) -> Dict[str, Any]:
        """获取音频文件元信息"""
        full_path = self._get_full_path(file_path)
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Audio file not found: {full_path}")

        info = {
            'file_path': file_path,
            'file_size': os.path.getsize(full_path),
            'format': os.path.splitext(file_path)[1].lower().lstrip('.'),
        }

        if not self._check_ffmpeg():
            return info

        try:
            result = subprocess.run([
                'ffprobe', '-v', 'quiet', '-print_format', 'json',
                '-show_format', '-show_streams', full_path
            ], capture_output=True, text=True, timeout=30)

            if result.returncode == 0:
                data = json.loads(result.stdout)
                fmt = data.get('format', {})
                info['duration'] = float(fmt.get('duration', 0))
                info['bitrate'] = int(fmt.get('bit_rate', 0))
                info['format_name'] = fmt.get('format_name', '')

                for stream in data.get('streams', []):
                    if stream.get('codec_type') == 'audio':
                        info['codec'] = stream.get('codec_name', '')
                        info['sample_rate'] = int(stream.get('sample_rate', 0))
                        info['channels'] = int(stream.get('channels', 0))
                        info['bits_per_sample'] = int(stream.get('bits_per_raw_sample', stream.get('bits_per_sample', 0)))
                        break
        except Exception as e:
            info['error'] = str(e)

        return info

    def convert_format(self, input_path: str, output_format: str) -> str:
        """转换音频格式"""
        full_input = self._get_full_path(input_path)
        if not os.path.exists(full_input):
            raise FileNotFoundError(f"Input file not found: {full_input}")

        if not self._check_ffmpeg():
            raise RuntimeError("FFmpeg is not available")

        output_format = output_format.lower().strip('.')
        if output_format not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported output format: {output_format}")

        src_fmt = os.path.splitext(input_path)[1].lower().lstrip('.')
        if output_format == src_fmt:
            return input_path  # Already target format

        output_path = self._get_output_path(full_input.replace('\\', '/'), output_format)

        codec_map = {
            'mp3': 'libmp3lame',
            'aac': 'aac',
            'flac': 'flac',
            'ogg': 'libvorbis',
            'opus': 'libopus',
            'm4a': 'aac',
        }

        cmd = ['ffmpeg', '-y', '-i', full_input]

        if output_format in codec_map:
            cmd.extend(['-c:a', codec_map[output_format]])

        if output_format == 'mp3':
            cmd.extend(['-b:a', '320k', '-q:a', '0'])
        elif output_format == 'flac':
            cmd.extend(['-compression_level', '8'])
        elif output_format == 'aac' or output_format == 'm4a':
            cmd.extend(['-b:a', '256k'])

        cmd.append(output_path)

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg conversion failed: {result.stderr[:500]}")

        rel_output = os.path.relpath(output_path, self.project_dir).replace('\\', '/')
        return rel_output

    def crop_audio(self, input_path: str, start_time: float, end_time: float,
                   output_format: Optional[str] = None) -> str:
        """裁剪音频片段"""
        full_input = self._get_full_path(input_path)
        if not os.path.exists(full_input):
            raise FileNotFoundError(f"Input file not found: {full_input}")

        if not self._check_ffmpeg():
            raise RuntimeError("FFmpeg is not available")

        if end_time <= start_time:
            raise ValueError("End time must be greater than start time")

        duration = end_time - start_time
        fmt = output_format or os.path.splitext(input_path)[1].lower().lstrip('.')
        output_path = self._get_output_path(
            full_input.replace('\\', '/'), fmt,
            suffix=f"crop_{start_time:.1f}s_{end_time:.1f}s"
        )

        cmd = ['ffmpeg', '-y', '-ss', str(start_time), '-i', full_input,
               '-t', str(duration), '-c', 'copy', output_path]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            # Retry without stream copy
            cmd = ['ffmpeg', '-y', '-ss', str(start_time), '-i', full_input,
                   '-t', str(duration), '-c:a', 'libmp3lame', '-q:a', '2', output_path]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg crop failed: {result.stderr[:500]}")

        rel_output = os.path.relpath(output_path, self.project_dir).replace('\\', '/')
        return rel_output

    def merge_audio(self, input_paths: List[str], output_format: str = 'mp3') -> str:
        """合并多个音频文件"""
        if not input_paths:
            raise ValueError("No input files provided")

        if not self._check_ffmpeg():
            raise RuntimeError("FFmpeg is not available")

        # Create file list for FFmpeg concat
        filelist_path = os.path.join(self.project_dir, '_temp_concat_list.txt')
        try:
            with open(filelist_path, 'w', encoding='utf-8') as f:
                for path in input_paths:
                    full_path = self._get_full_path(path)
                    if not os.path.exists(full_path):
                        raise FileNotFoundError(f"Input file not found: {full_path}")
                    f.write(f"file '{full_path.replace(chr(92), '/')}'\n")

            output_path = self._get_output_path(
                self._get_full_path(input_paths[0].replace('\\', '/')), output_format,
                suffix='merged'
            )

            cmd = ['ffmpeg', '-y', '-f', 'concat', '-safe', '0',
                   '-i', filelist_path, '-c', 'copy', output_path]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg merge failed: {result.stderr[:500]}")

            rel_output = os.path.relpath(output_path, self.project_dir).replace('\\', '/')
            return rel_output
        finally:
            if os.path.exists(filelist_path):
                os.remove(filelist_path)

    def adjust_volume(self, input_path: str, volume_db: float) -> str:
        """调整音量（dB 增益）"""
        full_input = self._get_full_path(input_path)
        if not os.path.exists(full_input):
            raise FileNotFoundError(f"Input file not found: {full_input}")

        if not self._check_ffmpeg():
            raise RuntimeError("FFmpeg is not available")

        fmt = os.path.splitext(input_path)[1].lower().lstrip('.')
        output_path = self._get_output_path(
            full_input.replace('\\', '/'), fmt,
            suffix=f"vol{volume_db:+}dB"
        )

        cmd = ['ffmpeg', '-y', '-i', full_input, '-af',
               f'volume={volume_db}dB', output_path]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg volume adjustment failed: {result.stderr[:500]}")

        rel_output = os.path.relpath(output_path, self.project_dir).replace('\\', '/')
        return rel_output

    def normalize_audio(self, input_path: str) -> str:
        """音频归一化（loudnorm）"""
        full_input = self._get_full_path(input_path)
        if not os.path.exists(full_input):
            raise FileNotFoundError(f"Input file not found: {full_input}")

        if not self._check_ffmpeg():
            raise RuntimeError("FFmpeg is not available")

        fmt = os.path.splitext(input_path)[1].lower().lstrip('.')
        output_path = self._get_output_path(full_input.replace('\\', '/'), fmt, suffix='normalized')

        # Two-pass loudnorm
        # Pass 1: analyze
        cmd1 = ['ffmpeg', '-y', '-i', full_input, '-af',
                'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']
        result1 = subprocess.run(cmd1, capture_output=True, text=True, timeout=300)

        # Extract measured values from stderr
        measured = {}
        for line in result1.stderr.split('\n'):
            if 'input_i' in line or 'input_tp' in line or 'input_lra' in line or 'input_thresh' in line:
                try:
                    key, val = line.strip().split(':')
                    measured[key.strip('" ')] = float(val.strip('" ,'))
                except:
                    pass

        # Pass 2: apply
        cmd2 = ['ffmpeg', '-y', '-i', full_input, '-af',
                f'loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={measured.get("input_i", -24)}:'
                f'measured_TP={measured.get("input_tp", -3)}:'
                f'measured_LRA={measured.get("input_lra", 11)}:'
                f'measured_thresh={measured.get("input_thresh", -34)}:linear=true',
                '-c:a', 'libmp3lame', '-q:a', '2', output_path]

        result2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=300)
        if result2.returncode != 0:
            raise RuntimeError(f"FFmpeg normalization failed: {result2.stderr[:500]}")

        rel_output = os.path.relpath(output_path, self.project_dir).replace('\\', '/')
        return rel_output

    def apply_effects(self, input_path: str, effects: Dict[str, Any]) -> str:
        """批量应用音效"""
        full_input = self._get_full_path(input_path)
        if not os.path.exists(full_input):
            raise FileNotFoundError(f"Input file not found: {full_input}")

        if not self._check_ffmpeg():
            raise RuntimeError("FFmpeg is not available")

        fmt = os.path.splitext(input_path)[1].lower().lstrip('.')
        output_path = self._get_output_path(full_input.replace('\\', '/'), fmt, suffix='fx')

        filters = []

        # EQ presets
        eq = effects.get('eq_settings', 'flat')
        eq_map = {
            'bass_boost': 'equalizer=f=80:t=q:w=1:g=6,equalizer=f=200:t=q:w=1:g=3',
            'treble_boost': 'equalizer=f=8000:t=q:w=1:g=6,equalizer=f=16000:t=q:w=1:g=3',
            'vocal_boost': 'equalizer=f=3000:t=q:w=2:g=3,equalizer=f=6000:t=q:w=2:g=2',
            'loudness': 'loudnorm=I=-14:TP=-1:LRA=7',
            'podcast': 'equalizer=f=100:t=q:w=1:g=-3,highpass=f=80,lowpass=f=15000',
        }
        if eq in eq_map:
            filters.append(eq_map[eq])

        # Compressor
        cmp = effects.get('compressor_settings', 'off')
        cmp_map = {
            'light': 'compand=attacks=0.1:decays=0.5:points=-80/-80|-30/-10|0/-3|20/-3',
            'medium': 'compand=attacks=0.05:decays=0.3:points=-80/-80|-20/-10|0/-5|20/-5',
            'heavy': 'compand=attacks=0.01:decays=0.1:points=-80/-80|-10/-10|0/-8|20/-8',
        }
        if cmp in cmp_map:
            filters.append(cmp_map[cmp])

        # Limiter
        lim = effects.get('limiter_settings', 'off')
        if lim and lim != 'off':
            limit_val = float(lim.replace('dB', ''))
            filters.append(f'alimiter=limit={limit_val}dB:attack=5:release=50')

        # Normalize
        if effects.get('normalize_audio'):
            filters.append('loudnorm=I=-16:TP=-1.5:LRA=11')

        # Reverb
        reverb = effects.get('reverb_level', 0)
        if reverb > 0:
            filters.append(f'aecho=0.8:0.9:{reverb * 2}|{reverb * 3}:{reverb / 100}|{reverb / 200}')

        # Fade in/out
        fade_in = effects.get('fade_in', 0)
        if fade_in > 0:
            filters.append(f'afade=t=in:st=0:d={fade_in}')
        fade_out = effects.get('fade_out', 0)
        if fade_out > 0:
            filters.append(f'afade=t=out:st=0:d={fade_out}')

        # Noise reduction (basic high-pass)
        if effects.get('noise_reduction'):
            filters.append('highpass=f=80')

        # Pitch shift
        pitch = effects.get('pitch_shift', 0)
        if pitch != 0:
            filters.append(f'rubberband=pitch={pitch}')

        if not filters:
            return input_path  # No effects to apply

        filter_chain = ','.join(filters)
        cmd = ['ffmpeg', '-y', '-i', full_input, '-af', filter_chain, output_path]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg effects failed: {result.stderr[:500]}")

        rel_output = os.path.relpath(output_path, self.project_dir).replace('\\', '/')
        return rel_output

    def analyze_waveform(self, file_path: str, num_samples: int = 200) -> List[float]:
        """分析音频波形数据"""
        full_path = self._get_full_path(file_path)
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Audio file not found: {full_path}")

        try:
            # Use Python wave module for WAV files
            if file_path.lower().endswith('.wav'):
                return self._analyze_wav(full_path, num_samples)

            # For other formats, use ffmpeg to decode
            if self._check_ffmpeg():
                return self._analyze_via_ffmpeg(full_path, num_samples)
        except Exception as e:
            raise RuntimeError(f"Waveform analysis failed: {str(e)}")

        return []

    def _analyze_wav(self, file_path: str, num_samples: int) -> List[float]:
        """分析 WAV 文件波形"""
        with wave.open(file_path, 'rb') as wf:
            n_frames = wf.getnframes()
            n_channels = wf.getnchannels()
            sample_width = wf.getsampwidth()

            data = wf.readframes(n_frames)

            if sample_width == 1:
                fmt = f'{n_frames * n_channels}B'
            elif sample_width == 2:
                fmt = f'{n_frames * n_channels}h'
            elif sample_width == 4:
                fmt = f'{n_frames * n_channels}i'
            else:
                return []

            samples = struct.unpack(fmt, data)
            if n_channels > 1:
                samples = samples[::n_channels]

            block_size = max(1, len(samples) // num_samples)
            waveform = []
            max_val = 2 ** (sample_width * 8 - 1)

            for i in range(num_samples):
                start = i * block_size
                end = min(start + block_size, len(samples))
                if start >= len(samples):
                    break
                chunk = samples[start:end]
                avg = sum(abs(s) for s in chunk) / len(chunk) / max_val
                waveform.append(min(1.0, avg))

            return waveform

    def _analyze_via_ffmpeg(self, file_path: str, num_samples: int) -> List[float]:
        """通过 FFmpeg 分析波形"""
        # Decode to raw PCM then analyze
        tmp_wav = os.path.join(tempfile.gettempdir(), '_audio_analyze_temp.wav')
        try:
            subprocess.run(['ffmpeg', '-y', '-i', file_path, '-ac', '1',
                           '-ar', '22050', '-f', 'wav', tmp_wav],
                          capture_output=True, check=True, timeout=60)
            return self._analyze_wav(tmp_wav, num_samples)
        finally:
            if os.path.exists(tmp_wav):
                os.remove(tmp_wav)

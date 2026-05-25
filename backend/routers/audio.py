"""音频处理 API 路由"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from services.audio_service import AudioService
from pathlib import Path
import os as os_module


router = APIRouter(prefix="/audio", tags=["Audio"])


# ===== Models =====

class AudioInfoResponse(BaseModel):
    file_path: str
    file_size: int
    format: str
    duration: Optional[float] = None
    bitrate: Optional[int] = None
    format_name: Optional[str] = None
    codec: Optional[str] = None
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    bits_per_sample: Optional[int] = None
    error: Optional[str] = None


class ConvertRequest(BaseModel):
    input_path: str
    output_format: str = Field(..., description="Target format: mp3, wav, flac, aac, ogg, m4a, opus")
    project: str


class CropRequest(BaseModel):
    input_path: str
    start_time: float = Field(..., ge=0, description="Start time in seconds")
    end_time: float = Field(..., gt=0, description="End time in seconds")
    output_format: Optional[str] = None
    project: str


class MergeRequest(BaseModel):
    input_paths: List[str] = Field(..., min_length=1)
    output_format: str = "mp3"
    project: str


class VolumeRequest(BaseModel):
    input_path: str
    volume_db: float = Field(..., ge=-30, le=30, description="Volume gain in dB")
    project: str


class EffectsRequest(BaseModel):
    input_path: str
    normalize: bool = False
    fade_in: float = Field(0, ge=0, le=10, description="Fade in duration in seconds")
    fade_out: float = Field(0, ge=0, le=10, description="Fade out duration in seconds")
    reverb_level: float = Field(0, ge=0, le=100, description="Reverb level percentage")
    eq_settings: str = Field("flat", description="EQ preset: flat, bass_boost, treble_boost, vocal_boost, loudness, podcast")
    compressor_settings: str = Field("off", description="Compressor: off, light, medium, heavy")
    limiter_settings: str = Field("off", description="Limiter: off, -0.1dB, -0.3dB, -1dB")
    noise_reduction: bool = False
    pitch_shift: float = Field(0, ge=-12, le=12, description="Pitch shift in semitones")
    project: str


class WaveformRequest(BaseModel):
    file_path: str
    num_samples: int = Field(200, ge=50, le=1000)
    project: str


class ProcessResponse(BaseModel):
    success: bool
    output_path: Optional[str] = None
    message: Optional[str] = None
    waveform: Optional[List[float]] = None


# ===== Helpers =====

BASE_DIR = os_module.path.dirname(os_module.path.dirname(os_module.path.abspath(__file__)))


def get_service(project: str) -> AudioService:
    """Create AudioService for a project"""
    return AudioService(project=project, base_dir=BASE_DIR)


# ===== Endpoints =====

@router.get("/info", response_model=AudioInfoResponse)
async def get_audio_info(
    file_path: str = Query(..., description="Relative file path in project"),
    project: str = Query(..., description="Project name")
):
    """获取音频文件元信息"""
    try:
        service = get_service(project)
        info = service.get_audio_info(file_path)
        return AudioInfoResponse(**info)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/convert", response_model=ProcessResponse)
async def convert_audio(req: ConvertRequest):
    """转换音频格式"""
    try:
        service = get_service(req.project)
        output = service.convert_format(req.input_path, req.output_format)
        return ProcessResponse(success=True, output_path=output, message=f"Converted to {req.output_format.upper()}")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/crop", response_model=ProcessResponse)
async def crop_audio(req: CropRequest):
    """裁剪音频片段"""
    try:
        service = get_service(req.project)
        output = service.crop_audio(req.input_path, req.start_time, req.end_time, req.output_format)
        return ProcessResponse(success=True, output_path=output, message=f"Cropped {req.start_time}s-{req.end_time}s")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/merge", response_model=ProcessResponse)
async def merge_audio(req: MergeRequest):
    """合并多个音频文件"""
    try:
        service = get_service(req.project)
        output = service.merge_audio(req.input_paths, req.output_format)
        return ProcessResponse(success=True, output_path=output, message=f"Merged {len(req.input_paths)} files")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/volume", response_model=ProcessResponse)
async def adjust_volume(req: VolumeRequest):
    """调整音频音量"""
    try:
        service = get_service(req.project)
        output = service.adjust_volume(req.input_path, req.volume_db)
        return ProcessResponse(success=True, output_path=output, message=f"Volume adjusted by {req.volume_db:+}dB")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/normalize", response_model=ProcessResponse)
async def normalize_audio(req: VolumeRequest):
    """音频归一化"""
    try:
        service = get_service(req.project)
        output = service.normalize_audio(req.input_path)
        return ProcessResponse(success=True, output_path=output, message="Audio normalized")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/effects", response_model=ProcessResponse)
async def apply_effects(req: EffectsRequest):
    """批量应用音效"""
    try:
        service = get_service(req.project)
        effects = {
            'normalize_audio': req.normalize,
            'fade_in': req.fade_in,
            'fade_out': req.fade_out,
            'reverb_level': req.reverb_level,
            'eq_settings': req.eq_settings,
            'compressor_settings': req.compressor_settings,
            'limiter_settings': req.limiter_settings,
            'noise_reduction': req.noise_reduction,
            'pitch_shift': req.pitch_shift,
        }
        output = service.apply_effects(req.input_path, effects)
        return ProcessResponse(success=True, output_path=output, message="Effects applied successfully")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/waveform", response_model=ProcessResponse)
async def analyze_waveform(req: WaveformRequest):
    """分析音频波形"""
    try:
        service = get_service(req.project)
        waveform = service.analyze_waveform(req.file_path, req.num_samples)
        return ProcessResponse(success=True, waveform=waveform, message=f"Waveform analyzed ({len(waveform)} samples)")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/process", response_model=ProcessResponse)
async def process_audio(
    action: str = Query(..., description="crop|convert|effects|merge|volume|normalize|waveform"),
    input_path: str = Body(...),
    project: str = Body(...),
    start_time: Optional[float] = Body(None),
    end_time: Optional[float] = Body(None),
    output_format: Optional[str] = Body(None),
    volume_db: Optional[float] = Body(None),
    normalize: Optional[bool] = Body(None),
    fade_in: Optional[float] = Body(None),
    fade_out: Optional[float] = Body(None),
    reverb_level: Optional[float] = Body(None),
    eq_settings: Optional[str] = Body(None),
    compressor_settings: Optional[str] = Body(None),
    limiter_settings: Optional[str] = Body(None),
    noise_reduction: Optional[bool] = Body(None),
    pitch_shift: Optional[float] = Body(None),
):
    """通用音频处理端点 (与前端 processAudio 对接)"""
    try:
        service = get_service(project)

        if action == 'crop':
            if start_time is None or end_time is None:
                raise HTTPException(400, "start_time and end_time required for crop")
            output = service.crop_audio(input_path, start_time, end_time, output_format)
        elif action == 'convert':
            if not output_format:
                raise HTTPException(400, "output_format required for convert")
            output = service.convert_format(input_path, output_format)
        elif action == 'effects':
            effects = {
                'normalize_audio': normalize or False,
                'fade_in': fade_in or 0,
                'fade_out': fade_out or 0,
                'reverb_level': reverb_level or 0,
                'eq_settings': eq_settings or 'flat',
                'compressor_settings': compressor_settings or 'off',
                'limiter_settings': limiter_settings or 'off',
                'noise_reduction': noise_reduction or False,
                'pitch_shift': pitch_shift or 0,
            }
            output = service.apply_effects(input_path, effects)
        elif action == 'volume':
            if volume_db is None:
                raise HTTPException(400, "volume_db required for volume")
            output = service.adjust_volume(input_path, volume_db)
        elif action == 'normalize':
            output = service.normalize_audio(input_path)
        elif action == 'waveform':
            waveform = service.analyze_waveform(input_path, 200)
            return ProcessResponse(success=True, waveform=waveform)
        else:
            raise HTTPException(400, f"Unknown action: {action}")

        return ProcessResponse(success=True, output_path=output)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

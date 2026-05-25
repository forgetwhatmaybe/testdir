"""视频缩略图与图片自动压缩。

v4: 增强压缩 — 集成二分查找压缩算法（compressor.py），支持批量压缩与进度上报。
"""
from __future__ import annotations

from pathlib import Path

import cv2
from PIL import Image

from config import MAX_IMAGE_BYTES


def extract_video_thumbnail(video_path: str, out_path: str) -> str | None:
    cap = cv2.VideoCapture(video_path)
    try:
        ok, frame = cap.read()
        if not ok or frame is None:
            return None
        out = Path(out_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(out), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        return str(out)
    finally:
        cap.release()


def compress_image_if_large(image_path: str) -> str:
    """单张图片压缩（保持向后兼容）。使用增强版二分查找算法。"""
    from services.compressor import compress_single
    result = compress_single(image_path, MAX_IMAGE_BYTES)
    return result.compressed_path


async def compress_images_batch(image_paths: list[str]) -> dict:
    """批量压缩图片（异步），返回汇总报告 dict。"""
    from services.compressor import compress_batch
    report = await compress_batch(image_paths, MAX_IMAGE_BYTES)
    return {
        "count": report.count,
        "compressed_count": report.compressed_count,
        "failed_count": report.failed_count,
        "total_original_mb": report.total_original_mb,
        "total_compressed_mb": report.total_compressed_mb,
        "saved_mb": report.saved_mb,
        "saved_percent": report.saved_percent,
        "results": [
            {
                "original_path": r.original_path,
                "compressed_path": r.compressed_path,
                "original_size_mb": r.original_size_mb,
                "compressed_size_mb": r.compressed_size_mb,
                "quality": r.quality,
                "was_compressed": r.was_compressed,
                "error": r.error,
            }
            for r in report.results
        ],
    }

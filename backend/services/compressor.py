"""图片批量压缩服务。

参照 testdir 的 compress_image_if_needed 逻辑：
- 自动检测图片大小 > MAX_IMAGE_BYTES(4.7MB) 时压缩
- 二分查找算法找到最佳质量值，保持画质前提下减小体积
- 支持批量压缩，返回每张图的压缩结果（前后大小对比）
- 线程安全，使用 asyncio.to_thread 执行 CPU 密集型操作
"""
from __future__ import annotations

import asyncio
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from PIL import Image

from config import MAX_IMAGE_BYTES


@dataclass
class CompressResult:
    """单张图片压缩结果。"""
    original_path: str
    compressed_path: str
    original_size_mb: float
    compressed_size_mb: float
    quality: int
    was_compressed: bool
    error: Optional[str] = None


@dataclass
class BatchCompressReport:
    """批量压缩汇总报告。"""
    results: list[CompressResult] = field(default_factory=list)
    total_original_mb: float = 0.0
    total_compressed_mb: float = 0.0
    saved_mb: float = 0.0
    count: int = 0
    compressed_count: int = 0
    failed_count: int = 0

    @property
    def saved_percent(self) -> float:
        if self.total_original_mb <= 0:
            return 0.0
        return round(self.saved_mb / self.total_original_mb * 100, 1)


def get_file_size_mb(file_path: str) -> float:
    """获取文件大小（MB）。"""
    p = Path(file_path)
    if not p.exists():
        return 0.0
    return round(p.stat().st_size / (1024 * 1024), 2)


def compress_single(image_path: str, max_size_bytes: int = MAX_IMAGE_BYTES) -> CompressResult:
    """压缩单张图片（同步方法，二分查找最佳质量）。

    Args:
        image_path: 原图片绝对路径
        max_size_bytes: 最大允许字节数，默认 4.7MB

    Returns:
        CompressResult 包含压缩前后大小、质量值等信息
    """
    p = Path(image_path)
    original_size = round(p.stat().st_size / (1024 * 1024), 2)

    # 无需压缩
    if p.stat().st_size <= max_size_bytes:
        return CompressResult(
            original_path=str(p),
            compressed_path=str(p),
            original_size_mb=original_size,
            compressed_size_mb=original_size,
            quality=100,
            was_compressed=False,
        )

    try:
        img = Image.open(p)
    except Exception as e:
        return CompressResult(
            original_path=str(p),
            compressed_path=str(p),
            original_size_mb=original_size,
            compressed_size_mb=original_size,
            quality=0,
            was_compressed=False,
            error=f"无法打开图片: {e}",
        )

    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGB")
    elif img.mode == "L":
        img = img.convert("RGB")

    # 输出到原始文件同目录（带 _compressed 后缀）
    out = p.with_name(p.stem + "_compressed.jpg")

    # 二分查找最佳质量值
    low, high = 10, 95
    best_q = 10
    best_size = float("inf")

    while low <= high:
        q = (low + high) // 2
        img.save(out, format="JPEG", quality=q, optimize=True)
        sz = out.stat().st_size
        if sz <= max_size_bytes:
            best_q = q
            best_size = sz
            low = q + 1
        else:
            high = q - 1

    # 使用最佳质量重新保存
    img.save(out, format="JPEG", quality=best_q, optimize=True)
    compressed_size = round(out.stat().st_size / (1024 * 1024), 2)

    return CompressResult(
        original_path=str(p),
        compressed_path=str(out),
        original_size_mb=original_size,
        compressed_size_mb=compressed_size,
        quality=best_q,
        was_compressed=True,
    )


async def compress_batch(
    image_paths: list[str],
    max_size_bytes: int = MAX_IMAGE_BYTES,
    progress_callback=None,
) -> BatchCompressReport:
    """批量压缩图片（异步，可监听进度）。

    Args:
        image_paths: 图片绝对路径列表
        max_size_bytes: 最大允许字节数
        progress_callback: async callable(report, current, total) 进度回调

    Returns:
        BatchCompressReport 汇总报告
    """
    report = BatchCompressReport()
    total = len(image_paths)

    for idx, path in enumerate(image_paths):
        try:
            result = await asyncio.to_thread(compress_single, path, max_size_bytes)
        except Exception as e:
            result = CompressResult(
                original_path=path,
                compressed_path=path,
                original_size_mb=get_file_size_mb(path),
                compressed_size_mb=get_file_size_mb(path),
                quality=0,
                was_compressed=False,
                error=str(e),
            )

        report.results.append(result)
        report.count += 1
        report.total_original_mb += result.original_size_mb
        report.total_compressed_mb += result.compressed_size_mb
        if result.was_compressed:
            report.compressed_count += 1
        if result.error:
            report.failed_count += 1

        report.saved_mb = round(report.total_original_mb - report.total_compressed_mb, 2)

        if progress_callback:
            await progress_callback(report, idx + 1, total)

    return report


def compress_image_if_large_enhanced(image_path: str) -> str:
    """增强版压缩：判断是否需要压缩，需要则返回压缩后路径。

    与 testdir 的 compress_image_if_needed 逻辑对齐，
    但增加了二分查找最佳质量的优化。
    """
    result = compress_single(image_path)
    return result.compressed_path
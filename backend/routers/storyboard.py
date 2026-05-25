"""图片分镜处理接口：合成分镜图、拆解分镜图。"""
from __future__ import annotations

import base64
import io
import math
from pathlib import Path
from typing import List, Literal

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image

from services import project_manager as pm

router = APIRouter(prefix="/api/storyboard", tags=["storyboard"])


def _resolve_in_project(project: str, rel_path: str) -> Path:
    """解析项目内的相对路径为绝对路径，并检查越界"""
    root = pm.find_project(project)
    candidate = (root / rel_path).resolve()
    root_resolved = root.resolve()
    if root_resolved not in candidate.parents and candidate != root_resolved:
        raise HTTPException(status_code=400, detail="路径越界")
    return candidate


@router.post("/combine")
async def combine_images(
    project: str = Form(...),
    image_paths: List[str] = Form(...),
    layout: Literal["horizontal", "vertical", "grid"] = Form("grid"),
    spacing: int = Form(10),
    background_color: str = Form("#000000"),
    output_format: Literal["png", "jpg"] = Form("png"),
) -> dict:
    """
    将多张图片合成为分镜图
    
    Args:
        project: 项目名称
        image_paths: 图片相对路径列表
        layout: 布局方式 - horizontal(水平排列), vertical(垂直排列), grid(网格排列)
        spacing: 图片间距(像素)
        background_color: 背景颜色(十六进制)
        output_format: 输出格式
    """
    try:
        # 解析所有图片路径
        abs_paths = []
        images = []
        max_width = 0
        max_height = 0
        
        for rel_path in image_paths:
            abs_path = _resolve_in_project(project, rel_path)
            if not abs_path.exists():
                raise HTTPException(status_code=404, detail=f"图片不存在: {rel_path}")
            
            with Image.open(abs_path) as img:
                # 转换为RGB/RGBA
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGBA')
                else:
                    img = img.convert('RGB')
                
                abs_paths.append(str(abs_path))
                images.append(img)
                max_width = max(max_width, img.width)
                max_height = max(max_height, img.height)
        
        if not images:
            raise HTTPException(status_code=400, detail="没有有效的图片")
        
        # 根据布局计算画布大小
        num_images = len(images)
        if layout == "horizontal":
            # 水平排列
            canvas_width = sum(img.width for img in images) + spacing * (num_images - 1)
            canvas_height = max(img.height for img in images)
            cols = num_images
            rows = 1
        elif layout == "vertical":
            # 垂直排列
            canvas_width = max(img.width for img in images)
            canvas_height = sum(img.height for img in images) + spacing * (num_images - 1)
            cols = 1
            rows = num_images
        else:  # grid
            # 网格排列，尽量接近正方形
            cols = math.ceil(math.sqrt(num_images))
            rows = math.ceil(num_images / cols)
            canvas_width = cols * max_width + spacing * (cols - 1)
            canvas_height = rows * max_height + spacing * (rows - 1)
        
        # 创建画布
        if background_color.startswith('#') and len(background_color) == 7:
            bg_color = tuple(int(background_color[i:i+2], 16) for i in (1, 3, 5))
            if images[0].mode == 'RGBA':
                bg_color = bg_color + (255,)  # 添加alpha通道
        else:
            bg_color = (0, 0, 0) if images[0].mode == 'RGB' else (0, 0, 0, 255)
        
        canvas = Image.new(images[0].mode, (canvas_width, canvas_height), bg_color)
        
        # 排列图片
        x, y = 0, 0
        for i, img in enumerate(images):
            if layout == "horizontal":
                # 水平排列
                canvas.paste(img, (x, (canvas_height - img.height) // 2))
                x += img.width + spacing
            elif layout == "vertical":
                # 垂直排列
                canvas.paste(img, ((canvas_width - img.width) // 2, y))
                y += img.height + spacing
            else:  # grid
                # 网格排列
                row = i // cols
                col = i % cols
                x_pos = col * (max_width + spacing)
                y_pos = row * (max_height + spacing)
                # 居中放置
                x_offset = (max_width - img.width) // 2
                y_offset = (max_height - img.height) // 2
                canvas.paste(img, (x_pos + x_offset, y_pos + y_offset))
        
        # 保存到项目素材库
        root = pm.find_project(project)
        target_dir = root / "素材库"
        target_dir.mkdir(parents=True, exist_ok=True)
        
        # 生成文件名
        base_name = f"storyboard_combined_{len(images)}"
        counter = 1
        while True:
            output_name = f"{base_name}_{counter}.{output_format}"
            output_path = target_dir / output_name
            if not output_path.exists():
                break
            counter += 1
        
        # 保存图片
        if output_format == "jpg":
            canvas = canvas.convert("RGB")  # JPG不支持透明度
            canvas.save(output_path, "JPEG", quality=95)
        else:
            canvas.save(output_path, "PNG")
        
        rel_path = output_path.relative_to(root).as_posix()
        
        return {
            "ok": True,
            "data": {
                "rel_path": rel_path,
                "abs_path": str(output_path),
                "canvas_size": {"width": canvas_width, "height": canvas_height},
                "image_count": num_images,
                "layout": layout
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"合成分镜图失败: {str(e)}")


@router.post("/split")
async def split_storyboard(
    project: str = Form(...),
    image_path: str = Form(...),
    rows: int = Form(1),
    cols: int = Form(1),
    spacing: int = Form(0),
    output_format: Literal["png", "jpg"] = Form("png"),
) -> dict:
    """
    将分镜图拆解为独立图片
    
    Args:
        project: 项目名称
        image_path: 分镜图相对路径
        rows: 行数
        cols: 列数
        spacing: 图片间距(像素，如果已知)
        output_format: 输出格式
    """
    try:
        # 解析图片路径
        abs_path = _resolve_in_project(project, image_path)
        if not abs_path.exists():
            raise HTTPException(status_code=404, detail=f"图片不存在: {image_path}")
        
        with Image.open(abs_path) as img:
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGBA')
            else:
                img = img.convert('RGB')
            
            width, height = img.size
            
            # 计算每个单元格的大小
            cell_width = (width - spacing * (cols - 1)) // cols
            cell_height = (height - spacing * (rows - 1)) // rows
            
            if cell_width <= 0 or cell_height <= 0:
                raise HTTPException(status_code=400, detail="单元格大小计算错误，请检查行列数和间距")
            
            # 保存到项目素材库
            root = pm.find_project(project)
            target_dir = root / "素材库"
            target_dir.mkdir(parents=True, exist_ok=True)
            
            base_name = Path(abs_path).stem
            output_paths = []
            
            # 分割图片
            for row in range(rows):
                for col in range(cols):
                    # 计算裁剪区域
                    left = col * (cell_width + spacing)
                    top = row * (cell_height + spacing)
                    right = left + cell_width
                    bottom = top + cell_height
                    
                    # 裁剪
                    cell_img = img.crop((left, top, right, bottom))
                    
                    # 保存
                    output_name = f"{base_name}_r{row+1}c{col+1}.{output_format}"
                    output_path = target_dir / output_name
                    counter = 1
                    while output_path.exists():
                        output_name = f"{base_name}_r{row+1}c{col+1}_{counter}.{output_format}"
                        output_path = target_dir / output_name
                        counter += 1
                    
                    if output_format == "jpg":
                        cell_img = cell_img.convert("RGB")
                        cell_img.save(output_path, "JPEG", quality=95)
                    else:
                        cell_img.save(output_path, "PNG")
                    
                    rel_path = output_path.relative_to(root).as_posix()
                    output_paths.append(rel_path)
        
        return {
            "ok": True,
            "data": {
                "original_size": {"width": width, "height": height},
                "cell_size": {"width": cell_width, "height": cell_height},
                "rows": rows,
                "cols": cols,
                "output_paths": output_paths,
                "total_cells": rows * cols
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"拆解分镜图失败: {str(e)}")


@router.post("/detect-grid")
async def detect_grid(
    project: str = Form(...),
    image_path: str = Form(...),
    threshold: float = Form(0.1),
) -> dict:
    """
    自动检测分镜图的网格布局
    
    Args:
        project: 项目名称
        image_path: 分镜图相对路径
        threshold: 检测阈值(0-1)
    """
    try:
        abs_path = _resolve_in_project(project, image_path)
        if not abs_path.exists():
            raise HTTPException(status_code=404, detail=f"图片不存在: {image_path}")
        
        # 使用PIL加载图片并转换为灰度
        with Image.open(abs_path) as img:
            gray_img = img.convert('L')
            width, height = gray_img.size
            
            # 转换为numpy数组
            img_array = np.array(gray_img)
            
            # 简单的边缘检测（简化版本）
            # 计算水平和垂直方向的梯度
            horizontal_grad = np.abs(np.diff(img_array, axis=1))
            vertical_grad = np.abs(np.diff(img_array, axis=0))
            
            # 寻找明显的分界线（梯度大的位置）
            h_threshold = np.max(horizontal_grad) * threshold
            v_threshold = np.max(vertical_grad) * threshold
            
            h_lines = np.where(np.any(horizontal_grad > h_threshold, axis=0))[0]
            v_lines = np.where(np.any(vertical_grad > v_threshold, axis=1))[0]
            
            # 估计行列数
            estimated_cols = len(h_lines) + 1 if len(h_lines) > 0 else 1
            estimated_rows = len(v_lines) + 1 if len(v_lines) > 0 else 1
            
            # 计算平均间距
            avg_h_spacing = np.mean(np.diff(h_lines)) if len(h_lines) > 1 else 0
            avg_v_spacing = np.mean(np.diff(v_lines)) if len(v_lines) > 1 else 0
        
        return {
            "ok": True,
            "data": {
                "estimated_rows": int(estimated_rows),
                "estimated_cols": int(estimated_cols),
                "horizontal_lines": [int(x) for x in h_lines],
                "vertical_lines": [int(y) for y in v_lines],
                "avg_h_spacing": float(avg_h_spacing),
                "avg_v_spacing": float(avg_v_spacing),
                "image_size": {"width": width, "height": height}
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"网格检测失败: {str(e)}")
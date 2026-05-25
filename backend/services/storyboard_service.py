"""图片分镜处理服务层"""
from __future__ import annotations

import math
from pathlib import Path
from typing import List, Literal, Tuple

import numpy as np
from PIL import Image


class StoryboardService:
    """图片分镜处理服务"""
    
    @staticmethod
    def combine_images(
        image_paths: List[Path],
        layout: Literal["horizontal", "vertical", "grid"] = "grid",
        spacing: int = 10,
        background_color: str = "#000000",
        output_format: Literal["png", "jpg"] = "png",
    ) -> Tuple[Image.Image, dict]:
        """
        将多张图片合成为分镜图
        
        Returns:
            tuple: (合成的图片对象, 元数据)
        """
        # 加载所有图片
        images = []
        max_width = 0
        max_height = 0
        
        for img_path in image_paths:
            with Image.open(img_path) as img:
                # 转换为RGB/RGBA
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGBA')
                else:
                    img = img.convert('RGB')
                
                images.append(img)
                max_width = max(max_width, img.width)
                max_height = max(max_height, img.height)
        
        if not images:
            raise ValueError("没有有效的图片")
        
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
        
        metadata = {
            "canvas_size": {"width": canvas_width, "height": canvas_height},
            "image_count": num_images,
            "layout": layout,
            "rows": rows,
            "cols": cols,
            "spacing": spacing,
            "max_cell_size": {"width": max_width, "height": max_height}
        }
        
        return canvas, metadata
    
    @staticmethod
    def split_storyboard(
        image_path: Path,
        rows: int = 1,
        cols: int = 1,
        spacing: int = 0,
        output_format: Literal["png", "jpg"] = "png",
    ) -> Tuple[List[Image.Image], dict]:
        """
        将分镜图拆解为独立图片
        
        Returns:
            tuple: (拆解后的图片列表, 元数据)
        """
        with Image.open(image_path) as img:
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGBA')
            else:
                img = img.convert('RGB')
            
            width, height = img.size
            
            # 计算每个单元格的大小
            cell_width = (width - spacing * (cols - 1)) // cols
            cell_height = (height - spacing * (rows - 1)) // rows
            
            if cell_width <= 0 or cell_height <= 0:
                raise ValueError("单元格大小计算错误，请检查行列数和间距")
            
            # 分割图片
            cell_images = []
            for row in range(rows):
                for col in range(cols):
                    # 计算裁剪区域
                    left = col * (cell_width + spacing)
                    top = row * (cell_height + spacing)
                    right = left + cell_width
                    bottom = top + cell_height
                    
                    # 裁剪
                    cell_img = img.crop((left, top, right, bottom))
                    cell_images.append(cell_img)
        
        metadata = {
            "original_size": {"width": width, "height": height},
            "cell_size": {"width": cell_width, "height": cell_height},
            "rows": rows,
            "cols": cols,
            "spacing": spacing,
            "total_cells": rows * cols
        }
        
        return cell_images, metadata
    
    @staticmethod
    def detect_grid(
        image_path: Path,
        threshold: float = 0.1,
    ) -> dict:
        """
        自动检测分镜图的网格布局
        """
        with Image.open(image_path) as img:
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
            "estimated_rows": int(estimated_rows),
            "estimated_cols": int(estimated_cols),
            "horizontal_lines": [int(x) for x in h_lines],
            "vertical_lines": [int(y) for y in v_lines],
            "avg_h_spacing": float(avg_h_spacing),
            "avg_v_spacing": float(avg_v_spacing),
            "image_size": {"width": width, "height": height}
        }
    
    @staticmethod
    def save_image(
        image: Image.Image,
        output_path: Path,
        output_format: Literal["png", "jpg"] = "png",
        quality: int = 95,
    ) -> Path:
        """
        保存图片到指定路径
        
        Returns:
            保存后的文件路径
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        if output_format == "jpg":
            image = image.convert("RGB")  # JPG不支持透明度
            image.save(output_path, "JPEG", quality=quality)
        else:
            image.save(output_path, "PNG")
        
        return output_path
    
    @staticmethod
    def generate_unique_filename(
        base_name: str,
        directory: Path,
        extension: str,
        max_attempts: int = 100,
    ) -> Path:
        """
        生成唯一的文件名
        
        Args:
            base_name: 基础文件名
            directory: 目录路径
            extension: 文件扩展名（带点）
            max_attempts: 最大尝试次数
        """
        directory.mkdir(parents=True, exist_ok=True)
        
        # 第一次尝试
        output_path = directory / f"{base_name}{extension}"
        
        # 如果文件已存在，添加序号
        if not output_path.exists():
            return output_path
        
        for i in range(1, max_attempts + 1):
            output_path = directory / f"{base_name}_{i}{extension}"
            if not output_path.exists():
                return output_path
        
        # 如果所有尝试都失败，使用时间戳
        import time
        timestamp = int(time.time())
        output_path = directory / f"{base_name}_{timestamp}{extension}"
        return output_path
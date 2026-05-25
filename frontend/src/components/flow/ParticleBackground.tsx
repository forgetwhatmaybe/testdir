import { useEffect, useRef } from 'react';

const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
      opacity: number;
      twinkleSpeed: number;
      twinkleOffset: number;
    }> = [];

    // 粒子数量上限降到 60，大幅减少 O(n²) 连接线计算
    const particleCount = Math.min(60, Math.floor((canvas.width * canvas.height) / 40000));
    const colors = [
      'rgba(123, 31, 162, {opacity})',
      'rgba(33, 150, 243, {opacity})',
      'rgba(76, 175, 80, {opacity})',
      'rgba(255, 255, 255, {opacity})',
    ];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: Math.random() * 0.5 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.01,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }

    // 预计算离线 canvas 用于光晕批渲染（避免每粒子 new RadialGradient）
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 10;
    glowCanvas.height = 10;
    const glowCtx = glowCanvas.getContext('2d');
    if (glowCtx) {
      const gradient = glowCtx.createRadialGradient(5, 5, 0, 5, 5, 5);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      glowCtx.fillStyle = gradient;
      glowCtx.fillRect(0, 0, 10, 10);
    }

    let animationId: number;
    let lastTime = 0;
    const FRAME_INTERVAL = 1000 / 30; // 30fps 节流

    const animate = (timestamp: number) => {
      if (timestamp - lastTime < FRAME_INTERVAL) {
        animationId = requestAnimationFrame(animate);
        return;
      }
      lastTime = timestamp;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 更新 + 绘制粒子（去掉每粒子的 createRadialGradient，统一用闪烁圆点）
      particles.forEach((particle) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        const currentOpacity = Math.max(0.05, Math.min(1,
          particle.opacity + Math.sin(timestamp * particle.twinkleSpeed + particle.twinkleOffset) * 0.2
        ));

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color.replace('{opacity}', currentOpacity.toString());
        ctx.fill();

        // 使用预渲染 glow 贴图（drawImage 比 createRadialGradient 快得多）
        const glowSize = particle.size * 6;
        ctx.drawImage(glowCanvas,
          particle.x - glowSize / 2,
          particle.y - glowSize / 2,
          glowSize, glowSize
        );
      });

      // 连接线：距离阈值缩小 + 每帧最多 800 对检查
      const MAX_PAIRS = 800;
      let pairCount = 0;

      for (let i = 0; i < particles.length && pairCount < MAX_PAIRS; i++) {
        for (let j = i + 1; j < particles.length && pairCount < MAX_PAIRS; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;
          // 距离阈值降到 80px，平方比较避免 sqrt
          if (distSq < 6400) {
            pairCount++;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      ctx.strokeStyle = 'rgba(79, 195, 247, 0.04)';
      ctx.lineWidth = 0.5;

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="particles-js"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -2,
        pointerEvents: 'none',
      }}
    />
  );
};

export default ParticleBackground;
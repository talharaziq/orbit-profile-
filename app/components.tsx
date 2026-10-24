"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

export interface TrendPoint { label: string; total: number }

export function ActivityChart({ data, caption }: { data: TrendPoint[]; caption: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const draw = () => {
      const width = Math.max(320, canvas.clientWidth || 640);
      const height = 236;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const root = canvas.closest<HTMLElement>(".app-shell") ?? document.documentElement;
      const styles = getComputedStyle(root);
      const accent = styles.getPropertyValue("--accent").trim() || "#9b87f5";
      const muted = styles.getPropertyValue("--muted").trim() || "#858c9d";
      const grid = styles.getPropertyValue("--chart-grid").trim() || "rgba(255,255,255,.07)";
      const plot = { left: 34, right: width - 14, top: 18, bottom: height - 32 };
      const plotWidth = plot.right - plot.left;
      const plotHeight = plot.bottom - plot.top;
      const values = data.map((item) => item.total);
      const maxValue = Math.max(5, ...values);
      const step = maxValue <= 20 ? 5 : Math.ceil(maxValue / 4 / 10) * 10;

      context.font = "11px Inter, ui-sans-serif, system-ui, sans-serif";
      context.textAlign = "right";
      context.textBaseline = "middle";
      context.fillStyle = muted;
      for (let tick = 0; tick <= maxValue; tick += step) {
        const y = plot.bottom - (tick / maxValue) * plotHeight;
        context.strokeStyle = grid;
        context.lineWidth = 1;
        context.beginPath(); context.moveTo(plot.left, y); context.lineTo(plot.right, y); context.stroke();
        context.fillText(tick.toLocaleString(), plot.left - 8, y);
      }

      if (!data.length) return;
      const pointX = (index: number) => plot.left + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
      const pointY = (index: number) => plot.bottom - ((values[index] ?? 0) / maxValue) * plotHeight;

      const fill = context.createLinearGradient(0, plot.top, 0, plot.bottom);
      fill.addColorStop(0, hexToRgba(accent, 0.24));
      fill.addColorStop(1, hexToRgba(accent, 0.005));
      context.beginPath();
      data.forEach((_, index) => index === 0 ? context.moveTo(pointX(index), pointY(index)) : context.lineTo(pointX(index), pointY(index)));
      context.lineTo(pointX(data.length - 1), plot.bottom);
      context.lineTo(pointX(0), plot.bottom);
      context.closePath();
      context.fillStyle = fill;
      context.fill();

      context.beginPath();
      data.forEach((_, index) => index === 0 ? context.moveTo(pointX(index), pointY(index)) : context.lineTo(pointX(index), pointY(index)));
      context.strokeStyle = accent;
      context.lineWidth = 2.5;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.stroke();

      const labelEvery = Math.max(1, Math.ceil(data.length / 6));
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillStyle = muted;
      data.forEach((point, index) => {
        if (index % labelEvery === 0 || index === data.length - 1) context.fillText(point.label, pointX(index), plot.bottom + 12);
      });

      if (hovered !== null && hovered >= 0 && hovered < data.length) {
        const x = pointX(hovered); const y = pointY(hovered);
        context.strokeStyle = hexToRgba(accent, 0.45);
        context.setLineDash([3, 4]);
        context.beginPath(); context.moveTo(x, plot.top); context.lineTo(x, plot.bottom); context.stroke();
        context.setLineDash([]);
        context.beginPath(); context.arc(x, y, 4.4, 0, Math.PI * 2);
        context.fillStyle = accent; context.fill();
        context.lineWidth = 2; context.strokeStyle = styles.getPropertyValue("--surface").trim() || "#151923"; context.stroke();
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [data, hovered]);

  function trackPointer(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const box = canvas.getBoundingClientRect();
    const x = event.clientX - box.left;
    const plotLeft = 34;
    const plotRight = box.width - 14;
    const ratio = Math.max(0, Math.min(1, (x - plotLeft) / Math.max(1, plotRight - plotLeft)));
    setHovered(Math.round(ratio * (data.length - 1)));
  }

  const current = hovered === null ? null : data[hovered];
  return (
    <div className="chart-wrap">
      <div className="chart-hover-readout" aria-live="polite">
        <span>{current?.label ?? caption}</span>
        <strong>{current ? current.total.toLocaleString() : " "}</strong>
        {current && <small>activity events</small>}
      </div>
      <canvas
        ref={canvasRef}
        className="activity-canvas"
        onPointerMove={trackPointer}
        onPointerLeave={() => setHovered(null)}
        role="img"
        aria-label={`Interactive activity trend. ${data.map((point) => `${point.label}: ${point.total}`).join(", ")}`}
      />
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(155,135,245,${alpha})`;
  const value = Number.parseInt(normalized, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

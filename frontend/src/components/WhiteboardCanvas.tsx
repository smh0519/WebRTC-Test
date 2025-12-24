'use client';

import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, DataPacket_Kind } from 'livekit-client';

interface DrawEvent {
  type: 'draw';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  color: number;
  width: number;
}

interface ClearEvent {
  type: 'clear';
}

type WhiteboardEvent = DrawEvent | ClearEvent;

export default function WhiteboardCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const drawingContainerRef = useRef<PIXI.Container | null>(null);
  const toolRef = useRef<'pen' | 'eraser' | 'select' | 'hand'>('pen');
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'select' | 'hand'>('pen');

  const room = useRoomContext();

  // Helper: Draw Line
  const drawLine = (x: number, y: number, prevX: number, prevY: number, color: number, width: number) => {
    if (!drawingContainerRef.current) return;

    const graphics = new PIXI.Graphics();

    // Create the stroke style
    graphics.moveTo(prevX, prevY);
    graphics.lineTo(x, y);

    // Check if Eraser (White) -> Apply 'erase' blend mode to make transparent
    if (color === 0xffffff) {
      graphics.blendMode = 'erase';
    }

    graphics.stroke({ width, color, cap: 'round', join: 'round' });

    drawingContainerRef.current.addChild(graphics);
  };

  // --- Pixi Initialization & Event Management ---
  useEffect(() => {
    if (!containerRef.current) return;
    if (appRef.current) return; // Prevent double init

    let currentStroke: DrawEvent[] = [];
    let isDrawing = false;
    let lastPoint: { x: number, y: number } | null = null;
    let canvasElement: HTMLCanvasElement | null = null;

    const onPointerDown = (e: PointerEvent) => {
      if (!canvasElement) return;
      isDrawing = true;
      canvasElement.setPointerCapture(e.pointerId);

      const rect = canvasElement.getBoundingClientRect();
      lastPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      currentStroke = [];
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDrawing || !lastPoint || !canvasElement) return;

      const rect = canvasElement.getBoundingClientRect();
      const currentPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      const color = toolRef.current === 'eraser' ? 0xffffff : 0x000000;
      const width = toolRef.current === 'eraser' ? 20 : 2;

      // Draw Locally
      drawLine(currentPoint.x, currentPoint.y, lastPoint.x, lastPoint.y, color, width);

      // Broadcast
      const event: DrawEvent = {
        type: 'draw',
        x: currentPoint.x, y: currentPoint.y,
        prevX: lastPoint.x, prevY: lastPoint.y,
        color, width
      };

      if (room) {
        const str = JSON.stringify(event);
        const encoder = new TextEncoder();
        room.localParticipant.publishData(encoder.encode(str), { reliable: true });
      }

      currentStroke.push(event);
      lastPoint = currentPoint;
    };

    const onPointerUp = async (e: PointerEvent) => {
      isDrawing = false;
      lastPoint = null;
      if (canvasElement) {
        canvasElement.releasePointerCapture(e.pointerId);
      }

      if (currentStroke.length > 0) {
        try {
          await fetch('/api/whiteboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room: room?.name, stroke: currentStroke })
          });
        } catch (err) {
          console.error('Failed to save stroke:', err);
        }
      }
      currentStroke = [];
    };

    const initPixi = async () => {
      // 1. Init Pixi with ResizeObserver
      const resizeObserver = new ResizeObserver((entries) => {
        if (!appRef.current || !entries[0]) return;
        const { width, height } = entries[0].contentRect;
        appRef.current.renderer.resize(width, height);
        // CRITICAL: Update hitArea when size changes
        if (appRef.current.stage) {
          appRef.current.stage.hitArea = appRef.current.screen;
        }
      });
      resizeObserver.observe(containerRef.current!);

      const app = new PIXI.Application();
      await app.init({
        backgroundAlpha: 0, // Make canvas transparent to show dots
        resizeTo: containerRef.current!,
        preference: 'webgpu',
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      if (containerRef.current && !appRef.current) {
        containerRef.current.appendChild(app.canvas);
        appRef.current = app;
        canvasElement = app.canvas;

        const drawingContainer = new PIXI.Container();
        app.stage.addChild(drawingContainer);
        drawingContainerRef.current = drawingContainer;

        // Attach Native Listeners
        canvasElement.addEventListener('pointerdown', onPointerDown);
        canvasElement.addEventListener('pointermove', onPointerMove);
        canvasElement.addEventListener('pointerup', onPointerUp);
      }
    };

    initPixi();

    return () => {
      // Cleanup
      if (appRef.current) {
        const canvas = appRef.current.canvas;
        // Remove Listeners safely
        if (canvas) {
          canvas.removeEventListener('pointerdown', onPointerDown);
          canvas.removeEventListener('pointermove', onPointerMove);
          canvas.removeEventListener('pointerup', onPointerUp);
        }
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
    };
  }, [room]);

  // Data Receiver
  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array, participant: any) => {
      try {
        const str = new TextDecoder().decode(payload);
        const event = JSON.parse(str);

        if (event.type === 'draw') {
          drawLine(event.x, event.y, event.prevX, event.prevY, event.color, event.width);
        } else if (event.type === 'clear') {
          drawingContainerRef.current?.removeChildren();
        }
      } catch (e) {
        console.error('Failed to parse board data', e);
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  // Initial Load (History)
  useEffect(() => {
    if (!room?.name) return;

    const loadHistory = async () => {
      try {
        const res = await fetch(`/api/whiteboard?room=${room.name}`);
        if (!res.ok) return;
        const history = await res.json();

        // Render all history
        history.forEach((stroke: DrawEvent[]) => {
          stroke.forEach(point => {
            drawLine(point.x, point.y, point.prevX, point.prevY, point.color, point.width);
          });
        });
      } catch (e) {
        console.error('Failed to load history', e);
      }
    };

    // Delay slightly or call immediately (Animation masking happens in parent)
    loadHistory();
  }, [room?.name]);

  const setTool = (t: 'pen' | 'eraser' | 'select' | 'hand') => {
    toolRef.current = t;
    setActiveTool(t);
  };

  const clearBoard = () => {
    if (drawingContainerRef.current) {
      drawingContainerRef.current.removeChildren();
    }
    // Broadcast Clear
    if (room) {
      const event: ClearEvent = { type: 'clear' };
      const encoder = new TextEncoder();
      room.localParticipant.publishData(encoder.encode(JSON.stringify(event)), { reliable: true });

      // API Clear (Optional: Implement DELETE /api/whiteboard if needed)
    }
  };

  return (
    <div className="relative w-full h-full bg-[#f9f9f9] touch-none overflow-hidden">
      {/* Dot Grid Background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-50"
        style={{
          backgroundImage: 'radial-gradient(#000000 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px'
        }}
      />

      <div ref={containerRef} className="w-full h-full relative z-10" />

      {/* Floating Toolbar (Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl px-2 py-2 flex items-center gap-1 border border-gray-100 z-50">

        {/* Select (Arrow) */}
        <button
          onClick={() => setActiveTool('select')}
          className={`p-3 rounded-xl transition-all ${activeTool === 'select' ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-500'}`}
          title="선택"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </button>

        {/* Hand (Pan) */}
        <button
          onClick={() => setActiveTool('hand')}
          className={`p-3 rounded-xl transition-all ${activeTool === 'hand' ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-500'}`}
          title="이동"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
          </svg>
        </button>

        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Pen */}
        <button
          onClick={() => setTool('pen')}
          className={`p-3 rounded-xl transition-all ${activeTool === 'pen' ? 'bg-purple-100 text-purple-600 ring-2 ring-purple-100' : 'hover:bg-gray-100 text-gray-500'}`}
          title="펜"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>

        {/* Eraser */}
        <button
          onClick={() => setTool('eraser')}
          className={`p-3 rounded-xl transition-all ${activeTool === 'eraser' ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 text-gray-500'}`}
          title="지우개"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Sticky Note (Placeholder) */}
        <button
          className="p-3 rounded-xl hover:bg-yellow-50 text-yellow-500 transition-all opacity-50 cursor-not-allowed"
          title="메모 (준비중)"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" />
          </svg>
        </button>

        {/* Shape (Placeholder) */}
        <button
          className="p-3 rounded-xl hover:bg-blue-50 text-blue-500 transition-all opacity-50 cursor-not-allowed"
          title="도형 (준비중)"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </button>

        {/* Text (Placeholder) */}
        <button
          className="p-3 rounded-xl hover:bg-gray-100 text-gray-500 transition-all opacity-50 cursor-not-allowed"
          title="텍스트 (준비중)"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>

        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Clear */}
        <button
          onClick={clearBoard}
          className="p-3 hover:bg-red-50 text-red-500 rounded-xl transition-colors font-medium"
          title="모두 지우기"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

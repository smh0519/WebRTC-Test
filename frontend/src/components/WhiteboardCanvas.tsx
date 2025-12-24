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
  const toolRef = useRef<'pen' | 'eraser'>('pen');
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen');

  const room = useRoomContext();

  // Helper: Draw Line
  const drawLine = (x: number, y: number, prevX: number, prevY: number, color: number, width: number) => {
    if (!drawingContainerRef.current) return;

    const graphics = new PIXI.Graphics();

    // Create the stroke style
    graphics.moveTo(prevX, prevY);
    graphics.lineTo(x, y);
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
        background: '#ffffff',
        resizeTo: containerRef.current!,
        preference: 'webgl',
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

  const setTool = (t: 'pen' | 'eraser') => {
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
    <div className="relative w-full h-full bg-white touch-none">
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating Toolbar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur shadow-lg rounded-full px-6 py-3 flex gap-4 border border-gray-200">
        <button
          onClick={() => setTool('pen')}
          className={`p-2 rounded-full transition-colors ${activeTool === 'pen' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          🖊️ 펜
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={`p-2 rounded-full transition-colors ${activeTool === 'eraser' ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100'}`}
        >
          🧹 지우개
        </button>
        <div className="w-px bg-gray-300 mx-2" />
        <button
          onClick={clearBoard}
          className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors font-medium"
        >
          모두 지우기
        </button>
      </div>
    </div>
  );
}

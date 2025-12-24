'use client';

import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, DataPacket_Kind } from 'livekit-client';

type Tool = 'pen' | 'eraser';

interface DrawEvent {
  ids: number[]; // Used to group points into a stroke if needed
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  color: number;
  width: number;
}

export default function WhiteboardCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const drawingContainerRef = useRef<PIXI.Container | null>(null);
  // We'll use a map to keep track of ongoing remote strokes if we want to smooth them 
  // but for now simple line segments are stateless and easiest.

  const room = useRoomContext();

  // Use refs for values needed inside event listeners
  const toolRef = useRef<Tool>('pen');
  const [activeTool, setActiveTool] = useState<Tool>('pen');

  useEffect(() => {
    if (!containerRef.current) return;
    if (appRef.current) return;

    const initPixi = async () => {
      // 1. Init Pixi with ResizeObserver
      const resizeObserver = new ResizeObserver((entries) => {
        if (!appRef.current || !entries[0]) return;
        const { width, height } = entries[0].contentRect;
        appRef.current.renderer.resize(width, height);
      });
      resizeObserver.observe(containerRef.current!);

      const app = new PIXI.Application();
      await app.init({
        background: '#ffffff',
        resizeTo: containerRef.current!,
        preference: 'webgl', // WebGPU can be unstable on some setups, using WebGL for reliability
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      if (containerRef.current) {
        containerRef.current.appendChild(app.canvas);
        appRef.current = app;

        const drawingContainer = new PIXI.Container();
        app.stage.addChild(drawingContainer);
        drawingContainerRef.current = drawingContainer;

        // Shared drawing function (for local and remote)
        const drawLine = (x: number, y: number, prevX: number, prevY: number, color: number, width: number) => {
          const graphics = new PIXI.Graphics();
          drawingContainer.addChild(graphics);

          graphics.moveTo(prevX, prevY);
          graphics.lineTo(x, y);
          graphics.stroke({ width, color, cap: 'round', join: 'round' });
        };

        // 2. Setup Local Drawing Logic
        let isDrawing = false;
        let lastPoint: { x: number; y: number } | null = null;

        const onPointerDown = (e: PointerEvent) => {
          isDrawing = true;
          const rect = app.canvas.getBoundingClientRect();
          lastPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };

          // Draw initial dot
          const color = toolRef.current === 'eraser' ? 0xffffff : 0x000000;
          const width = toolRef.current === 'eraser' ? 20 : 2;

          const graphics = new PIXI.Graphics();
          drawingContainer.addChild(graphics);
          graphics.circle(lastPoint.x, lastPoint.y, width / 2);
          graphics.fill({ color });

          // Broadcast dot (as a tiny line to self)
          broadcastDraw({
            x: lastPoint.x, y: lastPoint.y,
            prevX: lastPoint.x, prevY: lastPoint.y,
            color, width
          });
        };

        const onPointerMove = (e: PointerEvent) => {
          if (!isDrawing || !lastPoint) return;

          const rect = app.canvas.getBoundingClientRect();
          const currentPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };

          const color = toolRef.current === 'eraser' ? 0xffffff : 0x000000;
          const width = toolRef.current === 'eraser' ? 20 : 2;

          // Draw Locally
          drawLine(currentPoint.x, currentPoint.y, lastPoint.x, lastPoint.y, color, width);

          // Broadcast
          broadcastDraw({
            x: currentPoint.x, y: currentPoint.y,
            prevX: lastPoint.x, prevY: lastPoint.y,
            color, width
          });

          lastPoint = currentPoint;
        };

        const onPointerUp = () => {
          isDrawing = false;
          lastPoint = null;
        };

        app.canvas.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);

        // 3. Setup Remote Data Listener
        if (room) {
          room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant: any) => {
            try {
              const str = new TextDecoder().decode(payload);
              const event = JSON.parse(str);

              if (event.type === 'draw') {
                drawLine(event.x, event.y, event.prevX, event.prevY, event.color, event.width);
              } else if (event.type === 'clear') {
                drawingContainer.removeChildren();
              }
            } catch (e) {
              console.error('Failed to parse board data', e);
            }
          });
        }
      }
    };

    initPixi();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
    };
  }, [room]); // Re-init if room changes (though layout ensures room is stable usually)

  // Helper to send data
  const broadcastDraw = (data: Omit<DrawEvent, 'ids'>) => {
    if (!room) return;
    const str = JSON.stringify({ type: 'draw', ...data });
    const payload = new TextEncoder().encode(str);
    room.localParticipant.publishData(payload, { reliable: true }); // reliable for drawing is safer, though lossy is faster
  };

  const broadcastClear = () => {
    if (!room) return;
    const str = JSON.stringify({ type: 'clear' });
    const payload = new TextEncoder().encode(str);
    room.localParticipant.publishData(payload, { reliable: true });
  };

  const setTool = (tool: Tool) => {
    setActiveTool(tool);
    toolRef.current = tool;
  };

  const clearCanvas = () => {
    if (drawingContainerRef.current) {
      drawingContainerRef.current.removeChildren();
      broadcastClear();
    }
  };

  return (
    <div className="relative w-full h-full bg-white">
      <div ref={containerRef} className="w-full h-full touch-none" />

      {/* Floating Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 bg-gray-800/90 backdrop-blur p-2 rounded-xl shadow-xl border border-gray-700">
        <button
          onClick={() => setTool('pen')}
          className={`p-2 rounded-lg transition-colors ${activeTool === 'pen' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          title="Pen"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={`p-2 rounded-lg transition-colors ${activeTool === 'eraser' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          title="Eraser"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        <div className="w-px bg-gray-600/50 mx-1 my-1" />
        <button
          onClick={clearCanvas}
          className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
          title="Clear All"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

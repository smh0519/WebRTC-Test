'use client';

import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

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

export default function WhiteboardCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const drawingContainerRef = useRef<PIXI.Container | null>(null);
  const toolRef = useRef<'pen' | 'eraser' | 'select' | 'hand'>('pen');
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'select' | 'hand'>('pen');

  // Panning State
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });

  // Tool Size State
  const [penSize, setPenSize] = useState(2);
  const [eraserSize, setEraserSize] = useState(20);
  const penSizeRef = useRef(2);
  const eraserSizeRef = useRef(20);
  const [showSizeSlider, setShowSizeSlider] = useState(false);

  const room = useRoomContext();

  // Helper: Draw Line (World Coordinates)
  const drawLine = (x: number, y: number, prevX: number, prevY: number, color: number, width: number) => {
    if (!drawingContainerRef.current) return;

    const graphics = new PIXI.Graphics();
    graphics.moveTo(prevX, prevY);
    graphics.lineTo(x, y);

    if (color === 0xffffff) {
      graphics.blendMode = 'erase';
    }

    graphics.stroke({ width, color, cap: 'round', join: 'round' });
    drawingContainerRef.current.addChild(graphics);
  };

  // --- Pixi Initialization & Event Management ---
  useEffect(() => {
    if (!containerRef.current) return;
    if (appRef.current) return;

    // Helper: Update Pan
    const updateContainerPosition = () => {
      if (drawingContainerRef.current) {
        drawingContainerRef.current.position.set(panOffsetRef.current.x, panOffsetRef.current.y);
      }
    };

    let currentStroke: DrawEvent[] = [];
    let isDrawing = false;
    let isPanning = false;
    let lastPoint: { x: number, y: number } | null = null;
    let lastPanPoint: { x: number, y: number } | null = null;
    let canvasElement: HTMLCanvasElement | null = null;

    const onPointerDown = (e: PointerEvent) => {
      if (!canvasElement) return;
      canvasElement.setPointerCapture(e.pointerId);
      const rect = canvasElement.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      if (toolRef.current === 'hand') {
        isPanning = true;
        lastPanPoint = { x: e.clientX, y: e.clientY };
        return;
      }

      isDrawing = true;
      lastPoint = {
        x: clientX - panOffsetRef.current.x,
        y: clientY - panOffsetRef.current.y
      };
      currentStroke = [];
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!canvasElement) return;

      if (isPanning && lastPanPoint) {
        const dx = e.clientX - lastPanPoint.x;
        const dy = e.clientY - lastPanPoint.y;

        panOffsetRef.current = {
          x: panOffsetRef.current.x + dx,
          y: panOffsetRef.current.y + dy
        };

        setPanOffset({ ...panOffsetRef.current });
        updateContainerPosition();

        lastPanPoint = { x: e.clientX, y: e.clientY };
        return;
      }

      if (!isDrawing || !lastPoint) return;

      const rect = canvasElement.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const currentPoint = {
        x: clientX - panOffsetRef.current.x,
        y: clientY - panOffsetRef.current.y
      };

      const color = toolRef.current === 'eraser' ? 0xffffff : 0x000000;
      // Use Ref for current size to avoid stale closures in event listener
      const width = toolRef.current === 'eraser' ? eraserSizeRef.current : penSizeRef.current;

      drawLine(currentPoint.x, currentPoint.y, lastPoint.x, lastPoint.y, color, width);

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
      if (canvasElement) {
        canvasElement.releasePointerCapture(e.pointerId);
      }

      if (isPanning) {
        isPanning = false;
        lastPanPoint = null;
        return;
      }

      isDrawing = false;
      lastPoint = null;

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
      const resizeObserver = new ResizeObserver((entries) => {
        if (!appRef.current || !entries[0]) return;
        const { width, height } = entries[0].contentRect;
        appRef.current.renderer.resize(width, height);
        if (appRef.current.stage) {
          appRef.current.stage.hitArea = appRef.current.screen;
        }
      });
      resizeObserver.observe(containerRef.current!);

      const app = new PIXI.Application();
      await app.init({
        backgroundAlpha: 0,
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

        canvasElement.addEventListener('pointerdown', onPointerDown);
        canvasElement.addEventListener('pointermove', onPointerMove);
        canvasElement.addEventListener('pointerup', onPointerUp);
      }
    };

    initPixi();

    return () => {
      if (appRef.current) {
        const canvas = appRef.current.canvas;
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

  useEffect(() => {
    if (!room?.name) return;
    const loadHistory = async () => {
      try {
        const res = await fetch(`/api/whiteboard?room=${room.name}`);
        if (!res.ok) return;
        const history = await res.json();
        history.forEach((stroke: DrawEvent[]) => {
          stroke.forEach(point => {
            drawLine(point.x, point.y, point.prevX, point.prevY, point.color, point.width);
          });
        });
      } catch (e) {
        console.error('Failed to load history', e);
      }
    };
    loadHistory();
  }, [room?.name]);

  const setTool = (t: 'pen' | 'eraser' | 'select' | 'hand') => {
    if (toolRef.current === t) {
      // logic handled in double click now or specific UI toggle
    } else {
      setShowSizeSlider(false); // Hide slider if switching tools
    }
    toolRef.current = t;
    setActiveTool(t);
  };

  const handleToolClick = (t: 'pen' | 'eraser') => {
    if (activeTool === t) {
      // If already active, toggle slider
      if (!showSizeSlider) {
        setShowSizeSlider(true);
      } else {
        // Check if we are clicking the same tool to close it, or if it's just a focus thing. 
        // Usually simpler: single click sets tool, subsequent clicks toggle slider? 
        // User requested Double Click.
      }
    } else {
      setTool(t);
    }
  };

  const clearBoard = () => {
    if (drawingContainerRef.current) {
      drawingContainerRef.current.removeChildren();
    }
    if (room) {
      const event: ClearEvent = { type: 'clear' };
      const encoder = new TextEncoder();
      room.localParticipant.publishData(encoder.encode(JSON.stringify(event)), { reliable: true });
    }
  };

  // Dynamic Cursor
  const getCursor = () => {
    switch (activeTool) {
      case 'hand': return 'grab';
      case 'pen':
        // Dynamic SVG based on penSize
        const r = Math.max(2, penSize / 2); // Radius
        const size = Math.max(16, r * 2 + 4); // Canvas size
        const cx = size / 2;
        const svgPen = encodeURIComponent(`
                <svg xmlns='http://www.w3.org/2000/svg' height='${size}' width='${size}'>
                    <circle cx='${cx}' cy='${cx}' r='${r}' fill='black' />
                    <circle cx='${cx}' cy='${cx}' r='${r + 0.5}' stroke='white' stroke-width='1' fill='none' opacity='0.5'/>
                </svg>
            `.trim().replace(/\s+/g, ' '));
        return `url("data:image/svg+xml;utf8,${svgPen}") ${cx} ${cx}, crosshair`;

      case 'eraser':
        const er = Math.max(4, eraserSize / 2);
        const esize = Math.max(16, er * 2 + 4);
        const ecx = esize / 2;
        const svgEraser = encodeURIComponent(`
                <svg xmlns='http://www.w3.org/2000/svg' height='${esize}' width='${esize}'>
                    <circle cx='${ecx}' cy='${ecx}' r='${er}' stroke='black' stroke-width='1' fill='white' opacity='0.8'/>
                </svg>
            `.trim().replace(/\s+/g, ' '));
        return `url("data:image/svg+xml;utf8,${svgEraser}") ${ecx} ${ecx}, cell`;

      default: return 'default';
    }
  };

  return (
    <div className="relative w-full h-full bg-[#f9f9f9] touch-none overflow-hidden"
      style={{ cursor: getCursor() }}>

      {/* Dot Grid Background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-50"
        style={{
          backgroundImage: 'radial-gradient(#000000 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
          backgroundPosition: `${panOffset.x}px ${panOffset.y}px`
        }}
      />

      <div ref={containerRef} className="w-full h-full relative z-10" />

      {/* Floating Toolbar */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 z-50">

        {/* Size Slider Popup */}
        {showSizeSlider && (
          <div className="bg-white rounded-xl shadow-xl px-4 py-2 border border-gray-100 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 mb-2">
            <span className="text-xs font-medium text-gray-500 w-8">
              {activeTool === 'pen' ? penSize : eraserSize}px
            </span>
            <input
              type="range"
              min={activeTool === 'pen' ? "1" : "5"}
              max={activeTool === 'pen' ? "20" : "50"}
              value={activeTool === 'pen' ? penSize : eraserSize}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (activeTool === 'pen') {
                  setPenSize(val);
                  penSizeRef.current = val;
                } else {
                  setEraserSize(val);
                  eraserSizeRef.current = val;
                }
              }}
              className="w-32 accent-purple-600 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <button
              onClick={() => setShowSizeSlider(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        )}

        <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl px-2 py-2 flex items-center gap-1 border border-gray-100">
          {/* Select */}
          <button
            onClick={() => { setTool('select'); setShowSizeSlider(false); }}
            className={`p-3 rounded-xl transition-all ${activeTool === 'select' ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-500'}`}
            title="선택"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </button>

          {/* Hand */}
          <button
            onClick={() => { setTool('hand'); setShowSizeSlider(false); }}
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
            onClick={() => {
              if (activeTool === 'pen') {
                // Just focus logic, logic for popup handled by DoubleClick
              } else {
                setTool('pen');
              }
            }}
            onDoubleClick={() => {
              setTool('pen');
              setShowSizeSlider(!showSizeSlider);
            }}
            className={`p-3 rounded-xl transition-all ${activeTool === 'pen' ? 'bg-purple-100 text-purple-600 ring-2 ring-purple-100' : 'hover:bg-gray-100 text-gray-500'}`}
            title="펜 (더블클릭하여 굵기 조절)"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>

          {/* Eraser */}
          <button
            onClick={() => {
              if (activeTool !== 'eraser') setTool('eraser');
            }}
            onDoubleClick={() => {
              setTool('eraser');
              setShowSizeSlider(!showSizeSlider);
            }}
            className={`p-3 rounded-xl transition-all ${activeTool === 'eraser' ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 text-gray-500'}`}
            title="지우개 (더블클릭하여 크기 조절)"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l-6 6" />
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
    </div>
  );
}

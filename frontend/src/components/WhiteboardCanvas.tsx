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

interface RefetchEvent {
  type: 'refetch';
}

// Preset Colors
const COLORS = [
  '#000000', '#444444', '#666666', '#999999', '#CCCCCC', '#EEEEEE', '#FFFFFF',
  '#FFCCCC', '#FFE5CC', '#F9FFCC', '#CCFFEB', '#CCECFF', '#CCCCFF', '#E5CCFF',
  '#FF9966', '#FFCC00', '#B2CC47', '#80C2C0', '#66B2FF', '#9999FF', '#CC66FF',
  '#FF5050', '#FF9933', '#8CB347', '#40B2A9', '#3399FF', '#6666FF', '#9933FF',
  '#CC3300', '#FF6600', '#5F8C3E', '#209688', '#007ACC', '#3333CC', '#6600CC',
  '#992600', '#CC5200', '#40662E', '#146E5E', '#005299', '#24248F', '#47008F'
];

export default function WhiteboardCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const drawingContainerRef = useRef<PIXI.Container | null>(null);

  const currentGraphicsRef = useRef<{
    graphics: PIXI.Graphics;
    color: number;
    width: number;
    isEraser: boolean;
  } | null>(null);

  const toolRef = useRef<'pen' | 'eraser' | 'hand'>('pen');
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'hand'>('pen');

  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);

  const [penSize, setPenSize] = useState(2);
  const [eraserSize, setEraserSize] = useState(20);
  const [penColor, setPenColor] = useState('#000000');
  const [smoothness, setSmoothness] = useState(3);

  // New State for Undo/Redo availability
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const penSizeRef = useRef(2);
  const eraserSizeRef = useRef(20);
  const penColorRef = useRef(0x000000);
  const smoothnessRef = useRef(3);

  const [showToolSettings, setShowToolSettings] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);

  const [triggerLoad, setTriggerLoad] = useState(0);

  const room = useRoomContext();

  const drawLine = (x: number, y: number, prevX: number, prevY: number, color: number, width: number) => {
    if (!drawingContainerRef.current) return;

    const isEraser = color === 0xffffff && toolRef.current === 'eraser';

    let graphics: PIXI.Graphics;
    const sameProp = currentGraphicsRef.current &&
      currentGraphicsRef.current.color === color &&
      currentGraphicsRef.current.width === width &&
      currentGraphicsRef.current.isEraser === isEraser;

    if (sameProp && currentGraphicsRef.current) {
      graphics = currentGraphicsRef.current.graphics;
    } else {
      graphics = new PIXI.Graphics();
      if (isEraser) {
        graphics.blendMode = 'erase';
      }
      drawingContainerRef.current.addChild(graphics);

      currentGraphicsRef.current = {
        graphics,
        color,
        width,
        isEraser
      };
    }

    graphics.moveTo(prevX, prevY);
    graphics.lineTo(x, y);
    graphics.stroke({ width, color, cap: 'round', join: 'round' });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    if (appRef.current) return;

    const updateContainerTransform = () => {
      if (drawingContainerRef.current) {
        drawingContainerRef.current.position.set(panOffsetRef.current.x, panOffsetRef.current.y);
        drawingContainerRef.current.scale.set(scaleRef.current);
      }
    };

    let currentStroke: DrawEvent[] = [];
    let isDrawing = false;
    let isPanning = false;

    let lastPanPoint: { x: number, y: number } | null = null;
    let canvasElement: HTMLCanvasElement | null = null;

    let prevRawPoint: { x: number, y: number } | null = null;
    let prevRenderedPoint: { x: number, y: number } | null = null;

    const getLocalPoint = (clientX: number, clientY: number) => {
      if (!canvasElement) return { x: 0, y: 0 };
      const rect = canvasElement.getBoundingClientRect();
      return {
        x: (clientX - rect.left - panOffsetRef.current.x) / scaleRef.current,
        y: (clientY - rect.top - panOffsetRef.current.y) / scaleRef.current
      };
    };

    // Zoom logic moved to component scope

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey) {
        const zoomFactor = -e.deltaY * 0.002;
        zoom(zoomFactor, e.clientX, e.clientY);
      } else {
        const panSpeed = 1;
        const dx = -e.deltaX * panSpeed;
        const dy = -e.deltaY * panSpeed;

        panOffsetRef.current = {
          x: panOffsetRef.current.x + dx,
          y: panOffsetRef.current.y + dy
        };
        setPanOffset({ ...panOffsetRef.current });
        updateContainerTransform();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!canvasElement) return;

      setIsInteracting(true);
      setShowToolSettings(false);
      canvasElement.setPointerCapture(e.pointerId);

      if (e.button === 1 || toolRef.current === 'hand') {
        isPanning = true;
        if (e.button === 1) setIsMiddlePanning(true);
        lastPanPoint = { x: e.clientX, y: e.clientY };
        e.preventDefault();
        return;
      }

      isDrawing = true;
      const startPoint = getLocalPoint(e.clientX, e.clientY);

      prevRawPoint = startPoint;
      prevRenderedPoint = startPoint;
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
        updateContainerTransform();

        lastPanPoint = { x: e.clientX, y: e.clientY };
        return;
      }

      if (!isDrawing || !prevRawPoint || !prevRenderedPoint) return;

      const rawPoint = getLocalPoint(e.clientX, e.clientY);
      const sLevel = smoothnessRef.current;

      const dist = Math.sqrt(
        Math.pow(rawPoint.x - prevRawPoint.x, 2) +
        Math.pow(rawPoint.y - prevRawPoint.y, 2)
      );

      const distThresholdScreen = sLevel === 0 ? 0 : 0.5 + (sLevel * 0.5);
      const threshold = distThresholdScreen / scaleRef.current;

      if (dist < threshold) {
        return;
      }

      let targetPoint = rawPoint;
      if (sLevel > 0) {
        targetPoint = {
          x: (prevRawPoint.x + rawPoint.x) / 2,
          y: (prevRawPoint.y + rawPoint.y) / 2
        };
      }

      const x = targetPoint.x;
      const y = targetPoint.y;
      const prevX = prevRenderedPoint.x;
      const prevY = prevRenderedPoint.y;

      const color = toolRef.current === 'eraser' ? 0xffffff : penColorRef.current;

      const baseSize = toolRef.current === 'eraser' ? eraserSizeRef.current : penSizeRef.current;
      const width = baseSize / scaleRef.current;

      drawLine(x, y, prevX, prevY, color, width);

      const event: DrawEvent = {
        type: 'draw',
        x, y,
        prevX, prevY,
        color, width
      };

      if (room) {
        const str = JSON.stringify(event);
        const encoder = new TextEncoder();
        room.localParticipant.publishData(encoder.encode(str), { reliable: true });
      }

      currentStroke.push(event);

      prevRenderedPoint = targetPoint;
      prevRawPoint = rawPoint;
    };

    const onPointerUp = async (e: PointerEvent) => {
      setIsInteracting(false);

      if (canvasElement) {
        canvasElement.releasePointerCapture(e.pointerId);
      }

      if (isPanning) {
        isPanning = false;
        setIsMiddlePanning(false);
        lastPanPoint = null;
        return;
      }

      if (isDrawing && prevRawPoint && prevRenderedPoint) {
        const finalRaw = getLocalPoint(e.clientX, e.clientY);

        const dest = finalRaw;

        const color = toolRef.current === 'eraser' ? 0xffffff : penColorRef.current;
        const baseSize = toolRef.current === 'eraser' ? eraserSizeRef.current : penSizeRef.current;
        const width = baseSize / scaleRef.current;

        drawLine(dest.x, dest.y, prevRenderedPoint.x, prevRenderedPoint.y, color, width);

        const event: DrawEvent = {
          type: 'draw',
          x: dest.x, y: dest.y,
          prevX: prevRenderedPoint.x, prevY: prevRenderedPoint.y,
          color, width
        };

        if (room) {
          const str = JSON.stringify(event);
          const encoder = new TextEncoder();
          room.localParticipant.publishData(encoder.encode(str), { reliable: true });
        }
        currentStroke.push(event);
      }

      isDrawing = false;
      prevRawPoint = null;
      prevRenderedPoint = null;
      currentGraphicsRef.current = null;

      if (currentStroke.length > 0) {
        try {
          const res = await fetch('/api/whiteboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room: room?.name, stroke: currentStroke })
          });
          const data = await res.json();
          if (data.success) {
            setCanUndo(data.canUndo ?? true);
            setCanRedo(data.canRedo ?? false);
          }
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
        canvasElement.addEventListener('wheel', onWheel, { passive: false });
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
          canvas.removeEventListener('wheel', onWheel);
        }
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
    };
  }, [room]);

  // Separate effect for keyboard shortcuts to avoid stale closures (especially for Undo/Redo)


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
          currentGraphicsRef.current = null;
          setCanUndo(false); // Assume clear resets
          setCanRedo(false);
          setTriggerLoad(prev => prev + 1); // Refetch to be sure
        } else if (event.type === 'refetch') {
          setTriggerLoad(prev => prev + 1);
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
        const data = await res.json();

        let history = [];
        if (Array.isArray(data)) { // Backwards compatibility just in case
          history = data;
        } else {
          history = data.history || [];
          setCanUndo(data.canUndo ?? false);
          setCanRedo(data.canRedo ?? false);
        }

        if (drawingContainerRef.current) {
          drawingContainerRef.current.removeChildren();
        }
        currentGraphicsRef.current = null;

        history.forEach((stroke: DrawEvent[]) => {
          stroke.forEach(point => {
            drawLine(point.x, point.y, point.prevX, point.prevY, point.color, point.width);
          });
          currentGraphicsRef.current = null;
        });
      } catch (e) {
        console.error('Failed to load history', e);
      }
    };
    loadHistory();
  }, [room?.name, triggerLoad]);

  const setTool = (t: 'pen' | 'eraser' | 'hand') => {
    if (t === 'pen' || t === 'eraser') {
      setShowToolSettings(true);
    } else {
      setShowToolSettings(false);
    }
    toolRef.current = t;
    setActiveTool(t);
  };

  const clearBoard = () => {
    if (drawingContainerRef.current) {
      drawingContainerRef.current.removeChildren();
      currentGraphicsRef.current = null;
    }
    if (room) {
      const event: ClearEvent = { type: 'clear' };
      const encoder = new TextEncoder();
      room.localParticipant.publishData(encoder.encode(JSON.stringify(event)), { reliable: true });
    }
    fetch('/api/whiteboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: room?.name, type: 'clear' })
    }).then(res => res.json()).then(data => {
      setCanUndo(false);
      setCanRedo(false);
    });
  };

  const performUndo = async () => {
    if (!room?.name || !canUndo) return; // Prevent if disabled

    const res = await fetch('/api/whiteboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: room.name, type: 'undo' })
    });
    const data = await res.json();
    if (data.success) {
      setCanUndo(data.canUndo);
      setCanRedo(data.canRedo);
    }

    const event: RefetchEvent = { type: 'refetch' };
    const encoder = new TextEncoder();
    if (room) {
      room.localParticipant.publishData(encoder.encode(JSON.stringify(event)), { reliable: true });
    }
    setTriggerLoad(prev => prev + 1);
  };

  const performRedo = async () => {
    if (!room?.name || !canRedo) return; // Prevent if disabled

    const res = await fetch('/api/whiteboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: room.name, type: 'redo' })
    });
    const data = await res.json();
    if (data.success) {
      setCanUndo(data.canUndo);
      setCanRedo(data.canRedo);
    }

    const event: RefetchEvent = { type: 'refetch' };
    const encoder = new TextEncoder();
    if (room) {
      room.localParticipant.publishData(encoder.encode(JSON.stringify(event)), { reliable: true });
    }
    setTriggerLoad(prev => prev + 1);
  };

  // Move zoom logic out so buttons can use it
  const zoom = (factor: number, centerX?: number, centerY?: number) => {
    const oldScale = scaleRef.current;
    const newScale = Math.min(Math.max(0.1, oldScale + factor), 5);

    if (newScale === oldScale) return;

    // Use appRef to get canvas since we are outside init scope
    const canvasElement = appRef.current?.canvas;
    if (!canvasElement) return;

    let focusX, focusY;
    const rect = canvasElement.getBoundingClientRect();

    if (centerX !== undefined && centerY !== undefined) {
      focusX = centerX - rect.left;
      focusY = centerY - rect.top;
    } else {
      focusX = rect.width / 2;
      focusY = rect.height / 2;
    }

    const worldX = (focusX - panOffsetRef.current.x) / oldScale;
    const worldY = (focusY - panOffsetRef.current.y) / oldScale;

    const newPanX = focusX - worldX * newScale;
    const newPanY = focusY - worldY * newScale;

    scaleRef.current = newScale;
    panOffsetRef.current = { x: newPanX, y: newPanY };

    setScale(newScale);
    setPanOffset({ x: newPanX, y: newPanY });

    // Update container
    if (drawingContainerRef.current) {
      drawingContainerRef.current.position.set(newPanX, newPanY);
      drawingContainerRef.current.scale.set(newScale);
    }
  };

  const resetZoom = () => {
    setScale(1);
    scaleRef.current = 1;
    if (drawingContainerRef.current) {
      drawingContainerRef.current.scale.set(1);
    }
    setPanOffset({ x: 0, y: 0 });
    panOffsetRef.current = { x: 0, y: 0 };
    if (drawingContainerRef.current) {
      drawingContainerRef.current.position.set(0, 0);
    }
  };

  const handleColorChange = (hex: string) => {
    setPenColor(hex);
    penColorRef.current = parseInt(hex.replace('#', ''), 16);
  };

  const getCursor = () => {
    if (isMiddlePanning) return 'grabbing';
    if (activeTool === 'hand' && isInteracting) return 'grabbing';

    switch (activeTool) {
      case 'hand': return 'grab';
      case 'pen':
        const r = Math.max(2, penSize / 2);
        const size = Math.max(16, r * 2 + 4);
        const cx = size / 2;
        const svgPen = encodeURIComponent(`
                <svg xmlns='http://www.w3.org/2000/svg' height='${size}' width='${size}'>
                    <circle cx='${cx}' cy='${cx}' r='${r}' fill='${penColor}' />
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

  // Separate effect for keyboard shortcuts to avoid stale closures (especially for Undo/Redo)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Zoom: Ctrl + / Ctrl -
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          zoom(0.2);
        } else if (e.key === '-') {
          e.preventDefault();
          zoom(-0.2);
        } else if (e.key === '0') {
          e.preventDefault();
          resetZoom();
        } else if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) performRedo();
          else performUndo();
        } else if (e.key === 'y') {
          e.preventDefault();
          performRedo();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [zoom, resetZoom, performUndo, performRedo]);

  return (
    <div className="relative w-full h-full bg-[#f9f9f9] touch-none overflow-hidden select-none outline-none"
      style={{ cursor: getCursor() }}
      onContextMenu={(e) => e.preventDefault()}>

      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-50 state-layer"
        style={{
          backgroundImage: 'radial-gradient(#999999 1.5px, transparent 1.5px)',
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
          backgroundPosition: `${panOffset.x}px ${panOffset.y}px`
        }}
      />

      {/* Top Left Controls: Zoom & Reset */}
      <div className="absolute top-4 left-4 flex items-center gap-2 z-40">
        <div className="flex bg-white/80 backdrop-blur rounded-lg shadow-sm border border-gray-100 overflow-hidden">

          {/* Zoom Out (-) */}
          <button
            onClick={() => zoom(-0.2)}
            disabled={scale <= 0.1}
            className={`w-8 h-8 flex items-center justify-center hover:bg-white text-gray-600 transition-all ${scale <= 0.1 ? 'opacity-[0.65] cursor-not-allowed' : 'hover:text-black'}`}
            title="축소 (Ctrl -)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          <div className="w-px bg-gray-200 h-8"></div>

          {/* Reset (100%) */}
          <button
            onClick={resetZoom}
            className="px-3 h-8 text-sm font-medium text-gray-500 hover:bg-white hover:text-black transition-colors"
            title="100%로 초기화 (Ctrl 0)"
          >
            {Math.round(scale * 100)}%
          </button>

          <div className="w-px bg-gray-200 h-8"></div>

          {/* Zoom In (+) */}
          <button
            onClick={() => zoom(0.2)}
            disabled={scale >= 5}
            className={`w-8 h-8 flex items-center justify-center hover:bg-white text-gray-600 transition-all ${scale >= 5 ? 'opacity-[0.65] cursor-not-allowed' : 'hover:text-black'}`}
            title="확대 (Ctrl +)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      <div ref={containerRef} className="w-full h-full relative z-10" />

      {/* Floating Toolbar */}
      <div className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 z-50 transition-opacity duration-300 ${isInteracting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>

        {/* Tool Settings Popup */}
        {showToolSettings && (
          <div className="bg-white rounded-xl shadow-xl p-4 border border-gray-100 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 mb-2 w-72 max-h-[60vh] overflow-y-auto">
            {/* Size */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500 w-12">
                Size {activeTool === 'pen' ? penSize : eraserSize}px
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
                className="flex-1 accent-purple-600 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Smooth */}
            {activeTool === 'pen' && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-500 w-12">
                  Smooth {smoothness}
                </span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={smoothness}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSmoothness(val);
                    smoothnessRef.current = val;
                  }}
                  className="flex-1 accent-indigo-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            {/* Color */}
            {activeTool === 'pen' && (
              <>
                <div className="grid grid-cols-7 gap-1.5 pt-2 border-t border-gray-100">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleColorChange(c)}
                      className={`w-7 h-7 rounded-full border transition-transform hover:scale-110 ${penColor === c ? 'ring-2 ring-offset-1 ring-purple-600 border-transparent' : 'border-gray-200'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <div
                    className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm"
                    style={{ backgroundColor: penColor }}
                  />
                  <div className="flex-1 flex items-center bg-gray-50 rounded-lg px-2 border border-gray-200">
                    <input
                      type="text"
                      value={penColor.replace('#', '')}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                        handleColorChange(`#${val}`);
                      }}
                      className="w-full bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 uppercase p-1.5"
                      placeholder="000000"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="color"
                      value={penColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="w-8 h-8 opacity-0 absolute inset-0 cursor-pointer"
                    />
                    <button className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl px-2 py-2 flex items-center gap-1 border border-gray-100">
          {/* Undo */}
          <button
            onClick={performUndo}
            disabled={!canUndo}
            className={`p-3 rounded-xl transition-all ${!canUndo ? 'opacity-[0.65] cursor-not-allowed' : 'hover:bg-gray-100 text-gray-500'}`}
            title="실행 취소 (Ctrl+Z)"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>

          {/* Redo */}
          <button
            onClick={performRedo}
            disabled={!canRedo}
            className={`p-3 rounded-xl transition-all ${!canRedo ? 'opacity-[0.65] cursor-not-allowed' : 'hover:bg-gray-100 text-gray-500'}`}
            title="다시 실행 (Ctrl+Y)"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>

          <div className="w-px h-8 bg-gray-200 mx-1" />

          {/* Hand */}
          <button
            onClick={() => { setTool('hand'); }}
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
                setShowToolSettings(!showToolSettings);
              } else {
                setTool('pen');
                setShowToolSettings(true);
              }
            }}
            className={`p-3 rounded-xl transition-all ${activeTool === 'pen' ? 'bg-purple-100 text-purple-600 ring-2 ring-purple-100 ring-offset-1' : 'hover:bg-gray-100 text-gray-500'}`}
            title="펜"
          >
            <div className="relative">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <div
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white"
                style={{ backgroundColor: penColor }}
              />
            </div>
          </button>

          {/* Eraser */}
          <button
            onClick={() => {
              if (activeTool === 'eraser') {
                setShowToolSettings(!showToolSettings);
              } else {
                setTool('eraser');
                setShowToolSettings(true);
              }
            }}
            className={`p-3 rounded-xl transition-all ${activeTool === 'eraser' ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 text-gray-500'}`}
            title="지우개"
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

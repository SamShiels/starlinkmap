import { useEffect, useRef, useState } from 'react';
import { createEngine } from './engine/engine';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [engineCleanup, setEngineCleanup] = useState<(() => void) | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !overlayRef.current) return;
    const initEngine = async () => {
      const engine = await createEngine(canvasRef.current!, {
        overlayCanvas: overlayRef.current!,
        onHoverChange: setHoveredName,
      });
      engine.start();
      setEngineCleanup(() => engine.destroy);
    };
    initEngine();
  }, []);

  useEffect(() => {
    return () => {
      if (engineCleanup) engineCleanup();
    };
  }, [engineCleanup]);

  return (
    <main className="scene">
      <canvas ref={canvasRef} className="webgl-canvas" />
      <canvas ref={overlayRef} className="overlay-canvas" />
      {hoveredName && (
        <div className="hover-label">
          <span className="hover-label__tag">Hovering</span>
          <div className="hover-label__name">{hoveredName}</div>
        </div>
      )}
    </main>
  );
}

export default App;

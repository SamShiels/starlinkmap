import { useEffect, useRef, useState } from 'react';
import { createEngine } from './engine/engine';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [engineCleanup, setEngineCleanup] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const initEngine = async () => {
      const engine = await createEngine(canvasRef.current!);
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
    </main>
  );
}

export default App;

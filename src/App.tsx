import { useEffect, useRef } from 'react';
import { createEngine } from './engine/engine';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const engine = createEngine(canvasRef.current);
    engine.start();
    return () => engine.destroy();
  }, []);

  return (
    <main className="scene">
      <canvas ref={canvasRef} className="webgl-canvas" />
    </main>
  );
}

export default App;

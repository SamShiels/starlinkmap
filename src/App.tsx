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
      <section className="hud">
        <p className="tag">WebGL2</p>
        <h1>Minimal engine</h1>
        <p className="lede">
          Rendering a rotating triangle with vertex and index buffers, ready for
          you to expand.
        </p>
        <div className="meta">
          <div>
            <span className="label">Vertex buffer</span>
            <span className="value">position + color</span>
          </div>
          <div>
            <span className="label">Index buffer</span>
            <span className="value">Uint16</span>
          </div>
          <div>
            <span className="label">Shaders</span>
            <span className="value">GLSL 300 es</span>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;

import { useEffect, useRef, useState } from 'react';
import { createEngine } from './engine/engine';
import type { Satellite } from './engine/satellite';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [engineCleanup, setEngineCleanup] = useState<(() => void) | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<Satellite | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !overlayRef.current) return;
    const initEngine = async () => {
      const engine = await createEngine(canvasRef.current!, {
        overlayCanvas: overlayRef.current!,
        onHoverChange: setHoveredName,
        onSelectChange: setSelectedSatellite,
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
      {(hoveredName || selectedSatellite) && (
        <div className="hover-label hover-label--top-left">
          <span className="hover-label__tag">{selectedSatellite ? 'Selected' : 'Hovering'}</span>
          <div className="hover-label__name">{selectedSatellite?.name ?? hoveredName}</div>
          {selectedSatellite && (
            <div className="hover-label__meta">
              <div>
                <span className="label">NORAD ID </span>
                <span className="value">{selectedSatellite.id}</span>
              </div>
              <div>
                <span className="label">Altitude </span>
                <span className="value">
                  {selectedSatellite.altitudeKm !== undefined
                    ? `${selectedSatellite.altitudeKm.toFixed(2)} km`
                    : '—'}
                </span>
              </div>
              <div>
                <span className="label">Speed </span>
                <span className="value">
                  {selectedSatellite.speedKms !== undefined
                    ? `${selectedSatellite.speedKms.toFixed(4)} km/s`
                    : '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default App;

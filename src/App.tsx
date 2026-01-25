import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Mapper } from './engine/mapper';
import type { Satellite } from './engine/satellite';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [mapper, setMapper] = useState<Mapper | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<Satellite | null>(null);
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !overlayRef.current) return;
    let instance: Mapper | null = null;
    try {
      instance = new Mapper(canvasRef.current, {
        overlayCanvas: overlayRef.current,
        onHoverChange: setHoveredName,
        onSelectChange: setSelectedSatellite,
        onSatellitesLoaded: (loaded) => {
          setSatellites([...loaded]);
          setLoading(false);
          setLoadError(null);
        },
        onSatellitesError: (message) => {
          setLoadError(message);
          setLoading(false);
        },
      });
      instance.start();
      setMapper(instance);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load satellites';
      setLoadError(message);
      setLoading(false);
    }

    return () => {
      instance?.destroy();
    };
  }, []);

  const matches = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];
    return satellites
      .filter((sat) => sat.name.toLowerCase().includes(query) || sat.id.toString().includes(query))
      .slice(0, 8);
  }, [searchTerm, satellites]);

  const selectSatellite = (id: number | null) => {
    mapper?.selectSatellite(id);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (matches.length > 0) {
      selectSatellite(matches[0].id);
      setSearchTerm('');
    }
  };

  return (
    <main className="scene">
      <canvas ref={canvasRef} className="webgl-canvas" />
      <canvas ref={overlayRef} className="overlay-canvas" />
      <div className="search-panel">
        <form onSubmit={handleSubmit} className="search-panel__form">
          <label className="search-panel__label" htmlFor="sat-search">
            Find a satellite
          </label>
          <input
            id="sat-search"
            type="text"
            placeholder="Search by name or NORAD ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-panel__input"
          />
        </form>
        {matches.length > 0 && (
          <div className="search-panel__results">
            {matches.map((sat) => (
              <button
                type="button"
                key={sat.id}
                className="search-panel__result"
                onClick={() => {
                  selectSatellite(sat.id);
                  setSearchTerm('');
                }}
              >
                <span className="search-panel__result-name">{sat.name}</span>
                <span className="search-panel__result-id">NORAD {sat.id}</span>
              </button>
            ))}
          </div>
        )}
      </div>
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
      {loading && (
        <div className="loading-bar" aria-live="polite" aria-label="Loading satellites">
          <div className="loading-bar__track">
            <div className="loading-bar__fill" />
          </div>
          <div className="loading-bar__text">Fetching satellites…</div>
        </div>
      )}
      {!loading && loadError && (
        <div className="loading-bar loading-bar--error" role="alert">
          <div className="loading-bar__text">Failed to load: {loadError}</div>
        </div>
      )}
    </main>
  );
}

export default App;

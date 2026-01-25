import { Satellite } from '../satellite';

export type SatelliteApiData = {
  id: number;
  name: string;
  orbital_radius_km: number;
  angular_velocity_rad_per_s: number;
  speed_kms: number;
  position: { x: number; y: number; z: number };
  velocity: { vx: number; vy: number; vz: number };
};

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const POSITION_SCALE = 0.00011;

export async function fetchSatellitesFromApi(
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<Satellite[]> {
  const response = await fetch(`${baseUrl}/satellites`);
  if (!response.ok) {
    throw new Error('Failed to load satellites');
  }
  const data = await response.json();
  return mapApiDataToSatellites(data.satellites);
}

function mapApiDataToSatellites(data: SatelliteApiData[]): Satellite[] {
  return data.map((entry) => {
    const position = {
      x: entry.position.x * POSITION_SCALE,
      y: entry.position.y * POSITION_SCALE,
      z: entry.position.z * POSITION_SCALE,
    };
    const velocity = {
      x: entry.velocity.vx * POSITION_SCALE,
      y: entry.velocity.vy * POSITION_SCALE,
      z: entry.velocity.vz * POSITION_SCALE,
    };

    return new Satellite(
      entry.id,
      entry.name,
      position,
      velocity,
      entry.angular_velocity_rad_per_s,
      { altitudeKm: entry.orbital_radius_km, speedKms: entry.speed_kms },
    );
  });
}

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

type SatelliteApiResponse = {
  count: number;
  total?: number;
  has_more?: boolean;
  satellites: SatelliteApiData[];
};

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const POSITION_SCALE = 0.00011;
const PAGE_SIZE = 500;

export async function fetchSatellitesFromApi(
  baseUrl: string = DEFAULT_BASE_URL,
  onBatch?: (satellites: Satellite[]) => void,
): Promise<Satellite[]> {
  const satellites: Satellite[] = [];
  let offset = 0;
  let total: number | undefined;
  let hasMore = true;

  // Fetch in batches to avoid API limits
  while (hasMore) {
    const page = await fetchSatellitePage(baseUrl, offset, PAGE_SIZE);
    const mapped = mapApiDataToSatellites(page.satellites);
    satellites.push(...mapped);
    onBatch?.([...satellites]);
    total = page.total ?? total ?? offset + page.count;
    offset += page.count;

    // Determine whether to continue
    if (page.has_more !== undefined) {
      hasMore = page.has_more;
    } else if (total !== undefined) {
      hasMore = offset < total;
    } else {
      // If server didn't provide total, stop when fewer than requested were returned
      hasMore = page.count >= PAGE_SIZE;
    }

    // Safety net to avoid infinite loop if API returns count 0 with has_more true
    if (page.count === 0) {
      break;
    }
  }

  return satellites;
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

async function fetchSatellitePage(
  baseUrl: string,
  offset: number,
  limit: number,
): Promise<SatelliteApiResponse> {
  const response = await fetch(`${baseUrl}/satellites?offset=${offset}&limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to load satellites');
  }
  return response.json();
}

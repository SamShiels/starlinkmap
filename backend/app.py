import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from spacetrack import SpaceTrackClient
from skyfield.api import EarthSatellite, load, wgs84
from skyfield.framelib import itrs
import numpy as np
import os


satellites = []
ts = load.timescale()
allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]
if not allowed_origins:
    allowed_origins = ["*"]

@asynccontextmanager
async def lifespan(app: FastAPI):
    global satellites
    print("Fetching Starlink TLEs...")

    # Load credentials from environment variables
    ST_USERNAME = os.getenv("ST_USERNAME")
    ST_PASSWORD = os.getenv("ST_PASSWORD")

    if not ST_USERNAME or not ST_PASSWORD:
        raise ValueError("Please set ST_USERNAME and ST_PASSWORD environment variables")

    st = SpaceTrackClient(identity=ST_USERNAME, password=ST_PASSWORD)

    try:
        # 1. Fetch only STARLINK objects that are currently in orbit
        json_string = st.gp(
            object_name='STARLINK~~',  # "~~" is the wild card for "contains/starts with"
            decay_date='null-val',     # Exclude de-orbited/burned up ones
            format='json'
        )

        # Parse the big string of data into lines
        data = json.loads(json_string)

        # 2. Create Satellite Objects
        satellites = []
        for sat in data:
            # 1. Get the Real Name and ID
            name = sat['OBJECT_NAME']  # e.g., "STARLINK-3878"
            line1 = sat['TLE_LINE1']
            line2 = sat['TLE_LINE2']

            # Create the satellite object
            sat = EarthSatellite(line1, line2, name, ts=ts)
            satellites.append(sat)

        print(f"Loaded {len(satellites)} Starlink satellites.")
    except Exception as e:
        print(f"Startup Error: {e}")
    
    yield
    print("Shutdown: Cleaning up...")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "running", "satellite_count": len(satellites)}

@app.get("/satellites")
async def get_satellites(limit: int = 0):
    t = ts.now()
    results = []

    fetched_sats = satellites[:limit] if limit > 0 else satellites

    for sat in fetched_sats:
        try:
            geocentric = sat.at(t)

            # Get Velocity
            position_vector, velocity_vector = geocentric.frame_xyz_and_velocity(itrs)

            pos_km = position_vector.km
            vel_km = velocity_vector.km_per_s
            speed = np.linalg.norm(vel_km)

            # Compute orbital radius (geocentric distance)
            orbital_radius_km = np.linalg.norm(pos_km)

            # Angular velocity (for circular orbit approximation: ω = v / r)
            angular_velocity_rad_per_s = speed / orbital_radius_km

            # NORAD ID
            norad_id = sat.model.satnum

            results.append({
                "id": norad_id,
                "name": sat.name,
                "orbital_radius_km": orbital_radius_km,
                "speed_kms": speed,
                "angular_velocity_rad_per_s": angular_velocity_rad_per_s,
                "position": {
                    "x": pos_km[0],
                    "y": pos_km[2],
                    "z": -pos_km[1]
                },
                "velocity": {
                    "vx": vel_km[0],
                    "vy": vel_km[2],
                    "vz": -vel_km[1]
                }
            })
        except Exception:
            continue

    return {"count": len(results), "satellites": results}

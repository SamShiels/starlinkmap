from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from spacetrack import SpaceTrackClient
from skyfield.api import EarthSatellite, load, wgs84
import numpy as np
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load credentials from environment variables
ST_USERNAME = os.getenv("ST_USERNAME")
ST_PASSWORD = os.getenv("ST_PASSWORD")

if not ST_USERNAME or not ST_PASSWORD:
    raise ValueError("Please set ST_USERNAME and ST_PASSWORD environment variables")

st = SpaceTrackClient(identity=ST_USERNAME, password=ST_PASSWORD)
ts = load.timescale()

satellites = []

def load_satellites():
    global satellites
    print("Fetching Starlink TLEs...")

    # 1. Fetch only STARLINK objects that are currently in orbit
    data = st.gp(
        object_name='STARLINK~~',  # "~~" is the wild card for "contains/starts with"
        decay_date='null-val',     # Exclude de-orbited/burned up ones
        format='tle'
    )

    # Parse the big string of data into lines
    lines = data.strip().splitlines()

    # 2. Create Satellite Objects
    satellites = []
    for i in range(0, len(lines), 2):
        line1 = lines[i]
        line2 = lines[i+1]
        # Create the satellite object
        sat = EarthSatellite(line1, line2, name=f"Starlink-{i//2}", ts=ts)
        satellites.append(sat)

    print(f"Loaded {len(satellites)} Starlink satellites.")

# Load satellites at startup
load_satellites()

@app.get("/satellites")
async def get_satellites():
    t = ts.now()
    result = []

    for sat in satellites:
        geocentric = sat.at(t)

        # Get Position (Lat/Lon/Elevation)
        subpoint = wgs84.subpoint(geocentric)
        lat = subpoint.latitude.degrees
        lon = subpoint.longitude.degrees
        alt = subpoint.elevation.km  # in km

        # Get Velocity
        velocity_vector = geocentric.velocity.km_per_s
        speed = np.linalg.norm(velocity_vector)

        # Compute orbital radius (geocentric distance)
        position_vector = geocentric.position.km
        orbital_radius_km = np.linalg.norm(position_vector)

        # Angular velocity (for circular orbit approximation: ω = v / r)
        angular_velocity_rad_per_s = speed / orbital_radius_km

        # Direction of travel (normalized velocity vector)
        direction = {
            "x": velocity_vector[0] / speed if speed > 0 else 0,
            "y": velocity_vector[2] / speed if speed > 0 else 0,
            "z": velocity_vector[1] / speed if speed > 0 else 0
        }

        # NORAD ID
        norad_id = sat.model.satnum

        result.append({
            "id": norad_id,
            "name": sat.name,
            "latitude": lat,
            "longitude": lon,
            "altitude_km": alt,
            "speed_kms": speed,
            "orbital_radius_km": orbital_radius_km,
            "angular_velocity_rad_per_s": angular_velocity_rad_per_s,
            "direction": direction,
            "position": {
                "x": position_vector[0],
                "y": position_vector[2],
                "z": position_vector[1]
            },
            "velocity": {
                "vx": velocity_vector[0],
                "vy": velocity_vector[2],
                "vz": velocity_vector[1]
            }
        })

    return {"satellites": result}
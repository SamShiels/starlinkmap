import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from spacetrack import SpaceTrackClient
from skyfield.api import EarthSatellite, load, wgs84
from skyfield.framelib import itrs
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
        position_vector, velocity_vector = geocentric.frame_xyz_and_velocity(itrs)

        pos_km = position_vector.km
        vel_km = velocity_vector.km_per_s
        speed = np.linalg.norm(vel_km)

        # Compute orbital radius (geocentric distance)
        orbital_radius_km = np.linalg.norm(pos_km)

        # Angular velocity (for circular orbit approximation: ω = v / r)
        angular_velocity_rad_per_s = speed / orbital_radius_km

        # Direction of travel (normalized velocity vector)
        direction = {
            "x": vel_km[0] / speed if speed > 0 else 0,
            "y": vel_km[2] / speed if speed > 0 else 0,
            "z": -vel_km[1] / speed if speed > 0 else 0
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

    return {"satellites": result}
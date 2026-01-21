from fastapi import FastAPI
from spacetrack import SpaceTrackClient
from skyfield.api import EarthSatellite, load, wgs84
import numpy as np
import os

app = FastAPI()

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

        # NORAD ID
        norad_id = sat.model.satnum

        result.append({
            "id": norad_id,
            "name": sat.name,
            "latitude": lat,
            "longitude": lon,
            "altitude_km": alt,
            "speed_kms": speed,
            "velocity": {
                "vx": velocity_vector[0],
                "vy": velocity_vector[1],
                "vz": velocity_vector[2]
            }
        })

    return {"satellites": result}
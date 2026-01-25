# Starlink Map

WebGL globe that renders live-ish Starlink positions from a FastAPI backend fed by Space-Track TLEs.

## What’s here
- Frontend: React + Vite + TypeScript, custom WebGL renderer (no three.js).
- Backend: FastAPI, Skyfield for orbital mechanics, SpaceTrackClient for TLE ingestion.
- Dockerfile for the backend (Hugging Face Space target) and docker-compose for local backend.

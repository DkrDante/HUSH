"""
HUSH – FastAPI Backend
Serves the frontend and provides:
  - REST API: /api/gestures, /api/stats
  - WebSocket: /ws  (real-time frame → gesture classification)
  - Static files: /  (serves frontend/)
"""

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.gesture_classifier import GestureClassifier
from backend.isl_gestures import ISL_ALPHABET, LETTER_LIST

# ─── Globals ────────────────────────────────────────────────────────────────

classifier: Optional[GestureClassifier] = None

session_stats = {
    "total_frames": 0,
    "detected_frames": 0,
    "letters_detected": {},  # letter -> count
    "sessions": 0,
    "start_time": time.time(),
}


# ─── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global classifier
    print("🤚 HUSH starting – loading MediaPipe gesture classifier…")
    classifier = GestureClassifier()
    session_stats["start_time"] = time.time()
    print("✅ Classifier ready. Visit http://localhost:8000")
    yield
    print("🛑 HUSH shutting down…")
    if classifier:
        classifier.close()


# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="HUSH API",
    description="Real-time ISL Gesture & Alphabet Recognition",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── REST Endpoints ──────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "HUSH Gesture Recognition API",
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - session_stats["start_time"], 1),
        "classifier_ready": classifier is not None,
    }


@app.get("/api/gestures")
async def get_gestures():
    """Return full ISL alphabet with descriptions and tips."""
    return {
        "sign_language": "ISL",
        "total": len(LETTER_LIST),
        "letters": [
            {
                "letter": letter,
                **ISL_ALPHABET[letter]
            }
            for letter in LETTER_LIST
        ]
    }


@app.get("/api/gestures/{letter}")
async def get_gesture_detail(letter: str):
    """Return detail for a single ISL letter."""
    letter = letter.upper()
    if letter not in ISL_ALPHABET:
        return JSONResponse({"error": f"Letter '{letter}' not found"}, status_code=404)
    return {"letter": letter, **ISL_ALPHABET[letter]}


@app.get("/api/stats")
async def get_stats():
    """Return current session statistics."""
    total = session_stats["total_frames"]
    detected = session_stats["detected_frames"]
    top_letters = sorted(
        session_stats["letters_detected"].items(),
        key=lambda x: x[1],
        reverse=True
    )[:5]
    return {
        "total_frames_processed": total,
        "frames_with_hand": detected,
        "detection_rate": round(detected / total, 3) if total > 0 else 0.0,
        "unique_letters_detected": len(session_stats["letters_detected"]),
        "top_letters": [{"letter": l, "count": c} for l, c in top_letters],
        "active_sessions": session_stats["sessions"],
        "uptime_seconds": round(time.time() - session_stats["start_time"], 1),
    }


@app.post("/api/stats/reset")
async def reset_stats():
    session_stats["total_frames"] = 0
    session_stats["detected_frames"] = 0
    session_stats["letters_detected"] = {}
    session_stats["start_time"] = time.time()
    return {"message": "Stats reset successfully"}


# ─── WebSocket ───────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_stats["sessions"] += 1
    client = websocket.client
    print(f"🔌 WS connected: {client}")

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
            except asyncio.TimeoutError:
                # Send heartbeat ping
                await websocket.send_json({"type": "ping"})
                continue

            session_stats["total_frames"] += 1

            if not classifier:
                await websocket.send_json({
                    "type": "error",
                    "message": "Classifier not ready"
                })
                continue

            # Process frame
            result = classifier.process_base64_frame(data)

            if result.get("hand_detected"):
                session_stats["detected_frames"] += 1
                letter = result.get("letter")
                if letter:
                    session_stats["letters_detected"][letter] = (
                        session_stats["letters_detected"].get(letter, 0) + 1
                    )

            await websocket.send_json({
                "type": "result",
                **result
            })

    except WebSocketDisconnect:
        print(f"🔌 WS disconnected: {client}")
    except Exception as e:
        print(f"❌ WS error: {e}")
    finally:
        session_stats["sessions"] = max(0, session_stats["sessions"] - 1)


# ─── Static File Serving ─────────────────────────────────────────────────────

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

if FRONTEND_DIR.exists():
    # Serve /static/* from frontend/
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/app")
    async def serve_app():
        return FileResponse(str(FRONTEND_DIR / "app.html"))

    @app.get("/reference")
    async def serve_reference():
        return FileResponse(str(FRONTEND_DIR / "reference.html"))

    @app.get("/{path:path}")
    async def serve_static(path: str):
        file_path = FRONTEND_DIR / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))

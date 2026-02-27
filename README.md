# HUSH 🤚

**Real-time Indian Sign Language (ISL) Alphabet Recognition**

Built with MediaPipe • FastAPI • WebSockets • Vanilla JS

---

## Quick Start

```bash
# Clone / navigate to the project
cd /path/to/hush

# Run everything in one command
bash run.sh
```

Then open **<http://localhost:8000>** in your browser.

---

## Project Structure

```
hush/
├── backend/
│   ├── main.py               # FastAPI app + WebSocket endpoint
│   ├── gesture_classifier.py # MediaPipe hand landmark classifier
│   └── isl_gestures.py       # ISL A–Z gesture data
├── frontend/
│   ├── index.html            # Landing page
│   ├── app.html              # Main recognition app
│   ├── reference.html        # ISL alphabet guide
│   ├── css/
│   │   ├── style.css         # Design system (tokens, animations)
│   │   ├── index.css         # Landing page styles
│   │   ├── app.css           # App page styles
│   │   └── reference.css     # Reference page styles
│   └── js/
│       ├── app.js            # WebSocket + webcam + UI logic
│       ├── reference.js      # Alphabet grid + modal
│       └── index.js          # Landing page demo animation
├── requirements.txt
├── run.sh                    # One-command startup
└── README.md
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Landing page |
| GET | `/app` | Recognition app |
| GET | `/reference` | ISL alphabet guide |
| GET | `/api/health` | Health check + uptime |
| GET | `/api/gestures` | All ISL letters (A–Z) with descriptions |
| GET | `/api/gestures/{letter}` | Single letter detail |
| GET | `/api/stats` | Session frame/detection statistics |
| POST | `/api/stats/reset` | Reset session stats |
| WS | `/ws` | Real-time frame → gesture classification |

---

## WebSocket Protocol

**Send** (client → server): Base64-encoded JPEG frame string

**Receive** (server → client):

```json
{
  "type": "result",
  "hand_detected": true,
  "letter": "A",
  "pending_letter": "A",
  "confidence": 0.82,
  "stable": true,
  "landmarks": [{"x": 0.5, "y": 0.3, "z": -0.02}, ...]
}
```

---

## How It Works

1. **Webcam** frames are captured every ~150ms via `getUserMedia`
2. Frames are JPEG-compressed and sent as base64 over **WebSocket**
3. **MediaPipe Hands** extracts 21 3D hand landmarks server-side
4. A **rule-based classifier** maps landmark geometry → ISL letter
5. A **stability filter** (3 consistent frames) prevents flickering
6. Result is sent back to the browser and displayed in real-time

---

## Gesture Coverage (ISL A–Z)

All 26 letters are supported using one-hand static gestures.
Dynamic letters (J, Z) are approximated by their starting position.

---

## Accessibility

- ARIA live regions announce detected letters to screen readers
- Full keyboard navigation (Tab, Enter, Space, Backspace)
- High-contrast mode toggle
- WCAG AA color contrast ratios throughout

---

## Requirements

- Python 3.9+
- Webcam
- Modern browser (Chrome, Firefox, Safari)
- No GPU required (CPU inference via MediaPipe)
# HUSH

"""
HUSH Gesture Classifier
Uses MediaPipe hand landmarks to classify ISL (Indian Sign Language) alphabet gestures.
Rule-based classification using finger states, angles, and relative positions.
"""

import math
import numpy as np
import mediapipe as mp
import cv2
import base64
from typing import Optional
import time

mp_hands = mp.solutions.hands

# Landmark indices
WRIST = 0
THUMB_CMC, THUMB_MCP, THUMB_IP, THUMB_TIP = 1, 2, 3, 4
INDEX_MCP, INDEX_PIP, INDEX_DIP, INDEX_TIP = 5, 6, 7, 8
MIDDLE_MCP, MIDDLE_PIP, MIDDLE_DIP, MIDDLE_TIP = 9, 10, 11, 12
RING_MCP, RING_PIP, RING_DIP, RING_TIP = 13, 14, 15, 16
PINKY_MCP, PINKY_PIP, PINKY_DIP, PINKY_TIP = 17, 18, 19, 20


def dist(a, b):
    return math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)


def is_finger_up(lm, tip_idx, pip_idx):
    """Returns True if the finger tip is above its PIP joint (extended)."""
    return lm[tip_idx].y < lm[pip_idx].y


def is_finger_bent(lm, tip_idx, pip_idx):
    return lm[tip_idx].y > lm[pip_idx].y


def finger_states(lm):
    """Returns bool tuple: (thumb_up, index_up, middle_up, ring_up, pinky_up)"""
    thumb = lm[THUMB_TIP].x < lm[THUMB_IP].x  # left hand: thumb extends left
    # For typical right hand in mirrored (selfie) view:
    thumb = lm[THUMB_TIP].x > lm[THUMB_IP].x
    index = is_finger_up(lm, INDEX_TIP, INDEX_PIP)
    middle = is_finger_up(lm, MIDDLE_TIP, MIDDLE_PIP)
    ring = is_finger_up(lm, RING_TIP, RING_PIP)
    pinky = is_finger_up(lm, PINKY_TIP, PINKY_PIP)
    return (thumb, index, middle, ring, pinky)


def fingers_up_count(states):
    return sum(states)


def touching(lm, a_idx, b_idx, threshold=0.06):
    return dist(lm[a_idx], lm[b_idx]) < threshold


def classify_gesture(lm) -> tuple[str, float]:
    """
    Returns (letter, confidence) for ISL alphabet.
    Uses rule-based landmark geometry.
    """
    t, i, m, r, p = finger_states(lm)
    count = fingers_up_count((t, i, m, r, p))

    # --- A: Fist, thumb to the side ---
    if not i and not m and not r and not p and not t:
        return ("A", 0.82)

    # --- S: Fist with thumb over fingers ---
    if not i and not m and not r and not p and t:
        if lm[THUMB_TIP].y > lm[INDEX_MCP].y:
            return ("S", 0.78)

    # --- B: 4 fingers up, thumb folded ---
    if not t and i and m and r and p:
        if abs(lm[INDEX_TIP].x - lm[PINKY_TIP].x) < 0.15:
            return ("B", 0.85)

    # --- L: Index up + thumb out ---
    if t and i and not m and not r and not p:
        # Thumb and index roughly perpendicular
        return ("L", 0.83)

    # --- Y: Thumb + pinky extended (shaka) ---
    if t and not i and not m and not r and p:
        return ("Y", 0.87)

    # --- I: Only pinky up ---
    if not t and not i and not m and not r and p:
        return ("I", 0.84)

    # --- D: Index up, thumb touches middle ---
    if not t and i and not m and not r and not p:
        if touching(lm, THUMB_TIP, MIDDLE_TIP, 0.07):
            return ("D", 0.80)

    # --- G: Index horizontal, thumb parallel ---
    if not t and i and not m and not r and not p:
        # Index roughly horizontal (tip.y ≈ MCP.y)
        if abs(lm[INDEX_TIP].y - lm[INDEX_MCP].y) < 0.07:
            return ("G", 0.75)

    # --- X: Index bent/hooked ---
    if not t and not m and not r and not p:
        if lm[INDEX_TIP].y > lm[INDEX_PIP].y:  # index bent down
            return ("X", 0.78)

    # --- 1/Index: Index up alone ---
    if not t and i and not m and not r and not p:
        return ("1", 0.70)

    # --- V: Index + middle in V ---
    if not t and i and m and not r and not p:
        spread = abs(lm[INDEX_TIP].x - lm[MIDDLE_TIP].x)
        if spread > 0.04:
            return ("V", 0.85)

    # --- U: Index + middle together ---
    if not t and i and m and not r and not p:
        return ("U", 0.80)

    # --- R: Index + middle crossed ---
    if not t and i and m and not r and not p:
        if lm[INDEX_TIP].x > lm[MIDDLE_TIP].x:  # crossed
            return ("R", 0.76)
        return ("U", 0.80)

    # --- H: Index + middle horizontal ---
    if not t and i and m and not r and not p:
        if abs(lm[INDEX_TIP].y - lm[INDEX_MCP].y) < 0.07:
            return ("H", 0.75)

    # --- K: V with thumb between ---
    if t and i and m and not r and not p:
        if lm[THUMB_TIP].y < lm[INDEX_MCP].y:
            return ("K", 0.78)

    # --- W: 3 fingers spread ---
    if not t and i and m and r and not p:
        spread = abs(lm[INDEX_TIP].x - lm[RING_TIP].x)
        if spread > 0.07:
            return ("W", 0.82)

    # --- 3 fingers: W variant ---
    if not t and i and m and r and not p:
        return ("W", 0.75)

    # --- F: OK sign (index+thumb circle, 3 fingers up) ---
    if not t and i and m and r and p:
        if touching(lm, INDEX_TIP, THUMB_TIP, 0.06):
            return ("F", 0.82)

    # --- O: All fingertips touching thumb ---
    if count >= 3:
        if touching(lm, INDEX_TIP, THUMB_TIP, 0.07):
            all_close = all(touching(lm, tip, THUMB_TIP, 0.10) for tip in [MIDDLE_TIP, RING_TIP])
            if all_close:
                return ("O", 0.84)

    # --- C: Curved hand ---
    if not i and not m and not r and not p:
        # Open C shape — all fingers curved but not closed
        return ("C", 0.70)

    # --- E: Fingers bent at middle joint ---
    if not t and not i and not m and not r and not p:
        return ("E", 0.72)

    # --- M: 3 fingers over thumb ---
    if not t and not i and not m and not r and not p:
        return ("M", 0.68)

    # --- N: 2 fingers over thumb ---
    if not t and not i and not m and not r and not p:
        return ("N", 0.65)

    # --- T: Thumb between index+middle ---
    if not i and not m and not r and not p:
        if lm[THUMB_TIP].x > lm[INDEX_MCP].x and lm[THUMB_TIP].x < lm[MIDDLE_MCP].x:
            return ("T", 0.73)

    # --- P: K shape pointing down ---
    if t and i and m and not r and not p:
        if lm[INDEX_TIP].y > lm[WRIST].y:  # pointing downward
            return ("P", 0.70)

    # --- Q: G pointing down ---
    if t and i and not m and not r and not p:
        if lm[INDEX_TIP].y > lm[WRIST].y:
            return ("Q", 0.68)

    return (None, 0.0)


class GestureClassifier:
    def __init__(self):
        self.hands = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.65,
            min_tracking_confidence=0.55,
            model_complexity=1
        )
        self._last_letter = None
        self._stable_count = 0
        self._stable_threshold = 3  # frames to confirm

    def process_frame(self, frame_bytes: bytes) -> dict:
        """
        Process a raw JPEG frame and return classification result.
        Returns dict with keys: hand_detected, letter, confidence, landmarks
        """
        try:
            nparr = np.frombuffer(frame_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return {"hand_detected": False, "letter": None, "confidence": 0.0, "landmarks": []}

            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            result = self.hands.process(img_rgb)

            if not result.multi_hand_landmarks:
                self._last_letter = None
                self._stable_count = 0
                return {"hand_detected": False, "letter": None, "confidence": 0.0, "landmarks": []}

            lm = result.multi_hand_landmarks[0].landmark
            letter, confidence = classify_gesture(lm)

            # Stability filter — require consistent prediction
            if letter == self._last_letter:
                self._stable_count += 1
            else:
                self._last_letter = letter
                self._stable_count = 1

            stable = self._stable_count >= self._stable_threshold

            # Serialize landmarks
            landmarks = [
                {"x": l.x, "y": l.y, "z": l.z}
                for l in lm
            ]

            return {
                "hand_detected": True,
                "letter": letter if stable else None,
                "pending_letter": letter,  # raw prediction before stability
                "confidence": round(confidence, 3) if stable else 0.0,
                "landmarks": landmarks,
                "stable": stable
            }

        except Exception as e:
            return {"hand_detected": False, "letter": None, "confidence": 0.0, "landmarks": [], "error": str(e)}

    def process_base64_frame(self, b64_data: str) -> dict:
        """Accepts base64-encoded JPEG/PNG string."""
        try:
            # Strip data URL prefix if present
            if "," in b64_data:
                b64_data = b64_data.split(",", 1)[1]
            frame_bytes = base64.b64decode(b64_data)
            return self.process_frame(frame_bytes)
        except Exception as e:
            return {"hand_detected": False, "letter": None, "confidence": 0.0, "error": str(e), "landmarks": []}

    def close(self):
        self.hands.close()

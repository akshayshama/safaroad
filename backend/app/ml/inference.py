import numpy as np
from typing import List, Tuple, Optional
from PIL import Image
import cv2
import base64
from io import BytesIO


class PotholeDetector:
    """
    Pothole detection using YOLOv8/ONNX model.
    
    For MVP, we'll use a rule-based approach with image analysis.
    The ONNX model can be added when ready.
    """
    
    # Severity thresholds based on visual characteristics
    SEVERITY_CRITERIA = {
        "diameter_cm": [(10, 20), (20, 40), (40, 60), (60, 100), (100, float('inf'))],
        "darkness_ratio": [(0.3, 0.5), (0.5, 0.65), (0.65, 0.8), (0.8, 0.9), (0.9, 1.0)]
    }
    
    _instance = None
    _model = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def load_model(self, model_path: str):
        """Load ONNX model if available."""
        try:
            import onnxruntime as ort
            
            if self._model is None:
                providers = ['CPUExecutionProvider']
                self._model = ort.InferenceSession(model_path, providers=providers)
                print(f"Loaded ONNX model from {model_path}")
        except Exception as e:
            print(f"Could not load ONNX model: {e}")
            self._model = None
    
    async def detect_from_image(
        self,
        image_base64: str,
        use_ml: bool = False
    ) -> dict:
        """
        Detect pothole from base64 image.
        
        Returns detection results with bounding box, severity, and confidence.
        """
        try:
            # Decode image
            if "base64," in image_base64:
                image_base64 = image_base64.split("base64,")[1]
            
            image_data = base64.b64decode(image_base64)
            image = Image.open(BytesIO(image_data))
            image_array = np.array(image.convert('RGB'))
            
            if use_ml and self._model:
                return await self._detect_with_model(image_array)
            else:
                return self._detect_with_rules(image_array)
                
        except Exception as e:
            return {
                "detected": False,
                "error": str(e),
                "severity": 0,
                "confidence": 0.0
            }
    
    def _detect_with_rules(self, image: np.ndarray) -> dict:
        """
        Rule-based detection using OpenCV image analysis.
        
        This is a fallback for when the ML model is not available.
        """
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Edge detection
        edges = cv2.Canny(blurred, 50, 150)
        
        # Find contours (potential pothole boundaries)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter contours by area (potholes are typically 100-50000 pixels)
        valid_contours = [
            c for c in contours 
            if 100 < cv2.contourArea(c) < 50000
        ]
        
        if not valid_contours:
            return {
                "detected": False,
                "severity": 0,
                "confidence": 0.0,
                "bounding_boxes": []
            }
        
        # Get largest contour (most likely pothole)
        largest_contour = max(valid_contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest_contour)
        
        # Calculate darkness ratio (potholes are darker than surroundings)
        pothole_region = gray[y:y+h, x:x+w]
        avg_darkness = np.mean(pothole_region) / 255
        surrounding = cv2.copyMakeBorder(
            gray, 10, 10, 10, 10, cv2.BORDER_REPLICATE
        )[y:y+h, x:x+w]
        surrounding_avg = np.mean(surrounding) / 255
        
        darkness_ratio = surrounding_avg / avg_darkness if avg_darkness > 0 else 1.0
        
        # Estimate diameter in cm (assuming average road photo)
        diameter_px = max(w, h)
        diameter_cm = diameter_px * 0.3  # Rough estimate
        
        # Calculate severity
        severity = self._calculate_severity(diameter_cm, darkness_ratio)
        
        # Calculate confidence based on feature match
        confidence = min(0.9, 0.5 + (darkness_ratio - 1) * 0.5 + len(valid_contours) * 0.05)
        
        return {
            "detected": len(valid_contours) > 0,
            "severity": severity,
            "confidence": round(confidence, 2),
            "diameter_cm": round(diameter_cm, 2),
            "darkness_ratio": round(darkness_ratio, 2),
            "bounding_boxes": [
                {"x": int(x), "y": int(y), "width": int(w), "height": int(h)}
                for c in valid_contours
                for x, y, w, h in [cv2.boundingRect(c)]
            ],
            "detection_method": "rule_based"
        }
    
    async def _detect_with_model(self, image: np.ndarray) -> dict:
        """Detect using ONNX YOLOv8 model."""
        # Model input preprocessing
        input_tensor = self._preprocess_for_model(image)
        
        # Run inference
        outputs = self._model.run(None, {"images": input_tensor})
        
        # Post-process outputs (YOLOv8 format)
        results = self._postprocess_outputs(outputs)
        
        if results:
            # Return highest confidence detection
            best = max(results, key=lambda x: x["confidence"])
            return {
                "detected": True,
                "severity": self._estimate_severity_from_detection(best),
                "confidence": best["confidence"],
                "bounding_boxes": [best["box"]],
                "detection_method": "yolov8_onnx"
            }
        
        return {
            "detected": False,
            "severity": 0,
            "confidence": 0.0,
            "bounding_boxes": []
        }
    
    def _preprocess_for_model(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for YOLOv8 model."""
        # Resize to 640x640
        resized = cv2.resize(image, (640, 640))
        
        # Normalize to [0, 1]
        normalized = resized.astype(np.float32) / 255.0
        
        # Transpose to NCHW format
        transposed = np.transpose(normalized, (2, 0, 1))
        
        # Add batch dimension
        batched = np.expand_dims(transposed, axis=0)
        
        return batched
    
    def _postprocess_outputs(self, outputs: np.ndarray) -> List[dict]:
        """Post-process YOLOv8 model outputs."""
        # This is simplified - actual implementation depends on model format
        results = []
        
        # Parse YOLOv8 output format
        # outputs[0] shape: (1, 84, 8400) for 640x640 input
        # 84 = 4 (box) + 80 (classes)
        
        predictions = outputs[0][0]  # Remove batch dimension
        
        # Get boxes with confidence > threshold
        conf_threshold = 0.5
        
        # This is a simplified parser
        # In production, use ultralytics library for proper NMS
        for i in range(predictions.shape[1]):
            detection = predictions[:, i]
            box = detection[:4]
            class_scores = detection[4:]
            
            confidence = float(np.max(class_scores))
            if confidence < conf_threshold:
                continue
            
            class_id = int(np.argmax(class_scores))
            if class_id != 0:  # Assuming class 0 is pothole
                continue
            
            results.append({
                "confidence": confidence,
                "class_id": class_id,
                "box": box.tolist()
            })
        
        return results
    
    def _calculate_severity(self, diameter_cm: float, darkness_ratio: float) -> int:
        """Calculate severity (1-5) based on diameter and darkness."""
        severity = 1
        
        # Diameter contribution
        for i, (min_d, max_d) in enumerate(self.SEVERITY_CRITERIA["diameter_cm"]):
            if min_d <= diameter_cm < max_d:
                severity = max(severity, i + 1)
                break
        
        # Darkness ratio contribution
        for i, (min_dr, max_dr) in enumerate(self.SEVERITY_CRITERIA["darkness_ratio"]):
            if min_dr <= darkness_ratio < max_dr:
                severity = max(severity, i + 1)
                break
        
        return severity
    
    def _estimate_severity_from_detection(self, detection: dict) -> int:
        """Estimate severity from ML detection results."""
        box = detection.get("box", [])
        if len(box) >= 4:
            width = box[2] if len(box) > 2 else 100
            diameter_cm = width * 0.3
            return min(5, max(1, int(diameter_cm / 20)))
        return 3  # Default to moderate
    
    async def analyze_video_frame(self, frame: np.ndarray) -> dict:
        """Quick analysis for video stream."""
        return self._detect_with_rules(frame)

import {
  Accelerometer,
  AccelerometerMeasurement,
  Gyroscope,
  SensorTypes,
  setUpdateIntervalForType,
} from 'react-native-sensors';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

const ACCELEROMETER_UPDATE_INTERVAL = 50; // 50ms = 20Hz sampling
const Z_THRESHOLD = 2.5; // G-force threshold for bump detection
const SAMPLING_WINDOW = 5; // Number of samples to analyze
const MIN_BUMP_DURATION = 100; // ms
const BUMP_COOLDOWN = 500; // ms between bump reports

interface BumpDetectionResult {
  isBump: boolean;
  zForce: number;
  timestamp: number;
}

interface UseVibrationDetectionResult {
  isDetecting: boolean;
  lastBump: BumpDetectionResult | null;
  startDetection: () => void;
  stopDetection: () => void;
  sensitivity: number;
  setSensitivity: (value: number) => void;
}

export function useVibrationDetection(
  onBumpDetected?: (result: BumpDetectionResult) => void
): UseVibrationDetectionResult {
  const [isDetecting, setIsDetecting] = useState(false);
  const [lastBump, setLastBump] = useState<BumpDetectionResult | null>(null);
  const [sensitivity, setSensitivity] = useState(0.7); // 0-1 scale

  const accelerometerSubscription = useRef<any>(null);
  const sampleBuffer = useRef<number[]>([]);
  const lastBumpTime = useRef(0);
  const baseZ = useRef(0); // Baseline gravity
  const isBaseSet = useRef(false);

  const analyzeBuffer = useCallback((): number => {
    if (sampleBuffer.current.length < SAMPLING_WINDOW) return 0;

    // Calculate variance in Z-axis
    const values = sampleBuffer.current;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }, []);

  const handleAccelerometerData = useCallback(
    (data: AccelerometerMeasurement) => {
      const zForce = data.z;
      const timestamp = Date.now();

      // Set baseline on first few readings
      if (!isBaseSet.current) {
        baseZ.current = zForce;
        isBaseSet.current = true;
        return;
      }

      // Normalize Z relative to baseline (gravity)
      const normalizedZ = Math.abs(zForce - baseZ.current);

      // Add to buffer
      sampleBuffer.current.push(normalizedZ);
      if (sampleBuffer.current.length > SAMPLING_WINDOW) {
        sampleBuffer.current.shift();
      }

      // Adjust threshold based on sensitivity
      const adjustedThreshold = Z_THRESHOLD / sensitivity;

      // Check if bump detected
      if (normalizedZ > adjustedThreshold) {
        const timeSinceLastBump = timestamp - lastBumpTime.current;

        if (timeSinceLastBump > BUMP_COOLDOWN) {
          const variance = analyzeBuffer();

          // Additional validation: check if variance is significant
          if (variance > 0.3) {
            lastBumpTime.current = timestamp;

            const result: BumpDetectionResult = {
              isBump: true,
              zForce: normalizedZ,
              timestamp,
            };

            setLastBump(result);
            onBumpDetected?.(result);
          }
        }
      }
    },
    [sensitivity, analyzeBuffer, onBumpDetected]
  );

  const startDetection = useCallback(() => {
    if (isDetecting) return;

    setIsDetecting(true);
    isBaseSet.current = false;
    sampleBuffer.current = [];

    setUpdateIntervalForType(SensorTypes.accelerometer, ACCELEROMETER_UPDATE_INTERVAL);

    accelerometerSubscription.current = Accelerometer.addListener(
      handleAccelerometerData
    );
  }, [isDetecting, handleAccelerometerData]);

  const stopDetection = useCallback(() => {
    if (accelerometerSubscription.current) {
      accelerometerSubscription.current.remove();
      accelerometerSubscription.current = null;
    }
    setIsDetecting(false);
    isBaseSet.current = false;
    sampleBuffer.current = [];
  }, []);

  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    isDetecting,
    lastBump,
    startDetection,
    stopDetection,
    sensitivity,
    setSensitivity,
  };
}

// Lightweight classifier for on-device ML
export function classifyBump(
  zForce: number,
  duration: number,
  severity: number
): { type: 'pothole' | 'bump' | 'speedbreaker'; confidence: number } {
  // Rule-based classification
  if (severity >= 3 && duration < 200) {
    return { type: 'pothole', confidence: 0.85 };
  } else if (severity >= 2 && duration >= 200) {
    return { type: 'speedbreaker', confidence: 0.75 };
  } else if (zForce < 3) {
    return { type: 'bump', confidence: 0.6 };
  }
  return { type: 'pothole', confidence: 0.5 };
}

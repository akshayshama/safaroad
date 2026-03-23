import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { socketService } from '../services/socket';
import { api } from '../services/api';
import { useAuthStore, usePotholeStore, useSettingsStore, Pothole } from '../services/store';
import { useVibrationDetection } from '../services/vibration';

const { width, height } = Dimensions.get('window');

const SEVERITY_COLORS: Record<number, string> = {
  1: '#4ade80', // Green - Minor
  2: '#a3e635', // Lime
  3: '#facc15', // Yellow - Moderate
  4: '#f97316', // Orange
  5: '#ef4444', // Red - Critical
};

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Minor',
  2: 'Low',
  3: 'Moderate',
  4: 'High',
  5: 'Critical',
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [potholes, setPotholes] = useState<Pothole[]>([]);
  const [selectedPothole, setSelectedPothole] = useState<Pothole | null>(null);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuthStore();
  const { isDetecting, lastBump, startDetection, stopDetection } = useVibrationDetection();
  const { vibrationDetection } = useSettingsStore();

  useEffect(() => {
    requestPermissions();
    loadPotholes();
    connectSocket();

    return () => {
      socketService.disconnect();
      stopDetection();
    };
  }, []);

  useEffect(() => {
    if (lastBump && vibrationDetection) {
      handleBumpDetected();
    }
  }, [lastBump]);

  const requestPermissions = async () => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);

      // Center map on user location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }

      // Start vibration detection if enabled
      if (vibrationDetection) {
        startDetection();
      }

      // Subscribe to nearby potholes
      socketService.subscribeToArea(loc.coords.latitude, loc.coords.longitude);
    } catch (error) {
      console.error('Permission error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPotholes = async () => {
    if (!location) return;

    try {
      const nearbyPotholes = await api.getNearbyPotholes({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        radius_km: 10,
        include_resolved: false,
      });
      setPotholes(nearbyPotholes.items || []);
    } catch (error) {
      console.error('Failed to load potholes:', error);
    }
  };

  const connectSocket = () => {
    if (isAuthenticated) {
      socketService.connect();
    }
  };

  const handleBumpDetected = async () => {
    if (!location) return;

    Alert.alert(
      '🚧 Bump Detected!',
      'Would you like to report a pothole at your current location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          onPress: () => {
            stopDetection();
            router.push({
              pathname: '/report',
              params: {
                lat: location!.coords.latitude.toString(),
                lng: location!.coords.longitude.toString(),
                autoDetected: 'true',
              },
            });
          },
        },
      ]
    );
  };

  const handleReportPress = () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    router.push({
      pathname: '/report',
      params: {
        lat: location?.coords.latitude.toString() || '',
        lng: location?.coords.longitude.toString() || '',
      },
    });
  };

  const centerOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const renderMarker = (pothole: Pothole) => (
    <Marker
      key={pothole.id}
      coordinate={{
        latitude: pothole.latitude,
        longitude: pothole.longitude,
      }}
      onPress={() => setSelectedPothole(pothole)}
    >
      <View style={[styles.marker, { backgroundColor: SEVERITY_COLORS[pothole.severity] }]}>
        <Ionicons name="warning" size={16} color="#fff" />
      </View>
    </Marker>
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        mapType={Platform.OS === 'android' ? 'standard' : undefined}
      >
        {potholes.map(renderMarker)}

        {location && (
          <Circle
            center={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            radius={500}
            fillColor="rgba(100, 150, 255, 0.1)"
            strokeColor="rgba(100, 150, 255, 0.3)"
            strokeWidth={1}
          />
        )}
      </MapView>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>SafeRoad</Text>
          <Text style={styles.headerSubtitle}>
            {potholes.length} potholes nearby
          </Text>
        </View>
        {isDetecting && (
          <View style={styles.detectingBadge}>
            <View style={styles.detectingDot} />
            <Text style={styles.detectingText}>Detecting</Text>
          </View>
        )}
      </View>

      {/* Center button */}
      <TouchableOpacity style={styles.centerButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Selected pothole info */}
      {selectedPothole && (
        <View style={styles.potholeInfo}>
          <View style={styles.potholeInfoHeader}>
            <View
              style={[
                styles.severityBadge,
                { backgroundColor: SEVERITY_COLORS[selectedPothole.severity] },
              ]}
            >
              <Text style={styles.severityText}>
                {SEVERITY_LABELS[selectedPothole.severity]}
              </Text>
            </View>
            {selectedPothole.verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
          <Text style={styles.roadName}>
            {selectedPothole.road_name || 'Unknown Road'}
          </Text>
          <Text style={styles.distance}>
            {selectedPothole.distance_meters
              ? `${Math.round(selectedPothole.distance_meters)}m away`
              : 'Distance unknown'}
          </Text>
          <TouchableOpacity
            style={styles.navigateButton}
            onPress={() => {
              // Open in maps app
              const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedPothole.latitude},${selectedPothole.longitude}`;
              console.log('Navigate to:', url);
            }}
          >
            <Ionicons name="navigate" size={20} color="#fff" />
            <Text style={styles.navigateText}>Navigate</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Report FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleReportPress}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  map: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    backgroundColor: 'rgba(10, 10, 15, 0.9)',
    borderRadius: 12,
    padding: 12,
    backdropFilter: 'blur(10px)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  detectingBadge: {
    backgroundColor: 'rgba(10, 10, 15, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  detectingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
    marginRight: 6,
  },
  detectingText: {
    fontSize: 12,
    color: '#4ade80',
  },
  centerButton: {
    position: 'absolute',
    right: 16,
    bottom: 200,
    backgroundColor: 'rgba(10, 10, 15, 0.9)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  potholeInfo: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(26, 26, 36, 0.95)',
    borderRadius: 16,
    padding: 16,
    backdropFilter: 'blur(10px)',
  },
  potholeInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  severityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  verifiedText: {
    fontSize: 12,
    color: '#4ade80',
    marginLeft: 4,
  },
  roadName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  distance: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  navigateButton: {
    flexDirection: 'row',
    backgroundColor: '#ff4444',
    borderRadius: 8,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#ff4444',
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});

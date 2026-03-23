import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { useAuthStore, usePotholeStore, useNotificationStore, Pothole } from './store';
import * as Notifications from 'expo-notifications';

const WS_BASE_URL = Constants.expoConfig?.extra?.wsUrl || 'ws://localhost:8000';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  connect() {
    if (this.socket?.connected) return;

    const token = useAuthStore.getState().token;

    this.socket = io(WS_BASE_URL, {
      transports: ['websocket'],
      query: token ? { token } : {},
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupListeners();
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.log('WebSocket connection error:', error);
      this.reconnectAttempts++;
    });

    // New pothole reported
    this.socket.on('new_pothole', async (data) => {
      console.log('New pothole:', data);
      
      const pothole: Pothole = {
        id: data.data.id,
        latitude: data.data.latitude,
        longitude: data.data.longitude,
        severity: data.data.severity,
        confidence: data.data.confidence,
        source: data.data.source,
        reported_at: data.data.reported_at,
        verified: data.data.verified,
        resolved: data.data.resolved,
        road_name: data.data.road_name,
        city: data.data.city,
        risk_score: data.data.risk_score,
      };

      usePotholeStore.getState().addPothole(pothole);

      // Send local notification
      await this.sendLocalNotification(pothole);
    });

    // Alert notification
    this.socket.on('alert', (data) => {
      console.log('Alert received:', data);
      
      useNotificationStore.getState().addNotification({
        id: Date.now().toString(),
        type: 'alert',
        title: data.data.title || 'Pothole Alert',
        body: data.data.body || 'A new pothole has been reported nearby!',
        data: data.data,
        read: false,
        createdAt: new Date().toISOString(),
      });
    });

    // Heartbeat
    this.socket.on('heartbeat', () => {
      // Keep connection alive
    });
  }

  subscribeToArea(lat: number, lng: number, radiusKm: number = 5) {
    if (!this.socket?.connected) return;

    this.socket.emit('subscribe', { lat, lng, radius: radiusKm });
  }

  unsubscribeFromArea() {
    if (!this.socket?.connected) return;

    this.socket.emit('unsubscribe');
  }

  private async sendLocalNotification(pothole: Pothole) {
    const settings = useSettingsStore.getState?.() || { notificationsEnabled: true };
    
    if (!settings.notificationsEnabled) return;

    const severityText = ['', 'Minor', 'Low', 'Moderate', 'High', 'Critical'][pothole.severity] || 'Unknown';
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ Pothole Alert - ${severityText}`,
        body: pothole.road_name 
          ? `Near ${pothole.road_name}` 
          : `Reported at ${new Date(pothole.reported_at).toLocaleTimeString()}`,
        data: { potholeId: pothole.id },
        sound: true,
        priority: pothole.severity >= 4 ? 'high' : 'normal',
      },
      trigger: null,
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

import { useSettingsStore } from './store';

export const socketService = new SocketService();

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Pothole {
  id: string;
  latitude: number;
  longitude: number;
  severity: number;
  size_sqm?: number;
  depth_cm?: number;
  confidence: number;
  image_url?: string;
  source: string;
  reported_at: string;
  verified: boolean;
  resolved: boolean;
  road_name?: string;
  city: string;
  distance_meters?: number;
  risk_score?: number;
}

export interface User {
  id: string;
  phone: string;
  email?: string;
  full_name?: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'safaroad-auth',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

interface PotholeState {
  potholes: Pothole[];
  nearbyPotholes: Pothole[];
  selectedPothole: Pothole | null;
  isLoading: boolean;
  error: string | null;
  setPotholes: (potholes: Pothole[]) => void;
  addPothole: (pothole: Pothole) => void;
  setNearbyPotholes: (potholes: Pothole[]) => void;
  setSelectedPothole: (pothole: Pothole | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePotholeStore = create<PotholeState>((set) => ({
  potholes: [],
  nearbyPotholes: [],
  selectedPothole: null,
  isLoading: false,
  error: null,
  setPotholes: (potholes) => set({ potholes }),
  addPothole: (pothole) => set((state) => ({ 
    potholes: [pothole, ...state.potholes] 
  })),
  setNearbyPotholes: (nearbyPotholes) => set({ nearbyPotholes }),
  setSelectedPothole: (selectedPothole) => set({ selectedPothole }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}

export interface Notification {
  id: string;
  type: 'new_pothole' | 'alert' | 'system';
  title: string;
  body: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) => set((state) => ({
    notifications: [{ ...notification, read: false }, ...state.notifications],
    unreadCount: state.unreadCount + 1,
  })),
  markAsRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    ),
    unreadCount: Math.max(0, state.unreadCount - 1),
  })),
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));

interface SettingsState {
  notificationsEnabled: boolean;
  alertRadius: number; // in km
  darkMode: boolean;
  vibrationDetection: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  setAlertRadius: (radius: number) => void;
  setDarkMode: (darkMode: boolean) => void;
  setVibrationDetection: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notificationsEnabled: true,
      alertRadius: 5,
      darkMode: true,
      vibrationDetection: true,
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setAlertRadius: (alertRadius) => set({ alertRadius }),
      setDarkMode: (darkMode) => set({ darkMode }),
      setVibrationDetection: (vibrationDetection) => set({ vibrationDetection }),
    }),
    {
      name: 'safaroad-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

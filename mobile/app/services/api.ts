import axios, { AxiosInstance, AxiosError } from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from './store';

const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8000/api/v1';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          useAuthStore.getState().logout();
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async sendOTP(phone: string): Promise<{ success: boolean; debug_otp?: string }> {
    const response = await this.client.post('/auth/send-otp', null, { params: { phone } });
    return response.data;
  }

  async verifyOTP(phone: string, otp: string): Promise<any> {
    const response = await this.client.post('/auth/verify-otp', null, {
      params: { phone, otp },
    });
    return response.data;
  }

  async refreshToken(): Promise<any> {
    const response = await this.client.post('/auth/refresh');
    return response.data;
  }

  async getMe(): Promise<any> {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Pothole endpoints
  async getPotholes(params: {
    page?: number;
    page_size?: number;
    min_severity?: number;
    city?: string;
    resolved?: boolean;
  }): Promise<any> {
    const response = await this.client.get('/potholes', { params });
    return response.data;
  }

  async getNearbyPotholes(params: {
    latitude: number;
    longitude: number;
    radius_km?: number;
    min_severity?: number;
    include_resolved?: boolean;
  }): Promise<any> {
    const response = await this.client.get('/potholes/nearby', { params });
    return response.data;
  }

  async getHeatmap(city: string = 'Mumbai', resolution: number = 9): Promise<any> {
    const response = await this.client.get('/potholes/heatmap', {
      params: { city, resolution },
    });
    return response.data;
  }

  async createPothole(data: {
    latitude: number;
    longitude: number;
    severity: number;
    image_base64?: string;
    road_name?: string;
    city?: string;
  }): Promise<any> {
    const response = await this.client.post('/potholes', data);
    return response.data;
  }

  async getPothole(id: string): Promise<any> {
    const response = await this.client.get(`/potholes/${id}`);
    return response.data;
  }

  async updatePothole(id: string, data: any): Promise<any> {
    const response = await this.client.patch(`/potholes/${id}`, data);
    return response.data;
  }

  async votePothole(id: string, vote: boolean): Promise<any> {
    const response = await this.client.post(`/potholes/${id}/vote`, { vote });
    return response.data;
  }

  // Analytics endpoints
  async getSummary(city: string = 'Mumbai'): Promise<any> {
    const response = await this.client.get('/analytics/summary', { params: { city } });
    return response.data;
  }

  async getTrends(period: string = 'daily', days: number = 30): Promise<any> {
    const response = await this.client.get('/analytics/trends', { params: { period, days } });
    return response.data;
  }

  async getSeverityDistribution(city: string = 'Mumbai'): Promise<any> {
    const response = await this.client.get('/analytics/severity-distribution', {
      params: { city },
    });
    return response.data;
  }

  async getTopRoads(limit: number = 10, city: string = 'Mumbai'): Promise<any> {
    const response = await this.client.get('/analytics/top-roads', { params: { limit, city } });
    return response.data;
  }
}

export const api = new ApiService();

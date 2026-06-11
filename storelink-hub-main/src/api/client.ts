import axios from 'axios';
import type { 
  Product, 
  DeliveryRequest, 
  CreateDeliveryRequest, 
  RejectRequest,
  RequestStatus 
} from '@/types';

// API Base URL - Backend and Database server
export const API_BASE = 'http://localhost:8000';


// Создаём два клиента:
// 1. Для публичных запросов (логин)
// 2. Для защищённых запросов (с токеном)

// Публичный клиент (без авторизации)
const publicClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  timeout: 10000,
});

// Защищённый клиент (с JWT)
const authClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});


// Интерсептор: автоматически добавляет токен из localStorage
authClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Обработка 401: сброс токена при ошибке авторизации
authClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);


// ======================
// AUTH API
// ======================

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const params = new URLSearchParams();
    params.append('username', credentials.username);
    params.append('password', credentials.password);

    const response = await publicClient.post<AuthResponse>('/token', params);
    return response.data;
  },

  logout: (): void => {
    localStorage.removeItem('authToken');
  },

  // Проверка, авторизован ли пользователь
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('authToken');
  }
};


// ======================
// STORE API (теперь без store_id!)
// ======================

export const storeApi = {
  getProducts: async (): Promise<Product[]> => {
    const response = await authClient.get<Product[]>('/store/products');
    return response.data;
  },

  createDeliveryRequest: async (data: CreateDeliveryRequest): Promise<DeliveryRequest> => {
    const response = await authClient.post<DeliveryRequest>('/store/delivery-requests', data);
    return response.data;
  },

  // Теперь эндпоинт /store/delivery-requests/me — возвращает запросы ТЕКУЩЕГО пользователя
  getDeliveryRequests: async (): Promise<DeliveryRequest[]> => {
    const response = await authClient.get<DeliveryRequest[]>('/store/delivery-requests/me');
    return response.data;
  },
};
// ======================
// WAREHOUSE API (без изменений в URL, но с авторизацией)
// ======================

export const warehouseApi = {
  getDeliveryRequests: async (status: RequestStatus): Promise<DeliveryRequest[]> => {
    const response = await authClient.get<DeliveryRequest[]>('/warehouse/delivery-requests', {
      params: { status },
    });
    return response.data;
  },

  acceptRequest: async (id: number): Promise<DeliveryRequest> => {
    const response = await authClient.post<DeliveryRequest>(`/warehouse/delivery-requests/${id}/accept`);
    return response.data;
  },

  approveRequest: async (id: number): Promise<DeliveryRequest> => {
    const response = await authClient.post<DeliveryRequest>(`/warehouse/delivery-requests/${id}/approve`);
    return response.data;
  },

  rejectRequest: async (id: number, data: RejectRequest): Promise<DeliveryRequest> => {
    const response = await authClient.post<DeliveryRequest>(
      `/warehouse/delivery-requests/${id}/reject`,
      data
    );
    return response.data;
  },
};

export { authClient, publicClient };

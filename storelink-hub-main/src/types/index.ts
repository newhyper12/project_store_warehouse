// ======================
// Product types
// ======================
export interface Product {
  id: number;
  name: string;
  description: string;
  // stock_quantity НЕ включаем — магазин его не видит!
}

// ======================
// Cart types
// ======================
export interface CartItem {
  product: Product;
  quantity: number;
}

// ======================
// Request Status
// ======================
export type RequestStatus = 'pending' | 'processing' | 'approved' | 'rejected';

// ======================
// Delivery Request Items
// ======================
export interface DeliveryRequestItem {
  product_id: number;
  product_name?: string;      // опционально (для отображения)
  requested_quantity: number;
  approved_quantity?: number; // может быть null/undefined
  available_stock?: number;   // только для склада
}

// ======================
// ОСНОВНОЙ ТИП: DeliveryRequest
// ======================
export interface DeliveryRequest {
  id: number;                 // request_id → просто id
  // store_id УДАЛЁН — данные изолированы по пользователю!
  items: DeliveryRequestItem[];
  status: RequestStatus;
  reject_reason?: string | null; // ← правильное имя поля из БД
  created_at?: string;
  // created_by — не нужно на фронтенде
}

// ======================
// Создание запроса
// ======================
export interface CreateDeliveryRequest {
  // store_id УДАЛЁН — backend определит по токену!
  items: {
    product_id: number;
    requested_quantity: number;
  }[];
}

// ======================
// Отказ
// ======================
export interface RejectRequest {
  reason: string; // тело запроса: { "reason": "..." }
}

// ======================
// АВТОРИЗАЦИЯ
// ======================
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string; // обычно "bearer"
}
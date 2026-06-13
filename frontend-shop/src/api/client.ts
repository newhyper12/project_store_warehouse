import axios, { AxiosError, AxiosHeaders } from "axios";
import type { ProposalItemPayload } from "../types";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const http = axios.create({ baseURL });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

http.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ detail?: string }>) => {
    const status = err.response?.status ?? 0;
    if (status === 401) {
      localStorage.removeItem("token");
      onUnauthorized?.();
    }
    let message =
      (err.response?.data as { detail?: string } | undefined)?.detail ||
      err.message || "Сетевая ошибка";
    if (status === 403) message = "Недостаточно прав";
    if (status === 500) message = "Внутренняя ошибка сервера";
    return Promise.reject({ status, message });
  },
);

export const api = {
  login: async (username: string, password: string) => {
    const body = new URLSearchParams({ username, password });
    const { data } = await http.post<{ access_token: string }>("/auth/token", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return data.access_token;
  },
  me: async () => (await http.get("/auth/me")).data,

  // customer
  customerCategories: async () => (await http.get("/customer/categories")).data,
  customerProducts: async () => (await http.get("/customer/products")).data,
  customerCreateApplication: async (items: { product_id: number; quantity: number }[]) =>
    (await http.post("/customer/order-applications", { items })).data,
  customerMyApplications: async () => (await http.get("/customer/order-applications/me")).data,
  customerGetApplication: async (id: number) =>
    (await http.get(`/customer/order-applications/${id}`)).data,
  customerRespondProposal: async (
    id: number,
    decision: "accept_partial_warehouse_only" | "accept_split_warehouse_and_supplier" | "cancel_application",
  ) => (await http.post(`/customer/order-applications/${id}/proposal/respond`, { decision })).data,

  // store
  storeProducts: async () => (await http.get("/store/products")).data,
  storeApplications: async () => (await http.get("/store/customer-applications")).data,
  storeGetApplication: async (id: number) =>
    (await http.get(`/store/customer-applications/${id}`)).data,
  storeRouteWarehouse: async (id: number) =>
    (await http.post(`/store/customer-applications/${id}/route-warehouse`, {})).data,
  storeCreateProposal: async (id: number, message: string, items: ProposalItemPayload[]) =>
    (await http.post(`/store/customer-applications/${id}/proposal`, { message, items })).data,
  storeRejectApp: async (id: number, reason: string) =>
    (await http.post(`/store/customer-applications/${id}/reject`, { reason })).data,
  storeWarehouseReqs: async () => (await http.get("/store/warehouse-requests/me")).data,
  storeSupplierReqs: async () => (await http.get("/store/supplier-requests/me")).data,

  // warehouse
  warehouseProducts: async () => (await http.get("/warehouse/products")).data,
  warehouseRequests: async (status: string) =>
    (await http.get(`/warehouse/requests?status=${encodeURIComponent(status)}`)).data,
  warehouseAccept: async (id: number) => (await http.post(`/warehouse/requests/${id}/accept`)).data,
  warehouseApprove: async (id: number) => (await http.post(`/warehouse/requests/${id}/approve`)).data,
  warehouseReject: async (id: number, reason: string) =>
    (await http.post(`/warehouse/requests/${id}/reject`, { reason })).data,
  warehouseShip: async (id: number) => (await http.post(`/warehouse/requests/${id}/ship`)).data,

  // supplier
  supplierProducts: async () => (await http.get("/supplier/products")).data,
  supplierRequests: async (status: string) =>
    (await http.get(`/supplier/requests?status=${encodeURIComponent(status)}`)).data,
  supplierAccept: async (id: number) => (await http.post(`/supplier/requests/${id}/accept`)).data,
  supplierReject: async (id: number, reason: string) =>
    (await http.post(`/supplier/requests/${id}/reject`, { reason })).data,
  supplierShip: async (id: number, payload: { items: { product_id: number; quantity: number; unit_price: number }[]; expected_date?: string | null; notes?: string | null }) =>
    (await http.post(`/supplier/requests/${id}/ship`, payload)).data,
  supplierMyShipments: async () => (await http.get("/supplier/shipments/me")).data,
};

// ---------- v3.1: product management ----------
export const apiProducts = {
  // store
  storeCategories: async () => (await http.get("/store/categories")).data,
  storeProductsManaged: async () => (await http.get("/store/products-managed")).data,
  storeCreateProduct: async (payload: {
    name: string; description?: string; price: number;
    stock_quantity?: number; category_id?: number | null;
    sku?: string | null; is_active?: boolean;
  }) => (await http.post("/store/products", payload)).data,
  storeUpdateProduct: async (id: number, payload: Record<string, unknown>) =>
    (await http.patch(`/store/products/${id}`, payload)).data,

  // supplier
  supplierCategories: async () => (await http.get("/supplier/categories")).data,
  supplierProductsManaged: async () => (await http.get("/supplier/products-managed")).data,
  supplierGlobalCatalog: async () => (await http.get("/supplier/products-catalog")).data,
  supplierConnectProduct: async (payload: {
    product_id: number; unit_price: number; lead_time_days?: number;
    quantity_available?: number | null; notes?: string | null; is_active?: boolean;
  }) => (await http.post("/supplier/products", payload)).data,
  supplierCreateAndSupply: async (payload: {
    name: string; description?: string; price: number;
    category_id?: number | null; sku?: string | null;
    unit_price: number; lead_time_days?: number;
    quantity_available?: number | null; notes?: string | null;
  }) => (await http.post("/supplier/products/create-and-supply", payload)).data,
  supplierUpdateProduct: async (id: number, payload: Record<string, unknown>) =>
    (await http.patch(`/supplier/products/${id}`, payload)).data,

  // supplier requests new actions
  supplierApprove: async (id: number) => (await http.post(`/supplier/requests/${id}/approve`)).data,
};

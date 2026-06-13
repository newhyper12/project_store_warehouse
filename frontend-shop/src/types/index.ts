export type Role = "customer" | "store" | "warehouse" | "supplier" | "admin";

export interface Me { id: number; username: string; role: Role; entity_id: number; }

export interface Category { id: number; name: string; }

export interface SupplierOption {
  supplier_id: number;
  supplier_name: string;
  unit_price: number;
  lead_time_days: number;
  estimated_delivery_date: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category_id?: number | null;
  category_name?: string | null;
  stock_quantity?: number;
  in_stock?: boolean;
  suppliers?: SupplierOption[];
}

export interface ApplicationItem {
  id: number;
  product_id: number;
  product_name: string;
  category_name?: string | null;
  quantity: number;
  approved_quantity?: number | null;
  cancelled_quantity?: number;
  unit_price: number;
  fulfillment_source: string;
  item_status: string;
  warehouse_available_quantity_snapshot?: number | null;
  selected_supplier_id?: number | null;
  estimated_delivery_date?: string | null;
  exclusion_reason?: string | null;
  warehouse_available_quantity?: number | null;
  enough_in_warehouse?: boolean | null;
  suppliers?: SupplierOption[];
}

export interface StatusHistoryEntry {
  status: string;
  note?: string | null;
  created_at: string;
}

export interface ProposalItem {
  id: number;
  application_item_id: number;
  product_id: number;
  product_name: string;
  requested_quantity: number;
  warehouse_available_quantity: number;
  proposed_warehouse_quantity: number;
  proposed_supplier_quantity: number;
  proposed_action: "warehouse" | "supplier" | "exclude";
  supplier_id?: number | null;
  supplier_name?: string | null;
  estimated_delivery_date?: string | null;
  unit_price: number;
}

export interface Proposal {
  id: number;
  application_id: number;
  store_id: number;
  status: string;
  message?: string | null;
  created_at: string;
  updated_at: string;
  customer_decision_at?: string | null;
  items: ProposalItem[];
}

export interface OrderApplication {
  id: number;
  customer_id: number;
  store_id: number | null;
  status: string;
  total_amount: number;
  reject_reason?: string | null;
  created_at: string;
  updated_at: string;
  items: ApplicationItem[];
  history: StatusHistoryEntry[];
  proposal?: Proposal | null;
}

export interface RequestItem {
  product_id: number;
  product_name: string;
  category_name?: string | null;
  requested_quantity: number;
  approved_quantity?: number | null;
  stock_quantity?: number | null;
  estimated_delivery_date?: string | null;
}

export interface WarehouseRequest {
  id: number; application_id: number; store_id: number; warehouse_id: number | null;
  status: string; reject_reason?: string | null; created_at: string; items: RequestItem[];
}

export interface SupplierRequest {
  id: number; application_id: number; store_id: number; supplier_id: number | null;
  status: string; reject_reason?: string | null; created_at: string; items: RequestItem[];
}

export interface Shipment {
  id: number; supplier_request_id: number | null; supplier_id: number;
  expected_date: string | null; notes: string | null; created_at: string;
  items: { product_id: number; product_name: string; quantity: number; unit_price: number }[];
}

export interface ProposalItemPayload {
  application_item_id: number;
  proposed_warehouse_quantity: number;
  proposed_supplier_quantity: number;
  proposed_action: "warehouse" | "supplier" | "exclude";
  supplier_id?: number | null;
}

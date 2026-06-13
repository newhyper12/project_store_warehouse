import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import "./components/Theme";
import { AuthProvider } from "./context/AuthContext";
import { AppShell } from "./components/Shell";
import { HubPage, LoginPage, RequireRole } from "./components/Auth";
import { WarehousePage } from "./pages/WarehousePage";
import { SupplierPage } from "./pages/SupplierPage";

const TITLE = "Store System · Склад и Поставщик";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={
            <HubPage
              title={TITLE}
              subtitle="Кабинеты склада и поставщиков: остатки, входящие запросы, поставки и сроки доставки."
              roles={[
                { role: "warehouse", title: "Войти как склад",      tone: "emerald",
                  description: "Запросы магазинов, остатки, одобрение и отгрузка.",
                  points: ["Транзакционное списание остатков", "Индикаторы низких остатков", "История по каждому запросу"] },
                { role: "supplier",  title: "Войти как поставщик",  tone: "amber",
                  description: "Запросы на поставку, сроки и отгрузка с фиксацией цен.",
                  points: ["Только мои товары и запросы", "Расчётные даты доставки", "Поставки увеличивают остаток склада"] },
              ]}
              archInfo={[
                { label: "Frontend", value: "React 18 + Vite + TypeScript + Tailwind" },
                { label: "Backend",  value: "FastAPI + PostgreSQL + JWT" },
                { label: "Roles",    value: "customer · store · warehouse · supplier" },
              ]}
            />
          } />
          <Route path="/login" element={<LoginPage title={TITLE} allowedRoles={["warehouse", "supplier"]} />} />
          <Route path="/warehouse" element={<RequireRole role="warehouse"><AppShell title={TITLE}><WarehousePage /></AppShell></RequireRole>} />
          <Route path="/supplier"  element={<RequireRole role="supplier"><AppShell title={TITLE}><SupplierPage /></AppShell></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);

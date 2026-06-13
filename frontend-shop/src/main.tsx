import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import "./components/Theme"; // sets initial html.dark class before render
import { AuthProvider } from "./context/AuthContext";
import { AppShell } from "./components/Shell";
import { HubPage, LoginPage, RequireRole } from "./components/Auth";
import { CustomerPage } from "./pages/CustomerPage";
import { StorePage } from "./pages/StorePage";

const TITLE = "Store System · Магазин";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={
            <HubPage
              title={TITLE}
              subtitle="Управление заявками покупателей: каталог, частичная отгрузка со склада, заказ у поставщика и сквозные статусы."
              roles={[
                { role: "customer", title: "Войти как покупатель", tone: "violet",
                  description: "Витрина с фильтрами, корзиной и историей заявок.",
                  points: ["Каталог по категориям и поиску", "Корзина и оформление заявки", "Подтверждение частичной отгрузки"] },
                { role: "store",    title: "Войти как магазин",    tone: "blue",
                  description: "Обработка входящих заявок, остатки склада, маршрутизация поставщику.",
                  points: ["Чек-листы доступности по позициям", "Предложение частичного выполнения", "Маршрутизация на склад или поставщику"] },
              ]}
              archInfo={[
                { label: "Frontend", value: "React 18 + Vite + TypeScript + Tailwind" },
                { label: "Backend",  value: "FastAPI + PostgreSQL + JWT" },
                { label: "Roles",    value: "customer · store · warehouse · supplier" },
              ]}
            />
          } />
          <Route path="/login" element={<LoginPage title={TITLE} allowedRoles={["customer", "store"]} />} />
          <Route path="/customer" element={<RequireRole role="customer"><AppShell title={TITLE}><CustomerPage /></AppShell></RequireRole>} />
          <Route path="/store"    element={<RequireRole role="store"><AppShell title={TITLE}><StorePage /></AppShell></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);

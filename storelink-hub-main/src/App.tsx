// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { authApi } from "@/api/client";
import Index from "./pages/Index";
import Login from "./pages/Login"; // ← новая страница
import StorePage from "./pages/StorePage";
import WarehousePage from "./pages/WarehousePage";
import NotFound from "./pages/NotFound";

// ======================
// Компонент защищённого маршрута
// ======================
interface ProtectedRouteProps {
  children: JSX.Element;
  requiredRole?: 'store' | 'warehouse';
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const isAuthenticated = authApi.isAuthenticated();
  
  // Если не авторизован — перенаправляем на логин
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // TODO: Проверка роли (если нужно)
  // Сейчас мы полагаемся на backend — он сам фильтрует данные по токену
  // Поэтому клиентская проверка роли не обязательна для учебного проекта

  return children;
};

// ======================
// Основное приложение
// ======================
const queryClient = new QueryClient();

const App = () => (
<>
    {/* Добавляем базовые CSS-переменные для Tailwind */}
    <style>
      {`
        @layer base {
          :root {
            --background: 0 0% 100%;
            --foreground: 240 10% 3.9%;
            --card: 0 0% 100%;
            --card-foreground: 240 10% 3.9%;
            --popover: 0 0% 100%;
            --popover-foreground: 240 10% 3.9%;
            --primary: 221 83% 53%;
            --primary-foreground: 0 0% 100%;
            --secondary: 240 4.8% 95.9%;
            --secondary-foreground: 240 5.9% 10%;
            --muted: 240 4.8% 95.9%;
            --muted-foreground: 240 3.8% 46.1%;
            --accent: 240 4.8% 95.9%;
            --accent-foreground: 240 5.9% 10%;
            --destructive: 0 84.2% 60.2%;
            --destructive-foreground: 0 0% 100%;
            --border: 240 5.9% 90%;
            --input: 240 5.9% 90%;
            --ring: 221 83% 53%;
            --radius: 0.5rem;
            --card-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
            --card-shadow-hover: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
          }

          .dark {
            --background: 240 10% 3.9%;
            --foreground: 0 0% 98%;
            --card: 240 10% 3.9%;
            --card-foreground: 0 0% 98%;
            --popover: 240 10% 3.9%;
            --popover-foreground: 0 0% 98%;
            --primary: 217 91% 60%;
            --primary-foreground: 0 0% 100%;
            --secondary: 240 3.7% 15.9%;
            --secondary-foreground: 0 0% 98%;
            --muted: 240 3.7% 15.9%;
            --muted-foreground: 240 5% 64.9%;
            --accent: 240 3.7% 15.9%;
            --accent-foreground: 0 0% 98%;
            --destructive: 0 62.8% 30.6%;
            --destructive-foreground: 0 0% 98%;
            --border: 240 3.7% 15.9%;
            --input: 240 3.7% 15.9%;
            --ring: 217 91% 60%;
            --card-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
            --card-shadow-hover: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2);
          }

          body {
            background-color: hsl(var(--background));
            color: hsl(var(--foreground));
            transition: background-color 0.3s, color 0.3s;
          }
        }
      `}
    </style>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          
          {/* Маршрут авторизации */}
          <Route path="/login" element={<Login />} />
          
          {/* Защищённые маршруты */}
          <Route 
            path="/store" 
            element={
              <ProtectedRoute>
                <StorePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/warehouse" 
            element={
              <ProtectedRoute>
                <WarehousePage />
              </ProtectedRoute>
            } 
          />
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </>
);

export default App;
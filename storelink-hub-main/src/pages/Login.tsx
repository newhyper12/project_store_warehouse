// src/pages/Login.tsx
import { useState,useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { KeyRound, User, Store, Warehouse, ArrowRight, Warehouse, RefreshCw, Clock, Loader2, CheckCircle, XCircle, Package, Moon, Sun  } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi, LoginCredentials, warehouseApi } from '@/api/client';
import { toast } from 'sonner';


import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Badge } from '@/components/ui/badge';
import { RequestCard } from '@/components/warehouse/RequestCard';
import { RejectModal } from '@/components/warehouse/RejectModal';

import type { DeliveryRequest, RequestStatus } from '@/types';






const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Получаем, с какой роли пришёл пользователь (если нужно)
  // Например: /login?role=store
  const searchParams = new URLSearchParams(location.search);
  const intendedRole = searchParams.get('role');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    try {
      const credentials: LoginCredentials = { username, password };
      const authData = await authApi.login(credentials);

      let role = intendedRole;

      if (!role) {
        // Если роль не указана — попробуем угадать по username (например, 'store1' → store)
        role = username.toLowerCase().includes('store') ? 'store' : 'warehouse';
      }

      // Сохраняем токен
      localStorage.setItem('authToken', authData.access_token);

      // Перенаправляем
      if (role === 'warehouse') {
        navigate('/warehouse');
      } else {
        navigate('/store');
      }

    } catch (error: any) {
      console.error('Login error:', error);
      const message = error.response?.data?.detail || 'Invalid username or password';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Sign in to your account</CardTitle>
          <CardDescription>
            Enter your credentials to access the {intendedRole === 'warehouse' ? 'Warehouse' : 'Store'} portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          {/* Quick links for demo */}
          <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
            <p>For demonstration purposes:</p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setUsername('store1');
                  setPassword('password1');
                }}
                className="text-primary hover:underline"
              >
                Store User
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  setUsername('warehouseA');
                  setPassword('passwordA');
                }}
                className="text-accent hover:underline"
              >
                Warehouse User
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
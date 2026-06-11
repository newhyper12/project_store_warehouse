import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Warehouse, ArrowRight, Moon, Sun } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const Index = () => {
  const navigate = useNavigate();
  // === Theme Logic ===
const [theme, setTheme] = useState<'light' | 'dark'>('light');

useEffect(() => {
  const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = saved || (prefersDark ? 'dark' : 'light');

  setTheme(initialTheme);
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}, []);

const toggleTheme = () => {
  const newTheme = theme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
  localStorage.setItem('theme', newTheme);

  if (newTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};
// === End Theme Logic ===
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-store">
              <Store className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            Retail Store & Warehouse
            <span className="block text-primary">Interaction System</span>
          </h1>
          {/* Переключатель темы справа */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            A distributed system for managing delivery requests between retail stores and warehouses, 
            connected via Radmin VPN network.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-2">
              <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              Network: 10.0.0.x • API Server: 10.0.0.1:8000
            </div>
          </div>
        </div>
      </div>

      {/* Portal Selection */}
      <div className="container mx-auto px-4 py-16">
        <div className="mb-12 text-center">
          <h2 className="mb-2 text-2xl font-bold">Select Your Portal</h2>
          <p className="text-muted-foreground">Choose the appropriate interface for your role</p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {/* Store Portal Card */}
          <Card 
            className="h-full cursor-pointer transition-all duration-300 hover:shadow-card-hover hover:border-primary/50 group"
            onClick={() => navigate('/login?role=store')}
          >
            <CardHeader className="pb-4">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl gradient-store transition-transform group-hover:scale-110">
                <Store className="h-7 w-7 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl">Store Portal</CardTitle>
              <CardDescription className="text-base">
                For retail store managers to browse products, create delivery requests, and track order status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Browse available products
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Add items to cart with quantities
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Submit delivery requests
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Track request status in real-time
                </li>
              </ul>
              <Button className="w-full gap-2 group-hover:gap-3 transition-all">
                Open Store Portal
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Warehouse Portal Card */}
          <Card 
            className="h-full cursor-pointer transition-all duration-300 hover:shadow-card-hover hover:border-accent/50 group"
            onClick={() => navigate('/login?role=warehouse')}
          >
            <CardHeader className="pb-4">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl gradient-warehouse transition-transform group-hover:scale-110">
                <Warehouse className="h-7 w-7 text-accent-foreground" />
              </div>
              <CardTitle className="text-2xl">Warehouse Portal</CardTitle>
              <CardDescription className="text-base">
                For warehouse operators to manage incoming delivery requests and control inventory.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                  View requests by status
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Accept pending requests
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Approve or reject with reason
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Auto-refresh every 10 seconds
                </li>
              </ul>
              <Button variant="outline" className="w-full gap-2 group-hover:gap-3 transition-all border-accent text-accent hover:bg-accent hover:text-accent-foreground">
                Open Warehouse Portal
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Architecture Info */}
        <div className="mx-auto mt-16 max-w-3xl">
          <Card className="border-dashed">
            <CardHeader className="text-center">
              <CardTitle className="text-lg">Network Architecture</CardTitle>
              <CardDescription>Connected via Radmin VPN</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 md:flex-row md:justify-center">
                <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-center">
                  <p className="font-mono text-sm font-medium text-primary">PC1: 10.0.0.2</p>
                  <p className="text-xs text-muted-foreground">Store Frontend</p>
                </div>
                <div className="hidden h-px w-12 bg-border md:block" />
                <div className="h-8 w-px bg-border md:hidden" />
                <div className="rounded-lg border border-primary/50 bg-primary/10 px-4 py-3 text-center">
                  <p className="font-mono text-sm font-medium text-primary">PC3: 10.0.0.1</p>
                  <p className="text-xs text-muted-foreground">FastAPI + PostgreSQL</p>
                </div>
                <div className="hidden h-px w-12 bg-border md:block" />
                <div className="h-8 w-px bg-border md:hidden" />
                <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-center">
                  <p className="font-mono text-sm font-medium text-accent">PC2: 10.0.0.3</p>
                  <p className="text-xs text-muted-foreground">Warehouse Frontend</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;

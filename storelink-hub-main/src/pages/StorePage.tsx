import { useState, useEffect, useCallback } from 'react';
import { Store, Package, RefreshCw, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { ProductCard } from '@/components/store/ProductCard';
import { Cart } from '@/components/store/Cart';
import { RequestHistory } from '@/components/store/RequestHistory';
import { storeApi } from '@/api/client';
import type { Product, CartItem, DeliveryRequest } from '@/types';
import { Button } from '@/components/ui/button';

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [requests, setRequests] = useState<DeliveryRequest[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);


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


  const fetchProducts = useCallback(async () => {
    try {
      setIsLoadingProducts(true);
      const data = await storeApi.getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to load products. Please check your connection to the server.');
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoadingRequests(true);
      const data = await storeApi.getDeliveryRequests();
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
      toast.error('Failed to load delivery requests.');
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchRequests();
  }, [fetchProducts, fetchRequests]);

  // Auto-refresh requests every 15 seconds
  useEffect(() => {
    const interval = setInterval(fetchRequests, 15000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleAddToCart = (product: Product, quantity: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    toast.success(`Added ${quantity}x ${product.name} to cart`);
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleUpdateQuantity = (productId: number, quantity: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleSubmitRequest = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    try {
      setIsSubmitting(true);
      await storeApi.createDeliveryRequest({
        store_id: 1,
        items: cart.map((item) => ({
          product_id: item.product.id,
          requested_quantity: item.quantity,
        })),
      });
      toast.success('Delivery request submitted successfully!');
      setCart([]);
      fetchRequests();
    } catch (error) {
      console.error('Failed to submit request:', error);
      toast.error('Failed to submit delivery request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-store">
              <Store className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Store Portal</h1>
              <p className="text-sm text-muted-foreground">Store #1 • Radmin VPN</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            Connected to 10.0.0.1:8000
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Products Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Products</h2>
                <p className="text-muted-foreground">Select products for your delivery request</p>
              </div>
              <button
                onClick={fetchProducts}
                disabled={isLoadingProducts}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            </div>

            {isLoadingProducts ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-48 animate-pulse rounded-lg bg-secondary" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
                <Package className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium text-muted-foreground">No products available</p>
                <p className="text-sm text-muted-foreground">Check your connection to the server</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Cart & History Sidebar */}
          <div className="space-y-6">
            <Cart
              items={cart}
              onRemoveItem={handleRemoveFromCart}
              onUpdateQuantity={handleUpdateQuantity}
              onSubmitRequest={handleSubmitRequest}
              isSubmitting={isSubmitting}
            />
            <RequestHistory
              requests={requests}
              isLoading={isLoadingRequests}
              onRefresh={fetchRequests}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

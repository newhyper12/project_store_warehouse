import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, LogOut, Plus, Minus, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const API_URL = 'http://localhost:8000';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category_name: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function CustomerShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/customer/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      } else {
        toast.error('Ошибка загрузки товаров');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      toast.error('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast.success(`${product.name} добавлен в корзину`);
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0)
    );
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    const token = localStorage.getItem('token');
    setOrdering(true);

    try {
      const orderData = {
        customer_id: 1, // TODO: Получить из токена
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity
        }))
      };

      const response = await fetch(`${API_URL}/customer/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        toast.success('Заказ успешно оформлен!');
        setCart([]);
        setShowCart(false);
      } else {
        const error = await response.json();
        toast.error(`Ошибка: ${error.detail || 'Не удалось оформить заказ'}`);
      }
    } catch (error) {
      console.error('Ошибка оформления заказа:', error);
      toast.error('Ошибка сети');
    } finally {
      setOrdering(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Загрузка товаров...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Магазин</h1>
          <div className="flex gap-4 items-center">
            <Button
              variant="outline"
              onClick={() => setShowCart(!showCart)}
              className="relative"
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Корзина
              {cart.length > 0 && (
                <Badge className="ml-2 bg-primary text-primary-foreground">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </Badge>
              )}
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Выйти
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Products Grid */}
          <div className="flex-1">
            <h2 className="text-xl font-semibold mb-6">Каталог товаров</h2>
            
            {products.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <ShoppingCart className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Товары не найдены</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <Card key={product.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        {product.category_name && (
                          <Badge variant="secondary">{product.category_name}</Badge>
                        )}
                      </div>
                      <CardDescription className="line-clamp-2">
                        {product.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-bold text-primary">
                          {product.price.toLocaleString('ru-RU')} ₽
                        </span>
                        <Button onClick={() => addToCart(product)} size="sm">
                          <Plus className="mr-1 h-4 w-4" /> В корзину
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          {showCart && (
            <div className="w-96">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Корзина
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {cart.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Корзина пуста
                    </p>
                  ) : (
                    <>
                      <div className="space-y-4 mb-6">
                        {cart.map((item) => (
                          <div key={item.product.id} className="flex justify-between items-center">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.product.price.toLocaleString('ru-RU')} ₽ × {item.quantity}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.product.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-medium">
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.product.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => removeFromCart(item.product.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Separator className="mb-4" />

                      <div className="flex justify-between items-center mb-4">
                        <span className="font-semibold">Итого:</span>
                        <span className="text-2xl font-bold text-primary">
                          {getTotal().toLocaleString('ru-RU')} ₽
                        </span>
                      </div>

                      <Button
                        className="w-full"
                        size="lg"
                        onClick={handleCheckout}
                        disabled={ordering}
                      >
                        {ordering ? (
                          <>Оформление...</>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Оформить заказ
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

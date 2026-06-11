import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const API_URL = 'http://localhost:8000';

export default function SupplierPage() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/supplier/shipments/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setShipments(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки поставок:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleCreateShipment = () => {
    // TODO: Открыть модальное окно или перейти на страницу создания
    alert('Функция создания поставки будет добавлена');
  };

  if (loading) return <div className="p-10 text-center">Загрузка...</div>;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Панель поставщика</h1>
        <Button variant="destructive" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Выйти
        </Button>
      </div>

      <div className="mb-6">
        <Button onClick={handleCreateShipment}>
          <Plus className="mr-2 h-4 w-4" /> Создать поставку
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {shipments.map((shipment) => (
          <Card key={shipment.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Поставка #{shipment.id}</span>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  shipment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  shipment.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                  shipment.status === 'received' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {shipment.status === 'pending' ? 'Ожидает' :
                   shipment.status === 'in_transit' ? 'В пути' :
                   shipment.status === 'received' ? 'Получено' :
                   'Отменено'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Склад ID</p>
                  <p className="font-semibold">{shipment.warehouse_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ожидаемая дата</p>
                  <p className="font-semibold">{shipment.expected_date || 'Не указана'}</p>
                </div>
              </div>
              
              {shipment.items && shipment.items.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Товары:</p>
                  <ul className="space-y-1">
                    {shipment.items.map((item: any, idx: number) => (
                      <li key={idx} className="text-sm">
                        • Товар #{item.product_id} - {item.quantity} шт. ({item.unit_price} ₽)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground mt-4">
                Создано: {new Date(shipment.created_at).toLocaleString('ru-RU')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {shipments.length === 0 && (
        <div className="text-center text-muted-foreground mt-10">
          <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>У вас пока нет поставок</p>
          <Button variant="outline" className="mt-4" onClick={handleCreateShipment}>
            Создать первую поставку
          </Button>
        </div>
      )}
    </div>
  );
}

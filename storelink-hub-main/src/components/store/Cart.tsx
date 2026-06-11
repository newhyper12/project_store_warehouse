import { ShoppingCart, Trash2, Send, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CartItem } from '@/types';

interface CartProps {
  items: CartItem[];
  onRemoveItem: (productId: number) => void;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onSubmitRequest: () => void;
  isSubmitting: boolean;
}

export function Cart({ items, onRemoveItem, onUpdateQuantity, onSubmitRequest, isSubmitting }: CartProps) {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  if (items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ShoppingCart className="mb-4 h-12 w-12 opacity-50" />
          <p className="text-lg font-medium">Cart is empty</p>
          <p className="text-sm">Add products to create a delivery request</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Cart
          <Badge variant="secondary" className="ml-2">
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-[300px] space-y-3 overflow-y-auto pr-2">
          {items.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{item.product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Qty: {item.quantity}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded border border-border">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onUpdateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                    disabled={item.quantity <= 1}
                  >
                    -
                  </Button>
                  <span className="w-8 text-center font-mono text-sm">{item.quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                  >
                    +
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onRemoveItem(item.product.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4">
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={onSubmitRequest}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit Delivery Request
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

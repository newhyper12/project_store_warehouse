import { Package, Clock, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DeliveryRequest, RequestStatus } from '@/types';

interface RequestCardProps {
  request: DeliveryRequest;
  onAccept?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  isLoading?: boolean;
}

export function RequestCard({ request, onAccept, onApprove, onReject, isLoading }: RequestCardProps) {
  const showAccept = request.status === 'pending';
  const showApproveReject = request.status === 'processing';

  return (
    <Card className="animate-fade-in transition-all duration-200 hover:shadow-card-hover">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <span className="font-mono text-sm font-bold text-primary">#{request.id}</span>
            </div>
            Request #{request.id}
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            Store #{request.store_id}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-secondary/30">
          <div className="grid grid-cols-3 gap-2 border-b border-border bg-secondary/50 px-4 py-2 text-sm font-medium text-muted-foreground">
            <span>Product</span>
            <span className="text-center">Requested</span>
            <span className="text-right">Available</span>
          </div>
          <div className="divide-y divide-border">
            {(Array.isArray(request.items) ? request.items : []).map((item, index) => {
                console.log("Пример item:", request.items[0]);
              const hasEnoughStock = item.stock !== undefined &&
                item.stock >= item.requested;
              
              return (
                <div
                  key={index}
                  className="grid grid-cols-3 gap-2 px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {(item.name || item.product_name || `Product #${item.product_id}`)}
                    </span>
                  </div>
                  <div className="flex items-center justify-center">
                    <Badge variant="outline" className="font-mono">
                      {item.requested}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-end">
                    {item.stock !== undefined ? (
                      <Badge
                        variant={hasEnoughStock ? 'default' : 'destructive'}
                        className="font-mono"
                      >
                        {item.stock}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {request.status === 'rejected' && request.reject_reason && (
          <div className="rounded-lg bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              <strong>Rejection Reason:</strong> {request.reject_reason}
            </p>
          </div>
        )}

        {(showAccept || showApproveReject) && (
          <div className="flex gap-2 pt-2">
            {showAccept && (
              <Button
                onClick={onAccept}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  'Accept'
                )}
              </Button>
            )}
            {showApproveReject && (
              <>
                <Button
                  onClick={onApprove}
                  disabled={isLoading}
                  className="flex-1 bg-accent hover:bg-accent/90"
                >
                  Approve
                </Button>
                <Button
                  onClick={onReject}
                  disabled={isLoading}
                  variant="destructive"
                  className="flex-1"
                >
                  Reject
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

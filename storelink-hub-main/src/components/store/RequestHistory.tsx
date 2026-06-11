import { History, Clock, CheckCircle, XCircle, Loader2, RefreshCw, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DeliveryRequest, RequestStatus } from '@/types';

interface RequestHistoryProps {
  requests: DeliveryRequest[];
  isLoading: boolean;
  onRefresh: () => void;
}

const statusConfig: Record<RequestStatus, { icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pending: {
    icon: <Clock className="h-3 w-3" />,
    variant: 'secondary',
    label: 'Pending',
  },
  processing: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    variant: 'outline',
    label: 'Processing',
  },
  approved: {
    icon: <CheckCircle className="h-3 w-3" />,
    variant: 'default',
    label: 'Approved',
  },
  rejected: {
    icon: <XCircle className="h-3 w-3" />,
    variant: 'destructive',
    label: 'Rejected',
  },
};

export function RequestHistory({ requests, isLoading, onRefresh }: RequestHistoryProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Request History
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <History className="mb-3 h-10 w-10 opacity-50" />
            <p>No delivery requests yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const config = statusConfig[request.status];
              return (
                <div
                  key={request.id}
                  className="rounded-lg border border-border p-4 transition-colors hover:bg-secondary/30 animate-slide-in"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <span className="font-mono text-sm font-bold text-primary">
                          #{request.id}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">
                          {request.items.length} {request.items.length === 1 ? 'item' : 'items'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Request ID: {request.id}
                        </p>
                      </div>
                    </div>
                    <Badge variant={config.variant} className="gap-1">
                      {config.icon}
                      {config.label}
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-1.5 pl-[52px]">
                    {request.items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Package className="h-3.5 w-3.5" />
                        <span>{item.product_name} #{item.product_id}</span>
                        <span className="text-foreground">× {item.requested}</span>
                      </div>
                    ))}
                  </div>

                  {request.status === 'rejected' && request.reject_reason && (
                    <div className="mt-3 rounded-md bg-destructive/10 p-3 pl-[52px]">
                      <p className="text-sm text-destructive">
                        <strong>Reason:</strong> {request.reject_reason}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

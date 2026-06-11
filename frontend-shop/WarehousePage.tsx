import { useState, useEffect, useCallback } from 'react';
import { Warehouse, RefreshCw, Clock, Loader2, CheckCircle, XCircle, Package, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RequestCard } from '@/components/warehouse/RequestCard';
import { RejectModal } from '@/components/warehouse/RejectModal';
import { warehouseApi } from '@/api/client';
import type { DeliveryRequest, RequestStatus } from '@/types';

const tabs: { value: RequestStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'pending', label: 'Pending', icon: <Clock className="h-4 w-4" /> },
  { value: 'processing', label: 'Processing', icon: <Loader2 className="h-4 w-4" /> },
  { value: 'approved', label: 'Approved', icon: <CheckCircle className="h-4 w-4" /> },
  { value: 'rejected', label: 'Rejected', icon: <XCircle className="h-4 w-4" /> },
];

export default function WarehousePage() {
  const [activeTab, setActiveTab] = useState<RequestStatus>('pending');
  const [requests, setRequests] = useState<Record<RequestStatus, DeliveryRequest[]>>({
    pending: [],
    processing: [],
    approved: [],
    rejected: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; requestId: number | null }>({
    isOpen: false,
    requestId: null,
  });

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

  const fetchRequests = useCallback(async (status?: RequestStatus) => {
    const statusesToFetch = status ? [status] : tabs.map((t) => t.value);
    if (!status) setIsLoading(true);

    for (const s of statusesToFetch) {
      try {
        const data = await warehouseApi.getDeliveryRequests(s);
        const filteredData = data.map(req => ({
          ...req,
          items: typeof req.items === 'string' ? JSON.parse(req.items) : req.items,
        }));
        setRequests((prev) => ({ ...prev, [s]: filteredData }));
      } catch (error) {
        console.error(`Failed to fetch ${s} requests:`, error);
        toast.error(`Failed to load ${s} requests.`);
      }
    }

    if (!status) setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    const interval = setInterval(() => fetchRequests(), 10000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleAccept = async (id: number) => {
    try {
      setActionLoading(id);
      await warehouseApi.acceptRequest(id);
      toast.success(`Request #${id} accepted and moved to processing`);
      fetchRequests();
    } catch (error) {
      console.error('Failed to accept request:', error);
      toast.error('Failed to accept request. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      setActionLoading(id);
      await warehouseApi.approveRequest(id);
      toast.success(`Request #${id} approved successfully`);
      fetchRequests();
    } catch (error) {
      console.error('Failed to approve request:', error);
      toast.error('Failed to approve request. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectClick = (id: number) => {
    setRejectModal({ isOpen: true, requestId: id });
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectModal.requestId) return;
    
    try {
      setActionLoading(rejectModal.requestId);
      await warehouseApi.rejectRequest(rejectModal.requestId, { reason });
      toast.success(`Request #${rejectModal.requestId} rejected`);
      setRejectModal({ isOpen: false, requestId: null });
      fetchRequests();
    } catch (error) {
      console.error('Failed to reject request:', error);
      toast.error('Failed to reject request. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-warehouse">
              <Warehouse className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Warehouse Portal</h1>
              <p className="text-sm text-muted-foreground">Inventory Management • (connected to Ilias Nuriev)</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRequests()}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              Connected to 26.242.135.113:8000
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RequestStatus)}>
          <TabsList className="mb-6 grid w-full grid-cols-4">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                {tab.icon}
                {tab.label}
                <Badge
                  variant={requests[tab.value].length > 0 ? 'default' : 'secondary'}
                  className="ml-1"
                >
                  {requests[tab.value].length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-64 animate-pulse rounded-lg bg-secondary" />
                  ))}
                </div>
              ) : requests[tab.value].length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
                  <Package className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium text-muted-foreground">
                    No {tab.label.toLowerCase()} requests
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {requests[tab.value].map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onAccept={() => handleAccept(request.id)}
                      onApprove={() => handleApprove(request.id)}
                      onReject={() => handleRejectClick(request.id)}
                      isLoading={actionLoading === request.id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <RejectModal
        isOpen={rejectModal.isOpen}
        onClose={() => setRejectModal({ isOpen: false, requestId: null })}
        onConfirm={handleRejectConfirm}
        isLoading={actionLoading === rejectModal.requestId}
        requestId={rejectModal.requestId ?? 0}
      />
    </div>
  );
}
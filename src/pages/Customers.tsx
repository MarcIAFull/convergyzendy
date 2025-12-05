import { useEffect, useState } from 'react';
import { useRestaurantGuard } from '@/hooks/useRestaurantGuard';
import { useCustomersStore } from '@/stores/customersStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Users, 
  Phone, 
  DollarSign, 
  ShoppingBag, 
  Calendar,
  TrendingUp,
  Search,
  Star,
  Clock,
  MessageSquare,
  Package
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const Customers = () => {
  const { restaurant } = useRestaurantGuard();
  const {
    customers,
    selectedCustomer,
    customerOrders,
    customerRecoveryAttempts,
    loading,
    loadingOrders,
    filter,
    fetchCustomers,
    fetchCustomerDetails,
    setFilter,
    clearSelectedCustomer,
  } = useCustomersStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (restaurant?.id) {
      fetchCustomers(restaurant.id);
    }
  }, [restaurant?.id, fetchCustomers]);

  const handleCustomerClick = (phone: string) => {
    if (restaurant?.id) {
      fetchCustomerDetails(phone, restaurant.id);
      setSheetOpen(true);
    }
  };

  const handleSheetClose = () => {
    setSheetOpen(false);
    setTimeout(() => clearSelectedCustomer(), 300);
  };

  const getFilteredCustomers = () => {
    let filtered = customers;

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.phone.includes(searchQuery) ||
        c.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply filter
    if (filter === 'frequent') {
      filtered = filtered.filter(c => c.order_count >= 5);
    } else if (filter === 'inactive') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filtered = filtered.filter(c => 
        c.last_interaction_at && new Date(c.last_interaction_at) < thirtyDaysAgo
      );
    } else if (filter === 'high_value') {
      filtered = filtered.filter(c => c.average_ticket >= 20);
    }

    return filtered;
  };

  const filteredCustomers = getFilteredCustomers();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-primary/10 text-primary';
      case 'preparing':
        return 'bg-warning/10 text-warning';
      case 'out_for_delivery':
        return 'bg-info/10 text-info';
      case 'completed':
        return 'bg-success/10 text-success';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRecoveryStatusColor = (status: string) => {
    switch (status) {
      case 'recovered':
        return 'bg-success/10 text-success';
      case 'pending':
      case 'sent':
        return 'bg-warning/10 text-warning';
      case 'failed':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-4 mb-6">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground">Customer Insights</h1>
        <p className="text-muted-foreground mt-2">
          Understand your customers and their ordering behavior
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="frequent">Frequent</TabsTrigger>
            <TabsTrigger value="high_value">High Value</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Customer List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => (
          <Card
            key={customer.phone}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleCustomerClick(customer.phone)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {customer.name || 'Unnamed Customer'}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <Phone className="h-3 w-3" />
                    {customer.phone}
                  </CardDescription>
                </div>
                {customer.order_count >= 10 && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    <Star className="h-3 w-3 mr-1" />
                    VIP
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Orders</p>
                    <p className="font-semibold text-foreground">{customer.order_count}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Avg Ticket</p>
                    <p className="font-semibold text-foreground">€{customer.average_ticket.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm pt-2 border-t border-border">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Total Spent:</span>
                <span className="font-bold text-primary">€{customer.total_spent.toFixed(2)}</span>
              </div>
              {customer.last_interaction_at && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last order {formatDistanceToNow(new Date(customer.last_interaction_at), { addSuffix: true })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredCustomers.length === 0 && (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No customers found</h3>
                <p className="text-muted-foreground text-center">
                  {searchQuery ? 'Try a different search term' : 'Customers will appear here once they place orders'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Customer Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={handleSheetClose}>
        <SheetContent className="sm:max-w-2xl w-full overflow-y-auto">
          {selectedCustomer && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {selectedCustomer.name || 'Unnamed Customer'}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {selectedCustomer.phone}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Customer Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs">Total Orders</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-foreground">{selectedCustomer.order_count}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs">Total Spent</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">€{selectedCustomer.total_spent.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs">Avg Ticket</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-foreground">€{selectedCustomer.average_ticket.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs">Frequency</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-foreground">
                        {selectedCustomer.order_frequency_days ? `${selectedCustomer.order_frequency_days}d` : 'N/A'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Preferred Items */}
                {selectedCustomer.preferred_items && selectedCustomer.preferred_items.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      Preferred Products
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCustomer.preferred_items.map((item: any, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          {typeof item === 'string' ? item : item.name || 'Unknown'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Order History */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Order History ({customerOrders.length})
                  </h3>
                  {loadingOrders ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                      ))}
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        {customerOrders.map((order) => (
                          <Card key={order.id}>
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">
                                    {format(new Date(order.created_at), 'dd MMM yyyy, HH:mm')}
                                  </span>
                                </div>
                                <Badge className={getStatusColor(order.status)}>
                                  {order.status}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <div className="space-y-1">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">
                                      {item.quantity}x {item.product_name}
                                    </span>
                                    <span className="font-medium">
                                      €{(item.price * item.quantity).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <Separator />
                              <div className="flex justify-between font-semibold">
                                <span>Total</span>
                                <span className="text-primary">€{order.total_amount.toFixed(2)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <p className="truncate">📍 {order.delivery_address}</p>
                                <p>💳 {order.payment_method}</p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {customerOrders.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">No orders yet</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* Recovery Attempts */}
                {customerRecoveryAttempts.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Recovery Attempts ({customerRecoveryAttempts.length})
                      </h3>
                      <div className="space-y-2">
                        {customerRecoveryAttempts.map((attempt) => (
                          <Card key={attempt.id}>
                            <CardContent className="pt-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <Badge className={getRecoveryStatusColor(attempt.status)}>
                                  {attempt.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(attempt.created_at), 'dd MMM, HH:mm')}
                                </span>
                              </div>
                              <p className="text-sm">
                                <span className="font-medium">Type:</span> {attempt.recovery_type}
                              </p>
                              {attempt.cart_value && (
                                <p className="text-sm">
                                  <span className="font-medium">Cart Value:</span> €{attempt.cart_value.toFixed(2)}
                                </p>
                              )}
                              {attempt.message_sent && (
                                <p className="text-xs text-muted-foreground italic">
                                  "{attempt.message_sent}"
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Customers;

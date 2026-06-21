import { Link } from "wouter";
import { 
  useGetCustomer,
  useGetPersonalizedRecommendations,
  getGetCustomerQueryKey,
  getGetPersonalizedRecommendationsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, User, Mail, Calendar, ShoppingBag, TrendingUp, Target, Sparkles } from "lucide-react";
import { format } from "date-fns";

export default function CustomerDetail({ id }: { id: string }) {
  const customerId = parseInt(id, 10);
  
  const { data: customer, isLoading } = useGetCustomer(customerId, {
    query: { enabled: !!customerId, queryKey: getGetCustomerQueryKey(customerId) }
  });

  const { data: recs, isLoading: isLoadingRecs } = useGetPersonalizedRecommendations(customerId, {
    query: { enabled: !!customerId, queryKey: getGetPersonalizedRecommendationsQueryKey(customerId) }
  });

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
  if (!customer) return <div>Customer not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/customers"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2 text-sm mt-1">
            <Mail className="w-4 h-4" /> {customer.email}
            <span className="mx-2">•</span>
            <Calendar className="w-4 h-4" /> Joined {format(new Date(customer.createdAt), 'MMM yyyy')}
          </p>
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className="text-sm px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {customer.segment}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Total Orders" value={customer.totalOrders} icon={ShoppingBag} />
        <MetricCard title="Lifetime Value" value={formatCurrency(customer.totalSpent)} icon={TrendingUp} />
        <MetricCard title="Predicted CLV" value={customer.clv ? formatCurrency(customer.clv) : '-'} icon={Target} className="bg-primary/5 border-primary/20" />
        <MetricCard title="Last Order" value={customer.lastOrderDate ? format(new Date(customer.lastOrderDate), 'MMM dd, yyyy') : '-'} icon={Calendar} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.recentOrders?.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">#{order.id}</TableCell>
                      <TableCell>{format(new Date(order.orderDate), 'MMM dd, yyyy')}</TableCell>
                      <TableCell><Badge variant="secondary">{order.status || 'Completed'}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(order.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
                  {(!customer.recentOrders || customer.recentOrders.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground h-24">No recent orders</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">RFM Score</CardTitle>
              <CardDescription>Recency, Frequency, Monetary</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Recency</span>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => <div key={i} className={`h-2 w-6 rounded-sm ${i <= customer.rfmScore.recency ? 'bg-primary' : 'bg-muted'}`} />)}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Frequency</span>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => <div key={i} className={`h-2 w-6 rounded-sm ${i <= customer.rfmScore.frequency ? 'bg-primary' : 'bg-muted'}`} />)}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Monetary</span>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => <div key={i} className={`h-2 w-6 rounded-sm ${i <= customer.rfmScore.monetary ? 'bg-primary' : 'bg-muted'}`} />)}
                  </div>
                </div>
                <div className="pt-4 border-t mt-4 text-center">
                  <div className="text-3xl font-bold font-mono text-primary">{customer.rfmScore.total} <span className="text-sm text-muted-foreground">/ 15</span></div>
                  <div className="text-xs text-muted-foreground mt-1">Total Score</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center text-primary"><Sparkles className="w-4 h-4 mr-2" /> Next Best Offers</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingRecs ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : recs && recs.length > 0 ? (
                <div className="space-y-4">
                  {recs.slice(0, 4).map(rec => (
                    <div key={rec.id} className="flex justify-between items-center text-sm">
                      <div>
                        <Link href={`/products/${rec.id}`} className="font-medium hover:underline hover:text-primary">{rec.name}</Link>
                        <div className="text-xs text-muted-foreground line-clamp-1">{rec.reason}</div>
                      </div>
                      <div className="font-mono text-right shrink-0 ml-2">{formatCurrency(rec.price)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">No recommendations available</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, className = "" }: { title: string, value: string | number, icon: any, className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">{title}</h3>
          <Icon className="h-4 w-4 text-muted-foreground opacity-50" />
        </div>
        <div className="text-2xl font-bold font-mono">{value}</div>
      </CardContent>
    </Card>
  );
}

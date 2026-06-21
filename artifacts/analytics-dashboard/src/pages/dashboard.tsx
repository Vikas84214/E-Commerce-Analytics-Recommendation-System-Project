import { useState } from "react";
import { Link } from "wouter";
import { 
  useGetAnalyticsSummary, 
  useGetRevenueAnalytics,
  useGetRecentActivity,
  useGetTopSellingProducts
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { 
  DollarSign, ShoppingCart, Users, Package, ArrowUpRight, ArrowDownRight, Activity 
} from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetAnalyticsSummary();
  const { data: revenue, isLoading: isLoadingRevenue } = useGetRevenueAnalytics();
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity();
  const { data: topProducts, isLoading: isLoadingTopProducts } = useGetTopSellingProducts({ limit: 5 });

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your business performance.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          title="Total Revenue" 
          value={summary ? formatCurrency(summary.totalRevenue) : null}
          growth={summary?.revenueGrowth}
          icon={DollarSign}
          isLoading={isLoadingSummary}
        />
        <MetricCard 
          title="Orders" 
          value={summary ? formatNumber(summary.totalOrders) : null}
          growth={summary?.ordersGrowth}
          icon={ShoppingCart}
          isLoading={isLoadingSummary}
        />
        <MetricCard 
          title="Customers" 
          value={summary ? formatNumber(summary.totalCustomers) : null}
          growth={summary?.customersGrowth}
          icon={Users}
          isLoading={isLoadingSummary}
        />
        <MetricCard 
          title="Avg Order Value" 
          value={summary ? formatCurrency(summary.avgOrderValue) : null}
          growth={undefined}
          icon={Package}
          isLoading={isLoadingSummary}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Daily revenue for the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRevenue ? (
              <Skeleton className="h-[300px] w-full" />
            ) : revenue && revenue.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(new Date(val), 'MMM dd')}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      tickFormatter={(val) => `$${val / 1000}k`}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dx={-10}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                      labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground border border-dashed rounded-md">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions across your store</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingActivity ? (
              <div className="space-y-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex gap-3"><Skeleton className="h-8 w-8 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-[200px]" /><Skeleton className="h-3 w-[100px]" /></div></div>
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-4">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 text-sm">
                    <div className="p-2 bg-primary/10 text-primary rounded-full mt-0.5">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <div className="flex gap-2 text-muted-foreground text-xs">
                        <span>{format(new Date(item.timestamp), 'MMM dd, HH:mm')}</span>
                        {item.amount && <span className="text-primary font-medium">{formatCurrency(item.amount)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No recent activity
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>Highest revenue generators</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTopProducts ? (
              <div className="space-y-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : topProducts && topProducts.length > 0 ? (
              <div className="space-y-4">
                {topProducts.map((product, i) => (
                  <div key={product.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 text-center text-muted-foreground font-mono text-sm">{i + 1}</div>
                      <div>
                        <Link href={`/products/${product.id}`} className="font-medium hover:underline">{product.name}</Link>
                        <p className="text-xs text-muted-foreground">{product.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(product.revenue)}</div>
                      <div className="text-xs text-muted-foreground">{product.totalSold} sold</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No product data
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, growth, icon: Icon, isLoading }: { title: string, value: React.ReactNode, growth?: number, icon: any, isLoading: boolean }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">{title}</h3>
          <div className="p-2 bg-primary/10 rounded-md">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        
        {isLoading ? (
          <Skeleton className="h-8 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold font-mono">{value}</div>
        )}
        
        {growth !== undefined && (
          <div className="mt-2 text-xs flex items-center">
            {growth > 0 ? (
              <span className="text-emerald-500 flex items-center font-medium">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                +{growth.toFixed(1)}%
              </span>
            ) : growth < 0 ? (
              <span className="text-destructive flex items-center font-medium">
                <ArrowDownRight className="h-3 w-3 mr-1" />
                {growth.toFixed(1)}%
              </span>
            ) : (
              <span className="text-muted-foreground">0.0%</span>
            )}
            <span className="text-muted-foreground ml-1">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

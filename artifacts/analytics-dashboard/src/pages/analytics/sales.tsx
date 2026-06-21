import { useState } from "react";
import { 
  useGetRevenueAnalytics,
  useGetSalesReport,
  useGetProfitAnalysis
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

export default function AnalyticsSales() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  
  const { data: revenue, isLoading: isRevLoading } = useGetRevenueAnalytics({ period });
  const { data: report, isLoading: isRepLoading } = useGetSalesReport({ period: period === "daily" ? "daily" : "monthly" });
  const { data: profit, isLoading: isProfLoading } = useGetProfitAnalysis();

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Analytics</h1>
          <p className="text-muted-foreground">Deep dive into revenue and profit metrics.</p>
        </div>
        <Tabs value={period} onValueChange={(v: any) => setPeriod(v)}>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Orders</CardTitle>
          <CardDescription>Historical trend analysis</CardDescription>
        </CardHeader>
        <CardContent>
          {isRevLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : revenue ? (
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenue} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(new Date(val), period === 'monthly' ? 'MMM yyyy' : 'MMM dd')}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    yAxisId="left"
                    tickFormatter={(val) => `$${val / 1000}k`}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" name="Revenue" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" name="Orders" dataKey="orders" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profit Analysis</CardTitle>
            <CardDescription>Gross margin breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {isProfLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : profit ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 border-b pb-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Gross Profit</p>
                    <p className="text-3xl font-bold font-mono text-emerald-500">{formatCurrency(profit.grossProfit)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Gross Margin</p>
                    <p className="text-3xl font-bold font-mono">{profit.grossMargin.toFixed(1)}%</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-4">Profit by Category</h4>
                  <div className="space-y-4">
                    {profit.byCategory.map((cat, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{cat.category}</span>
                          <span className="font-mono">{formatCurrency(cat.profit)} ({cat.margin.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(cat.margin, 100)}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales Report Table</CardTitle>
            <CardDescription>Tabular data for current period</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isRepLoading ? (
              <div className="p-6"><Skeleton className="h-[200px] w-full" /></div>
            ) : report ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">AOV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{format(new Date(row.period), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(row.revenue)}</TableCell>
                      <TableCell className="text-right font-mono">{row.orders}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(row.avgOrderValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

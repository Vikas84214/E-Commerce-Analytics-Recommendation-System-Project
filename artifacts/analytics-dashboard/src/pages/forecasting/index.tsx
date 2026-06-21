import { 
  useGetSalesForecast,
  useGetInventoryForecast
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart
} from "recharts";
import { format } from "date-fns";
import { AlertTriangle, TrendingUp, Package } from "lucide-react";

export default function Forecasting() {
  const { data: salesForecast, isLoading: isSalesLoading } = useGetSalesForecast({ periods: 30, granularity: "daily" });
  const { data: invForecast, isLoading: isInvLoading } = useGetInventoryForecast();

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Predictive Forecasting</h1>
        <p className="text-muted-foreground">AI-driven sales and inventory projections.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-primary" /> 30-Day Sales Forecast</CardTitle>
          <CardDescription>Expected revenue with 95% confidence intervals</CardDescription>
        </CardHeader>
        <CardContent>
          {isSalesLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : salesForecast ? (
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={salesForecast} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                  />
                  <Tooltip 
                    labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-card border border-border p-3 rounded-lg shadow-lg">
                            <p className="font-medium mb-2">{format(new Date(label), 'MMM dd, yyyy')}</p>
                            {payload.map((entry: any, index: number) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-muted-foreground capitalize">{entry.name}:</span>
                                <span className="font-mono font-medium">{formatCurrency(entry.value)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="upper" 
                    stroke="none" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.1} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="lower" 
                    stroke="none" 
                    fill="hsl(var(--background))" 
                    fillOpacity={1} 
                  />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="predicted" name="Predicted" stroke="hsl(var(--primary))" strokeWidth={3} strokeDasharray="5 5" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Package className="w-5 h-5 mr-2 text-orange-500" /> Inventory Stockout Risk</CardTitle>
          <CardDescription>Items predicted to run out of stock soon based on velocity</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Predicted Demand</TableHead>
                  <TableHead className="text-right">Reorder Point</TableHead>
                  <TableHead>Est. Stockout</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isInvLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : invForecast && invForecast.length > 0 ? (
                  invForecast.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-right font-mono">{item.currentStock}</TableCell>
                      <TableCell className="text-right font-mono text-primary">+{item.predictedDemand}/mo</TableCell>
                      <TableCell className="text-right font-mono">{item.reorderPoint}</TableCell>
                      <TableCell>
                        {item.daysUntilStockout !== null && item.daysUntilStockout <= 14 ? (
                          <Badge variant="destructive" className="flex items-center w-fit">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {item.daysUntilStockout} days
                          </Badge>
                        ) : (
                          <Badge variant="outline">{item.daysUntilStockout} days</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground italic">
                        {item.recommendation}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No critical inventory alerts
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

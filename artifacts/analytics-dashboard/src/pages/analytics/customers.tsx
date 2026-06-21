import { 
  useGetCustomerSegments,
  useGetRetentionMetrics
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from "recharts";
import { Users, UserCheck, RefreshCcw, UserMinus } from "lucide-react";

export default function AnalyticsCustomers() {
  const { data: segments, isLoading: isSegLoading } = useGetCustomerSegments();
  const { data: retention, isLoading: isRetLoading } = useGetRetentionMetrics();

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customer Analytics</h1>
        <p className="text-muted-foreground">Understand your user base and retention.</p>
      </div>

      {isRetLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : retention ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="Retention Rate" 
            value={`${retention.retentionRate.toFixed(1)}%`}
            icon={UserCheck} 
            color="text-emerald-500"
          />
          <MetricCard 
            title="Churn Rate" 
            value={`${retention.churnRate.toFixed(1)}%`}
            icon={UserMinus} 
            color="text-destructive"
          />
          <MetricCard 
            title="Repeat Customer Rate" 
            value={`${retention.repeatCustomerRate.toFixed(1)}%`}
            icon={RefreshCcw} 
            color="text-primary"
          />
          <MetricCard 
            title="Avg Days Between Orders" 
            value={retention.avgDaysBetweenOrders.toFixed(0)}
            icon={Users} 
            color="text-muted-foreground"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Segmentation</CardTitle>
            <CardDescription>Based on RFM modeling</CardDescription>
          </CardHeader>
          <CardContent>
            {isSegLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : segments ? (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={segments}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="segment"
                    >
                      {segments.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [value, "Customers"]}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Segment Value</CardTitle>
            <CardDescription>Average CLV by segment</CardDescription>
          </CardHeader>
          <CardContent>
            {isSegLoading ? (
              <div className="space-y-4">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : segments ? (
              <div className="space-y-5 mt-4">
                {segments.map((seg, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium flex items-center">
                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        {seg.segment}
                      </span>
                      <span className="font-mono text-primary">${Math.round(seg.avgClv)} avg CLV</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${Math.max(seg.percentage, 5)}%`, backgroundColor: COLORS[i % COLORS.length] }}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">{title}</h3>
          <div className="p-2 bg-muted/50 rounded-md">
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
        </div>
        <div className="text-3xl font-bold font-mono">{value}</div>
      </CardContent>
    </Card>
  );
}

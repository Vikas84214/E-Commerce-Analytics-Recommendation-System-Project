import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListCustomers } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, Users, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function Customers() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  const { data: customersData, isLoading } = useListCustomers({
    search: debouncedSearch || undefined,
    limit: 50,
  });

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const getSegmentColor = (segment: string) => {
    switch(segment.toLowerCase()) {
      case 'champions': return 'bg-primary/20 text-primary border-primary/30';
      case 'loyal': return 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30 dark:text-emerald-400';
      case 'at risk': return 'bg-orange-500/20 text-orange-600 border-orange-500/30 dark:text-orange-400';
      case 'lost': return 'bg-destructive/20 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your user base and view segments.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search customers..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                  <TableHead className="text-right">CLV</TableHead>
                  <TableHead className="text-right">Last Order</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : customersData?.items && customersData.items.length > 0 ? (
                  customersData.items.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="font-medium">
                          <Link href={`/customers/${customer.id}`} className="hover:underline text-primary">
                            {customer.name}
                          </Link>
                        </div>
                        <div className="text-xs text-muted-foreground">{customer.email}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSegmentColor(customer.segment)}`}>
                          {customer.segment}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">{customer.totalOrders}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(customer.totalSpent)}</TableCell>
                      <TableCell className="text-right font-mono text-primary">{customer.clv ? formatCurrency(customer.clv) : '-'}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {customer.lastOrderDate ? format(new Date(customer.lastOrderDate), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/customers/${customer.id}`}><ArrowRight className="h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Users className="h-8 w-8 mb-2 opacity-50" />
                        No customers found.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {customersData?.total && (
            <div className="p-4 border-t text-sm text-muted-foreground flex justify-between items-center">
              <div>Showing {customersData.items.length} of {customersData.total} customers</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

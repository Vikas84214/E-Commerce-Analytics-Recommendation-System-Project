import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { 
  useGetProduct,
  useUpdateProduct,
  useDeleteProduct,
  useGetSimilarProducts,
  useGetFrequentlyBoughtTogether,
  useGetDemandForecast,
  getGetProductQueryKey,
  getGetSimilarProductsQueryKey,
  getGetFrequentlyBoughtTogetherQueryKey,
  getGetDemandForecastQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Edit, Save, Trash2, Box, TrendingUp, PackageSearch, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export default function ProductDetail({ id }: { id: string }) {
  const productId = parseInt(id, 10);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useGetProduct(productId, { 
    query: { enabled: !!productId, queryKey: getGetProductQueryKey(productId) } 
  });
  
  const { data: similarProducts } = useGetSimilarProducts(productId, {
    query: { enabled: !!productId, queryKey: getGetSimilarProductsQueryKey(productId) }
  });
  
  const { data: boughtTogether } = useGetFrequentlyBoughtTogether(productId, {
    query: { enabled: !!productId, queryKey: getGetFrequentlyBoughtTogetherQueryKey(productId) }
  });

  const { data: demandForecast } = useGetDemandForecast(productId, {
    query: { enabled: !!productId, queryKey: getGetDemandForecastQueryKey(productId) }
  });

  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [editForm, setEditForm] = useState({
    name: "", category: "", price: 0, stock: 0, description: ""
  });

  useEffect(() => {
    if (product) {
      setEditForm({
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
        description: product.description || ""
      });
    }
  }, [product]);

  const handleSave = () => {
    updateProduct.mutate(
      { id: productId, data: editForm },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetProductQueryKey(productId), data);
          setIsEditing(false);
          toast({ title: "Product updated" });
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Update failed", description: err.message })
      }
    );
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!product) return <div>Product not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/products"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground font-mono text-sm">ID: {product.id} • {product.category}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} variant="outline"><Edit className="w-4 h-4 mr-2" /> Edit</Button>
          ) : (
            <Button onClick={handleSave} disabled={updateProduct.isPending}><Save className="w-4 h-4 mr-2" /> Save</Button>
          )}
          <Button variant="destructive" size="icon"><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input value={editForm.name} onChange={e => setEditForm(prev => ({...prev, name: e.target.value}))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Input value={editForm.category} onChange={e => setEditForm(prev => ({...prev, category: e.target.value}))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Price</label>
                    <Input type="number" value={editForm.price} onChange={e => setEditForm(prev => ({...prev, price: parseFloat(e.target.value)}))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Stock</label>
                    <Input type="number" value={editForm.stock} onChange={e => setEditForm(prev => ({...prev, stock: parseInt(e.target.value)}))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea value={editForm.description} onChange={e => setEditForm(prev => ({...prev, description: e.target.value}))} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Price</div>
                  <div className="text-2xl font-mono">{formatCurrency(product.price)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Stock Level</div>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-mono">{product.stock}</div>
                    <Badge variant={product.stock > 10 ? "outline" : "destructive"}>
                      {product.stock > 10 ? 'In Stock' : 'Low Stock'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Rating</div>
                  <div className="text-lg font-medium">{product.rating} / 5.0</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Added On</div>
                  <div className="text-lg">{product.createdAt ? format(new Date(product.createdAt), 'MMM dd, yyyy') : '-'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground mb-1">Description</div>
                  <p className="text-sm leading-relaxed">{product.description || "No description provided."}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Forecast / Insights */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center"><TrendingUp className="w-4 h-4 mr-2" /> Demand Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              {demandForecast ? (
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={demandForecast}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="predicted" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Loading forecast...</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center"><PackageSearch className="w-4 h-4 mr-2 text-primary" /> Frequently Bought Together</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {boughtTogether?.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <Link href={`/products/${item.id}`} className="hover:underline hover:text-primary truncate pr-4">{item.name}</Link>
                    <span className="font-mono text-muted-foreground shrink-0">{formatCurrency(item.price)}</span>
                  </div>
                ))}
                {!boughtTogether?.length && <div className="text-sm text-muted-foreground">Not enough data</div>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

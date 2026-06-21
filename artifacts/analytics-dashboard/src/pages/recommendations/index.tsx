import { Link } from "wouter";
import { 
  useGetTrendingProducts,
  useGetPersonalizedRecommendations
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, TrendingUp, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Recommendations() {
  const DEMO_USER_ID = 1;
  
  const { data: trending, isLoading: isTrendLoading } = useGetTrendingProducts({ limit: 8 });
  const { data: personal, isLoading: isPersLoading } = useGetPersonalizedRecommendations(DEMO_USER_ID);

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Recommendations</h1>
        <p className="text-muted-foreground">Discover trending items and personalized suggestions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center text-primary">
              <Sparkles className="w-5 h-5 mr-2" /> 
              Personalized for User #{DEMO_USER_ID}
            </CardTitle>
            <CardDescription>Collaborative filtering based on purchase history</CardDescription>
          </CardHeader>
          <CardContent>
            {isPersLoading ? (
              <div className="space-y-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : personal && personal.length > 0 ? (
              <div className="grid gap-4">
                {personal.map((item) => (
                  <div key={item.id} className="bg-card border rounded-lg p-4 flex gap-4 items-center">
                    <div className="h-12 w-12 bg-primary/10 rounded flex items-center justify-center text-primary font-bold">
                      {Math.round(item.score * 100)}%
                    </div>
                    <div className="flex-1">
                      <Link href={`/products/${item.id}`} className="font-semibold hover:underline">{item.name}</Link>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.reason}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-medium">{formatCurrency(item.price)}</div>
                      <Badge variant="secondary" className="mt-1 text-[10px]">{item.category}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">No recommendations generated</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-chart-2" /> 
              Trending Catalog-Wide
            </CardTitle>
            <CardDescription>Products with sudden spike in velocity</CardDescription>
          </CardHeader>
          <CardContent>
            {isTrendLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
              </div>
            ) : trending && trending.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {trending.map((item) => (
                  <Link key={item.id} href={`/products/${item.id}`}>
                    <div className="group border rounded-lg p-4 h-full hover:border-primary transition-colors hover:shadow-md">
                      <Badge variant="outline" className="mb-2 bg-chart-2/10 text-chart-2 border-chart-2/30">Trending</Badge>
                      <h4 className="font-medium group-hover:text-primary transition-colors line-clamp-2">{item.name}</h4>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="font-mono text-sm">{formatCurrency(item.price)}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">No trending products</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

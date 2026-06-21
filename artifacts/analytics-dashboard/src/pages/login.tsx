import { useState } from "react";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLogin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { QueryClient, useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "admin@example.com",
      password: "password123",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(["/api/auth/me"], data.user);
          toast({
            title: "Welcome back",
            description: "Successfully logged in.",
          });
          setLocation("/dashboard");
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Login failed",
            description: error.message || "Invalid credentials",
          });
        },
      }
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex flex-col justify-center items-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="p-3 bg-primary/10 rounded-xl mb-2">
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">CommerceIQ</h1>
            <p className="text-muted-foreground text-sm">
              Sign in to your analytics command center
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="admin@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link href="#" className="text-xs text-primary hover:underline">
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Sign In
              </Button>
            </form>
          </Form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link href="/register" className="text-primary font-medium hover:underline">
              Create one
            </Link>
          </div>
        </div>
      </div>
      
      <div className="hidden lg:flex bg-sidebar flex-col justify-between p-12 text-sidebar-foreground">
        <div>
          <h2 className="text-4xl font-bold font-mono tracking-tighter mb-4">DATA IS YOUR MOAT.</h2>
          <p className="text-xl text-sidebar-foreground/70 font-mono">
            Understand revenue, optimize inventory, know your customers.
          </p>
        </div>
        <div className="space-y-4">
          <div className="p-6 bg-card/10 backdrop-blur rounded-lg border border-sidebar-border">
            <p className="italic text-lg mb-4">"The insight density in this dashboard changed how we run our operations entirely. We stopped guessing and started knowing."</p>
            <div className="font-semibold">- Director of E-Commerce, ACME Corp</div>
          </div>
        </div>
      </div>
    </div>
  );
}

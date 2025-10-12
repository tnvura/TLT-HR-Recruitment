import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/talaadthai-logo.png";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    console.log("=== LOGIN ATTEMPT ===");
    console.log("Email:", email);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log("Login response:", { data, error });

      if (error) {
        console.error("❌ Login failed:", error);
        throw error;
      }

      console.log("✅ Login successful");
      console.log("User ID:", data.user?.id);
      console.log("User email:", data.user?.email);
      console.log("Session:", data.session ? "EXISTS" : "MISSING");

      // Check if user has role
      const { data: roleData, error: roleError } = await (supabase as any)
        .from("user_roles")
        .select("*")
        .eq("user_id", data.user.id)
        .single();

      console.log("User role check:", { roleData, roleError });

      if (!roleData) {
        console.error("❌ No role found for user");
        console.error("   User ID:", data.user.id);
        console.error("   User email:", data.user.email);
      } else {
        console.log("✅ User has role:", roleData.role);
      }

      toast({
        title: "Success",
        description: "Logged in successfully",
      });

      console.log("Navigating to /candidates...");
      navigate("/candidates");
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}/candidates`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <img src={logo} alt="TALAADTHAI" className="h-24 w-auto mb-2" />
      </header>

      {/* Login Form */}
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-card rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center mb-8 text-foreground">Sign In</h1>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12"
              />
            </div>

            <Button type="submit" className="w-full h-12" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-sm text-muted-foreground">
              OR
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 bg-white hover:bg-gray-50 text-foreground border-border hover:shadow-md transition-shadow"
            onClick={handleMicrosoftLogin}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="11" height="11" fill="#F25022" />
              <rect x="12" y="0" width="11" height="11" fill="#7FBA00" />
              <rect x="0" y="12" width="11" height="11" fill="#00A4EF" />
              <rect x="12" y="12" width="11" height="11" fill="#FFB900" />
            </svg>
            Sign in with Microsoft
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Login;


"use client";

import { useState, type FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { LogIn, Mail, KeyRound } from "lucide-react";
import { usePageTitle } from "@/context/PageTitleContext";
import { useUserSession } from "@/context/UserSessionContext"; // To redirect if already logged in

export default function LoginPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Login";

  const router = useRouter();
  const { toast } = useToast();
  const { firebaseUser, authLoading } = useUserSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  useEffect(() => {
    // If auth is not loading and user is already logged in, redirect to dashboard
    if (!authLoading && firebaseUser) {
      router.replace("/");
    }
  }, [firebaseUser, authLoading, router]);


  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Success", description: "Logged in successfully!" });
      // Redirection will be handled by useEffect or a protected route mechanism later
      // For now, onAuthStateChanged in UserSessionContext will update the state,
      // and pages like Dashboard will react. Let's explicitly redirect here.
      router.push("/");
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Login Failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // If auth is loading, or user is already logged in (and about to be redirected by useEffect)
  // show a simple loading state to prevent login form flash.
  if (authLoading || firebaseUser) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center">
            <LogIn className="h-7 w-7 mr-2 text-primary" /> {pageSpecificTitle} to Dudh Dairy
          </CardTitle>
          <CardDescription>Enter your credentials to access your dairy dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center">
                <Mail className="h-4 w-4 mr-2 text-muted-foreground" /> Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center">
                <KeyRound className="h-4 w-4 mr-2 text-muted-foreground" /> Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
            {/* TODO: Add "Forgot Password?" and "Sign Up" links later */}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

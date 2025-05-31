
"use client";

import { useState, type FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { Mail, KeyRound, UserPlus, Building, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { createCompanyInFirestore, createUserProfileInFirestore } from "./actions";
import { usePageTitle } from "@/context/PageTitleContext";
import { useUserSession } from "@/context/UserSessionContext";

export default function SignupPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Create Account";
  
  const router = useRouter();
  const { toast } = useToast();
  const { firebaseUser, authLoading } = useUserSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  useEffect(() => {
    if (!authLoading && firebaseUser) {
      router.replace("/"); // Redirect to dashboard if already logged in
    }
  }, [firebaseUser, authLoading, router]);

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (!companyName.trim()) {
      toast({ title: "Error", description: "Company name is required.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("CLIENT: Firebase Auth user created:", user.uid);

      // 2. Update Firebase Auth profile (optional, for displayName)
      if (displayName.trim()) {
        await updateProfile(user, { displayName: displayName.trim() });
        console.log("CLIENT: Firebase Auth profile updated with displayName.");
      }

      // 3. Create Company in Firestore
      const companyResult = await createCompanyInFirestore(companyName.trim(), user.uid);
      if (!companyResult.success || !companyResult.companyId) {
        // Attempt to clean up Firebase Auth user if Firestore operations fail.
        // This is a best-effort and might need more robust handling (e.g., a cleanup function).
        await user.delete().catch(delErr => console.error("CLIENT: Failed to cleanup Firebase Auth user after Firestore company creation failure:", delErr));
        throw new Error(companyResult.error || "Failed to create company record.");
      }
      const companyId = companyResult.companyId;
      console.log("CLIENT: Company created in Firestore with ID:", companyId);

      // 4. Create User Profile in Firestore
      const userProfileResult = await createUserProfileInFirestore(
        user.uid,
        companyId,
        user.email!, // email will exist as user was just created
        displayName.trim() || null,
        'admin' // First user creating a company is an admin
      );

      if (!userProfileResult.success) {
         // Attempt to clean up. More robust cleanup might involve deleting the company doc too.
        await user.delete().catch(delErr => console.error("CLIENT: Failed to cleanup Firebase Auth user after Firestore user profile creation failure:", delErr));
        throw new Error(userProfileResult.error || "Failed to create user profile record.");
      }
      console.log("CLIENT: User profile created in Firestore.");

      toast({ title: "Account Created!", description: "Your account and company have been successfully created. Please log in." });
      router.push("/login");

    } catch (error: any) {
      console.error("CLIENT: Signup error:", error);
      let errorMessage = "An unknown error occurred during sign up.";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email address is already in use.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "The password is too weak. Please choose a stronger password.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Sign Up Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (authLoading || firebaseUser) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-10rem)] py-8">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center">
            <UserPlus className="h-7 w-7 mr-2 text-primary" /> {pageSpecificTitle}
          </CardTitle>
          <CardDescription>Create your Dudh Dairy account and set up your company.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="companyName" className="flex items-center"><Building className="h-4 w-4 mr-2 text-muted-foreground" />Company Name</Label>
              <Input id="companyName" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your Dairy's Name" required disabled={isLoading} />
            </div>
             <div className="space-y-1">
              <Label htmlFor="displayName" className="flex items-center"><UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />Your Name (Optional)</Label>
              <Input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g., John Doe" disabled={isLoading} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email" className="flex items-center"><Mail className="h-4 w-4 mr-2 text-muted-foreground" />Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required disabled={isLoading} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="flex items-center"><KeyRound className="h-4 w-4 mr-2 text-muted-foreground" />Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required disabled={isLoading} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="flex items-center"><KeyRound className="h-4 w-4 mr-2 text-muted-foreground" />Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required disabled={isLoading} />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Button variant="link" asChild className="px-0.5">
                <Link href="/login">Sign In</Link>
              </Button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { signInEmailOtp, verifyEmailOtp } from "@/lib/api-client";
import { BookOpen, ArrowRight, Loader2, Mail } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slowConnect, setSlowConnect] = useState(false);

  // If a request hangs for 6s+ (backend unreachable), surface a hint instead
  // of an endless spinner.
  useEffect(() => {
    if (!isLoading) {
      setSlowConnect(false);
      return;
    }
    const t = setTimeout(() => setSlowConnect(true), 6000);
    return () => clearTimeout(t);
  }, [isLoading]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      if (mode === "signup" && !searchParams.get("returnTo")) {
        navigate(`/dashboard?new=1`, { replace: true });
      } else {
        navigate(redirect);
      }
    }
  }, [authLoading, isAuthenticated, navigate, redirect, mode, searchParams]);

  const switchMode = (next: "signin" | "signup") => {
    setMode(next);
    setStep("signIn");
    setOtp("");
    setError(null);
  };

  const isSignUp = mode === "signup";

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const email = formData.get("email") as string;
      await signInEmailOtp(email);
      setStep({ email });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Couldn't send the verification code. Give it another try.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await verifyEmailOtp(formData.get("email") as string, formData.get("code") as string);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("That code didn't work. Mind checking and trying again?");
      setIsLoading(false);
      setOtp("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-teal-light/10 to-cream/30">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="flex items-center justify-center h-full flex-col w-full max-w-sm">
          {/* Brand */}
          <div className="flex items-center gap-2 mb-8">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-lg">Soft Ledger</span>
          </div>

          <Card className="w-full border-border/30 soft-shadow-md">
            {step === "signIn" ? (
              <>
                {/* Mode toggle */}
                <div className="flex p-1 bg-muted/60 rounded-xl mb-4">
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      !isSignUp
                        ? "bg-card text-foreground soft-shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      isSignUp
                        ? "bg-card text-foreground soft-shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sign up
                  </button>
                </div>

                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl font-semibold">
                    {isSignUp ? "Create your account" : "Welcome back!"}
                  </CardTitle>
                  <CardDescription>
                    {isSignUp
                      ? "Enter your email and we'll send you a code to get set up"
                      : "Enter your email and we'll send you a sign-in code"}
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent>
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          name="email"
                          placeholder="name@example.com"
                          type="email"
                          className="pl-9 h-12 rounded-xl"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        size="icon"
                        disabled={isLoading}
                        className="h-12 w-12 rounded-xl bg-primary shrink-0"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-error">{error}</p>
                    )}
                    {slowConnect && (
                      <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
                        Taking unusually long — the app can&apos;t reach its
                        database. Reload the page; if it keeps happening,
                        restart the app from the dashboard.
                      </p>
                    )}
                    <p className="mt-4 text-xs text-muted-foreground text-center">
                      {isSignUp ? (
                        <>
                          Already have an account?{" "}
                          <button
                            type="button"
                            onClick={() => switchMode("signin")}
                            className="text-primary font-medium cursor-pointer hover:underline"
                          >
                            Sign in
                          </button>
                        </>
                      ) : (
                        <>
                          New to Soft Ledger?{" "}
                          <button
                            type="button"
                            onClick={() => switchMode("signup")}
                            className="text-primary font-medium cursor-pointer hover:underline"
                          >
                            Create an account
                          </button>
                        </>
                      )}
                    </p>
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl font-semibold">
                    {isSignUp ? "Verify your email" : "Check your inbox"}
                  </CardTitle>
                  <CardDescription>
                    We sent a code to <span className="font-medium text-foreground">{step.email}</span>
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-2">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />

                    <div className="flex justify-center py-2">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            otp.length === 6 &&
                            !isLoading
                          ) {
                            const form = (e.target as HTMLElement).closest(
                              "form",
                            );
                            if (form) {
                              form.requestSubmit();
                            }
                          }
                        }}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot key={index} index={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-error text-center">
                        {error}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground text-center mt-4">
                      Didn&apos;t get a code?{" "}
                      <Button
                        variant="link"
                        className="p-0 h-auto text-primary"
                        onClick={() => setStep("signIn")}
                      >
                        Try a different email
                      </Button>
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col gap-2 px-6 pb-6">
                    <Button
                      type="submit"
                      className="w-full h-12 rounded-xl bg-primary font-semibold"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          Let&apos;s go
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="w-full text-muted-foreground"
                    >
                      Use a different email
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}
          </Card>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            Secured by{" "}
            <a
              href="https://freebuff.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary transition-colors"
            >
              freebuff.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}

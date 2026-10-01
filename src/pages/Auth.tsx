import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { ArrowRight, Loader2, Mail, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth({
  to,
  fallback = "/dashboard",
}: {
  to: string | null;
  fallback?: string;
}) {
  if (to?.startsWith("/") && !to.startsWith("//")) {
    return to;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps) {
  const { isLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth({
    to: searchParams.get("returnTo"),
    fallback: redirectAfterAuth,
  });

  const [step, setStep] = useState<"signin" | { email: string }>("signin");
  const [otp, setOtp] = useState("");
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [isLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingState(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget as HTMLFormElement);
      await signIn("email-otp", formData);
      const email = form.get("email") as string;
      setStep({ email });
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to send verification code"
      );
    } finally {
      setIsLoadingState(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingState(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget as HTMLFormElement);
      await signIn("email-otp", formData);
      console.log("Signed in");
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is invalid");
      setOtp("");
    } finally {
      setIsLoadingState(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoadingState(true);
    setError(null);
    try {
      console.log("Attempting anonymous sign in...");
      await signIn("anonymous");
      console.log("Anonymous sign in successful");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      setError(`Failed to sign in as guest: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsLoadingState(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoadingState(true);
    setError(null);
    try {
      await signIn("google");
    } catch (error) {
      console.error("Google sign-in error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to sign in with Google"
      );
      setIsLoadingState(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[350px] pb-8">
        <Card className="border shadow-md">
          {step === "signin" ? (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <img
                    src={logo}
                    alt="Lock Icon"
                    width={64}
                    height={64}
                    className="rounded-lg mb-4 mt-2"
                  />
                </div>
                <CardTitle className="text-xl">Get Started</CardTitle>
                <CardDescription>
                  Enter your email to log in or sign up
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleEmailSubmit}>
                <CardContent className="pb-4">
                  <div className="relative flex items-center">
                    <div className="absolute left-3 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                    </div>
                    <Input
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      className="pl-9"
                      required
                      disabled={isLoadingState}
                    />
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-red-500">{error}</p>
                  )}
                  <div className="mt-4">
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full"
                      disabled={isLoadingState}
                    >
                      {isLoadingState ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Continue with Email
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-muted px-2 text-muted-foreground">
                        Or
                      </span>
                    </div>
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogleLogin}
                      disabled={isLoadingState}
                    >
                      Continue with Google
                    </Button>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleGuestLogin}
                    disabled={isLoadingState}
                    className="w-full"
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Continue as Guest
                  </Button>
                </CardFooter>
              </form>
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <CardTitle>Check your email</CardTitle>
                <CardDescription>
                  We've sent a code to {step.email}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="pb-4">
                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoadingState}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoadingState) {
                          const form = (e.target as HTMLElement).closest("form");
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
                    <p className="mt-2 text-sm text-red-500">{error}</p>
                  )}
                  <div className="mt-4">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoadingState || otp.length !== 6}
                    >
                      {isLoadingState ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify code
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("signin")}
                    disabled={isLoadingState}
                    className="w-full"
                  >
                    Use different email
                  </Button>
                </CardFooter>
              </form>
            </>
          )}
        </Card>
        <div className="py-4 px-6 text-xs text-center text-muted-foreground bg-muted border-t rounded-b-lg">
          Secured by{" "}
          <a
            href="https://freebuff.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary transition-colors"
          >
            freebuff.com
          </a>
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

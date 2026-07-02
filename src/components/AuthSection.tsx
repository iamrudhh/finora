import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  ShieldAlert, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff
} from "lucide-react";

interface AuthSectionProps {
  onAuthSuccess: (token: string, user: { email: string; name: string; picture?: string }) => void;
  onContinueAsGuest: () => void;
  hideHeader?: boolean;
}

export default function AuthSection({ onAuthSuccess, onContinueAsGuest, hideHeader = false }: AuthSectionProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  // Listen for OAuth messages from the popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith(".run.app") && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
        return;
      }

      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const { token, user } = event.data.payload;
        onAuthSuccess(token, user);
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [onAuthSuccess]);

  const handleGoogleSSO = async () => {
    setSsoLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/google/url");
      if (!res.ok) {
        throw new Error("Failed to get Google authentication URL");
      }
      const data = await res.json();
      
      const width = 500;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        data.url,
        "google_sso_popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        setError("Popup was blocked. Please allow popups for this page to sign in with Google.");
        setSsoLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred starting Google SSO.");
      setSsoLoading(false);
    } finally {
      setTimeout(() => setSsoLoading(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && !name)) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError(null);

    const endpoint = isSignUp ? "/api/auth/signup" : "/api/auth/login";
    const payload = isSignUp ? { email, password, name } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnsupportedSSO = (provider: string) => {
    setError(`Sign in with ${provider} is disabled for the sandbox. Please use "Google" or try Sandbox Mode (Offline).`);
  };

  return (
    <div id="auth-section" className="w-full max-w-md mx-auto">
      {/* Outer wrapper mimicking the elegant mockup card container */}
      <div className="bg-[#FAF9F5] border border-ledger-line rounded-3xl overflow-hidden shadow-sm">
        
        {/* Main Card */}
        <div className="bg-ledger-surface p-8 space-y-6">
          
          {/* Top Logo and Ring - Exact match to image */}
          <div className="flex flex-col items-center">
            <div className="relative flex items-center justify-center w-16 h-16 rounded-full mb-4">
              {/* Subtle outer dotted circular ring */}
              <div className="absolute inset-0 border-2 border-dashed border-ledger-line/80 rounded-full animate-[spin_20s_linear_infinite]" />
              
              {/* Core Icon Box */}
              <div className="relative w-11 h-11 bg-[#27272a] rounded-xl flex items-center justify-center shadow-md">
                {/* 5-dot configuration inside */}
                <div className="grid grid-cols-3 gap-1 w-5 h-5">
                  <div className="w-1 h-1 rounded-full bg-stone-300" />
                  <div className="w-1 h-1 rounded-full bg-stone-500 opacity-0" />
                  <div className="w-1 h-1 rounded-full bg-stone-300" />
                  <div className="w-1 h-1 rounded-full bg-stone-500 opacity-0" />
                  <div className="w-1 h-1 rounded-full bg-stone-200" />
                  <div className="w-1 h-1 rounded-full bg-stone-500 opacity-0" />
                  <div className="w-1 h-1 rounded-full bg-stone-300" />
                  <div className="w-1 h-1 rounded-full bg-stone-500 opacity-0" />
                  <div className="w-1 h-1 rounded-full bg-stone-300" />
                </div>
              </div>
            </div>

            <h3 className="font-sans font-bold text-xl text-[#18181b] tracking-tight">
              {isSignUp ? "Create an account" : "Sign in to continue"}
            </h3>
            <p className="text-xs text-ledger-muted mt-1 text-center">
              {isSignUp 
                ? "Please fill details to register your personal ledger" 
                : "Please sign in to start your financial ledger"
              }
            </p>
          </div>

          {error && (
            <div id="auth-error" className="bg-ledger-expense-bg border border-ledger-expense text-ledger-expense rounded-xl p-3 text-xs leading-relaxed font-medium flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {isSignUp && (
              <div className="space-y-1">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="signup-name"
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#f4f4f5] border border-transparent hover:border-stone-200 focus:border-stone-400 rounded-xl py-3 pl-10 pr-4 text-sm font-medium focus:bg-white focus:outline-none transition-all placeholder:text-stone-400 text-[#18181b]"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="auth-email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#f4f4f5] border border-transparent hover:border-stone-200 focus:border-stone-400 rounded-xl py-3 pl-10 pr-4 text-sm font-medium focus:bg-white focus:outline-none transition-all placeholder:text-stone-400 text-[#18181b]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#f4f4f5] border border-transparent hover:border-stone-200 focus:border-stone-400 rounded-xl py-3 pl-10 pr-11 text-sm font-medium focus:bg-white focus:outline-none transition-all placeholder:text-stone-400 text-[#18181b]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#18181b] transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading || ssoLoading}
              className="w-full bg-[#18181b] hover:bg-stone-800 text-white rounded-xl py-3 font-bold text-sm cursor-pointer transition-colors duration-150 disabled:opacity-60 flex items-center justify-center gap-2 mt-2 shadow-sm"
            >
              {loading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
            </button>
          </form>

          {/* Elegant Dashed Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-dashed border-stone-200"></div>
            <span className="flex-shrink mx-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              Or continue with
            </span>
            <div className="flex-grow border-t border-dashed border-stone-200"></div>
          </div>

          {/* Google SSO Button */}
          <button
            id="google-sso-btn"
            type="button"
            onClick={handleGoogleSSO}
            disabled={ssoLoading}
            className="w-full bg-white hover:bg-[#fafafa] active:bg-[#f4f4f5] text-[#18181b] border border-stone-200 hover:border-stone-300 rounded-xl py-3 px-4 font-bold text-sm cursor-pointer transition-all duration-150 flex items-center justify-center gap-2.5 disabled:opacity-60 shadow-2xs"
          >
            <span className="font-sans font-extrabold tracking-tight select-none text-base">
              <span className="text-[#4285F4]">G</span>
              <span className="text-[#EA4335]">o</span>
              <span className="text-[#FBBC05]">o</span>
              <span className="text-[#34A853]">g</span>
              <span className="text-[#4285F4]">l</span>
              <span className="text-[#EA4335]">e</span>
            </span>
            <span>{ssoLoading ? "Connecting Google..." : "Continue with Google"}</span>
          </button>

        </div>

        {/* Footer of the card */}
        <div className="bg-[#f4f4f5]/60 border-t border-stone-100 py-4 text-center">
          <p className="text-xs text-stone-500">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-[#18181b] hover:underline font-bold transition-all cursor-pointer"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>

      {/* Guest Sandbox entry link outside the main form wrapper */}
      <div className="text-center mt-6">
        <button
          id="guest-access-btn"
          type="button"
          onClick={onContinueAsGuest}
          className="text-xs text-ledger-muted hover:text-[#18181b] font-semibold underline underline-offset-4 cursor-pointer flex items-center justify-center gap-1.5 mx-auto transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-ledger-income" />
          Try it instantly in Sandbox Mode (Offline)
        </button>
      </div>
    </div>
  );
}


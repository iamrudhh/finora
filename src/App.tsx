/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { RefreshCw, Sparkles, ShieldCheck, HelpCircle } from "lucide-react";
import AuthSection from "./components/AuthSection";
import LedgerApp from "./components/LedgerApp";
import { User } from "./types";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load and verify existing session from localStorage
  useEffect(() => {
    const recoverSession = async () => {
      const storedToken = localStorage.getItem("ledger_token");
      const storedUser = localStorage.getItem("ledger_user");

      if (storedToken && storedUser) {
        try {
          // Verify with server
          const res = await fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (res.ok) {
            const data = await res.json();
            setToken(storedToken);
            setUser(data.user);
          } else {
            // Token expired or invalid, clear session
            localStorage.removeItem("ledger_token");
            localStorage.removeItem("ledger_user");
          }
        } catch (err) {
          // Server offline or network error, recover gracefully with cached info
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } else {
        // Check if they previously had sandbox guest mode active
        const storedGuest = localStorage.getItem("ledger_guest_mode");
        if (storedGuest === "true") {
          setGuestMode(true);
        }
      }
      setLoading(false);
    };

    recoverSession();
  }, []);

  const handleAuthSuccess = (newToken: string, authenticatedUser: User) => {
    localStorage.setItem("ledger_token", newToken);
    localStorage.setItem("ledger_user", JSON.stringify(authenticatedUser));
    localStorage.removeItem("ledger_guest_mode"); // Clear guest mode if logged in

    setToken(newToken);
    setUser(authenticatedUser);
    setGuestMode(false);
  };

  const handleContinueAsGuest = () => {
    localStorage.setItem("ledger_guest_mode", "true");
    setGuestMode(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("ledger_token");
    localStorage.removeItem("ledger_user");
    localStorage.removeItem("ledger_guest_mode");

    setToken(null);
    setUser(null);
    setGuestMode(false);
  };

  return (
    <div className="min-h-screen bg-ledger-bg py-8 px-4 sm:px-6 lg:px-8">
      <div className={`${user || guestMode ? "max-w-xl" : "max-w-6xl"} mx-auto transition-all duration-300`}>
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-ledger-muted">
            <RefreshCw className="w-8 h-8 animate-spin text-ledger-muted mb-4" />
            <p className="font-serif font-semibold text-lg">Loading Finora...</p>
          </div>
        ) : user || guestMode ? (
          <div>
            {/* Header */}
            <div className="mb-6 flex justify-between items-end">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-ledger-muted font-bold mb-1">
                  Personal Finance
                </p>
                <h1 className="font-serif font-bold text-3xl tracking-tight text-ledger-ink">
                  Finora
                </h1>
              </div>
              
              {/* Mode indicator */}
              <div className="pb-1 select-none">
                {user ? (
                  <span className="inline-flex items-center gap-1 bg-[#E4EEE3] text-[#3F6E52] text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border border-[#3F6E52]/20">
                    <ShieldCheck className="w-3 h-3" />
                    Synced
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-ledger-expense-bg text-ledger-expense text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border border-ledger-expense/20">
                    <Sparkles className="w-3 h-3" />
                    Sandbox
                  </span>
                )}
              </div>
            </div>

            {/* Central app interface */}
            <LedgerApp user={user} token={token} onLogout={handleLogout} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center py-4 sm:py-8" id="finora-landing">
            {/* Right Column (Mobile: Top/First, Desktop: Right/Second): Portal */}
            <div className="order-1 lg:order-2 lg:col-span-5 w-full flex justify-center">
              <AuthSection
                onAuthSuccess={handleAuthSuccess}
                onContinueAsGuest={handleContinueAsGuest}
                hideHeader={true}
              />
            </div>

            {/* Left Column (Mobile: Bottom/Second, Desktop: Left/First): Workflow Explanation */}
            <div className="order-2 lg:order-1 lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 bg-[#E4EEE3] text-[#3F6E52] text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-[#3F6E52]/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  Finora Smart Ledger
                </div>
                <h1 className="font-serif font-bold text-4xl sm:text-5xl tracking-tight text-ledger-ink leading-tight">
                  Clean Finance.<br />
                  Deep Multi-Week Insights.
                </h1>
                <p className="text-sm sm:text-base text-ledger-muted leading-relaxed max-w-xl">
                  Finora is a sleek, beautiful personal finance ledger designed to track your cash flow, analyze note-by-note category trends, and keep your balances perfect with zero bloat.
                </p>
              </div>

              {/* Step-by-Step Workflow Card */}
              <div className="bg-ledger-surface border border-ledger-line rounded-2xl p-6 shadow-xs space-y-5">
                <h3 className="font-bold text-xs text-ledger-ink uppercase tracking-wider flex items-center gap-2 border-b border-ledger-line pb-3">
                  <HelpCircle className="w-4 h-4 text-ledger-income" />
                  Application Workflow
                </h3>

                <div className="space-y-5">
                  {/* Step 1 */}
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-ledger-income-bg text-ledger-income flex items-center justify-center font-bold text-xs sm:text-sm">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-ledger-ink">
                        Flexible Secured Access
                      </h4>
                      <p className="text-xs text-ledger-muted mt-0.5 leading-relaxed">
                        Sign up securely with standard credentials, login in one click with <strong>Google SSO</strong>, or use our instant offline <strong>Sandbox Mode</strong> to save records locally.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-ledger-income-bg text-ledger-income flex items-center justify-center font-bold text-xs sm:text-sm">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-ledger-ink">
                        Frictionless Balance Logging
                      </h4>
                      <p className="text-xs text-ledger-muted mt-0.5 leading-relaxed">
                        Quickly log daily expenses and income. A built-in guard prevents future-date selections, keeping your financial timeline realistic and accurate.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-ledger-income-bg text-ledger-income flex items-center justify-center font-bold text-xs sm:text-sm">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-ledger-ink">
                        Instant Records Correction
                      </h4>
                      <p className="text-xs text-ledger-muted mt-0.5 leading-relaxed">
                        Entered a wrong amount or made a spelling typo? Simply click the inline <strong>Edit Icon</strong> on any ledger item to instantly rewrite details or select another date.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-ledger-income-bg text-ledger-income flex items-center justify-center font-bold text-xs sm:text-sm">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-ledger-ink">
                        Deep Multi-Week Trend Analytics
                      </h4>
                      <p className="text-xs text-ledger-muted mt-0.5 leading-relaxed">
                        Select any category to analyze multi-week visual trend progress blocks across 7, 14, 21, and 28 days alongside itemized note-by-note description lists.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

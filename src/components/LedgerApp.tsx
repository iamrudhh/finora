import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, 
  Minus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  Calendar, 
  User, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Info,
  Sparkles,
  RefreshCw,
  Edit2,
  Check,
  X,
  Database,
  Copy,
  ExternalLink,
  FileText
} from "lucide-react";
import { Entry, CATEGORIES, User as UserType } from "../types";

interface LedgerAppProps {
  user: UserType | null;
  token: string | null;
  onLogout: () => void;
}

const getTodayLocalDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function LedgerApp({ user, token, onLogout }: LedgerAppProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formType, setFormType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getTodayLocalDateStr());
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("Food");
  const [saving, setSaving] = useState(false);

  // Edit State
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editCategory, setEditCategory] = useState("Food");
  const [editDate, setEditDate] = useState("");
  const [editType, setEditType] = useState<"income" | "expense">("expense");

  // Reports State
  const [reportTab, setReportTab] = useState<"weekly" | "monthly">("weekly");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [storageStatus, setStorageStatus] = useState<{ isSupabaseEnabled: boolean; supabaseUrl: string | null } | null>(null);
  const [showSupabaseInfo, setShowSupabaseInfo] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Indian Rupee (INR) formatter
  const moneyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
  const money = (n: number) => moneyFormatter.format(n);

  // --- Fetching & Persistence Logic ---
  const loadEntries = async () => {
    setLoading(true);
    setError(null);
    if (token) {
      // Authenticated Mode - Server Sync
      try {
        const res = await fetch("/api/entries", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Could not fetch ledger logs from server");
        const data = await res.json();
        setEntries(data);
      } catch (err: any) {
        setError(err.message || "Failed to load records");
      } finally {
        setLoading(false);
      }
    } else {
      // Guest Mode - Local Storage
      try {
        const stored = localStorage.getItem("ledger_entries_guest");
        if (stored) {
          setEntries(JSON.parse(stored));
        } else {
          // Add dummy entries for a beautiful first-look preview!
          const demoEntries: Entry[] = [
            {
              id: "demo1",
              type: "income",
              amount: 54000,
              note: "Monthly Freelance Project",
              category: "Income",
              date: new Date().toISOString()
            },
            {
              id: "demo2",
              type: "expense",
              amount: 1450,
              note: "Team Lunch",
              category: "Food",
              date: new Date().toISOString()
            },
            {
              id: "demo3",
              type: "expense",
              amount: 600,
              note: "Cab ride to office",
              category: "Travel",
              date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Yesterday
            },
            {
              id: "demo4",
              type: "expense",
              amount: 12500,
              note: "Electricity & Internet Bill",
              category: "Bills",
              date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            }
          ];
          localStorage.setItem("ledger_entries_guest", JSON.stringify(demoEntries));
          setEntries(demoEntries);
        }
      } catch (err) {
        setError("Could not read local data");
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadEntries();
    // Fetch Storage Status
    fetch("/api/storage-status")
      .then((res) => res.json())
      .then((data) => setStorageStatus(data))
      .catch((e) => console.error("Error loading storage status:", e));
  }, [token]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Please input a valid positive amount");
      return;
    }

    const todayStr = getTodayLocalDateStr();
    if (date > todayStr) {
      setError("Future dates are not allowed. Please select today or a past date.");
      return;
    }

    setSaving(true);
    setError(null);

    // Make sure we parse the date cleanly as local noon to avoid timezone shift
    const cleanDateStr = new Date(date + "T12:00:00").toISOString();

    if (token) {
      // Authenticated Mode - Save to Server
      try {
        const res = await fetch("/api/entries", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: formType,
            amount: parsedAmount,
            note: note.trim(),
            category: formType === "expense" ? category : "Income",
            date: cleanDateStr,
          }),
        });

        if (!res.ok) throw new Error("Could not save entry to server");
        await res.json();
        await loadEntries();
        
        // Reset Inputs
        setAmount("");
        setNote("");
      } catch (err: any) {
        setError(err.message || "Failed to save record");
      } finally {
        setSaving(false);
      }
    } else {
      // Guest Mode - Save to Local Storage
      try {
        const newEntry: Entry = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          type: formType,
          amount: parsedAmount,
          note: note.trim() || (formType === "income" ? "Money added" : "Expense"),
          category: formType === "expense" ? category : "Income",
          date: cleanDateStr,
        };

        const updated = [newEntry, ...entries];
        localStorage.setItem("ledger_entries_guest", JSON.stringify(updated));
        setEntries(updated);

        // Reset Inputs
        setAmount("");
        setNote("");
      } catch (err) {
        setError("Failed to save record locally");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (token) {
      // Authenticated - Server delete
      try {
        const res = await fetch(`/api/entries/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Could not delete record from server");
        setEntries(prev => prev.filter(e => e.id !== id));
      } catch (err: any) {
        setError(err.message || "Failed to delete record");
      }
    } else {
      // Guest - Local delete
      try {
        const updated = entries.filter(e => e.id !== id);
        localStorage.setItem("ledger_entries_guest", JSON.stringify(updated));
        setEntries(updated);
      } catch (err) {
        setError("Failed to delete record locally");
      }
    }
  };

  const startEditing = (entry: Entry) => {
    setEditingEntryId(entry.id);
    setEditAmount(entry.amount.toString());
    setEditNote(entry.note);
    setEditCategory(entry.category || "Food");
    setEditDate(new Date(entry.date).toISOString().slice(0, 10));
    setEditType(entry.type);
  };

  const handleUpdateEntry = async (id: string) => {
    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please input a valid positive amount");
      return;
    }

    const todayStr = getTodayLocalDateStr();
    if (editDate > todayStr) {
      setError("Future dates are not allowed. Please select today or a past date.");
      return;
    }

    setSaving(true);
    setError(null);

    // Parse date safely
    const cleanDateStr = new Date(editDate + "T12:00:00").toISOString();

    if (token) {
      try {
        const res = await fetch(`/api/entries/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: editType,
            amount: parsedAmount,
            note: editNote.trim(),
            category: editType === "income" ? "Income" : editCategory,
            date: cleanDateStr,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Could not update entry on server");
        }
        
        const updatedEntry = await res.json();
        setEntries(prev => prev.map(e => e.id === id ? updatedEntry : e));
        setEditingEntryId(null);
      } catch (err: any) {
        setError(err.message || "Failed to update record");
      } finally {
        setSaving(false);
      }
    } else {
      try {
        const updated = entries.map((e) => {
          if (e.id === id) {
            return {
              ...e,
              type: editType,
              amount: parsedAmount,
              note: editNote.trim(),
              category: editType === "income" ? "Income" : editCategory,
              date: cleanDateStr,
            };
          }
          return e;
        });

        localStorage.setItem("ledger_entries_guest", JSON.stringify(updated));
        setEntries(updated);
        setEditingEntryId(null);
      } catch (err) {
        setError("Failed to update record locally");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleResetAll = async () => {
    if (token) {
      try {
        const res = await fetch("/api/entries", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to clear ledger history on server");
        setEntries([]);
      } catch (err: any) {
        setError(err.message || "Failed to reset records");
      }
    } else {
      try {
        localStorage.removeItem("ledger_entries_guest");
        setEntries([]);
      } catch (err) {
        setError("Failed to reset records locally");
      }
    }
  };

  // --- Calculations & Grouping Helper Utilities ---
  const startOfWeek = (d: Date) => {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // Monday start
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  const startOfMonth = (d: Date) => {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  };

  const endOfMonth = (d: Date) => {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  };

  const sameDay = (a: Date, b: Date) => {
    return a.toDateString() === b.toDateString();
  };

  const getGroupLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = addDays(today, -1);
    
    if (sameDay(d, today)) return "Today";
    if (sameDay(d, yesterday)) return "Yesterday";
    
    return d.toLocaleDateString("en-IN", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  // Total Summary values
  const getTotals = (recordList: Entry[]) => {
    let income = 0;
    let expense = 0;
    recordList.forEach((e) => {
      const amt = Number(e.amount) || 0;
      if (e.type === "income") income += amt;
      else expense += amt;
    });
    return { income, expense, net: income - expense };
  };

  const overallBalance = getTotals(entries).net;

  // Filter records for the current selected month stats
  const now = new Date();
  const currentMonthEntries = entries.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const currentMonthTotals = getTotals(currentMonthEntries);

  // Sort descending by date
  const sortedEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- Report Date Navigation Construction ---
  let rangeEntries: Entry[] = [];
  let rangeLabel = "";

  if (reportTab === "weekly") {
    const wStart = addDays(startOfWeek(now), weekOffset * 7);
    const wEnd = addDays(wStart, 6);
    wEnd.setHours(23, 59, 59, 999);
    
    rangeEntries = entries.filter((e) => {
      const d = new Date(e.date);
      return d >= wStart && d <= wEnd;
    });
    
    rangeLabel = `${wStart.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} – ${wEnd.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`;
  } else {
    const ref = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const mStart = startOfMonth(ref);
    const mEnd = endOfMonth(ref);
    
    rangeEntries = entries.filter((e) => {
      const d = new Date(e.date);
      return d >= mStart && d <= mEnd;
    });
    
    rangeLabel = ref.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }

  const rangeTotals = getTotals(rangeEntries);

  // Group expense records in the selected range by Category
  const expenseByCategory: Record<string, number> = {};
  rangeEntries.forEach((e) => {
    if (e.type === "expense") {
      const amt = Number(e.amount) || 0;
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + amt;
    }
  });

  const categoryList = Object.keys(expenseByCategory)
    .map((k) => ({ category: k, amount: expenseByCategory[k] }))
    .sort((a, b) => b.amount - a.amount);

  const maxExpenseAmount = categoryList.length > 0 ? categoryList[0].amount : 0;

  // --- Category Deep Dive Trends & Notes Analyzer ---
  const [analyzedCategory, setAnalyzedCategory] = useState("Food");
  const [breakdownDays, setBreakdownDays] = useState(30);

  const getCategoryTimeframeSpent = (catName: string, days: number) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    return entries
      .filter((e) => e.type === "expense" && e.category === catName && new Date(e.date) >= cutoff)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  };

  const getCategoryNotesBreakdown = (catName: string, days: number) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    const matched = entries.filter(
      (e) => e.type === "expense" && e.category === catName && new Date(e.date) >= cutoff
    );

    const grouped: Record<string, number> = {};
    matched.forEach((e) => {
      const noteLabel = e.note.trim() || `Unnamed ${catName} log`;
      grouped[noteLabel] = (grouped[noteLabel] || 0) + (Number(e.amount) || 0);
    });

    return Object.keys(grouped)
      .map((n) => ({ note: n, amount: grouped[n] }))
      .sort((a, b) => b.amount - a.amount);
  };

  const spent1W = getCategoryTimeframeSpent(analyzedCategory, 7);
  const spent2W = getCategoryTimeframeSpent(analyzedCategory, 14);
  const spent3W = getCategoryTimeframeSpent(analyzedCategory, 21);
  const spent4W = getCategoryTimeframeSpent(analyzedCategory, 28);
  const spent30D = getCategoryTimeframeSpent(analyzedCategory, 30);

  const notesBreakdown = getCategoryNotesBreakdown(analyzedCategory, breakdownDays);
  const maxNoteAmount = notesBreakdown.length > 0 ? notesBreakdown[0].amount : 0;

  return (
    <div id="ledger-app" className="space-y-6">
      {/* Wallet Balance Card */}
      <motion.div 
        id="card-balance"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-ledger-surface border border-ledger-line rounded-xl p-6 shadow-sm"
      >
        <p className="text-xs font-semibold text-ledger-muted uppercase tracking-wider mb-1">
          Wallet Balance
        </p>
        <h3 className="font-mono font-semibold text-3xl sm:text-4xl tracking-tight text-ledger-ink mb-4 select-all">
          {money(overallBalance)}
        </h3>
        
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-dashed border-ledger-line pt-4">
          <div className="flex items-center gap-2 text-xs font-medium text-ledger-muted">
            <span className="w-2 h-2 rounded-full bg-ledger-income inline-block" />
            This Month's Income:{" "}
            <span className="font-mono font-bold text-ledger-ink">
              {money(currentMonthTotals.income)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-ledger-muted">
            <span className="w-2 h-2 rounded-full bg-ledger-expense inline-block" />
            This Month's Expenses:{" "}
            <span className="font-mono font-bold text-ledger-ink">
              {money(currentMonthTotals.expense)}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Add Entry Card */}
      <motion.div 
        id="card-add-entry"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-ledger-surface border border-ledger-line rounded-xl p-6 shadow-sm"
      >
        <p className="font-serif font-semibold text-lg text-ledger-ink mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-ledger-muted" />
          Add Entry
        </p>

        <form onSubmit={handleAddEntry} className="space-y-4">
          {/* Segmented Button Selection */}
          <div className="flex bg-ledger-bg border border-ledger-line rounded-full p-0.5" id="segmented-type">
            <button
              type="button"
              id="btn-form-income"
              onClick={() => setFormType("income")}
              className={`flex-1 py-2 rounded-full text-xs font-bold cursor-pointer transition-all duration-150 ${
                formType === "income"
                  ? "bg-ledger-income-bg text-ledger-income shadow-xs"
                  : "text-ledger-muted hover:text-ledger-ink"
              }`}
            >
              + Add Money
            </button>
            <button
              type="button"
              id="btn-form-expense"
              onClick={() => setFormType("expense")}
              className={`flex-1 py-2 rounded-full text-xs font-bold cursor-pointer transition-all duration-150 ${
                formType === "expense"
                  ? "bg-ledger-expense-bg text-ledger-expense shadow-xs"
                  : "text-ledger-muted hover:text-ledger-ink"
              }`}
            >
              − Add Expense
            </button>
          </div>

          {/* Form Fields row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ledger-muted" htmlFor="amount-input">
                Amount (₹)
              </label>
              <input
                id="amount-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono bg-ledger-bg border border-ledger-line rounded-lg p-2.5 text-sm focus:outline-ledger-ink w-full"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ledger-muted" htmlFor="date-input">
                Date
              </label>
              <input
                id="date-input"
                type="date"
                value={date}
                max={getTodayLocalDateStr()}
                onChange={(e) => setDate(e.target.value)}
                className="bg-ledger-bg border border-ledger-line rounded-lg p-2.5 text-sm focus:outline-ledger-ink w-full"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ledger-muted" htmlFor="note-input">
                Note
              </label>
              <input
                id="note-input"
                type="text"
                placeholder={formType === "income" ? "e.g. Freelance Consulting" : "e.g. Lunch at Diner"}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="bg-ledger-bg border border-ledger-line rounded-lg p-2.5 text-sm focus:outline-ledger-ink w-full"
              />
            </div>

            {formType === "expense" ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-ledger-muted" htmlFor="category-select">
                  Category
                </label>
                <select
                  id="category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-ledger-bg border border-ledger-line rounded-lg p-2.5 text-sm focus:outline-ledger-ink w-full"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="hidden sm:flex flex-col gap-1.5 justify-end pb-1 text-xs text-ledger-muted italic">
                <span>Auto-categorized as Income log</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            id="btn-add-entry"
            disabled={saving}
            className={`w-full text-white font-semibold py-3 px-4 rounded-lg text-sm cursor-pointer hover:opacity-90 active:opacity-95 transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2 mt-2 ${
              formType === "income" ? "bg-ledger-income" : "bg-ledger-expense"
            }`}
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                {formType === "income" ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                {formType === "income" ? "Add Money" : "Add Expense"}
              </>
            )}
          </button>
        </form>
      </motion.div>

      {/* error message display inside page layout */}
      {error && (
        <div id="ledger-error-banner" className="bg-ledger-expense-bg border border-ledger-expense text-ledger-expense rounded-xl p-4 text-xs font-medium flex items-center justify-between">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-ledger-expense hover:opacity-80 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Recent Entries List Card */}
      <motion.div 
        id="card-recent-entries"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-ledger-surface border border-ledger-line rounded-xl p-6 shadow-sm"
      >
        <p className="font-serif font-semibold text-lg text-ledger-ink mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-ledger-muted" />
          Recent Entries
        </p>

        {loading ? (
          <div className="py-12 text-center text-sm text-ledger-muted flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-ledger-muted" />
            Loading your ledger records...
          </div>
        ) : sortedEntries.length === 0 ? (
          <p className="text-center text-sm text-ledger-muted py-8 bg-ledger-bg rounded-lg border border-dashed border-ledger-line">
            No records found. Input your first cash flow above!
          </p>
        ) : (
          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
            {(() => {
              let lastGroupLabel = "";
              return sortedEntries.map((e, index) => {
                const groupLabelStr = getGroupLabel(e.date);
                const showGroupHeader = groupLabelStr !== lastGroupLabel;
                lastGroupLabel = groupLabelStr;

                return (
                  <div key={e.id}>
                    {showGroupHeader && (
                      <div className="text-[10px] font-bold tracking-widest text-ledger-muted uppercase mt-4 mb-2 first:mt-0 select-none">
                        {groupLabelStr}
                      </div>
                    )}
                    <motion.div
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-ledger-line/60 last:border-0"
                    >
                      {editingEntryId === e.id ? (
                        <div className="bg-ledger-bg border border-ledger-line rounded-lg p-3 my-2 space-y-3">
                          <div className="flex gap-2 items-center">
                            <button
                              type="button"
                              onClick={() => setEditType("expense")}
                              className={`flex-1 py-1 text-xs font-bold rounded-md transition-all duration-150 ${
                                editType === "expense"
                                  ? "bg-ledger-expense text-white"
                                  : "bg-ledger-surface border border-ledger-line text-ledger-muted"
                              }`}
                            >
                              Expense
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditType("income")}
                              className={`flex-1 py-1 text-xs font-bold rounded-md transition-all duration-150 ${
                                editType === "income"
                                  ? "bg-ledger-income text-white"
                                  : "bg-ledger-surface border border-ledger-line text-ledger-muted"
                              }`}
                            >
                              Income
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-ledger-muted uppercase mb-0.5">Amount (₹)</label>
                              <input
                                type="number"
                                step="any"
                                value={editAmount}
                                onChange={(val) => setEditAmount(val.target.value)}
                                className="w-full bg-ledger-surface border border-ledger-line rounded-lg py-1 px-2.5 text-xs font-mono font-bold focus:outline-ledger-ink"
                                placeholder="Amount"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-ledger-muted uppercase mb-0.5">Date</label>
                              <input
                                type="date"
                                value={editDate}
                                max={getTodayLocalDateStr()}
                                onChange={(val) => setEditDate(val.target.value)}
                                className="w-full bg-ledger-surface border border-ledger-line rounded-lg py-1 px-2 text-xs font-medium focus:outline-ledger-ink"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2 sm:col-span-1">
                              <label className="block text-[10px] font-bold text-ledger-muted uppercase mb-0.5">Description</label>
                              <input
                                type="text"
                                value={editNote}
                                onChange={(val) => setEditNote(val.target.value)}
                                className="w-full bg-ledger-surface border border-ledger-line rounded-lg py-1 px-2.5 text-xs font-medium focus:outline-ledger-ink"
                                placeholder="E.g., Groceries, Salary, etc."
                              />
                            </div>
                            {editType === "expense" && (
                              <div className="col-span-2 sm:col-span-1">
                                <label className="block text-[10px] font-bold text-ledger-muted uppercase mb-0.5">Category</label>
                                <select
                                  value={editCategory}
                                  onChange={(val) => setEditCategory(val.target.value)}
                                  className="w-full bg-ledger-surface border border-ledger-line rounded-lg py-1 px-2 text-xs font-semibold focus:outline-ledger-ink"
                                >
                                  {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          <div className="flex justify-end gap-2 pt-1 border-t border-ledger-line/60">
                            <button
                              type="button"
                              onClick={() => setEditingEntryId(null)}
                              className="flex items-center gap-1 bg-ledger-surface border border-ledger-line text-ledger-muted hover:text-ledger-ink text-xs font-bold py-1 px-2.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateEntry(e.id)}
                              className="flex items-center gap-1 bg-ledger-ink text-ledger-surface hover:opacity-90 text-xs font-bold py-1 px-2.5 rounded-lg transition-opacity cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between py-2 group">
                          <div className="min-w-0 pr-4">
                            <div className="font-semibold text-sm text-ledger-ink truncate" title={e.note}>
                              {e.note || (e.type === "income" ? "Money Added" : "Expense")}
                            </div>
                            <div className="text-xs text-ledger-muted font-medium mt-0.5">
                              {e.type === "income" ? "Income" : e.category}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-sm font-bold whitespace-nowrap mr-2 ${
                                e.type === "income" ? "text-ledger-income" : "text-ledger-expense"
                              }`}
                            >
                              {e.type === "income" ? "+" : "−"}
                              {money(e.amount)}
                            </span>
                            
                            <button
                              type="button"
                              onClick={() => startEditing(e)}
                              className="text-ledger-muted hover:text-ledger-ink opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-sm hover:bg-ledger-bg transition-all duration-150 cursor-pointer"
                              title="Edit record"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(e.id)}
                              className="text-ledger-muted hover:text-ledger-expense opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-sm hover:bg-ledger-bg transition-all duration-150 cursor-pointer"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </motion.div>

      {/* Reports Card */}
      <motion.div 
        id="card-reports"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-ledger-surface border border-ledger-line rounded-xl p-6 shadow-sm"
      >
        <div className="flex justify-between items-center mb-4">
          <p className="font-serif font-semibold text-lg text-ledger-ink">Reports</p>
          {/* Tabs switch */}
          <div className="flex bg-ledger-bg border border-ledger-line rounded-full p-0.5" id="reports-tab">
            <button
              type="button"
              id="tab-reports-weekly"
              onClick={() => {
                setReportTab("weekly");
                setWeekOffset(0);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all duration-150 ${
                reportTab === "weekly"
                  ? "bg-ledger-ink text-white"
                  : "text-ledger-muted hover:text-ledger-ink"
              }`}
            >
              Weekly
            </button>
            <button
              type="button"
              id="tab-reports-monthly"
              onClick={() => {
                setReportTab("monthly");
                setMonthOffset(0);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all duration-150 ${
                reportTab === "monthly"
                  ? "bg-ledger-ink text-white"
                  : "text-ledger-muted hover:text-ledger-ink"
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Range Navigation */}
        <div className="flex items-center justify-between mb-4 border-b border-ledger-line/40 pb-3" id="reports-nav">
          <button
            type="button"
            id="btn-nav-prev"
            onClick={() => {
              if (reportTab === "weekly") setWeekOffset((p) => p - 1);
              else setMonthOffset((p) => p - 1);
            }}
            className="w-8 h-8 rounded-full border border-ledger-line flex items-center justify-center hover:bg-ledger-bg hover:border-ledger-ink transition-colors duration-150 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-ledger-ink" />
          </button>
          <span className="text-xs font-bold text-ledger-muted font-sans select-none" id="reports-nav-label">
            {rangeLabel}
          </span>
          <button
            type="button"
            id="btn-nav-next"
            onClick={() => {
              if (reportTab === "weekly") setWeekOffset((p) => p + 1);
              else setMonthOffset((p) => p + 1);
            }}
            className="w-8 h-8 rounded-full border border-ledger-line flex items-center justify-center hover:bg-ledger-bg hover:border-ledger-ink transition-colors duration-150 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-ledger-ink" />
          </button>
        </div>

        {/* Range summary blocks */}
        <div className="grid grid-cols-3 gap-1 bg-ledger-bg border border-ledger-line rounded-lg p-3 text-center mb-6" id="reports-totals">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-ledger-muted uppercase mb-1">Income</p>
            <p className="font-mono text-xs sm:text-sm font-bold text-ledger-income truncate">
              {money(rangeTotals.income)}
            </p>
          </div>
          <div className="border-x border-ledger-line/60">
            <p className="text-[10px] font-bold tracking-wider text-ledger-muted uppercase mb-1">Expense</p>
            <p className="font-mono text-xs sm:text-sm font-bold text-ledger-expense truncate">
              {money(rangeTotals.expense)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-ledger-muted uppercase mb-1">Net Flow</p>
            <p className={`font-mono text-xs sm:text-sm font-bold truncate ${rangeTotals.net >= 0 ? "text-ledger-income" : "text-ledger-expense"}`}>
              {rangeTotals.net >= 0 ? "+" : ""}{money(rangeTotals.net)}
            </p>
          </div>
        </div>

        {/* Categories Spent Chart Visualizer */}
        <div id="reports-chart" className="space-y-4">
          <p className="text-xs font-semibold text-ledger-muted uppercase tracking-wider mb-2">
            Spending by Category
          </p>

          {categoryList.length === 0 ? (
            <p className="text-center text-xs text-ledger-muted py-6 italic select-none">
              No expenses recorded during this period.
            </p>
          ) : (
            <div className="space-y-3">
              {categoryList.map((c) => {
                const percentage = maxExpenseAmount > 0 ? (c.amount / maxExpenseAmount) * 100 : 0;
                return (
                  <div key={c.category} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-ledger-ink">{c.category}</span>
                      <span className="font-mono font-bold text-ledger-ink">{money(c.amount)}</span>
                    </div>
                    {/* Track progress */}
                    <div className="w-full h-2 bg-ledger-bg rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="h-full bg-ledger-expense rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Category Analysis Card */}
      <motion.div
        id="card-category-deep-dive"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="bg-ledger-surface border border-ledger-line rounded-xl p-6 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
          <div>
            <p className="text-xs font-semibold text-ledger-muted uppercase tracking-wider mb-0.5">Category Analysis</p>
            <h4 className="font-serif font-semibold text-lg text-ledger-ink">Deep Dive & Multi-Week Trends</h4>
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-ledger-muted font-medium">Select:</span>
            <select
              id="analyze-category-select"
              value={analyzedCategory}
              onChange={(e) => setAnalyzedCategory(e.target.value)}
              className="bg-ledger-bg border border-ledger-line rounded-lg py-1 px-3 text-xs font-semibold focus:outline-ledger-ink"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Multi-Week Trend Progress Grid */}
        <div className="space-y-4 mb-6">
          <p className="text-xs font-bold text-ledger-muted uppercase tracking-wider">
            {analyzedCategory} Spend Trends (Timeline)
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" id="category-timeline-grid">
            {/* 1 Week */}
            <div className="bg-ledger-bg border border-ledger-line/60 rounded-lg p-3 text-center">
              <p className="text-[10px] font-bold text-ledger-muted uppercase tracking-wider mb-1">1 Week</p>
              <p className="font-mono text-xs sm:text-sm font-bold text-ledger-expense">{money(spent1W)}</p>
              <p className="text-[9px] text-ledger-muted font-semibold mt-0.5">Past 7 days</p>
            </div>
            {/* 2 Weeks */}
            <div className="bg-ledger-bg border border-ledger-line/60 rounded-lg p-3 text-center">
              <p className="text-[10px] font-bold text-ledger-muted uppercase tracking-wider mb-1">2 Weeks</p>
              <p className="font-mono text-xs sm:text-sm font-bold text-ledger-expense">{money(spent2W)}</p>
              <p className="text-[9px] text-ledger-muted font-semibold mt-0.5">Past 14 days</p>
            </div>
            {/* 3 Weeks */}
            <div className="bg-ledger-bg border border-ledger-line/60 rounded-lg p-3 text-center">
              <p className="text-[10px] font-bold text-ledger-muted uppercase tracking-wider mb-1">3 Weeks</p>
              <p className="font-mono text-xs sm:text-sm font-bold text-ledger-expense">{money(spent3W)}</p>
              <p className="text-[9px] text-ledger-muted font-semibold mt-0.5">Past 21 days</p>
            </div>
            {/* 4 Weeks */}
            <div className="bg-ledger-bg border border-ledger-line/60 rounded-lg p-3 text-center">
              <p className="text-[10px] font-bold text-ledger-muted uppercase tracking-wider mb-1">4 Weeks</p>
              <p className="font-mono text-xs sm:text-sm font-bold text-ledger-expense">{money(spent4W)}</p>
              <p className="text-[9px] text-ledger-muted font-semibold mt-0.5">Past 28 days</p>
            </div>
            {/* Monthly */}
            <div className="bg-ledger-bg border border-ledger-line/60 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
              <p className="text-[10px] font-bold text-ledger-muted uppercase tracking-wider mb-1">Monthly</p>
              <p className="font-mono text-xs sm:text-sm font-bold text-ledger-expense">{money(spent30D)}</p>
              <p className="text-[9px] text-ledger-muted font-semibold mt-0.5">Past 30 days</p>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown by Note */}
        <div className="border-t border-ledger-line/40 pt-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
            <p className="text-xs font-bold text-ledger-muted uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-ledger-expense" />
              Breakdown by Note Description
            </p>

            {/* Timeframe selector for notes breakdown */}
            <div className="flex bg-ledger-bg border border-ledger-line rounded-full p-0.5 text-[10px] self-start sm:self-auto" id="breakdown-timeframe">
              {[
                { label: "1W", val: 7 },
                { label: "2W", val: 14 },
                { label: "3W", val: 21 },
                { label: "4W", val: 28 },
                { label: "1M", val: 30 }
              ].map((tf) => (
                <button
                  key={tf.val}
                  type="button"
                  onClick={() => setBreakdownDays(tf.val)}
                  className={`px-2 py-1 rounded-full font-bold cursor-pointer transition-all duration-150 ${
                    breakdownDays === tf.val
                      ? "bg-ledger-expense text-white shadow-xs"
                      : "text-ledger-muted hover:text-ledger-ink"
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {notesBreakdown.length === 0 ? (
            <p className="text-center text-xs text-ledger-muted py-8 italic select-none bg-ledger-bg rounded-lg border border-dashed border-ledger-line">
              No entries found under "{analyzedCategory}" in the last {breakdownDays} days.
            </p>
          ) : (
            <div className="space-y-3.5 max-h-[250px] overflow-y-auto pr-1">
              {notesBreakdown.map((item) => {
                const percentage = maxNoteAmount > 0 ? (item.amount / maxNoteAmount) * 100 : 0;
                return (
                  <div key={item.note} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-ledger-ink truncate max-w-[70%]" title={item.note}>
                        {item.note}
                      </span>
                      <span className="font-mono font-bold text-ledger-ink whitespace-nowrap">
                        {money(item.amount)}
                      </span>
                    </div>
                    {/* Track progress */}
                    <div className="w-full h-1.5 bg-ledger-bg rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="h-full bg-ledger-expense rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Footer Profile Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-ledger-line pt-6">
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full border border-ledger-line"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-ledger-ink text-white flex items-center justify-center font-bold text-sm">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <p className="text-xs font-bold text-ledger-ink leading-none">{user.name}</p>
                <p className="text-[10px] text-ledger-muted mt-0.5">{user.email}</p>
                
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                    storageStatus?.isSupabaseEnabled 
                      ? "bg-[#E2F7E5] text-[#1E7E34] border-[#1E7E34]/15" 
                      : "bg-[#FFF4E5] text-[#B05B00] border-[#B05B00]/15"
                  }`}>
                    <Database className="w-2 h-2" />
                    {storageStatus?.isSupabaseEnabled ? "Supabase Cloud" : "Local Storage"}
                  </span>
                  <button 
                    type="button"
                    onClick={() => setShowSupabaseInfo(true)}
                    className="text-[9px] text-[#3F6E52] hover:underline font-bold cursor-pointer"
                  >
                    Setup Guide
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-ledger-muted text-white flex items-center justify-center font-bold text-sm">
                GS
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-ledger-ink flex items-center gap-1 leading-none">
                  Sandbox Guest <Sparkles className="w-3 h-3 text-ledger-income" />
                </p>
                <p className="text-[10px] text-ledger-muted mt-0.5">Offline-only storage mode</p>

                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                    storageStatus?.isSupabaseEnabled 
                      ? "bg-[#E2F7E5] text-[#1E7E34] border-[#1E7E34]/15" 
                      : "bg-[#FFF4E5] text-[#B05B00] border-[#B05B00]/15"
                  }`}>
                    <Database className="w-2 h-2" />
                    {storageStatus?.isSupabaseEnabled ? "Supabase Ready" : "Local Storage"}
                  </span>
                  <button 
                    type="button"
                    onClick={() => setShowSupabaseInfo(true)}
                    className="text-[9px] text-[#3F6E52] hover:underline font-bold cursor-pointer"
                  >
                    Setup Guide
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            id="reset-history-link"
            onClick={() => setShowResetConfirm(true)}
            className="text-xs text-ledger-muted hover:text-ledger-expense font-semibold underline underline-offset-2 cursor-pointer transition-colors duration-150"
          >
            Reset all data
          </button>
          
          <button
            type="button"
            id="btn-logout"
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs bg-ledger-bg hover:bg-ledger-line border border-ledger-line rounded-lg py-2 px-3 text-ledger-ink font-semibold transition-colors duration-150 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            {user ? "Sign Out" : "Exit Sandbox"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetConfirm(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-xs"
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-ledger-surface border border-ledger-line rounded-2xl p-6 shadow-xl z-10 space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto text-red-500 mb-2">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-lg text-ledger-ink">
                  Reset Ledger Data?
                </h3>
                <p className="text-sm text-ledger-muted leading-relaxed">
                  Are you absolutely sure you want to clear your entire transaction history? This action is permanent and cannot be undone.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 px-4 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleResetAll();
                    setShowResetConfirm(false);
                  }}
                  className="flex-1 bg-ledger-expense hover:opacity-95 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-opacity cursor-pointer shadow-sm"
                >
                  Yes, Clear Data
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showSupabaseInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSupabaseInfo(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-xs"
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-xl bg-ledger-surface border border-ledger-line rounded-2xl p-6 shadow-xl z-10 space-y-5 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start border-b border-ledger-line pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-ledger-income" />
                  <h3 className="font-serif font-bold text-lg text-ledger-ink">
                    Supabase Integration Guide
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSupabaseInfo(false)}
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Section */}
              <div className="bg-stone-50 border border-ledger-line/60 rounded-xl p-4 flex items-center gap-3">
                <div className={`p-2 rounded-full ${storageStatus?.isSupabaseEnabled ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-ledger-ink uppercase tracking-wider">Connection Status</p>
                  {storageStatus?.isSupabaseEnabled ? (
                    <p className="text-sm text-green-700 font-semibold flex items-center gap-1 mt-0.5">
                      🟢 Connected to Supabase Cloud Storage
                    </p>
                  ) : (
                    <p className="text-sm text-amber-700 font-semibold flex items-center gap-1 mt-0.5">
                      🟡 Local Sandbox Mode (Local JSON Files)
                    </p>
                  )}
                </div>
              </div>

              {/* Setup Steps */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-ledger-ink flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-ledger-income rounded-full"></span>
                  How to Connect Supabase
                </h4>
                
                <ol className="text-xs text-ledger-muted space-y-3 pl-4 list-decimal">
                  <li>
                    <strong className="text-ledger-ink">Get Credentials:</strong> Log in to your <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-ledger-income font-bold underline inline-flex items-center gap-0.5">Supabase Console <ExternalLink className="w-3 h-3" /></a>, select or create a project, and navigate to <strong className="text-ledger-ink">Project Settings → API</strong>.
                  </li>
                  <li>
                    <strong className="text-ledger-ink">Enter Keys in Settings:</strong> Open the <strong className="text-ledger-ink">Settings Panel</strong> in the top-right corner of the AI Studio workspace, find the <strong className="text-ledger-ink">Secrets / API Keys</strong> section, and define these two variables:
                    <div className="mt-2 bg-stone-900 text-stone-200 font-mono p-2.5 rounded-lg border border-stone-800 space-y-1 block text-[11px] select-all">
                      <div>SUPABASE_URL = "your-project-url"</div>
                      <div>SUPABASE_KEY = "your-anon-or-service-role-key"</div>
                    </div>
                  </li>
                  <li>
                    <strong className="text-ledger-ink">Create Database Tables:</strong> Go to the <strong className="text-ledger-ink">SQL Editor</strong> inside your Supabase dashboard, click "New Query", paste the SQL script below, and click <strong className="text-ledger-ink">Run</strong>.
                  </li>
                  <li>
                    <strong className="text-ledger-ink">Restart Workspace:</strong> Once environment variables are set and query is executed, click the restart button or let the build recompile to enjoy cloud synchronization!
                  </li>
                </ol>
              </div>

              {/* SQL script Copy block */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-ledger-ink uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-ledger-muted" />
                    Supabase SQL Schema Script
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const sql = `-- Create 'users' table\nCREATE TABLE IF NOT EXISTS users (\n  email TEXT PRIMARY KEY,\n  password_hash TEXT,\n  name TEXT NOT NULL,\n  picture TEXT,\n  google_id TEXT,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n-- Create 'entries' table\nCREATE TABLE IF NOT EXISTS entries (\n  id TEXT PRIMARY KEY,\n  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),\n  amount NUMERIC NOT NULL,\n  note TEXT,\n  category TEXT NOT NULL,\n  date TIMESTAMPTZ DEFAULT NOW(),\n  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE\n);`;
                      navigator.clipboard.writeText(sql);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2000);
                    }}
                    className="flex items-center gap-1.5 text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold px-2.5 py-1.5 rounded-lg border border-stone-200 transition-colors cursor-pointer"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3 h-3 text-green-600" />
                        <span className="text-green-600">Copied SQL!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Schema SQL</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-[#1e1e2e] text-[#cdd6f4] font-mono text-[10px] p-3 rounded-xl overflow-x-auto border border-[#313244] max-h-[160px] leading-relaxed">
                  <pre className="whitespace-pre">{`-- Create 'users' table
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  password_hash TEXT,
  name TEXT NOT NULL,
  picture TEXT,
  google_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create 'entries' table
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC NOT NULL,
  note TEXT,
  category TEXT NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE
);`}</pre>
                </div>
              </div>

              <div className="pt-3 border-t border-ledger-line">
                <button
                  type="button"
                  onClick={() => setShowSupabaseInfo(false)}
                  className="w-full bg-ledger-ink hover:opacity-90 text-white font-bold py-2.5 rounded-xl text-xs transition-opacity cursor-pointer text-center"
                >
                  Done, Go back to Ledger
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

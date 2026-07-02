export interface User {
  email: string;
  name: string;
  picture?: string;
}

export interface Entry {
  id: string;
  type: "income" | "expense";
  amount: number;
  note: string;
  category: string;
  date: string; // ISO String
}

export interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
}

export const CATEGORIES = [
  "Food",
  "Travel",
  "Bills",
  "Shopping",
  "Health",
  "Entertainment",
  "Other"
];

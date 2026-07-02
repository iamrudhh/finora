import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const resolvedDir = typeof __dirname !== "undefined" 
  ? __dirname 
  : path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;

app.use(express.json());

// --- Setup Data Directory & Persistent Store ---
const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const ENTRIES_FILE = path.join(DATA_DIR, "entries.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(ENTRIES_FILE)) {
  fs.writeFileSync(ENTRIES_FILE, JSON.stringify([], null, 2));
}

interface User {
  email: string;
  passwordHash?: string;
  name: string;
  picture?: string;
  googleId?: string;
  createdAt: string;
}

interface Entry {
  id: string;
  type: "income" | "expense";
  amount: number;
  note: string;
  category: string;
  date: string;
  userEmail: string;
}

function loadUsers(): User[] {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function saveUsers(users: User[]) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function loadEntries(): Entry[] {
  try {
    return JSON.parse(fs.readFileSync(ENTRIES_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function saveEntries(entries: Entry[]) {
  fs.writeFileSync(ENTRIES_FILE, JSON.stringify(entries, null, 2));
}

// --- Initialize Supabase ---
const supabaseUrl = process.env.SUPABASE_URL;
// Prefer the service role key on the server, since this backend is the trusted
// party performing writes on behalf of users authenticated via our own Google SSO
// flow (not Supabase Auth), so RLS policies based on auth.uid() would never match.
// Falls back to the anon/publishable key if the service key isn't set, but writes
// will fail under RLS in that case.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_KEY;
const supabaseKey = supabaseServiceKey || supabaseAnonKey;
const isSupabaseEnabled = !!(supabaseUrl && supabaseKey);
const supabase = isSupabaseEnabled
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// Debug logs
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SUPABASE_KEY:", supabaseKey ? "Loaded" : "Missing");
console.log("SUPABASE_KEY PREFIX:", supabaseKey?.substring(0, 20));
console.log(
  "SUPABASE_KEY TYPE:",
  supabaseServiceKey ? "service_role (bypasses RLS)" : "anon/publishable (subject to RLS)"
);
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "Loaded" : "Missing");
console.log("APP_URL:", process.env.APP_URL);

if (isSupabaseEnabled) {
  console.log("🟢 Supabase integration enabled with URL:", supabaseUrl);
} else {
  console.log("🟡 Supabase credentials not found. Falling back to Local JSON Files.");
}

// --- Unified Database Access (Supabase + local JSON Fallback) ---

async function ensureUserInSupabase(email: string): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from("users").select("email").eq("email", email).maybeSingle();
    if (error || !data) {
      const localUsers = loadUsers();
      const localUser = localUsers.find(u => u.email === email);
      if (localUser) {
        await supabase.from("users").upsert({
          email: localUser.email,
          password_hash: localUser.passwordHash,
          name: localUser.name,
          picture: localUser.picture,
          google_id: localUser.googleId,
          created_at: localUser.createdAt
        });
        console.log(`✅ Auto-synced user ${email} to Supabase`);
      } else {
        await supabase.from("users").upsert({
          email: email,
          name: email.split("@")[0],
          created_at: new Date().toISOString()
        });
        console.log(`✅ Created stub user ${email} in Supabase`);
      }
    }
  } catch (e) {
    console.warn("ensureUserInSupabase failed:", e);
  }
}

async function getUsers(): Promise<User[]> {
  const local = loadUsers();
  if (supabase) {
    try {
      const { data, error } = await supabase.from("users").select("*");
      if (!error && data) {
        const supabaseUsers: User[] = data.map(u => ({
          email: u.email,
          passwordHash: u.password_hash || u.passwordHash || u.passwordhash,
          name: u.name,
          picture: u.picture,
          googleId: u.google_id || u.googleId || u.googleid,
          createdAt: u.created_at || u.createdAt || u.createdat || new Date().toISOString()
        }));

        // If there are local users that are NOT in Supabase, let's auto-sync them to Supabase!
        for (const localUser of local) {
          if (!supabaseUsers.some(u => u.email === localUser.email)) {
            await supabase.from("users").upsert({
              email: localUser.email,
              password_hash: localUser.passwordHash,
              name: localUser.name,
              picture: localUser.picture,
              google_id: localUser.googleId,
              created_at: localUser.createdAt
            });
            supabaseUsers.push(localUser);
            console.log(`✅ Auto-synced user ${localUser.email} to Supabase during getUsers`);
          }
        }
        return supabaseUsers;
      }
      console.warn("Supabase getUsers failed, falling back to local storage:", error?.message || error);
    } catch (e) {
      console.warn("Supabase getUsers exception, falling back to local storage:", e);
    }
  }
  return local;
}

async function saveUser(user: User): Promise<void> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("users")
        .upsert(
          {
            email: user.email,
            password_hash: user.passwordHash,
            name: user.name,
            picture: user.picture,
            google_id: user.googleId,
            created_at: user.createdAt,
          },
          {
            onConflict: "email",
          }
        )
        .select();

      if (error) {
        console.error("❌ Supabase saveUser failed:", error);
      } else {
        console.log("✅ User saved to Supabase:", user.email);
      }
    } catch (err) {
      console.error("❌ Supabase saveUser exception:", err);
    }
  }

  // Always keep a local backup
  const users = loadUsers();
  const index = users.findIndex((u) => u.email === user.email);

  if (index !== -1) {
    users[index] = user;
  } else {
    users.push(user);
  }

  saveUsers(users);
}

async function getEntries(email: string): Promise<Entry[]> {
  await ensureUserInSupabase(email);
  const localEntries = loadEntries().filter(e => e.userEmail === email);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("user_email", email);
      if (!error && data) {
        const supabaseEntries = data.map(d => ({
          id: d.id,
          type: d.type,
          amount: parseFloat(d.amount),
          note: d.note || "",
          category: d.category,
          date: d.date,
          userEmail: d.user_email || d.userEmail || d.useremail || ""
        }));

        // Auto-sync local entries to Supabase if they are missing in Supabase
        for (const localE of localEntries) {
          if (!supabaseEntries.some(e => e.id === localE.id)) {
            const { error: insertErr } = await supabase.from("entries").upsert({
              id: localE.id,
              type: localE.type,
              amount: localE.amount,
              note: localE.note,
              category: localE.category,
              date: localE.date,
              user_email: localE.userEmail
            });
            if (!insertErr) {
              supabaseEntries.push(localE);
              console.log(`✅ Auto-synced entry ${localE.id} to Supabase`);
            } else {
              console.error("Failed to auto-sync local entry to Supabase:", insertErr);
            }
          }
        }
        return supabaseEntries;
      }
      console.warn("Supabase getEntries failed, falling back to local storage:", error?.message || error);
    } catch (e) {
      console.warn("Supabase getEntries exception, falling back to local storage:", e);
    }
  }
  return localEntries;
}

async function saveEntry(entry: Entry): Promise<void> {
  await ensureUserInSupabase(entry.userEmail);

  if (supabase) {
    try {
      const { error } = await supabase.from("entries").upsert({
        id: entry.id,
        type: entry.type,
        amount: entry.amount,
        note: entry.note,
        category: entry.category,
        date: entry.date,
        user_email: entry.userEmail
      });
      if (error) {
        console.error("Supabase saveEntry Error:", error);
      }
    } catch (e) {
      console.warn("Supabase saveEntry exception:", e);
    }
  }
  
  const entries = loadEntries();
  const idx = entries.findIndex(e => e.id === entry.id);
  if (idx > -1) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  saveEntries(entries);
}

async function deleteEntry(id: string, email: string): Promise<boolean> {
  if (supabase) {
    try {
      const { error } = await supabase
        .from("entries")
        .delete()
        .eq("id", id)
        .eq("user_email", email);
      if (error) {
        console.warn("Supabase deleteEntry failed:", error.message);
      }
    } catch (e) {
      console.warn("Supabase deleteEntry exception:", e);
    }
  }
  
  const entries = loadEntries();
  const idx = entries.findIndex(e => e.id === id && e.userEmail === email);
  if (idx === -1) return false;
  entries.splice(idx, 1);
  saveEntries(entries);
  return true;
}

async function resetEntries(email: string): Promise<void> {
  if (supabase) {
    try {
      const { error } = await supabase
        .from("entries")
        .delete()
        .eq("user_email", email);
      if (error) {
        console.warn("Supabase resetEntries failed:", error.message);
      }
    } catch (e) {
      console.warn("Supabase resetEntries exception:", e);
    }
  }
  
  let entries = loadEntries();
  entries = entries.filter(e => e.userEmail !== email);
  saveEntries(entries);
}

// --- Token & Hashing Utilities ---
const JWT_SECRET = process.env.JWT_SECRET || "my-super-secret-ledger-key-2026";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + JWT_SECRET).digest("hex");
}

function generateToken(payload: { email: string; name: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string): { email: string; name: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Date.now()) return null;
    return { email: payload.email, name: payload.name };
  } catch (e) {
    return null;
  }
}

// --- Authentication Middleware ---
function authenticate(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }
  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
  req.user = decoded;
  next();
}

// --- API Endpoints ---

// 1. SignUp
app.post("/api/auth/signup", async (req: any, res: any) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const emailLower = email.toLowerCase().trim();
  const users = await getUsers();
  if (users.find(u => u.email === emailLower)) {
    return res.status(400).json({ error: "An account with this email already exists" });
  }

  const newUser: User = {
    email: emailLower,
    passwordHash: hashPassword(password),
    name: name.trim(),
    createdAt: new Date().toISOString()
  };
  await saveUser(newUser);

  const token = generateToken({ email: newUser.email, name: newUser.name });
  res.json({ token, user: { email: newUser.email, name: newUser.name } });
});

// 2. LogIn
app.post("/api/auth/login", async (req: any, res: any) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const emailLower = email.toLowerCase().trim();
  const users = await getUsers();
  const user = users.find(u => u.email === emailLower);
  if (!user || !user.passwordHash || user.passwordHash !== hashPassword(password)) {
    return res.status(400).json({ error: "Invalid email or password" });
  }

  const token = generateToken({ email: user.email, name: user.name });
  res.json({ token, user: { email: user.email, name: user.name, picture: user.picture } });
});

// 3. Me (Verify Auth state)
app.get("/api/auth/me", authenticate, async (req: any, res: any) => {
  const users = await getUsers();
  const user = users.find(u => u.email === req.user.email);
  res.json({ user: { email: req.user.email, name: req.user.name, picture: user?.picture } });
});

// 4. Google Auth URL Construction
app.get("/api/auth/google/url", (req: any, res: any) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
  const redirectUri = `${appUrl}/auth/callback`;

  // Fallback to Mock login if real Google SSO keys are missing or placeholders
  if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID" || !clientSecret) {
    // Return our custom Mock Google SSO launcher URL
    const mockAuthUrl = `${appUrl}/api/auth/google/mock-login?redirect_uri=${encodeURIComponent(redirectUri)}`;
    return res.json({ url: mockAuthUrl, isMock: true });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account"
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, isMock: false });
});

// Mock Google Login Form UI
app.get("/api/auth/google/mock-login", (req: any, res: any) => {
  const redirectUri = req.query.redirect_uri || "";
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sign in with Google - My Ledger Preview</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
      <style>
        body {
          margin: 0;
          background-color: #f2f2f2;
          font-family: 'Inter', sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          color: #202124;
        }
        .box {
          background: #ffffff;
          border: 1px solid #dadce0;
          border-radius: 8px;
          width: 450px;
          padding: 40px;
          box-sizing: border-box;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .logo-container {
          display: flex;
          justify-content: center;
          margin-bottom: 16px;
        }
        .logo {
          font-size: 24px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .logo span:nth-child(1) { color: #4285F4; }
        .logo span:nth-child(2) { color: #EA4335; }
        .logo span:nth-child(3) { color: #FBBC05; }
        .logo span:nth-child(4) { color: #34A853; }
        .title {
          font-size: 24px;
          text-align: center;
          margin: 0 0 8px;
          font-weight: 500;
        }
        .subtitle {
          font-size: 16px;
          text-align: center;
          color: #5f6368;
          margin: 0 0 32px;
        }
        .info-alert {
          background-color: #E4EEE3;
          border: 1px solid #3F6E52;
          color: #3F6E52;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 13px;
          margin-bottom: 24px;
          line-height: 1.4;
        }
        .account-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border: 1px solid #dadce0;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s, border-color 0.2s;
          margin-bottom: 12px;
        }
        .account-item:hover {
          background-color: #f8f9fa;
          border-color: #ccc;
        }
        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #3F6E52;
          color: #fff;
          display: flex;
          justify-content: center;
          align-items: center;
          font-weight: 600;
          font-size: 16px;
        }
        .avatar.guest {
          background: #A8442F;
        }
        .details {
          flex: 1;
        }
        .name {
          font-size: 14px;
          font-weight: 500;
        }
        .email {
          font-size: 12px;
          color: #5f6368;
        }
        .custom-form {
          margin-top: 24px;
          border-top: 1px solid #dadce0;
          padding-top: 20px;
        }
        .custom-title {
          font-size: 13px;
          font-weight: 600;
          color: #5f6368;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .input-group {
          margin-bottom: 12px;
        }
        .input-group label {
          display: block;
          font-size: 12px;
          color: #5f6368;
          font-weight: 500;
          margin-bottom: 4px;
        }
        input {
          width: 100%;
          padding: 10px;
          border: 1px solid #dadce0;
          border-radius: 4px;
          font-size: 13px;
          box-sizing: border-box;
        }
        .btn {
          width: 100%;
          background-color: #1a73e8;
          color: #fff;
          border: none;
          padding: 10px;
          border-radius: 4px;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
        }
        .btn:hover {
          background-color: #1557b0;
        }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="logo-container">
          <div class="logo">
            <span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span>
          </div>
        </div>
        <h1 class="title">Choose an account</h1>
        <p class="subtitle">to continue to My Ledger</p>

        <div class="info-alert">
          💡 <b>Development Preview Mode:</b> Genuine Google credentials are not yet configured. This simulated Google SSO authorizes you instantly using the profiles below.
        </div>

        <div class="account-item" onclick="selectMock('anirudhm0547@gmail.com', 'Anirudh M')">
          <div class="avatar">AM</div>
          <div class="details">
            <div class="name">Anirudh M</div>
            <div class="email">anirudhm0547@gmail.com</div>
          </div>
        </div>

        <div class="account-item" onclick="selectMock('guest_ledger@gmail.com', 'Guest Ledger')">
          <div class="avatar guest">GL</div>
          <div class="details">
            <div class="name">Guest Ledger</div>
            <div class="email">guest_ledger@gmail.com</div>
          </div>
        </div>

        <div class="custom-form">
          <div class="custom-title">Or sign in with a custom profile</div>
          <form onsubmit="handleCustom(event)">
            <div class="input-group">
              <label>Name</label>
              <input type="text" id="cust-name" placeholder="John Doe" required>
            </div>
            <div class="input-group">
              <label>Email Address</label>
              <input type="email" id="cust-email" placeholder="john.doe@gmail.com" required>
            </div>
            <button type="submit" class="btn">Sign in as custom profile</button>
          </form>
        </div>
      </div>

      <script>
        const redirectUri = "${redirectUri}";
        function selectMock(email, name) {
          const code = 'mock_code_' + btoa(JSON.stringify({email, name}));
          window.location.href = redirectUri + '?code=' + code;
        }
        function handleCustom(e) {
          e.preventDefault();
          const email = document.getElementById('cust-email').value.trim();
          const name = document.getElementById('cust-name').value.trim();
          selectMock(email, name);
        }
      </script>
    </body>
    </html>
  `);
});

// 5. Auth Callback (Handles real Google Code Exchange OR Mock Code Exchange)
app.get(["/auth/callback", "/auth/callback/"], async (req: any, res: any) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("No authentication code was received.");
  }

  let userProfile: { email: string; name: string; picture?: string; googleId?: string } = {
    email: "",
    name: ""
  };

  if (code.startsWith("mock_code_")) {
    // Decode mock payload
    try {
      const base64 = code.replace("mock_code_", "");
      const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
      userProfile = {
        email: payload.email.toLowerCase().trim(),
        name: payload.name,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(payload.name)}`,
        googleId: `mock_google_id_${payload.email}`
      };
    } catch (e) {
      return res.status(400).send("Invalid preview authentication code format.");
    }
  } else {
    // Real Google Auth Code Exchange
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const redirectUri = `${appUrl}/auth/callback`;

      // 1. Exchange Code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          code: code.toString(),
          grant_type: "authorization_code",
          redirect_uri: redirectUri
        }).toString()
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error_description || "Token exchange failed");
      }

      const tokens = await tokenResponse.json();

      // 2. Fetch User Profile
      const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      if (!userResponse.ok) {
        throw new Error("Failed to fetch user profile information from Google.");
      }

      const googleProfile = await userResponse.json();
      userProfile = {
        email: googleProfile.email.toLowerCase().trim(),
        name: googleProfile.name || googleProfile.given_name || "Google User",
        picture: googleProfile.picture,
        googleId: googleProfile.sub
      };
    } catch (err: any) {
      console.error("Google OAuth Exchange Error:", err);
      return res.status(500).send(`Authentication failed: ${err.message}`);
    }
  }

  // Save/Update user in local database
  const users = await getUsers();
  let existingUser = users.find(u => u.email === userProfile.email);
  if (!existingUser) {
    existingUser = {
      email: userProfile.email,
      name: userProfile.name,
      picture: userProfile.picture,
      googleId: userProfile.googleId,
      createdAt: new Date().toISOString()
    };
  } else {
    existingUser.name = userProfile.name;
    if (userProfile.picture) existingUser.picture = userProfile.picture;
    if (userProfile.googleId) existingUser.googleId = userProfile.googleId;
  }
  await saveUser(existingUser);

  // Generate Session Token
  const token = generateToken({ email: existingUser.email, name: existingUser.name });

  // Send message back to parent React window via postMessage and close popup
  res.send(`
    <html>
      <body style="font-family: -apple-system, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; background-color: #EFEEE6; color: #23282B;">
        <div style="background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 1px solid #DAD6C6; text-align: center;">
          <h2 style="margin: 0 0 10px 0; font-family: sans-serif;">Authorized successfully!</h2>
          <p style="color: #6B6F66; margin: 0 0 20px 0;">Completing setup, please wait...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: "OAUTH_AUTH_SUCCESS", 
              payload: { 
                token: "${token}", 
                user: ${JSON.stringify({ email: existingUser.email, name: existingUser.name, picture: existingUser.picture })} 
              } 
            }, "*");
            window.close();
          } else {
            // Save token to localStorage and redirect
            localStorage.setItem("ledger_token", "${token}");
            localStorage.setItem("ledger_user", JSON.stringify(${JSON.stringify({ email: existingUser.email, name: existingUser.name, picture: existingUser.picture })}));
            window.location.href = "/";
          }
        </script>
      </body>
    </html>
  `);
});

// --- Storage Status Endpoint ---
app.get("/api/storage-status", (req: any, res: any) => {
  res.json({
    isSupabaseEnabled,
    supabaseUrl: isSupabaseEnabled ? supabaseUrl : null,
  });
});

// --- Ledger Entries Routes ---

// Get all entries for authenticated user
app.get("/api/entries", authenticate, async (req: any, res: any) => {
  const userEntries = await getEntries(req.user.email);
  res.json(userEntries);
});

// Create new entry
app.post("/api/entries", authenticate, async (req: any, res: any) => {
  const { type, amount, note, category, date } = req.body;
  if (!type || !amount || amount <= 0) {
    return res.status(400).json({ error: "Type and valid positive amount are required" });
  }

  if (date) {
    const parsedDate = new Date(date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    if (parsedDate > tomorrow) {
      return res.status(400).json({ error: "Future dates are not allowed" });
    }
  }

  const newEntry: Entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    type,
    amount: parseFloat(amount),
    note: (note || "").trim(),
    category: type === "expense" ? category : "Income",
    date: date || new Date().toISOString(),
    userEmail: req.user.email
  };

  await saveEntry(newEntry);
  res.json(newEntry);
});

// Delete entry
app.delete("/api/entries/:id", authenticate, async (req: any, res: any) => {
  const { id } = req.params;
  const success = await deleteEntry(id, req.user.email);
  if (!success) {
    return res.status(404).json({ error: "Entry not found or unauthorized" });
  }
  res.json({ success: true });
});

// Update entry
app.put("/api/entries/:id", authenticate, async (req: any, res: any) => {
  const { id } = req.params;
  const { type, amount, note, category, date } = req.body;

  const entries = await getEntries(req.user.email);
  const entry = entries.find(e => e.id === id);
  if (!entry) {
    return res.status(404).json({ error: "Entry not found or unauthorized" });
  }

  if (amount !== undefined) {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Please provide a valid positive amount" });
    }
    entry.amount = parsedAmount;
  }
  if (type !== undefined) entry.type = type;
  if (note !== undefined) entry.note = note.trim();
  if (category !== undefined) entry.category = type === "income" ? "Income" : category;
  if (date !== undefined) {
    const parsedDate = new Date(date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    if (parsedDate > tomorrow) {
      return res.status(400).json({ error: "Future dates are not allowed" });
    }
    entry.date = date;
  }

  await saveEntry(entry);
  res.json(entry);
});

// Reset all entries for user
app.delete("/api/entries", authenticate, async (req: any, res: any) => {
  await resetEntries(req.user.email);
  res.json({ success: true });
});

// --- Vite Middleware in Development, Static Assets in Production ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(resolvedDir, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
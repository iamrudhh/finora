# Finora 💰

A sleek, multi-period personal finance ledger — track expenses and income, explore category-level analytics, and sign in securely with Google.

Built as a personal project to learn full-stack development with React, Express, Google OAuth, and Supabase.

---

## ✨ Features

- 🔐 **Google Sign-In (OAuth 2.0)** — secure authentication, no passwords to manage
- 📊 **Category analytics** — see spending trends broken down by category
- 📅 **Multi-period ledger** — track entries across different time ranges
- ☁️ **Supabase-backed** — entries and users sync to a Postgres database in real time
- 💾 **Local-first fallback** — data also persists locally as JSON, auto-syncing to Supabase
- ⚡ **Fast, modern stack** — React 19, Vite, TypeScript, Tailwind CSS

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS, Vite |
| Backend | Express, TypeScript (via `tsx`) |
| Auth | Google OAuth 2.0 |
| Database | Supabase (PostgreSQL) |
| AI | Google Gemini API |


## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A [Supabase](https://supabase.com/) project
- A [Google Cloud](https://console.cloud.google.com/) OAuth 2.0 Client ID
- A [Google AI Studio](https://aistudio.google.com/) Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/iamrudhh/finora.git
   cd finora
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example file and fill in your own values:
   ```bash
   cp .env.example .env
   ```

   Then open `.env` and add your credentials:

   | Variable | Description |
   |---|---|
   | `GEMINI_API_KEY` | Your Gemini API key from Google AI Studio |
   | `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID from Google Cloud Console |
   | `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret from Google Cloud Console |
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_KEY` | Your Supabase anon/publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (server-side only) |
   | `APP_URL` | The URL your app runs on, e.g. `http://localhost:3000` |

   > ⚠️ **Never commit your `.env` file.** It's already excluded via `.gitignore`.

4. **Run the app**
   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000) in your browser.

## 🗄️ Database Setup

This project expects two tables in your Supabase project:

- **`users`** — synced from Google SSO profiles
- **`entries`** — expense/income records, linked to `users` via a foreign key on `user_email`

Row Level Security (RLS) is enabled on both tables. The backend uses the Supabase **service role key** to perform writes, since authentication is handled by this app's own Google SSO flow rather than Supabase Auth directly.

## 📦 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run the app locally in development mode |
| `npm run build` | Build the frontend and bundle the server for production |
| `npm start` | Run the production build |
| `npm run lint` | Type-check the project with TypeScript |

## ☁️ Deployment

This app requires a host that can run a persistent Node/Express server (not a static host). It deploys cleanly to:

- [Render](https://render.com/)
- [Railway](https://railway.app/)
- [Fly.io](https://fly.io/)

Set the build command to `npm run build`, the start command to `npm start`, and add all environment variables from `.env.example` in your host's dashboard.

> Static hosts like GitHub Pages, or edge/serverless-only platforms like Vercel and Netlify (without rewriting the backend into serverless functions), are **not** compatible with this project as-is.

## 🔒 Security Notes

- Secrets are managed entirely through environment variables — never hardcoded
- `.env` is git-ignored; only `.env.example` (with empty placeholders) is committed
- The Supabase service role key is used **server-side only** and never exposed to the browser
- Local data (`data/` folder) containing user info is also excluded from version control

## 📄 License

This is a personal project built for learning purposes. Feel free to explore the code — please don't redistribute the Google/Supabase credentials pattern without setting up your own project keys.

## 🙋 About

Built by [@iamrudhh](https://github.com/iamrudhh) as a first project exploring Google SSO and Supabase integration in a full-stack TypeScript app.


import { useEffect, useState } from "react";
import MealManagement from "./pages/MealManagement.jsx"
import AdminMealReview from "./pages/AdminMealReview";
import ExpenseManagement from "./components/ExpenseManagement";
import UtilitiesManagement from "./components/UtilitiesManagement";
const API = "/flathisab/backend/auth/";

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("Dashboard");
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = user?.role === "ADMIN";

  // Restore login session after page refresh
  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch(API + "check-auth.php", {
          credentials: "include"
        });

        const data = await response.json();

        if (response.ok && data.authenticated) {
          setUser(data.user);
        }
      } catch (err) {
        console.error("Session check failed:", err);
      } finally {
        setChecking(false);
      }
    }

    checkSession();
  }, []);

  // Login
  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(API + "login.php", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed.");
      }

      setUser(data.user);
      setPage("Dashboard");
      setPassword("");

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Logout
  async function handleLogout() {
    try {
      const response = await fetch(API + "logout.php", {
        method: "POST",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Logout failed.");
      }

      setUser(null);
      setUsername("");
      setPassword("");
      setPage("Dashboard");
      setError("");

    } catch (err) {
      setError(err.message);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-green-800 font-semibold">
          Loading FlatHisab...
        </p>
      </div>
    );
  }

  // Login Page
  if (!user) {
    return (
      <div className="min-h-screen bg-[#f3f6f2] flex items-center justify-center p-5">
        <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl overflow-hidden grid md:grid-cols-2">

          <div className="bg-[#173f32] text-white p-10 md:p-12 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center text-2xl">
                  F
                </div>
                <span className="text-2xl font-bold">FlatHisab</span>
              </div>

              <div className="mt-20">
                <p className="text-green-300 font-semibold text-sm tracking-widest">
                  SMART FLAT MANAGEMENT
                </p>
                <h1 className="text-4xl font-bold leading-tight mt-5">
                  Manage your flat.
                  <br />
                  Simplify your life.
                </h1>
                <p className="text-green-100/80 mt-6 leading-7">
                  Manage daily meals, bazar expenses, utilities
                  and monthly settlements — all in one place.
                </p>
              </div>
            </div>

            <p className="text-green-200/60 text-sm mt-16">
              © 2026 FlatHisab
            </p>
          </div>

          <div className="p-8 md:p-14 flex flex-col justify-center">
            <p className="text-green-700 font-semibold text-sm">
              WELCOME BACK
            </p>

            <h2 className="text-3xl font-bold text-slate-800 mt-2">
              Sign in to your account
            </h2>

            <p className="text-slate-500 mt-2 mb-8">
              Enter your credentials to continue.
            </p>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Username
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                  required
                  className="w-full border border-slate-300 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Password
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    required
                    className="w-full border border-slate-300 rounded-xl px-4 py-3.5 pr-20 outline-none focus:ring-2 focus:ring-green-600"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-green-700 font-semibold"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <p className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-sm">
                  {error}
                </p>
              )}

              <button
                disabled={loading}
                className="w-full bg-[#287653] hover:bg-[#1d5d40] disabled:opacity-60 text-white rounded-xl py-3.5 font-semibold"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p className="text-center text-sm text-slate-400 mt-8">
              Secure access for flat members and administrators.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Navigation
  const adminMenu = [
    "Dashboard",
    "Members",
    "Meal Management",
    "Bazar & Expenses",
    "Utilities",
    "Deposits",
    "Monthly Settlement",
    "Reports"
  ];

  const memberMenu = [
    "Dashboard",
    "My Meals",
    "Bazar & Expenses",
    "Utilities",
    "Deposits",
    "My Balance",
    "Monthly History"
  ];

  const menu = isAdmin ? adminMenu : memberMenu;

  const descriptions = {
    "Dashboard": "Overview of your flat accounts.",
    "Members": "Manage flat members and their accounts.",
    "Meal Management": "Manage daily lunch and dinner entries.",
    "My Meals": "View your personal meal records.",
    "Bazar & Expenses": "Track bazar purchases and expenses.",
    "Utilities": "Manage shared flat expenses.",
    "Deposits": "Track member deposits and contributions.",
    "Monthly Settlement": "Review monthly payments and balances.",
    "My Balance": "View your personal account balance.",
    "Monthly History": "Review your previous monthly accounts.",
    "Reports": "View financial reports and summaries."
  };

  const stats = [
    { title: "Total Meals", value: "—", note: "Lunch & Dinner", icon: "🍽️" },
    { title: "Meal Rate", value: "—", note: "Cost per meal", icon: "📊" },
    { title: "Food Expenses", value: "—", note: "Monthly total", icon: "🛒" },
    { title: "Utilities", value: "—", note: "Shared expenses", icon: "💡" }
  ];

  return (
    <div className="min-h-screen bg-[#f5f7f5] flex">

      {/* Sidebar */}
      <aside className="w-64 bg-[#173f32] text-white min-h-screen hidden md:flex flex-col">

        <div className="px-6 py-7 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl">
              F
            </div>
            <div>
              <h1 className="text-xl font-bold">FlatHisab</h1>
              <p className="text-xs text-green-200">Flat Management</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-6 flex-1">
          <p className="text-xs text-green-300 font-semibold tracking-widest mb-4">
            MAIN MENU
          </p>
          <button
          onClick={() => setPage("Meal Review")}
          className={`w-full text-left px-4 py-3 rounded-xl ${
          page === "Meal Review"
           ? "bg-white text-[#174638] font-semibold"
           : "text-white hover:bg-white/10"
           }`}
          >
           Meal Review
          </button>
          <nav className="space-y-2">
            {menu.map((item, index) => (
              <button
                key={item}
                onClick={() => setPage(item)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition ${
                  page === item
                    ? "bg-white text-[#173f32] font-bold"
                    : "text-green-100 hover:bg-white/10"
                }`}
              >
                <span className="mr-3">
                  {["▦", "♙", "☷", "◈", "◇", "↗", "◷", "▤"][index]}
                </span>
                {item}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-5 border-t border-white/10">
          <p className="text-xs text-green-200">Logged in as</p>
          <p className="font-semibold mt-1">{user.full_name}</p>
          <p className="text-xs text-green-300 mt-1">
            {isAdmin ? "Administrator" : "Flat Member"}
          </p>
        </div>
        
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">

        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-5 md:px-8 py-5 flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-400">FlatHisab / {page}</p>
            <h2 className="text-xl font-bold text-slate-800 mt-1">
              {page}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-800">
                {user.full_name}
              </p>
              <p className="text-xs text-slate-500">
                {isAdmin ? "Admin" : "Member"}
              </p>
            </div>

            <div className="w-10 h-10 rounded-full bg-green-100 text-green-800 flex items-center justify-center font-bold">
              {user.full_name?.charAt(0)}
            </div>

            <button
              onClick={handleLogout}
              className="text-sm text-red-600 font-semibold hover:bg-red-50 rounded-lg px-3 py-2"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="p-5 md:p-8">

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-800">
              Hello, {user.full_name}!
            </h1>
            <p className="text-slate-500 mt-1">
              {descriptions[page]}
            </p>
          </div>

          {page === "Dashboard" ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {stats.map((stat) => (
                  <div
                    key={stat.title}
                    className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm"
                  >
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-slate-500 font-medium">
                        {stat.title}
                      </p>
                      <span className="text-2xl">{stat.icon}</span>
                    </div>

                    <h3 className="text-3xl font-bold text-slate-800 mt-5">
                      {stat.value}
                    </h3>

                    <p className="text-xs text-slate-400 mt-2">
                      {stat.note}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-5 mt-7">

                <div className="bg-white rounded-2xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 text-lg">
                    Account Overview
                  </h3>
                  <p className="text-sm text-slate-500 mt-2">
                    Your current account information.
                  </p>

                  <div className="mt-6 space-y-4">
                    <div className="flex justify-between border-b pb-3">
                      <span className="text-slate-500 text-sm">Name</span>
                      <span className="font-semibold text-sm">{user.full_name}</span>
                    </div>

                    <div className="flex justify-between border-b pb-3">
                      <span className="text-slate-500 text-sm">Username</span>
                      <span className="font-semibold text-sm">{user.username}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Account Role</span>
                      <span className="font-semibold text-green-700 text-sm">
                        {user.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 text-lg">
                    Quick Access
                  </h3>

                  <div className="grid grid-cols-2 gap-3 mt-5">
                    {(isAdmin
                      ? ["Members", "Meal Management", "Bazar & Expenses", "Monthly Settlement"]
                      : ["My Meals", "Bazar & Expenses", "Deposits", "My Balance"]
                    ).map((item) => (
                      <button
                        key={item}
                        onClick={() => setPage(item)}
                        className="bg-[#f0f6f1] hover:bg-green-100 text-[#20563e] rounded-xl p-4 text-sm font-semibold text-left"
                      >
                        {item} →
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </>
         ): page === "Meal Management" || page === "My Meals" ? (
        <MealManagement user={user} />

        ) : page === "Meal Review" ? (
         user?.role === "ADMIN" ? (
            <AdminMealReview />
        ) : (
         <div className="p-6 text-red-600">
            Access denied. Admin only.
         </div>
        )

          ) : page === "Bazar & Expenses" ? (
           <ExpenseManagement user={user} />

          ) : page === "Utilities" ? (
            <UtilitiesManagement user={user} />
          ) : (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 min-h-64">
        <h3 className="text-xl font-bold text-slate-800">
            {page}
        </h3>
        <p className="text-slate-500 mt-3">
            This module is scheduled for development.
        </p>
    </div>
)}


          <footer className="text-center text-xs text-slate-400 mt-10">
            © 2026 FlatHisab. Manage your flat smarter.
          </footer>

        </div>
      </main>
    </div>
  );
}

export default App;

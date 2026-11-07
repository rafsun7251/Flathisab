
import { useEffect, useState } from "react";

const API = "/flathisab/backend/api/";

export default function SettlementManagement({ user }) {
  const isAdmin = user?.role === "ADMIN";

  const [monthId, setMonthId] = useState("2");
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      ...options
    });

    const data = await response.json();

    if (!response.ok || data.status !== "success") {
      throw new Error(data.message || "Request failed.");
    }

    return data;
  }

  async function loadSettlement() {
    if (!monthId || Number(monthId) <= 0) {
      setError("Enter a valid Month ID.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await apiRequest(
        API + `settlements.php?month_id=${monthId}`
      );

      setSettlements(data.data || []);

    } catch (err) {
      setError(err.message);
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettlement();
  }, [monthId]);

  async function calculateSettlement() {
    if (!isAdmin) return;

    setError("");
    setMessage("");

    if (!window.confirm(
      "Calculate settlement using all verified records for this month?"
    )) {
      return;
    }

    try {
      setCalculating(true);

      const data = await apiRequest(API + "settlements.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          month_id: Number(monthId)
        })
      });

      setMessage(data.message);

      await loadSettlement();

    } catch (err) {
      setError(err.message);
    } finally {
      setCalculating(false);
    }
  }

  const first = settlements[0];

  const totalMealQuantity = settlements.reduce(
    (sum, item) => sum + Number(item.meal_quantity || 0),
    0
  );

  const mealRate = Number(first?.meal_rate || 0);
  const foodExpense = Number(first?.food_expense_total || 0);
  const fixedShare = Number(first?.fixed_expense_share || 0);

  const totalDeposits = settlements.reduce(
    (sum, item) => sum + Number(item.deposits_total || 0),
    0
  );

  const totalCredits = settlements.reduce(
    (sum, item) => sum + Number(item.expenses_paid_credit || 0),
    0
  );

  return (
    <div className="space-y-6">

      {/* Header */}

      <div>
        <p className="text-sm text-slate-500">
          Accounts / Monthly Settlement
        </p>

        <h2 className="text-2xl font-bold text-slate-800 mt-1">
          Monthly Settlement
        </h2>

        <p className="text-slate-500 mt-2">
          Calculate and review each member's monthly balance.
        </p>
      </div>

      {/* Month Selection */}

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Month ID
        </label>

        <div className="flex flex-wrap gap-3">
          <input
            type="number"
            min="1"
            value={monthId}
            onChange={(e) => setMonthId(e.target.value)}
            className="border border-slate-300 rounded-xl px-4 py-3 w-36"
          />

          <button
            type="button"
            onClick={loadSettlement}
            disabled={loading || !monthId}
            className="px-5 py-3 rounded-xl border border-slate-300 font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={calculateSettlement}
              disabled={calculating || loading || !monthId}
              className="px-5 py-3 rounded-xl bg-[#287653] text-white font-semibold hover:bg-[#1d5d40] disabled:opacity-50"
            >
              {calculating ? "Calculating..." : "Calculate Settlement"}
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400 mt-3">
          October 2026 = Month ID 1. November 2026 = Month ID 2.
        </p>
      </div>

      {/* Messages */}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-sm">
          {message}
        </div>
      )}

      {/* Summary Cards */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <SummaryCard
          title="Total Meal Quantity"
          value={totalMealQuantity.toFixed(2)}
          subtitle="Verified meals"
        />

        <SummaryCard
          title="Meal Rate"
          value={`৳${mealRate.toFixed(4)}`}
          subtitle="Per meal"
        />

        <SummaryCard
          title="Food / Bazar Expense"
          value={`৳${foodExpense.toFixed(2)}`}
          subtitle="Verified expenses"
        />

        <SummaryCard
          title="Fixed Expense Share"
          value={`৳${fixedShare.toFixed(2)}`}
          subtitle="Per active member"
        />

      </div>

      {/* Credits Summary */}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <SummaryCard
          title="Verified Deposits"
          value={`৳${totalDeposits.toFixed(2)}`}
          subtitle="All member deposits"
        />

        <SummaryCard
          title="Member Paid Expenses"
          value={`৳${totalCredits.toFixed(2)}`}
          subtitle="Verified personal payments"
        />

      </div>

      {/* Settlement Table */}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">

        <div className="p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">
            Member-wise Settlement
          </h3>

          <p className="text-sm text-slate-500 mt-1">
            Review individual monthly calculations.
          </p>
        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left">

            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr>
                <th className="px-5 py-4">Member</th>
                <th className="px-5 py-4">Total Deposit</th>
                <th className="px-5 py-4">Meal Deposit</th>
                <th className="px-5 py-4">Utility Deposit</th>
                <th className="px-5 py-4">Total Meals</th>
                <th className="px-5 py-4">Meal Rate</th>
                <th className="px-5 py-4">Meal Cost</th>
                <th className="px-5 py-4">Utility Share</th>
                <th className="px-5 py-4">Paid Expense</th>
            
                <th className="px-5 py-4">Settlement</th>
              </tr>
            </thead>

                            <tbody>
                {loading ? (
                    <tr>
                    <td colSpan="11" className="text-center py-8 text-slate-400">
                        Loading settlement...
                    </td>
                    </tr>
                ) : settlements.length === 0 ? (
                    <tr>
                    <td colSpan="11" className="text-center py-10 text-slate-400">
                        No settlement records found. Admin can calculate this month.
                    </td>
                    </tr>
                ) : (
                    settlements.map((item) => {
                    const balance = Number(item.final_balance || 0);

                    return (
                        <tr
                        key={item.settlement_id}
                        className="border-t border-slate-100"
                        >
                        {/* 1. Member */}
                        <td className="px-5 py-4 font-semibold text-slate-800">
                            {item.member_name}
                        </td>

                        {/* 2. Total Deposit */}
                        <td className="px-5 py-4">
                            ৳{Number(item.deposits_total || 0).toFixed(2)}
                        </td>

                        {/* 3. Meal Deposit */}
                        <td className="px-5 py-4">
                            ৳{Number(item.meal_deposit || 0).toFixed(2)}
                        </td>

                        {/* 4. Utility Deposit */}
                        <td className="px-5 py-4">
                            ৳{Number(item.utility_deposit || 0).toFixed(2)}
                        </td>

                        {/* 5. Total Meals */}
                        <td className="px-5 py-4">
                            {Number(item.meal_quantity || 0).toFixed(2)}
                        </td>

                        {/* 6. Meal Rate */}
                        <td className="px-5 py-4">
                            ৳{Number(item.meal_rate || 0).toFixed(2)}
                        </td>

                        {/* 7. Meal Cost */}
                        <td className="px-5 py-4">
                            ৳{Number(item.meal_cost || 0).toFixed(2)}
                        </td>

                        {/* 8. Utility Share */}
                        <td className="px-5 py-4">
                            ৳{Number(item.fixed_expense_share || 0).toFixed(2)}
                        </td>

                        {/* 9. Paid Expense */}
                        <td className="px-5 py-4">
                            ৳{Number(item.expenses_paid_credit || 0).toFixed(2)}
                        </td>

                       

                        {/* 11. Final Settlement */}
                        <td
                            className={`px-5 py-4 font-bold ${
                            balance > 0
                                ? "text-red-600"
                                : balance < 0
                                ? "text-green-700"
                                : "text-slate-600"
                            }`}
                        >
                            {balance > 0
                            ? `Pay ৳${balance.toFixed(2)}`
                            : balance < 0
                            ? `Receive ৳${Math.abs(balance).toFixed(2)}`
                            : "Settled"}
                        </td>
                        </tr>
                    );
                    })
                )}
                </tbody>
          </table>

        </div>

      </div>

      <p className="text-xs text-slate-400">
        Positive balance = Member must pay. Negative balance = Member receives money.
      </p>

    </div>
  );
}

function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <p className="text-sm text-slate-500">{title}</p>

      <h3 className="text-2xl font-bold text-slate-800 mt-2">
        {value}
      </h3>

      <p className="text-xs text-slate-400 mt-2">
        {subtitle}
      </p>
    </div>
  );
}

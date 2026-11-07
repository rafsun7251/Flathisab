
import { useEffect, useState } from "react";

const API = "/flathisab/backend/api/";

export default function DepositAllocation() {
  const [deposits, setDeposits] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [allocations, setAllocations] = useState([]);

  const [mealAmount, setMealAmount] = useState("");
  const [utilityAmount, setUtilityAmount] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedDeposit = deposits.find(
    item => String(item.deposit_id) === selectedId
  );

  const totalAmount = Number(selectedDeposit?.amount || 0);
  const meal = Number(mealAmount || 0);
  const utility = Number(utilityAmount || 0);
  const allocated = meal + utility;
  const remaining = totalAmount - allocated;

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

  async function loadDeposits() {
    try {
      setLoading(true);
      setError("");

      const month = new Date().toLocaleDateString("en-CA").slice(0, 7);

      const data = await apiRequest(
        API + `deposits.php?month=${month}`
      );

      const verified = (data.data || []).filter(
        item =>
          item.status === "VERIFIED" &&
          item.deposit_type === "GENERAL_FUND"
      );

      const results = await Promise.all(
        verified.map(async item => {
          try {
            const allocationData = await apiRequest(
              API + `deposit-allocations.php?deposit_id=${item.deposit_id}`
            );

            return {
              ...item,
              allocated_total: Number(
                allocationData.data.allocated_total || 0
              ),
              unallocated_amount: Number(
                allocationData.data.unallocated_amount || 0
              ),
              allocations: allocationData.data.allocations || []
            };
          } catch {
            return {
              ...item,
              allocated_total: 0,
              unallocated_amount: Number(item.amount),
              allocations: []
            };
          }
        })
      );

      setDeposits(results);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeposits();
  }, []);

  function selectDeposit(id) {
    setSelectedId(String(id));
    setMealAmount("");
    setUtilityAmount("");
    setNote("");
    setMessage("");
    setError("");
  }

  async function saveAllocation(e) {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!selectedDeposit) {
      setError("Please select a deposit.");
      return;
    }

    if (meal < 0 || utility < 0 || allocated <= 0) {
      setError("Enter a valid allocation amount.");
      return;
    }

    if (allocated > totalAmount + 0.001) {
      setError("Allocation cannot exceed deposit amount.");
      return;
    }

    if (!window.confirm(
      `Allocate this deposit?\nMeal: ৳${meal.toFixed(2)}\nUtility: ৳${utility.toFixed(2)}\nRemaining: ৳${remaining.toFixed(2)}`
    )) {
      return;
    }

    try {
      setSaving(true);

      const data = await apiRequest(
        API + "deposit-allocations.php",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            deposit_id: Number(selectedId),
            meal_amount: meal,
            utility_amount: utility,
            note
          })
        }
      );

      setMessage(
        `Allocation saved successfully. Remaining: ৳${Number(
          data.data.unallocated_amount
        ).toFixed(2)}`
      );

      await loadDeposits();

      setMealAmount("");
      setUtilityAmount("");
      setNote("");

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border p-6 text-slate-500">
        Loading deposit allocations...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div>
        <h3 className="text-xl font-bold text-slate-800">
          Admin Deposit Allocation
        </h3>

        <p className="text-sm text-slate-500 mt-1">
          Distribute verified General Fund deposits between Meal and Utility Funds.
        </p>
      </div>

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

      {/* Deposit List */}

      <div className="bg-white rounded-2xl border overflow-hidden">

        <div className="p-5 border-b">
          <h4 className="font-bold text-slate-800">
            Verified General Fund Deposits
          </h4>
        </div>

        {deposits.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No verified General Fund deposits found this month.
          </div>
        ) : (
          <div className="divide-y">
            {deposits.map(item => (
              <button
                type="button"
                key={item.deposit_id}
                onClick={() => selectDeposit(item.deposit_id)}
                className={`w-full text-left p-5 hover:bg-slate-50 transition ${
                  selectedId === String(item.deposit_id)
                    ? "bg-green-50 border-l-4 border-green-600"
                    : ""
                }`}
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {item.member_name} — Deposit #{item.deposit_id}
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      {item.deposit_date} · {item.payment_method}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-slate-800">
                      ৳{Number(item.amount).toFixed(2)}
                    </p>

                    <p className="text-xs text-amber-700 mt-1">
                      Unallocated: ৳{item.unallocated_amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Allocation Form */}

      {selectedDeposit && (
        <form
          onSubmit={saveAllocation}
          className="bg-white rounded-2xl border p-6 space-y-5"
        >

          <div>
            <h4 className="font-bold text-lg text-slate-800">
              Allocate Deposit #{selectedDeposit.deposit_id}
            </h4>

            <p className="text-sm text-slate-500 mt-1">
              Member: {selectedDeposit.member_name}
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm text-slate-500">
              Total Deposit Amount
            </p>

            <h3 className="text-2xl font-bold text-slate-800">
              ৳{totalAmount.toFixed(2)}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Meal Fund Amount (৳)
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={mealAmount}
                onChange={e => setMealAmount(e.target.value)}
                placeholder="Example: 300"
                className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Utility Fund Amount (৳)
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={utilityAmount}
                onChange={e => setUtilityAmount(e.target.value)}
                placeholder="Example: 200"
                className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Admin Note
            </label>

            <input
              type="text"
              maxLength={255}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional allocation note"
              className="w-full border rounded-xl px-4 py-3"
            />
          </div>

          {/* Allocation Summary */}

          <div className="bg-slate-50 rounded-xl p-4 space-y-3">

            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Meal Fund</span>
              <strong>৳{meal.toFixed(2)}</strong>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Utility Fund</span>
              <strong>৳{utility.toFixed(2)}</strong>
            </div>

            <div className="flex justify-between text-sm border-t pt-3">
              <span className="text-slate-600">Allocated Total</span>
              <strong>৳{allocated.toFixed(2)}</strong>
            </div>

            <div className="flex justify-between font-bold">
              <span>Remaining Unallocated</span>
              <span className={
                remaining < -0.001 ? "text-red-600" : "text-green-700"
              }>
                ৳{remaining.toFixed(2)}
              </span>
            </div>

          </div>

          <button
            type="submit"
            disabled={
              saving ||
              allocated <= 0 ||
              remaining < -0.001
            }
            className="px-6 py-3 rounded-xl bg-[#287653] text-white font-semibold hover:bg-[#1d5d40] disabled:opacity-50"
          >
            {saving ? "Saving Allocation..." : "Save Allocation"}
          </button>

        </form>
      )}

      {/* Existing Allocation History */}

      {selectedDeposit && (
        <div className="bg-white rounded-2xl border p-5">
          <h4 className="font-bold text-slate-800 mb-4">
            Current Allocation
          </h4>

          {selectedDeposit.allocations.length === 0 ? (
            <p className="text-sm text-slate-400">
              No allocation has been made yet.
            </p>
          ) : (
            <div className="space-y-3">
              {selectedDeposit.allocations.map(item => (
                <div
                  key={item.allocation_id}
                  className="flex justify-between border-b pb-3 text-sm"
                >
                  <span className="text-slate-600">
                    {item.allocation_type === "MEAL_FUND"
                      ? "Meal Fund"
                      : "Utility Fund"}
                  </span>

                  <strong>
                    ৳{Number(item.amount).toFixed(2)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}


import { useEffect, useState } from "react";
import DepositAllocation from "./DepositAllocation";
const API = "/flathisab/backend/api/";

function currentMonth() {
  return new Date().toLocaleDateString("en-CA").slice(0, 7);
}

function today() {
  return new Date().toLocaleDateString("en-CA");
}

export default function DepositManagement({ user }) {
  const isAdmin = user?.role === "ADMIN";

  const [deposits, setDeposits] = useState([]);
  const [members, setMembers] = useState([]);
  const [month, setMonth] = useState(currentMonth());

  const [form, setForm] = useState({
    member_id: String(user?.user_id || ""),
    deposit_date: today(),
    amount: "",
    deposit_type: "MEAL_FUND",
    payment_method: "CASH",
    reference_note: ""
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  async function loadDeposits() {
    try {
      const data = await apiRequest(
        API + `deposits.php?month=${month}`
      );

      setDeposits(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadMembers() {
    if (!isAdmin) return;

    try {
      const data = await apiRequest(API + "members.php");
      setMembers(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadInitialData() {
    setLoading(true);
    setError("");

    await Promise.all([
      loadDeposits(),
      loadMembers()
    ]);

    setLoading(false);
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadDeposits();
  }, [month]);

  function updateForm(field, value) {
    setForm(previous => ({
      ...previous,
      [field]: value
    }));
  }

  async function submitDeposit(e) {
    e.preventDefault();

    setError("");
    setMessage("");

    if (isAdmin && !form.member_id) {
      setError("Please select a member.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setError("Enter a valid deposit amount.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        member_id: Number(form.member_id),
        deposit_date: form.deposit_date,
        amount: Number(form.amount),
        deposit_type: form.deposit_type,
        payment_method: form.payment_method,
        reference_note: form.reference_note.trim()
      };

      const data = await apiRequest(API + "deposits.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      setMessage(data.message);

      setForm(previous => ({
        ...previous,
        amount: "",
        reference_note: ""
      }));

      setMonth(form.deposit_date.slice(0, 7));
      await loadDeposits();

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function reviewDeposit(depositId, status) {
    setError("");
    setMessage("");

    try {
      const data = await apiRequest(API + "deposits.php", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          deposit_id: depositId,
          status
        })
      });

      setMessage(data.message);
      await loadDeposits();

    } catch (err) {
      setError(err.message);
    }
  }

  const verifiedDeposits = deposits.filter(
    item => item.status === "VERIFIED"
  );

  const mealFund = verifiedDeposits
    .filter(item => item.deposit_type === "MEAL_FUND")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const generalFund = verifiedDeposits
    .filter(item => item.deposit_type === "GENERAL_FUND")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const totalVerified = mealFund + generalFund;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 text-slate-500">
        Loading deposits...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div>
        <p className="text-sm text-slate-500">
          Accounts / Deposits
        </p>

        <h2 className="text-2xl font-bold text-slate-800 mt-1">
          Deposits Management
        </h2>

        <p className="text-slate-500 mt-2">
          Manage meal contributions and general flat deposits.
        </p>
      </div>

      {/* Summary */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div className="bg-white rounded-2xl border p-5">
          <p className="text-sm text-slate-500">
            Total Verified
          </p>
          <h3 className="text-2xl font-bold text-green-700 mt-2">
            ৳{totalVerified.toFixed(2)}
          </h3>
        </div>

        <div className="bg-white rounded-2xl border p-5">
          <p className="text-sm text-slate-500">
            Meal Fund
          </p>
          <h3 className="text-2xl font-bold text-slate-800 mt-2">
            ৳{mealFund.toFixed(2)}
          </h3>
        </div>

        <div className="bg-white rounded-2xl border p-5">
          <p className="text-sm text-slate-500">
            General Fund
          </p>
          <h3 className="text-2xl font-bold text-slate-800 mt-2">
            ৳{generalFund.toFixed(2)}
          </h3>
        </div>

      </div>

      {/* Deposit Form */}

      <form
        onSubmit={submitDeposit}
        className="bg-white rounded-2xl border p-6 space-y-5"
      >

        <h3 className="text-lg font-bold text-slate-800">
          Add New Deposit
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {isAdmin && (
            <div>
              <label className="block text-sm font-semibold mb-2">
                Member
              </label>

              <select
                value={form.member_id}
                onChange={e =>
                  updateForm("member_id", e.target.value)
                }
                required
                className="w-full border border-slate-300 rounded-xl px-4 py-3"
              >
                <option value="">Select Member</option>

                {members.map(member => (
                  <option
                    key={member.user_id}
                    value={member.user_id}
                  >
                    {member.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-2">
              Deposit Date
            </label>

            <input
              type="date"
              value={form.deposit_date}
              onChange={e =>
                updateForm("deposit_date", e.target.value)
              }
              required
              className="w-full border border-slate-300 rounded-xl px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Deposit Type
            </label>

            <select
              value={form.deposit_type}
              onChange={e =>
                updateForm("deposit_type", e.target.value)
              }
              className="w-full border border-slate-300 rounded-xl px-4 py-3"
            >
              <option value="MEAL_FUND">Meal Fund</option>
              <option value="GENERAL_FUND">General Fund</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Payment Method
            </label>

            <select
              value={form.payment_method}
              onChange={e =>
                updateForm("payment_method", e.target.value)
              }
              className="w-full border border-slate-300 rounded-xl px-4 py-3"
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="BKASH">bKash</option>
              <option value="NAGAD">Nagad</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Amount (৳)
            </label>

            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={e =>
                updateForm("amount", e.target.value)
              }
              placeholder="Enter amount"
              required
              className="w-full border border-slate-300 rounded-xl px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Reference / Note
            </label>

            <input
              type="text"
              maxLength={255}
              value={form.reference_note}
              onChange={e =>
                updateForm("reference_note", e.target.value)
              }
              placeholder="Optional reference"
              className="w-full border border-slate-300 rounded-xl px-4 py-3"
            />
          </div>

        </div>

        <p className="text-xs text-slate-500">
          Deposits remain Pending until verified by Admin.
        </p>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-[#287653] text-white font-semibold disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Submit Deposit"}
        </button>

      </form>

      {/* Feedback */}

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

      {/* History */}

      <div className="bg-white rounded-2xl border overflow-hidden">

        <div className="p-5 border-b flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              Deposit History
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Review monthly deposit records.
            </p>
          </div>

          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2"
          />
 
        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left">

            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr>
                <th className="px-5 py-4">Member</th>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Method</th>
                <th className="px-5 py-4">Amount</th>
                <th className="px-5 py-4">Status</th>
                {isAdmin && (
                  <th className="px-5 py-4">Actions</th>
                )}
              </tr>
            </thead>

            <tbody>

              {deposits.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 6}
                    className="px-5 py-8 text-center text-slate-400"
                  >
                    No deposits found for this month.
                  </td>
                </tr>
              ) : (
                deposits.map(item => (
                  <tr
                    key={item.deposit_id}
                    className="border-t border-slate-100"
                  >

                    <td className="px-5 py-4 font-semibold">
                      {item.member_name}
                    </td>

                    <td className="px-5 py-4 text-sm">
                      {item.deposit_date}
                    </td>

                    <td className="px-5 py-4 text-sm">
                      {item.deposit_type === "MEAL_FUND"
                        ? "Meal Fund"
                        : "General Fund"}
                    </td>

                    <td className="px-5 py-4 text-sm">
                      {item.payment_method}
                    </td>

                    <td className="px-5 py-4 font-semibold">
                      ৳{Number(item.amount).toFixed(2)}
                    </td>

                    <td className="px-5 py-4">
                      <span className={
                        item.status === "VERIFIED"
                          ? "text-xs font-semibold px-3 py-2 rounded-full bg-green-50 text-green-700"
                          : item.status === "REJECTED"
                          ? "text-xs font-semibold px-3 py-2 rounded-full bg-red-50 text-red-700"
                          : "text-xs font-semibold px-3 py-2 rounded-full bg-amber-50 text-amber-700"
                      }>
                        {item.status}
                      </span>
                    </td>

                    {isAdmin && (
                      <td className="px-5 py-4">
                        {item.status === "PENDING" ? (
                          <div className="flex gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                reviewDeposit(
                                  item.deposit_id,
                                  "VERIFIED"
                                )
                              }
                              className="bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-semibold"
                            >
                              Verify
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                reviewDeposit(
                                  item.deposit_id,
                                  "REJECTED"
                                )
                              }
                              className="bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-semibold"
                            >
                              Reject
                            </button>

                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Reviewed
                          </span>
                        )}
                      </td>
                    )}

                  </tr>
                ))
              )}

            </tbody>
          </table>

        </div>
      </div>
               {isAdmin && (
  <DepositAllocation />
)}

    </div>
  );
}

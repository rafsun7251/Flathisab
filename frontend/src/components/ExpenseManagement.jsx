
import { useEffect, useState } from "react";

const API = "/flathisab/backend/api/";

export default function ExpenseManagement({ user }) {
  const [categories, setCategories] = useState([]);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [expenseDate, setExpenseDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );

  const [form, setForm] = useState({
    category_id: "",
    paid_by_user_id: user?.user_id
      ? String(user.user_id)
      : "",
    payment_source: "MEMBER",
    amount: "",
    description: ""
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (expenseDate) {
      loadExpenses();
    }
  }, [expenseDate]);

  async function requestJson(url, options = {}) {
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

  async function loadInitialData() {
    try {
      setLoading(true);
      setError("");

      const categoryData = await requestJson(
        API + "expense-categories.php"
      );

      setCategories(categoryData.data || []);

      const memberData = await requestJson(
        API + "members.php"
      );

      setMembers(memberData.data || []);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadExpenses() {
    try {
      const data = await requestJson(
        API + `expenses.php?date=${expenseDate}`
      );

      setExpenses(data.data || []);

    } catch (err) {
      setError(err.message);
    }
  }

  function updateForm(field, value) {
    setForm(previous => ({
      ...previous,
      [field]: value
    }));
  }

  async function submitExpense(e) {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!form.category_id) {
      setError("Please select an expense category.");
      return;
    }

    if (
      form.payment_source === "MEMBER" &&
      !form.paid_by_user_id
    ) {
      setError("Please select who paid for this expense.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setError("Enter a valid expense amount.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        category_id: Number(form.category_id),
        paid_by_user_id:
          form.payment_source === "MEMBER"
            ? Number(form.paid_by_user_id)
            : null,
        payment_source: form.payment_source,
        expense_date: expenseDate,
        amount: Number(form.amount),
        description: form.description.trim()
      };

      const data = await requestJson(API + "expenses.php", {
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
        description: ""
      }));

      await loadExpenses();

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function reviewExpense(expenseId, status) {
    setError("");
    setMessage("");

    try {
      const data = await requestJson(API + "expenses.php", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expense_id: expenseId,
          action: "review",
          status
        })
      });

      setMessage(data.message);
      await loadExpenses();

    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 text-slate-500">
        Loading expense information...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div>
        <p className="text-sm text-slate-500">
          Accounts / Bazar & Expenses
        </p>

        <h2 className="text-2xl font-bold text-slate-800 mt-1">
          Bazar & Expenses
        </h2>

        <p className="text-slate-500 mt-2">
          Record grocery purchases and shared flat expenses.
        </p>
      </div>

      {/* Expense Date */}

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Expense Date
        </label>

        <input
          type="date"
          value={expenseDate}
          onChange={e => setExpenseDate(e.target.value)}
          className="border border-slate-300 rounded-xl px-4 py-3"
        />
      </div>

      {/* Expense Form */}

      <form
        onSubmit={submitExpense}
        className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5"
      >

        <h3 className="text-lg font-bold text-slate-800">
          Add New Expense
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          <div>
            <label className="block text-sm font-semibold mb-2">
              Expense Category
            </label>

            <select
              value={form.category_id}
              onChange={e =>
                updateForm("category_id", e.target.value)
              }
              required
              className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-white"
            >
              <option value="">Select Category</option>

              {categories.map(category => (
                <option
                  key={category.category_id}
                  value={category.category_id}
                >
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Payment Source
            </label>

            <select
              value={form.payment_source}
              onChange={e => {
                const value = e.target.value;

                setForm(previous => ({
                  ...previous,
                  payment_source: value,
                  paid_by_user_id:
                    value === "MEMBER"
                      ? String(user?.user_id || "")
                      : ""
                }));
              }}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-white"
            >
              <option value="MEMBER">
                Member's Own Money
              </option>

              <option value="CASHBOX">
                Flat Cashbox
              </option>
            </select>
          </div>

          {form.payment_source === "MEMBER" && (
            <div>
              <label className="block text-sm font-semibold mb-2">
                Who Paid?
              </label>

              <select
                value={form.paid_by_user_id}
                onChange={e =>
                  updateForm("paid_by_user_id", e.target.value)
                }
                required
                className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-white"
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
              Amount (৳)
            </label>

            <input
              type="number"
              min="0.01"
              max="9999999999.99"
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

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-2">
              Description
            </label>

            <textarea
              value={form.description}
              onChange={e =>
                updateForm("description", e.target.value)
              }
              maxLength={255}
              rows={3}
              placeholder="Example: Weekly grocery shopping"
              className="w-full border border-slate-300 rounded-xl px-4 py-3"
            />
          </div>

        </div>

        <p className="text-xs text-slate-500">
          Submitted expenses remain Pending until reviewed by Admin.
        </p>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-[#287653] text-white font-semibold hover:bg-[#1d5d40] disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Submit Expense"}
        </button>

      </form>

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

      {/* Expense List */}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">

        <div className="p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">
            Expense Records
          </h3>

          <p className="text-sm text-slate-500 mt-1">
            Expenses recorded on {expenseDate}
          </p>
        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4">Paid By</th>
                <th className="px-5 py-4">Amount</th>
                <th className="px-5 py-4">Status</th>
                {isAdmin && (
                  <th className="px-5 py-4">Actions</th>
                )}
              </tr>
            </thead>

            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 5 : 4}
                    className="px-5 py-8 text-center text-slate-400"
                  >
                    No expense records found for this date.
                  </td>
                </tr>
              ) : (
                expenses.map(expense => (
                  <tr
                    key={expense.expense_id}
                    className="border-t border-slate-100"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">
                        {expense.category_name}
                      </p>

                      <p className="text-xs text-slate-400 mt-1">
                        {expense.description || "No description"}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm">
                      {expense.payment_source === "CASHBOX"
                        ? "Flat Cashbox"
                        : expense.paid_by_name || "Unknown"}
                    </td>

                    <td className="px-5 py-4 font-semibold">
                      ৳{Number(expense.amount).toFixed(2)}
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold px-3 py-2 rounded-full bg-amber-50 text-amber-700">
                        {expense.status}
                      </span>
                    </td>

                    {isAdmin && (
                      <td className="px-5 py-4">
                        {expense.status === "PENDING" ? (
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() =>
                                reviewExpense(
                                  expense.expense_id,
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
                                reviewExpense(
                                  expense.expense_id,
                                  "FLAGGED"
                                )
                              }
                              className="bg-amber-500 text-white px-3 py-2 rounded-lg text-xs font-semibold"
                            >
                              Flag
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                reviewExpense(
                                  expense.expense_id,
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

    </div>
  );
}

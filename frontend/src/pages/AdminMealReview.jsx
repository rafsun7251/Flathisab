
import { useEffect, useState } from "react";

const API = "/flathisab/backend/api/";

// Current November 2026 month ID from your database.
// Change this when reviewing another month.
const CURRENT_MONTH_ID = 2;

export default function AdminMealReview() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("PENDING");

  useEffect(() => {
    loadEntries();
  }, []);

  // Load monthly meal records
  async function loadEntries() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API}meals.php?month_id=${CURRENT_MONTH_ID}`,
        { credentials: "include" }
      );

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        throw new Error(data.message || "Could not load meal records.");
      }

      setEntries(data.data || []);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Verify, Flag or Reject an entry
  
async function reviewEntry(entryId, status) {
  try {
    setProcessingId(entryId);
    setError("");
    setMessage("");

    const response = await fetch(API + "meals.php", {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        meal_entry_id: Number(entryId),
        action: "review",
        status
      })
    });

    const data = await response.json();

    if (!response.ok || data.status !== "success") {
      throw new Error(data.message || "Review action failed.");
    }

    setMessage(data.message);
    await loadEntries();

  } catch (err) {
    setError(err.message);
  } finally {
    setProcessingId(null);
  }
}


  const pendingCount = entries.filter(
    (entry) => entry.status === "PENDING"
  ).length;

  const verifiedCount = entries.filter(
    (entry) => entry.status === "VERIFIED"
  ).length;

  const flaggedCount = entries.filter(
    (entry) => entry.status === "FLAGGED"
  ).length;

  const rejectedCount = entries.filter(
    (entry) => entry.status === "REJECTED"
  ).length;

  const filteredEntries =
    filter === "ALL"
      ? entries
      : entries.filter((entry) => entry.status === filter);

  function formatDate(date) {
    if (!date) return "-";

    const parts = date.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function statusStyle(status) {
    const styles = {
      PENDING: "bg-amber-50 text-amber-700",
      VERIFIED: "bg-green-50 text-green-700",
      FLAGGED: "bg-orange-50 text-orange-700",
      REJECTED: "bg-red-50 text-red-700"
    };

    return styles[status] || "bg-slate-100 text-slate-600";
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 text-slate-500">
        Loading meal records...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Heading */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <p className="text-sm text-slate-500">
            Admin / Meal Management / Review
          </p>

          <h2 className="text-2xl font-bold text-slate-800 mt-1">
            Meal Entry Review
          </h2>

          <p className="text-slate-500 mt-2">
            Review and approve member-submitted meal records.
          </p>
        </div>

        <button
          onClick={loadEntries}
          className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <p className="text-sm text-slate-500">Pending</p>
          <h3 className="text-2xl font-bold text-amber-600 mt-2">
            {pendingCount}
          </h3>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <p className="text-sm text-slate-500">Verified</p>
          <h3 className="text-2xl font-bold text-green-600 mt-2">
            {verifiedCount}
          </h3>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <p className="text-sm text-slate-500">Flagged</p>
          <h3 className="text-2xl font-bold text-orange-600 mt-2">
            {flaggedCount}
          </h3>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <p className="text-sm text-slate-500">Rejected</p>
          <h3 className="text-2xl font-bold text-red-600 mt-2">
            {rejectedCount}
          </h3>
        </div>

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

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="font-bold text-lg text-slate-800">
              Submitted Meal Records
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Review each member's lunch and dinner.
            </p>
          </div>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-4 py-2 outline-none"
          >
            <option value="PENDING">Pending Only</option>
            <option value="VERIFIED">Verified</option>
            <option value="FLAGGED">Flagged</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All Records</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mt-5">
          <table className="w-full text-left min-w-[850px]">

            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr>
                <th className="px-4 py-4">Member ID</th>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Meal</th>
                <th className="px-4 py-4">Regular</th>
                <th className="px-4 py-4">Guests</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredEntries.map((entry) => (
                <tr
                  key={entry.meal_entry_id}
                  className="border-t border-slate-100"
                >
                  <td className="px-4 py-4 font-semibold text-slate-800">
                    #{entry.member_id}
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-600">
                    {formatDate(entry.meal_date)}
                  </td>

                  <td className="px-4 py-4 text-sm font-medium">
                    {entry.meal_type}
                  </td>

                  <td className="px-4 py-4">
                    {entry.quantity}
                  </td>

                  <td className="px-4 py-4">
                    {entry.guest_quantity ?? 0}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusStyle(entry.status)}`}
                    >
                      {entry.status}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    {entry.status === "PENDING" ? (
                      <div className="flex gap-2">

                        <button
                          disabled={processingId !== null}
                          onClick={() =>
                            reviewEntry(
                              entry.meal_entry_id,
                              "VERIFIED"
                            )
                          }
                          className="px-3 py-2 rounded-lg bg-green-700 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          {processingId === entry.meal_entry_id
                            ? "Wait..."
                            : "Verify"}
                        </button>

                        <button
                          disabled={processingId !== null}
                          onClick={() =>
                            reviewEntry(
                              entry.meal_entry_id,
                              "FLAGGED"
                            )
                          }
                          className="px-3 py-2 rounded-lg bg-orange-100 text-orange-700 text-xs font-semibold disabled:opacity-50"
                        >
                          Flag
                        </button>

                        <button
                          disabled={processingId !== null}
                          onClick={() =>
                            reviewEntry(
                              entry.meal_entry_id,
                              "REJECTED"
                            )
                          }
                          className="px-3 py-2 rounded-lg bg-red-100 text-red-700 text-xs font-semibold disabled:opacity-50"
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
                </tr>
              ))}

              {filteredEntries.length === 0 && (
                <tr>
                  <td
                    colSpan="7"
                    className="text-center py-10 text-slate-500"
                  >
                    No meal records found.
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

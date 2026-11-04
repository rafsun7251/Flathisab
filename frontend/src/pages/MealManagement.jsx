
import { useEffect, useState } from "react";

const API = "/flathisab/backend/api/";

const mealTypes = ["LUNCH", "DINNER"];

function createInitialQuantities(members, defaultMeal = "1") {
  const initial = {};

  members.forEach((member) => {
    initial[member.user_id] = {
      LUNCH: defaultMeal,
      DINNER: defaultMeal,
      LUNCH_GUESTS: "0",
      DINNER_GUESTS: "0",
      FULL_DAY_OFF: false,
    
    };
  });

  return initial;
}

export default function MealManagement({ user }) {
  const [members, setMembers] = useState([]);
  const [mealDate, setMealDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );

  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadMembers();
  }, []);

  // Load active members from database
  async function loadMembers() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API + "members.php", {
        credentials: "include"
      });

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        throw new Error(data.message || "Could not load members.");
      }

      const memberList = data.data || [];

      setMembers(memberList);
      setQuantities(createInitialQuantities(memberList));

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Update meal or guest quantity
  function updateQuantity(memberId, field, value) {
    setQuantities((previous) => ({
      ...previous,
      [memberId]: {
        ...previous[memberId],
        [field]: value
      }
    }));
  }
  //Full day off 
  function toggleFullDayOff(memberId, checked) {
  setQuantities((previous) => ({
    ...previous,
    [memberId]: {
      ...previous[memberId],
      FULL_DAY_OFF: checked,
      LUNCH: checked ? "0" : "1",
      DINNER: checked ? "0" : "1",
      LUNCH_GUESTS: "0",
      DINNER_GUESTS: "0"
    }
  }));
}
  // Submit all member meal entries
  async function submitMeals(e) {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!members.length) {
      setError("No active members found.");
      return;
    }

    // Validate guest quantities
    for (const member of members) {
      for (const mealType of mealTypes) {
        const guestValue =
          quantities[member.user_id]?.[mealType + "_GUESTS"];

        const guestNumber = Number(guestValue);

        if (
          guestValue === "" ||
          !Number.isFinite(guestNumber) ||
          guestNumber < 0 ||
          guestNumber > 50 ||
          guestNumber % 0.5 !== 0
        ) {
          setError(
            `Invalid guest quantity for ${member.full_name}. Use 0 to 50 in steps of 0.5.`
          );
          return;
        }
      }
    }

    // Create 8 entries for 4 members (Lunch + Dinner)
    const entries = members.flatMap((member) =>
      mealTypes.map((mealType) => ({
        member_id: Number(member.user_id),
        meal_date: mealDate,
        meal_type: mealType,
        quantity: Number(
          quantities[member.user_id][mealType]
        ),
        guest_quantity: Number(
          quantities[member.user_id][mealType + "_GUESTS"]
        )
      }))
    );

    try {
      setSaving(true);

      const response = await fetch(API + "meals.php", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ entries })
      });

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        throw new Error(data.message || "Meal submission failed.");
      }

      setMessage(
        `${data.data.meal_entry_ids.length} meal entries submitted for Admin review.`
      );

      // Clear form after successful submission
      setQuantities(createInitialQuantities(members, "0"));

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Reset all quantities
  function resetAll() {
    setQuantities(createInitialQuantities(members, "0"));
    setError("");
    setMessage("");
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 text-slate-500">
        Loading members...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Page Heading */}
      <div>
        <p className="text-sm text-slate-500">
          Meal Management / Daily Entry
        </p>

        <h2 className="text-2xl font-bold text-slate-800 mt-1">
          Daily Meal Entry
        </h2>

        <p className="text-slate-500 mt-2">
          Record lunch, dinner and guest meals for all flat members.
        </p>
      </div>

      <form onSubmit={submitMeals} className="space-y-6">

        {/* Date Selection */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Meal Date
          </label>

          <input
            type="date"
            value={mealDate}
            onChange={(e) => setMealDate(e.target.value)}
            required
            className="border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        {/* Meal Chart */}
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">

          <div className="p-5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="font-bold text-lg text-slate-800">
                Member Meal Chart
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                Select regular and guest meal quantities.
              </p>
            </div>

            <span className="bg-green-50 text-green-700 text-xs font-semibold px-3 py-2 rounded-full">
              {members.length} Members
            </span>
          </div>

          {members.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No active members found.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left min-w-[850px]">

                <thead className="bg-slate-50 text-slate-500 text-sm">
                  <tr>
                    <th className="px-5 py-4">Member</th>
                    <th className="px-5 py-4">Lunch</th>
                    <th className="px-5 py-4">Lunch Guests</th>
                    <th className="px-5 py-4">Dinner</th>
                    <th className="px-5 py-4">Dinner Guests</th>
                    <th className="px-5 py-4">Full Day Off</th>
                  </tr>
                </thead>

                <tbody>
                  {members.map((member) => (
                    <tr
                      key={member.user_id}
                      className="border-t border-slate-100"
                    >

                      <td className="px-5 py-5">
                        <p className="font-semibold text-slate-800">
                          {member.full_name}
                        </p>

                        <p className="text-xs text-slate-400 mt-1">
                          @{member.username}
                        </p>
                      </td>

                      {/* Lunch */}
                      <td className="px-5 py-5">
                        <select
                          value={
                            quantities[member.user_id]?.LUNCH ?? "1"
                          }
                          onChange={(e) =>
                            updateQuantity(
                              member.user_id,
                              "LUNCH",
                              e.target.value
                            )
                          }
                          className="border border-slate-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-green-600"
                        >
                          <option value="0">0 - No Meal</option>
                          <option value="0.5">0.5 - Half Meal</option>
                          <option value="1">1 - Full Meal</option>
                        </select>
                      </td>

                      {/* Lunch Guests */}
                      <td className="px-5 py-5">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          step="0.5"
                          value={
                            quantities[member.user_id]?.LUNCH_GUESTS ?? "0"
                          }
                          onChange={(e) =>
                            updateQuantity(
                              member.user_id,
                              "LUNCH_GUESTS",
                              e.target.value
                            )
                          }
                          className="w-24 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-600"
                        />
                      </td>

                      {/* Dinner */}
                      <td className="px-5 py-5">
                        <select
                          value={
                            quantities[member.user_id]?.DINNER ?? "1"
                          }
                          onChange={(e) =>
                            updateQuantity(
                              member.user_id,
                              "DINNER",
                              e.target.value
                            )
                          }
                          className="border border-slate-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-green-600"
                        >
                          <option value="0">0 - No Meal</option>
                          <option value="0.5">0.5 - Half Meal</option>
                          <option value="1">1 - Full Meal</option>
                        </select>
                      </td>
                    <td className="px-5 py-5">
                    <label className="flex items-center gap-2 cursor-pointer">
                     <input
                       type="checkbox"
                  checked={
                   quantities[member.user_id]?.FULL_DAY_OFF ?? false
                     }
                     onChange={(e) =>
                  toggleFullDayOff(member.user_id, e.target.checked)
                    }
                    className="w-4 h-4 accent-green-700"
                     />
                     <span className="text-sm text-slate-600">
                     Full Day Off
                 </span>
                 </label>
                </td>
                      {/* Dinner Guests */}
                      <td className="px-5 py-5">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          step="0.5"
                          value={
                            quantities[member.user_id]?.DINNER_GUESTS ?? "0"
                          }
                          onChange={(e) =>
                            updateQuantity(
                              member.user_id,
                              "DINNER_GUESTS",
                              e.target.value
                            )
                          }
                          className="w-24 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-600"
                        />
                      </td>

                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}

          {/* Table Footer */}
          <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
            <span className="text-sm text-slate-600">
              Total entries: {members.length * 2}
            </span>

            <span className="text-xs text-slate-500">
              Guest quantity supports 0.5 increments
            </span>
          </div>

        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* Success Message */}
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-sm">
            {message}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-end gap-3">

          <button
            type="button"
            onClick={resetAll}
            disabled={saving}
            className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Reset All
          </button>

          <button
            type="submit"
            disabled={saving || members.length === 0}
            className="px-6 py-3 rounded-xl bg-[#287653] hover:bg-[#1d5d40] text-white font-semibold disabled:opacity-60"
          >
            {saving ? "Submitting..." : "Submit Meal Entries"}
          </button>

        </div>

      </form>

      <p className="text-xs text-slate-400">
        Submitted entries remain Pending until reviewed by an Admin.
      </p>

    </div>
  );
}

import { useState } from "react";
import axios from "axios";
import TravelPlanDisplay from "./TravelPlanDisplay";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { toast } from "react-toastify";

const TravelForm = () => {
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("");
  const [groupType, setGroupType] = useState("");
  const [budgetType, setBudgetType] = useState("");

  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // const BACKEND_URL = "http://localhost:3000";
  const cache = {}; // simple frontend cache

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cacheKey = `${destination}-${days}-${groupType}-${budgetType}`;
    if (cache[cacheKey]) {
      setResponse(cache[cacheKey]);
      return;
    }

    const prompt = `Give a ${days}-day travel plan for a ${groupType} visiting ${destination} on a ${budgetType} budget. 
Return only raw JSON data without any code block or explanation.

Use this structure:
1. "hotels": [{ name, addr, price, img, coords, rating }]
2. "itinerary": [{ day, places: [{ name, desc (≤30 words), img, coords, ticket, rating, travel_time, best_time (≤30 words) }] }]

Use brief field names and keep content concise.`;

    try {
      setLoading(true);

      // const res = await axios.post(`${BACKEND_URL}/api/content`, {
      //   question: prompt,
      //   previousMessages: [], // no previous messages yet
      // });
      const res = await axios.post(
        "https://trip-planer-backend.onrender.com/api/content",
        {
          question: prompt,
          previousMessages: [],
        }
      );

      let travelData;
      if (res.data.result?.content) {
        try {
          travelData = JSON.parse(res.data.result.content);
        } catch (err) {
          console.error("Failed to parse JSON:", res.data.result.content);
          setResponse("Error parsing travel plan. Please try again.");
          return;
        }
      }

      if (
        !travelData ||
        !Array.isArray(travelData.hotels) ||
        !Array.isArray(travelData.itinerary)
      ) {
        throw new Error("Invalid travel plan structure");
      }

      const cleanRating = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
      };

      const cleanHotels = travelData.hotels.map((h) => ({
        ...h,
        rating: cleanRating(h.rating),
      }));
      const cleanItinerary = travelData.itinerary.map((d) => ({
        day: d.day,
        places: d.places.map((p) => ({ ...p, rating: cleanRating(p.rating) })),
      }));

      const finalData = { hotels: cleanHotels, itinerary: cleanItinerary };
      cache[cacheKey] = finalData;
      setResponse(finalData);
    } catch (err) {
      console.error(err);
      setResponse("Error generating travel plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return toast.error("Please log in to save your travel plan.");

    try {
      setSaving(true);
      await addDoc(collection(db, "travelPlans"), {
        uid: user.uid,
        destination,
        days,
        groupType,
        budgetType,
        createdAt: new Date(),
        plan: response,
      });
      toast.success("✅ Travel plan saved successfully!");
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to save travel plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">
          ✈️ Travel Plan Generator
        </h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="text"
            placeholder="Destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <input
            type="number"
            placeholder="Days"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          <select
            value={groupType}
            onChange={(e) => setGroupType(e.target.value)}
          >
            <option value="">-- Group Type --</option>
            <option value="couple">Couple</option>
            <option value="family">Family</option>
            <option value="solo">Solo</option>
            <option value="friends">Friends</option>
          </select>
          <select
            value={budgetType}
            onChange={(e) => setBudgetType(e.target.value)}
          >
            <option value="">-- Budget --</option>
            <option value="budget">Low</option>
            <option value="moderate">Moderate</option>
            <option value="luxury">Luxury</option>
          </select>
          <button type="submit">
            {loading ? "Generating..." : "🚀 Generate Plan"}
          </button>
        </form>
      </div>

      {loading && <p>Generating travel plan...</p>}

      {response && typeof response === "object" && (
        <TravelPlanDisplay data={response} />
      )}

      {response && typeof response === "object" && (
        <button onClick={handleSavePlan} disabled={saving}>
          {saving ? "Saving..." : "💾 Save Plan"}
        </button>
      )}
    </div>
  );
};

export default TravelForm;

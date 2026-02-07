"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase"; // adjust if needed
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { enrichInventoryWithWaste } from "../../../lib/waste"; // adjust if needed
import DonationsMap from "./DonationsMap";

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  );
}

type Place = {
  id: string;
  name: string;
  url?: string;
  phone?: string;
  location?: { display_address?: string[] };
  coordinates?: { latitude: number; longitude: number };
  categories?: string[];
};


const DONATION_SITES: Place[] = [
  {
    id: "don-1",
    name: "Cornerstone Food Pantry",
    location: { display_address: ["4680 Lexington Rd. , Athens , GA 30605, USA"] },
    url: "https://ampleharvest.org/food-pantries/cornerstone-food-pantry-3549/?usertype=",
    phone: "706-549-0000",
    coordinates: { latitude: 33.9163, longitude: -83.2952 },
    categories: ["Food bank", "Hours: Mon–Fri 9am–11am"],
  },
  {
    id: "don-2",
    name: "Food Bank of Northeast Georgia",
    location: { display_address: ["861 Newton Bridge Road, Athens, GA 30607, USA"] },
    url: "https://ampleharvest.org/food-pantries/food-bank-of-northeast-georgia-843/?usertype=",
    phone: "706-354-8191",
    coordinates: { latitude: 33.987, longitude: -83.395 },
    categories: ["Food pantry", "Hours: Tue/Thu 8am–4pm"],
  },
  {
    id: "don-3",
    name: "Storehouse Ministry",
    location: { display_address: ["36 Piedmont Drive, Winder, GA 30680, USA"] },
    url: "https://ampleharvest.org/food-pantries/storehouse-ministry-5747/?usertype=",
    phone: "770-709-2244",
    coordinates: { latitude: 33.714, longitude: -84.538 },
    categories: ["Food pantry", "Hours: Tue/Thu 12pm–1pm"],
  },
  {
    id: "don-4",
    name: "The Shepherd's Staff Ministries, Inc.",
    location: { display_address: ["2240 Commerce Dr, Loganville, GA 30052"] },
    url: "https://ampleharvest.org/food-pantries/the-shepherds-staff-ministries-inc-9205/?usertype=",
    phone: "770-842-8392",
    coordinates: { latitude: 33.855591, longitude: -83.876477 },
    categories: ["Food pantry", "Hours: Tue/Thu 11am–2pm"],
  },
  {
    id: "don-5",
    name: "Chat and Chew Emergency Food Pantry",
    location: { display_address: ["22 Segar Street, Bowman, GA 30624, USA"] },
    url: "https://ampleharvest.org/food-pantries/chat-and-chew-emergency-food-pantry-5169/?usertype=",
    phone: "706-461-4159",
    coordinates: { latitude: 34.1952, longitude: -83.0039 },
    categories: ["Food pantry", "Hours: Tue/Thu 12pm–2pm"],
  },
  {
    id: "don-6",
    name: "Clifford Grove Food Pantry",
    location: { display_address: ["2471 Callaway Rd, Rayle, GA, USA"] },
    url: "https://ampleharvest.org/food-pantries/clifford-grove-food-pantry-10346/?usertype=",
    phone: "706-206-8236",
    coordinates: { latitude: 33.7915, longitude: -82.9032 },
    categories: ["Food pantry", "Hours: Tue/Thu 12pm–2pm"],
  },
   {
    id: "don-7",
    name: "Greene County Food Pantry",
    location: { display_address: ["519 Morningside Apt., Greensboro, GA 30642, USA"] },
    url: "https://ampleharvest.org/food-pantries/greene-county-food-pantry-5345/?usertype=",
    phone: "706-453-1380",
    coordinates: { latitude: 33.590599, longitude: -83.174724 },
    categories: ["Food pantry", "Hours: Tue/Thu 10am–2:30pm"],
  },

];

export default function SustainabilityPage() {
  const router = useRouter();

  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [status, setStatus] = useState("");

  // map center: use browser location if allowed, else fallback to Athens
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: 33.9519,
    lng: -83.3576,
  });

  useEffect(() => {
    // try to get location for nicer UX (optional)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // ignore errors; keep fallback
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return router.push("/login");

      setStatus("Loading sustainability insights...");

      const invSnap = await getDocs(
        query(collection(db, "users", u.uid, "inventory"), orderBy("itemName"))
      );
      const invRows = invSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const { enriched, stats } = enrichInventoryWithWaste(invRows, 7);

      const atRisk = enriched
        .filter((x: any) => x.atRisk)
        .sort((a: any, b: any) => Number(b.wasteValueUSD ?? 0) - Number(a.wasteValueUSD ?? 0));

      setRows(atRisk);
      setStats({
        totalItems: stats.totalItems,
        atRiskCount: stats.atRiskCount,
        expiringSoonCount: stats.expiringSoonCount,
        wasteValueUSD: stats.wasteValueUSD,
      });

      setStatus("✅ Loaded");
    });

    return () => unsub();
  }, [router]);

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1>Sustainability</h1>
      <p>Items at risk of waste (excess inventory relative to expected consumption before expiration).</p>

      <p style={{ marginTop: 10 }}>{status}</p>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
          <Stat label="Total items" value={stats.totalItems} />
          <Stat label="At-risk items" value={stats.atRiskCount} />
          <Stat label="Expiring ≤ 3 days" value={stats.expiringSoonCount} />
          <Stat label="Est. waste $" value={`$${stats.wasteValueUSD}`} />
        </div>
      )}

      <section style={{ marginTop: 22 }}>
        <h2>At-risk items</h2>

        {rows.length === 0 ? (
          <p>No items currently at risk 🎉</p>
        ) : (
          <table style={{ width: "100%", marginTop: 12 }}>
            <thead>
              <tr>
                <th align="left">Item</th>
                <th align="left">Days to Expire</th>
                <th align="left">Stock</th>
                <th align="left">Excess at Risk</th>
                <th align="left">Est. Waste</th>
                <th align="left">Est. Waste $</th>
                <th align="left">Storage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id}>
                  <td><b>{r.itemName}</b></td>
                  <td>{r.daysToExpire ?? "—"}</td>
                  <td>{r.currentStock} {r.unit}</td>
                  <td>{r.excessAtRisk} {r.unit}</td>
                  <td><b>{r.estimatedWaste}</b> {r.unit}</td>
                  <td><b>${r.wasteValueUSD}</b></td>
                  <td>{r.storage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ✅ Donation section (hardcoded) */}
      <section style={{ marginTop: 28 }}>
        <h2>Donate instead of waste</h2>
        <p style={{ maxWidth: 900 }}>
          If you have items at risk, consider donating to nearby food banks and pantries.
          Here are verified local donation locations you can use.
        </p>

        <div style={{ marginTop: 14 }}>
          <DonationsMap center={center} places={DONATION_SITES} />
        </div>

        <div style={{ marginTop: 14 }}>
          <h3>Locations</h3>
          <ul>
            {DONATION_SITES.map((p) => (
              <li key={p.id} style={{ marginBottom: 10 }}>
                <b>{p.name}</b>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  {p.location?.display_address?.[0] ?? ""}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  {p.categories?.join(" · ")}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  {p.phone ? `📞 ${p.phone}` : ""}
                  {p.url ? (
                    <>
                      {" "}
                      · <a href={p.url} target="_blank" rel="noreferrer">Website</a>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

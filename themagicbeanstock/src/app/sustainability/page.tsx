"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase"; // adjust if needed
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { enrichInventoryWithWaste } from "../../../lib/waste"; // adjust if needed
import DonationsMap from "./DonationsMap";
import "./sustainability.css";
import FloatingLines from "../components/background";

// OPTIONAL: If your Dashboard uses a FloatingLines component,
// import and render it inside sus-bg like your dash-bg.
// import FloatingLines from "../dashboard/FloatingLines";

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

  // Map center: browser location if allowed, else Athens
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: 33.9519,
    lng: -83.3576,
  });

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return router.push("/login");


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

      
    });

    return () => unsub();
  }, [router]);

  return (
    <div className="sus-page">
      <div className="sus-bg">
    <FloatingLines />
  </div>

      <main className="sus-content">
        <header className="sus-header">
          <div>
            <h1 className="sus-title">Sustainability</h1>
            <p className="sus-subtitle">
              Items at risk of waste (excess inventory relative to expected consumption before expiration).
            </p>
          </div>
        </header>


        {stats && (
          <div className="sus-kpi-grid">
            <div className="sus-kpi-card">
              <div className="sus-kpi-label">Total items</div>
              <div className="sus-kpi-value">{stats.totalItems}</div>
            </div>

            <div className="sus-kpi-card">
              <div className="sus-kpi-label">At-risk items</div>
              <div className="sus-kpi-value">{stats.atRiskCount}</div>
            </div>

            <div className="sus-kpi-card">
              <div className="sus-kpi-label">Expiring ≤ 3 days</div>
              <div className="sus-kpi-value">{stats.expiringSoonCount}</div>
            </div>

            <div className="sus-kpi-card">
              <div className="sus-kpi-label">Est. waste $</div>
              <div className="sus-kpi-value">${stats.wasteValueUSD}</div>
            </div>
          </div>
        )}

        {/* At-risk items table */}
        <section className="sus-section">
          <div className="sus-card">
            <div className="sus-card-header">
              <h2 className="sus-section-title">At-risk items</h2>
              <p className="sus-section-note">
                Items most likely to be wasted based on consumption rate and expiration.
              </p>
            </div>

            {rows.length === 0 ? (
              <div className="sus-empty-state">No items currently at risk 🎉</div>
            ) : (
              <div className="sus-table-wrap">
                <table className="sus-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Days to Expire</th>
                      <th>Stock</th>
                      <th>Excess at Risk</th>
                      <th>Est. Waste</th>
                      <th>Est. Waste $</th>
                      <th>Storage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: any) => (
                      <tr key={r.id}>
                        <td className="sus-cell-item">{r.itemName}</td>
                        <td>{r.daysToExpire ?? "—"}</td>
                        <td>
                          {r.currentStock} {r.unit}
                        </td>
                        <td>
                          {r.excessAtRisk} {r.unit}
                        </td>
                        <td>
                          <b>{r.estimatedWaste}</b> {r.unit}
                        </td>
                        <td>
                          <b>${r.wasteValueUSD}</b>
                        </td>
                        <td>{r.storage ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Donation map + locations */}
        <section className="sus-section">
          <div className="sus-card">
            <div className="sus-card-header">
              <h2 className="sus-section-title">Donate instead of waste</h2>
              <p className="sus-section-note">
                If you have items at risk, consider donating. These are verified local donation locations.
              </p>
            </div>

            <div style={{ padding: "14px 18px 18px" }}>
              <DonationsMap center={center} places={DONATION_SITES} />
            </div>
          </div>

          <div className="sus-card">
            <div className="sus-card-header">
              <h3 className="sus-section-title">Locations</h3>
              <p className="sus-section-note">Contact info and links.</p>
            </div>

            <div className="sus-locations">
              {DONATION_SITES.map((p) => (
                <div key={p.id} className="sus-location-item">
                  <div className="sus-location-name">{p.name}</div>
                  <div className="sus-location-meta">{p.location?.display_address?.[0] ?? ""}</div>
                  <div className="sus-location-meta">{p.categories?.join(" · ")}</div>
                  <div className="sus-location-meta">
                    {p.phone ? `📞 ${p.phone}` : ""}
                    {p.url ? (
                      <>
                        {" "}
                        ·{" "}
                        <a className="sus-link" href={p.url} target="_blank" rel="noreferrer">
                          Website
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

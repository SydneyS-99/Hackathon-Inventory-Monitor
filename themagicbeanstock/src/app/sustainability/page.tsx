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
  rating?: number;
  reviewCount?: number;
  distanceMeters?: number;
  location?: { display_address?: string[] };
  coordinates?: { latitude: number; longitude: number };
  categories?: string[];
};

export default function SustainabilityPage() {
  const router = useRouter();

  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [status, setStatus] = useState("");

  // Donations section
  const [geoStatus, setGeoStatus] = useState<string>("");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesStatus, setPlacesStatus] = useState<string>("");

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

  async function useMyLocation() {
    setGeoStatus("");
    setPlaces([]);
    setPlacesStatus("");

    if (!navigator.geolocation) {
      setGeoStatus("Geolocation not supported in this browser.");
      return;
    }

    setGeoStatus("Getting your location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoStatus("✅ Location set");
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setGeoStatus(`Location error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function findDonationPlaces() {
    if (!center) {
      setPlacesStatus("Set your location first.");
      return;
    }

    setPlacesStatus("Searching nearby food banks / donation locations...");

    const res = await fetch(
      `/api/donations?lat=${center.lat}&lng=${center.lng}&radius=8000&limit=12`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      const txt = await res.text();
      setPlacesStatus("❌ Failed to load donation locations");
      console.error(txt);
      return;
    }

    const data = await res.json();
    setPlaces(data.businesses ?? []);
    setPlacesStatus(`✅ Found ${(data.businesses ?? []).length} places`);
  }

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

      {/* NEW: Donation finder */}
      <section style={{ marginTop: 28 }}>
        <h2>Donate instead of waste</h2>
        <p style={{ maxWidth: 900 }}>
          If you have items at risk, consider donating to nearby food banks, pantries, or donation centers.
          We’ll use Yelp to find nearby locations and show them on the map.
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
          <button onClick={useMyLocation}>Use my location</button>
          <button onClick={findDonationPlaces} disabled={!center}>
            Find nearby donation places
          </button>
          <span style={{ fontSize: 13, opacity: 0.8 }}>{geoStatus || placesStatus}</span>
        </div>

        {center && (
          <div style={{ marginTop: 14 }}>
            <DonationsMap center={center} places={places} />
          </div>
        )}

        {places.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3>Nearby locations</h3>
            <ul>
              {places.map((p) => (
                <li key={p.id} style={{ marginBottom: 8 }}>
                  <b>{p.name}</b>
                  {p.distanceMeters != null ? ` — ${Math.round(p.distanceMeters)} m` : ""}
                  {p.url ? (
                    <>
                      {" "}
                      · <a href={p.url} target="_blank" rel="noreferrer">Yelp</a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}

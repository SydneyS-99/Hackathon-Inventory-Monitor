"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase"; // adjust if needed
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { enrichInventoryWithWaste } from "../../../lib/waste"; // adjust if needed

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  );
}

export default function SustainabilityPage() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [status, setStatus] = useState("");

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
        .filter((x) => x.atRisk)
        .sort((a, b) => Number(b.wasteValueUSD ?? 0) - Number(a.wasteValueUSD ?? 0));

      setRows(atRisk);

      // remove lowStock-related stat from the UI; keep the rest
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
      <p>
        Items at risk of waste (excess inventory relative to expected consumption before
        expiration).
      </p>

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
              {rows.map((r) => (
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
    </main>
  );
}

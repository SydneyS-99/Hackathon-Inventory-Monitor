"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";

export default function ForecastPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [date, setDate] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUid(u.uid);
    });
    return () => unsub();
  }, [router]);

  async function loadForecasts() {
  if (!uid) return;
  if (!date) {
    setStatus("Pick a date first.");
    return;
  }

  setStatus("Loading forecasts...");
  setRows([]);

  const q = query(
    collection(db, "users", uid, "forecasts"),
    where("date", "==", date)
  );

  const snap = await getDocs(q);
  const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  data.sort((a: any, b: any) =>
    String(a.menuItemId).localeCompare(String(b.menuItemId))
  );

  setRows(data);
  setStatus(`✅ Loaded ${data.length} forecasts`);
}


  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>AI Forecasts</h1>
      <p>
        Select a date to view predicted menu demand. (Forecasts are written by your
        Python ML script into Firestore.)
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button onClick={loadForecasts}>Load</button>
      </div>

      <p style={{ marginTop: 10 }}>{status}</p>

      {rows.length > 0 && (
        <table style={{ width: "100%", marginTop: 12 }}>
          <thead>
            <tr>
              <th align="left">Menu Item</th>
              <th align="left">Predicted Units</th>
              <th align="left">Model</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.menuItemId}</td>
                <td><b>{r.predictedUnits}</b></td>
                <td>{r.model ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

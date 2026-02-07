"use client";

import { useState } from "react";
import Papa from "papaparse";
import { auth, db } from "../../../lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const [status, setStatus] = useState("");
  const router = useRouter();

  async function handleFile(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setStatus("❌ Not logged in. Redirecting to /login...");
      router.push("/login");
      return;
    }

    setStatus("Parsing CSV...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        const rows: any[] = results.data;

        setStatus(`Uploading ${rows.length} rows...`);

        let count = 0;
        for (const r of rows) {
          if (!r.itemName) continue;

          const ref = doc(collection(db, "users", uid, "inventory"));
          await setDoc(ref, {
            itemName: r.itemName,
            category: r.category ?? "",
            unit: r.unit ?? "",
            currentStock: Number(r.currentStock ?? 0),
            avgDailyUsage: Number(r.avgDailyUsage ?? 0),
            reorderPoint: Number(r.reorderPoint ?? 0),
            leadTimeDays: Number(r.leadTimeDays ?? 0),
            supplier: r.supplier ?? "",
            pricePerUnitUSD: Number(r.pricePerUnitUSD ?? 0),
            wastePctHistorical: Number(r.wastePctHistorical ?? 0),
            createdAt: new Date().toISOString(),
          });

          count++;
        }

        setStatus(`✅ Uploaded ${count} inventory items to Firestore!`);
      },
      error: (err: any) => {
        setStatus("❌ CSV parse error: " + err.message);
      },
    });
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Upload Inventory CSV</h1>
      <p>Upload <code>demo_inventory_current.csv</code> to seed your inventory.</p>

      <input type="file" accept=".csv" onChange={handleFile} />
      <p style={{ marginTop: 12 }}>{status}</p>
    </main>
  );
}

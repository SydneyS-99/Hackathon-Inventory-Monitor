"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { auth, db } from "../../../lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

type UploadKind =
  | "inventory_csv"
  | "sales_csv"
  | "recipes_json"
  | "menu_json"
  | "conversions_csv";

const KIND_LABEL: Record<UploadKind, string> = {
  inventory_csv: "Inventory (CSV)",
  sales_csv: "Menu Sales History (CSV)",
  recipes_json: "Recipes (JSON)",
  menu_json: "Menu Catalog (JSON)",
  conversions_csv: "Unit Conversions (CSV)",
};

export default function UploadPage() {
  const [kind, setKind] = useState<UploadKind>("inventory_csv");
  const [status, setStatus] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const router = useRouter();

  const accept = useMemo(() => {
    return kind.endsWith("_json") ? ".json,application/json" : ".csv,text/csv";
  }, [kind]);

  function requireAuth(): string | null {
    const uid = auth.currentUser?.uid ?? null;
    if (!uid) {
      setStatus("❌ Not logged in. Redirecting to /login...");
      router.push("/login");
      return null;
    }
    return uid;
  }

  async function uploadInventory(uid: string, file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        const rows: any[] = results.data;
        setStatus(`Uploading inventory... (${rows.length} rows)`);
        setCount(null);

        let written = 0;
        for (const r of rows) {
          if (!r.itemName) continue;

          const ref = doc(collection(db, "users", uid, "inventory"));
          await setDoc(ref, {
            itemName: r.itemName,
            category: r.category ?? "",
            subcategory: r.subcategory ?? "",
            unit: r.unit ?? "",
            currentStock: Number(r.currentStock ?? 0),
            avgDailyUsage: Number(r.avgDailyUsage ?? 0),
            reorderPoint: Number(r.reorderPoint ?? 0),
            leadTimeDays: Number(r.leadTimeDays ?? 0),
            supplier: r.supplier ?? "",
            pricePerUnitUSD: Number(r.pricePerUnitUSD ?? 0),
            wastePctHistorical: Number(r.wastePctHistorical ?? 0),
            purchaseDate: r.purchaseDate ?? null,
            estimatedExpirationDate: r.estimatedExpirationDate ?? null,
            storage: r.storage ?? "",
            createdAt: new Date().toISOString(),
          });
          written++;
        }

        setCount(written);
        setStatus("✅ Inventory upload complete!");
      },
      error: (err: any) => setStatus("❌ CSV parse error: " + err?.message),
    });
  }

  async function uploadSales(uid: string, file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        const rows: any[] = results.data;
        setStatus(`Uploading sales history... (${rows.length} rows)`);
        setCount(null);

        let written = 0;
        for (const r of rows) {
          if (!r.date || !r.menuItemId) continue;
          const id = `${r.date}_${r.menuItemId}`;

          const ref = doc(collection(db, "users", uid, "salesDaily"), id);
          await setDoc(ref, {
            date: r.date,
            menuItemId: r.menuItemId,
            menuItemName: r.menuItemName ?? "",
            recipeId: r.recipeId ?? "",
            unitsSold: Number(r.unitsSold ?? 0),
            unitPriceUSD: Number(r.unitPriceUSD ?? 0),
            revenueUSD: Number(r.revenueUSD ?? 0),
            dayOfWeek: r.dayOfWeek ?? "",
            isPromoDay: String(r.isPromoDay).toLowerCase() === "true",
            createdAt: new Date().toISOString(),
          });

          written++;
        }

        setCount(written);
        setStatus("✅ Sales history upload complete!");
      },
      error: (err: any) => setStatus("❌ CSV parse error: " + err?.message),
    });
  }

  async function uploadRecipes(uid: string, file: File) {
    const text = await file.text();
    const data = JSON.parse(text); // expects array
    setStatus(`Uploading recipes... (${data.length} recipes)`);
    setCount(null);

    let written = 0;
    for (const r of data) {
      if (!r.recipeId) continue;
      const ref = doc(collection(db, "users", uid, "recipes"), r.recipeId);
      await setDoc(ref, { ...r, updatedAt: new Date().toISOString() });
      written++;
    }

    setCount(written);
    setStatus("✅ Recipes upload complete!");
  }

  async function uploadMenuCatalog(uid: string, file: File) {
    const text = await file.text();
    const data = JSON.parse(text); // expects array
    setStatus(`Uploading menu catalog... (${data.length} items)`);
    setCount(null);

    let written = 0;
    for (const m of data) {
      if (!m.menuItemId) continue;
      const ref = doc(collection(db, "users", uid, "menuCatalog"), m.menuItemId);
      await setDoc(ref, { ...m, updatedAt: new Date().toISOString() });
      written++;
    }

    setCount(written);
    setStatus("✅ Menu catalog upload complete!");
  }

  async function uploadConversions(uid: string, file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        const rows: any[] = results.data;
        setStatus(`Uploading unit conversions... (${rows.length} rows)`);
        setCount(null);

        let written = 0;
        for (const r of rows) {
          if (!r.itemName || !r.fromUnit || !r.toUnit) continue;
          const id = `${r.itemName}_${r.fromUnit}_${r.toUnit}`;

          const ref = doc(collection(db, "users", uid, "unitConversions"), id);
          await setDoc(ref, {
            itemName: r.itemName,
            fromUnit: r.fromUnit,
            toUnit: r.toUnit,
            multiplier: Number(r.multiplier ?? 1),
            updatedAt: new Date().toISOString(),
          });

          written++;
        }

        setCount(written);
        setStatus("✅ Unit conversions upload complete!");
      },
      error: (err: any) => setStatus("❌ CSV parse error: " + err?.message),
    });
  }

  async function handleFileChange(e: any) {
    const file: File | undefined = e.target.files?.[0];
    if (!file) return;

    const uid = requireAuth();
    if (!uid) return;

    setStatus("Reading file...");
    setCount(null);

    try {
      if (kind === "inventory_csv") await uploadInventory(uid, file);
      else if (kind === "sales_csv") await uploadSales(uid, file);
      else if (kind === "recipes_json") await uploadRecipes(uid, file);
      else if (kind === "menu_json") await uploadMenuCatalog(uid, file);
      else if (kind === "conversions_csv") await uploadConversions(uid, file);
    } catch (err: any) {
      setStatus("❌ Upload failed: " + (err?.message || String(err)));
    } finally {
      // allow re-uploading same file (resets input)
      e.target.value = "";
    }
  }

  return (
    <main style={{ padding: 40, maxWidth: 720 }}>
      <h1>Dataset Upload</h1>
      <p style={{ marginTop: 8 }}>
        Choose what you’re uploading, then select the file.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
        <label>
          Dataset type:&nbsp;
          <select value={kind} onChange={(e) => setKind(e.target.value as UploadKind)}>
            {Object.entries(KIND_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <input type="file" accept={accept} onChange={handleFileChange} />
      </div>

      <div style={{ marginTop: 16 }}>
        <div><b>Status:</b> {status || "—"}</div>
        {count !== null && <div><b>Documents written:</b> {count}</div>}
      </div>

      <hr style={{ margin: "20px 0" }} />

      <div style={{ fontSize: 14, lineHeight: 1.4 }}>
        <b>Expected files:</b>
        <ul>
          <li>Inventory (CSV): <code>demo_inventory_current.csv</code></li>
          <li>Recipes (JSON): <code>demo_recipes.json</code></li>
          <li>Menu Catalog (JSON): <code>demo_menu_catalog.json</code></li>
          <li>Sales History (CSV): <code>demo_menu_sales_history_180d.csv</code></li>
          <li>Unit Conversions (CSV): <code>demo_unit_conversions.csv</code></li>
        </ul>
      </div>
    </main>
  );
}

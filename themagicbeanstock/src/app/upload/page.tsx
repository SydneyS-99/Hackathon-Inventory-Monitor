"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { auth, db } from "../../../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getCountFromServer,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import "./upload.css";

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

type TrainState =
  | { kind: "idle"; text: string }
  | { kind: "loading"; text: string }
  | { kind: "success"; text: string; details?: { trained_models?: number; forecast_rows?: number; written?: number } }
  | { kind: "error"; text: string };

type DatasetKey = "inventory" | "salesDaily" | "recipes" | "menuCatalog" | "unitConversions";
type DatasetStatus = {
  loading: boolean;
  count: number | null;
  present: boolean | null;
};

export default function UploadPage() {
  const [kind, setKind] = useState<UploadKind>("inventory_csv");
  const [status, setStatus] = useState("");
  const [count, setCount] = useState<number | null>(null);

  const [train, setTrain] = useState<TrainState>({ kind: "idle", text: "" });
  const [trainLoading, setTrainLoading] = useState(false);

  const [ds, setDs] = useState<Record<DatasetKey, DatasetStatus>>({
    inventory: { loading: true, count: null, present: null },
    salesDaily: { loading: true, count: null, present: null },
    recipes: { loading: true, count: null, present: null },
    menuCatalog: { loading: true, count: null, present: null },
    unitConversions: { loading: true, count: null, present: null },
  });

  const router = useRouter();

  const accept = useMemo(() => {
    return kind.endsWith("_json") ? ".json,application/json" : ".csv,text/csv";
  }, [kind]);

  function requireAuth(): string | null {
    const uid = auth.currentUser?.uid ?? null;
    if (!uid) {
      setStatus("Not logged in. Redirecting to /login...");
      router.push("/login");
      return null;
    }
    return uid;
  }

  async function refreshDatasetPresence(uid: string) {
    // mark loading
    setDs((prev) => {
      const next: any = { ...prev };
      (Object.keys(next) as DatasetKey[]).forEach((k) => {
        next[k] = { ...next[k], loading: true };
      });
      return next;
    });

    const keys: { key: DatasetKey; col: string }[] = [
      { key: "inventory", col: "inventory" },
      { key: "salesDaily", col: "salesDaily" },
      { key: "recipes", col: "recipes" },
      { key: "menuCatalog", col: "menuCatalog" },
      { key: "unitConversions", col: "unitConversions" },
    ];

    try {
      const results = await Promise.all(
        keys.map(async ({ key, col }) => {
          const snap = await getCountFromServer(collection(db, "users", uid, col));
          const c = snap.data().count;
          return { key, count: c };
        })
      );

      setDs((prev) => {
        const next: any = { ...prev };
        for (const r of results) {
          next[r.key] = {
            loading: false,
            count: r.count,
            present: r.count > 0,
          };
        }
        return next;
      });
    } catch {
      // if count query fails, stop loading but keep unknown
      setDs((prev) => {
        const next: any = { ...prev };
        (Object.keys(next) as DatasetKey[]).forEach((k) => {
          next[k] = { ...next[k], loading: false };
        });
        return next;
      });
    }
  }

  // refresh presence when user is available
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u?.uid) refreshDatasetPresence(u.uid);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setStatus("Inventory upload complete.");
        refreshDatasetPresence(uid);
      },
      error: (err: any) => setStatus("CSV parse error: " + err?.message),
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
        setStatus("Sales history upload complete.");
        refreshDatasetPresence(uid);
      },
      error: (err: any) => setStatus("CSV parse error: " + err?.message),
    });
  }

  async function uploadRecipes(uid: string, file: File) {
    const text = await file.text();
    const data = JSON.parse(text);
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
    setStatus("Recipes upload complete.");
    refreshDatasetPresence(uid);
  }

  async function uploadMenuCatalog(uid: string, file: File) {
    const text = await file.text();
    const data = JSON.parse(text);
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
    setStatus("Menu catalog upload complete.");
    refreshDatasetPresence(uid);
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
        setStatus("Unit conversions upload complete.");
        refreshDatasetPresence(uid);
      },
      error: (err: any) => setStatus("CSV parse error: " + err?.message),
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
      setStatus("Upload failed: " + (err?.message || String(err)));
    } finally {
      e.target.value = "";
    }
  }

  async function handleTrainModel() {
    const uid = auth.currentUser?.uid ?? null;
    if (!uid) {
      setTrain({ kind: "error", text: "Not logged in. Redirecting to /login..." });
      router.push("/login");
      return;
    }

    // simple guard: training requires salesDaily
    const salesCount = ds.salesDaily.count ?? 0;
    if (ds.salesDaily.present === false || salesCount === 0) {
      setTrain({ kind: "error", text: "Missing sales history. Upload Menu Sales History first." });
      return;
    }

    setTrainLoading(true);
    setTrain({ kind: "loading", text: "Training…" });

    try {
      const res = await fetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Training failed");
      }

      const data = await res.json();

      // no checkmark; show compact success info
      setTrain({
        kind: "success",
        text: "Model trained • Forecasts updated",
        details: {
          trained_models: Number(data.trained_models ?? 0),
          forecast_rows: Number(data.forecast_rows ?? 0),
          written: Number(data.written ?? 0),
        },
      });

      // forecasts updated -> optional refresh (doesn't hurt)
      refreshDatasetPresence(uid);
    } catch (e: any) {
      setTrain({
        kind: "error",
        text: "Training failed. Make sure the trainer is running.",
      });
    } finally {
      setTrainLoading(false);
    }
  }

  const TrainDotClass =
    train.kind === "loading" ? "dot loading" : train.kind === "success" ? "dot ok" : train.kind === "error" ? "dot missing" : "dot missing";

  const trainBadgeClass =
    train.kind === "success"
      ? "train-inline-status success"
      : train.kind === "error"
      ? "train-inline-status error"
      : train.kind === "loading"
      ? "train-inline-status loading"
      : "train-inline-status";

  const datasetLabel: Record<DatasetKey, string> = {
    inventory: "Inventory",
    salesDaily: "Sales History",
    recipes: "Recipes",
    menuCatalog: "Menu Catalog",
    unitConversions: "Unit Conversions",
  };

  return (
    <main className="upload-page">
      <div className="upload-bg" aria-hidden="true" />

      <div className="upload-container">
        <div className="upload-card">
          <h1 className="upload-title">Dataset Upload</h1>
          <p className="upload-subtitle">
            Upload your restaurant datasets to power forecasts and smarter ordering.
          </p>

          {/* Dataset presence */}
          <div className="dataset-panel-title">
            <b>Detected in Firestore</b> (for your account)
          </div>

          <div className="dataset-grid">
            {(Object.keys(ds) as DatasetKey[]).map((k) => {
              const row = ds[k];
              const dotClass = row.loading ? "dot loading" : row.present ? "dot ok" : "dot missing";
              const text = row.loading ? "Checking…" : row.present ? "Found" : "Missing";
              const countText = row.loading ? "—" : String(row.count ?? 0);

              return (
                <div className="dataset-chip" key={k}>
                  <strong>{datasetLabel[k]}</strong>
                  <div className="dataset-meta">
                    <span className="pill">
                      <span className={dotClass} />
                      {text}
                    </span>
                    <span className="pill">
                      <span style={{ opacity: 0.85 }}>Docs</span>&nbsp;<b>{countText}</b>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="upload-divider" />

          {/* Upload controls */}
          <div className="upload-row">
            <label className="upload-label">
              Dataset type
              <select
                className="upload-select"
                value={kind}
                onChange={(e) => setKind(e.target.value as UploadKind)}
              >
                {Object.entries(KIND_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="upload-label">
              File
              <input className="upload-file" type="file" accept={accept} onChange={handleFileChange} />
            </label>
          </div>

          <div className="upload-status">
            <div>
              <b>Status:</b> {status || "—"}
            </div>
            {count !== null && (
              <div>
                <b>Documents written:</b> {count}
              </div>
            )}
          </div>

          <div className="upload-divider" />

          {/* Train row (button + status to the right) */}
          <div className="train-row">
            <button className="train-btn" onClick={handleTrainModel} disabled={trainLoading}>
              {trainLoading ? "Training..." : "Train Model"}
            </button>

            {(train.kind !== "idle" && train.text) && (
              <div className={trainBadgeClass} role="status" aria-live="polite">
                <span className={TrainDotClass} />
                <strong>{train.text}</strong>
                {train.kind === "success" && train.details && (
                  <span style={{ opacity: 0.9 }}>
                    &nbsp;• models {train.details.trained_models ?? 0}
                    &nbsp;• forecasts {train.details.forecast_rows ?? 0}
                    &nbsp;• written {train.details.written ?? 0}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="upload-divider" />

          <div className="upload-help">
            <b>Expected files:</b>
            <ul>
              <li>
                Inventory (CSV): <code>demo_inventory_current.csv</code>
              </li>
              <li>
                Recipes (JSON): <code>demo_recipes.json</code>
              </li>
              <li>
                Menu Catalog (JSON): <code>demo_menu_catalog.json</code>
              </li>
              <li>
                Sales History (CSV): <code>demo_menu_sales_history_180d.csv</code>
              </li>
              <li>
                Unit Conversions (CSV): <code>demo_unit_conversions.csv</code>
              </li>
            </ul>
            <p className="upload-note">
              Tip: upload <b>Sales History</b> first — training requires it.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

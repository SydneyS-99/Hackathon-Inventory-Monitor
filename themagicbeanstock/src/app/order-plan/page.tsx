"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";

import FloatingLines from "../components/background";

// ✅ Reuse dashboard styles for cards/tables/buttons/pagination look
import "../dashboard/dashboard.css";
import "./order-plan.css";

type ForecastRow = { menuItemId: string; predictedUnits: number };
type MenuRow = { name: string; recipeId: string };
type RecipeIng = { itemName: string; unit: string; amountPerServing: number };
type RecipeRow = { name?: string; ingredients: RecipeIng[] };
type InventoryRow = {
  itemName: string;
  currentStock: number;
  unit: string;
  supplier?: string;
};

function round(n: number, d = 2) {
  const m = Math.pow(10, d);
  return Math.round(n * m) / m;
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

export default function OrderPlanPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);

  const [date, setDate] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const [forecastDisplay, setForecastDisplay] = useState<
    { menuItemId: string; menuName: string; predictedUnits: number }[]
  >([]);

  const [ingredientRows, setIngredientRows] = useState<
    {
      itemName: string;
      unit: string;
      needed: number;
      inStock: number;
      toOrder: number;
      supplier: string;
    }[]
  >([]);

  // ✅ Dashboard-style pagination state
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  const stats = useMemo(() => {
    const totalPredicted = forecastDisplay.reduce((s, r) => s + r.predictedUnits, 0);

    const shortages = ingredientRows.filter((r) => r.toOrder > 0);
    const shortageLines = shortages.length;

    const suppliers = new Set(ingredientRows.map((r) => r.supplier));
    const suppliersWithOrders = new Set(shortages.map((r) => r.supplier));

    const totalNeeded = ingredientRows.reduce((s, r) => s + r.needed, 0);
    const totalInStockUsed = ingredientRows.reduce((s, r) => s + Math.min(r.inStock, r.needed), 0);
    const coveragePct = totalNeeded > 0 ? (totalInStockUsed / totalNeeded) * 100 : 0;

    return {
      menuItems: forecastDisplay.length,
      totalPredicted,
      ingredients: ingredientRows.length,
      shortageLines,
      suppliersCount: suppliers.size,
      suppliersWithOrdersCount: suppliersWithOrders.size,
      coveragePct: round(coveragePct, 1),
    };
  }, [forecastDisplay, ingredientRows]);

  const ordersBySupplier = useMemo(() => {
    const map = new Map<string, typeof ingredientRows>();
    for (const row of ingredientRows) {
      if (row.toOrder <= 0) continue;
      const key = row.supplier || "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => a.itemName.localeCompare(b.itemName));
      map.set(k, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [ingredientRows]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUid(u.uid);
    });
    return () => unsub();
  }, [router]);

  async function generatePlan() {
    if (!uid || !date) return;

    setStatus("Loading forecasts...");
    setForecastDisplay([]);
    setIngredientRows([]);
    setPage(1);

    // 1) forecasts for selected date
    const forecastSnap = await getDocs(
      query(collection(db, "users", uid, "forecasts"), where("date", "==", date))
    );
    const forecasts: ForecastRow[] = forecastSnap.docs.map((d) => {
      const x: any = d.data();
      return { menuItemId: String(x.menuItemId), predictedUnits: Number(x.predictedUnits ?? 0) };
    });

    if (!forecasts.length) {
      setStatus("No forecasts found for that date.");
      return;
    }

    setStatus("Loading menu catalog, recipes, and inventory...");

    // 2) menu catalog
    const menuSnap = await getDocs(collection(db, "users", uid, "menuCatalog"));
    const menuMap = new Map<string, MenuRow>();
    menuSnap.docs.forEach((d) => {
      const x: any = d.data();
      menuMap.set(d.id, { name: String(x.name ?? d.id), recipeId: String(x.recipeId ?? "") });
    });

    // 3) recipes
    const recipeSnap = await getDocs(collection(db, "users", uid, "recipes"));
    const recipeMap = new Map<string, RecipeRow>();
    recipeSnap.docs.forEach((d) => {
      const x: any = d.data();
      recipeMap.set(d.id, {
        name: x.name,
        ingredients: Array.isArray(x.ingredients) ? x.ingredients : [],
      });
    });

    // 4) inventory
    const invSnap = await getDocs(collection(db, "users", uid, "inventory"));
    const invMap = new Map<string, InventoryRow>();
    invSnap.docs.forEach((d) => {
      const x: any = d.data();
      invMap.set(String(x.itemName), {
        itemName: String(x.itemName),
        currentStock: Number(x.currentStock ?? 0),
        unit: String(x.unit ?? ""),
        supplier: String(x.supplier ?? "Unknown"),
      });
    });

    // keep forecastDisplay for stats
    const forecastRows = forecasts
      .map((f) => {
        const menu = menuMap.get(f.menuItemId);
        return {
          menuItemId: f.menuItemId,
          menuName: menu?.name ?? f.menuItemId,
          predictedUnits: f.predictedUnits,
        };
      })
      .sort((a, b) => a.menuName.localeCompare(b.menuName));
    setForecastDisplay(forecastRows);

    // compute ingredient totals
    setStatus("Computing ingredient needs...");

    const needs = new Map<
      string,
      { itemName: string; unit: string; needed: number; inStock: number; supplier: string }
    >();

    for (const f of forecasts) {
      const menu = menuMap.get(f.menuItemId);
      if (!menu?.recipeId) continue;

      const recipe = recipeMap.get(menu.recipeId);
      if (!recipe?.ingredients?.length) continue;

      const predicted = Number(f.predictedUnits || 0);

      for (const ing of recipe.ingredients) {
        const itemName = String(ing.itemName);
        const unit = String(ing.unit ?? invMap.get(itemName)?.unit ?? "");
        const perServing = Number(ing.amountPerServing ?? 0);
        const totalNeed = perServing * predicted;

        const inv = invMap.get(itemName);
        const supplier = inv?.supplier ?? "Unknown";
        const inStock = inv ? Number(inv.currentStock) : 0;

        if (!needs.has(itemName)) {
          needs.set(itemName, { itemName, unit, needed: 0, inStock, supplier });
        }
        needs.get(itemName)!.needed += totalNeed;
      }
    }

    const ingredientList = Array.from(needs.values())
      .map((n) => {
        const toOrder = Math.max(0, n.needed - n.inStock);
        return {
          itemName: n.itemName,
          unit: n.unit,
          needed: round(n.needed, 3),
          inStock: round(n.inStock, 3),
          toOrder: round(toOrder, 3),
          supplier: n.supplier || "Unknown",
        };
      })
      .sort((a, b) => b.toOrder - a.toOrder);

    setIngredientRows(ingredientList);

    // No "✅ Order plan ready"
    setStatus("");
  }

  // ✅ Dashboard-style pagination derived values
  const totalItems = ingredientRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pagedIngredients = ingredientRows.slice(startIndex, endIndex);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, totalItems]);

  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  return (
    <main className="order-page">
      <div className="order-bg" aria-hidden="true">
        <FloatingLines
          enabledWaves={["top", "middle", "bottom"]}
          lineCount={[7, 6, 7]}
          lineDistance={[5, 5, 5]}
          animationSpeed={1}
          interactive={true}
          parallax={true}
        />
      </div>

      <div className="order-content">
        <header className="dash-header">
          <div>
            <h1 className="dash-title">AI Order Plan</h1>
            <p className="dash-subtitle">
              Pick a forecast date. We’ll convert predicted demand into ingredient needs and supplier orders.
            </p>
          </div>

          <div className="dash-actions">
            <button className="dash-btn" onClick={() => router.push("/dashboard")} type="button">
              Dashboard
            </button>
            <button className="dash-btn" onClick={() => router.push("/sustainability")} type="button">
              Sustainability
            </button>
          </div>
        </header>

        <div className="order-controls">
          <input
            className="order-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <button className="primary" onClick={generatePlan} type="button" disabled={!uid || !date}>
            Generate Plan
          </button>
        </div>

        {status ? (
          <div className="dash-loading">
            <div className="spinner" aria-hidden="true" />
            <span>{status}</span>
          </div>
        ) : null}

        {(forecastDisplay.length > 0 || ingredientRows.length > 0) && (
          <div className="kpi-grid">
            <Stat label="Menu items forecasted" value={stats.menuItems} />
            <Stat label="Total dishes predicted" value={stats.totalPredicted} />
            <Stat label="Ingredients tracked" value={stats.ingredients} />
            <Stat label="Ingredients needing order" value={stats.shortageLines} />
            <Stat label="Suppliers involved" value={stats.suppliersCount} />
          </div>
        )}

        {/* ✅ Supplier section first */}
        {ordersBySupplier.length > 0 && (
          <section className="dash-section">
            <div className="panel-card">
              <div className="panel-header">
                <h2 className="section-title">Order List by Supplier</h2>
                <p className="section-note">Only items with positive order quantities appear here.</p>
              </div>

              <div className="order-supplier-wrap">
                {ordersBySupplier.map(([supplier, items]) => (
                  <div key={supplier} className="order-supplier-card">
                    <h3 className="order-supplier-title">{supplier}</h3>
                    <ul className="order-list">
                      {items.map((it) => (
                        <li key={it.itemName}>
                          {it.itemName}: <b>{it.toOrder}</b> {it.unit} (need {it.needed}, have {it.inStock})
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ✅ Ingredients table second (Dashboard-style pagination) */}
        {ingredientRows.length > 0 && (
          <section className="dash-section">
            <div className="table-card">
              <div className="table-card-header">
                <h2 className="section-title">Ingredient Needs and Orders</h2>
                <p className="section-note">Sorted by highest shortages first.</p>
              </div>

              <div className="table-wrap" role="region" aria-label="Ingredients table" tabIndex={0}>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Needed</th>
                      <th>In Stock</th>
                      <th>To Order</th>
                      <th>Supplier</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagedIngredients.map((r) => (
                      <tr key={r.itemName}>
                        <td className="cell-item">{r.itemName}</td>
                        <td>
                          {r.needed} {r.unit}
                        </td>
                        <td>
                          {r.inStock} {r.unit}
                        </td>
                        <td>
                          <b>{r.toOrder}</b> {r.unit}
                        </td>
                        <td>{r.supplier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ✅ Pagination controls — copied from Dashboard (same look/behavior) */}
              {!!ingredientRows.length && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 18px 16px",
                    gap: 12,
                    flexWrap: "wrap",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 14 }}>
                    Showing <b>{startIndex + 1}</b>–<b>{endIndex}</b> of <b>{totalItems}</b>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <label style={{ color: "rgba(255,255,255,0.75)", fontSize: 14 }}>
                      Rows:
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                        }}
                        style={{
                          marginLeft: 8,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(255,255,255,0.04)",
                          color: "white",
                          outline: "none",
                        }}
                      >
                        {[10, 25, 50, 100].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      className="dash-btn"
                      onClick={() => setPage(1)}
                      disabled={!canPrev}
                      style={{
                        opacity: canPrev ? 1 : 0.6,
                        cursor: canPrev ? "pointer" : "not-allowed",
                      }}
                    >
                      ⏮ First
                    </button>

                    <button
                      type="button"
                      className="dash-btn"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={!canPrev}
                      style={{
                        opacity: canPrev ? 1 : 0.6,
                        cursor: canPrev ? "pointer" : "not-allowed",
                      }}
                    >
                      ◀ Prev
                    </button>

                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
                      Page <b>{safePage}</b> / <b>{totalPages}</b>
                    </div>

                    <button
                      type="button"
                      className="dash-btn"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={!canNext}
                      style={{
                        opacity: canNext ? 1 : 0.6,
                        cursor: canNext ? "pointer" : "not-allowed",
                      }}
                    >
                      Next ▶
                    </button>

                    <button
                      type="button"
                      className="dash-btn"
                      onClick={() => setPage(totalPages)}
                      disabled={!canNext}
                      style={{
                        opacity: canNext ? 1 : 0.6,
                        cursor: canNext ? "pointer" : "not-allowed",
                      }}
                    >
                      Last ⏭
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {!ingredientRows.length && !status}
      </div>
    </main>
  );
}

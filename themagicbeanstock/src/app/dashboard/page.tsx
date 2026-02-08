"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { enrichInventoryWithWaste, round } from "../../../lib/waste";

import FloatingLines from "../components/background"; // <-- adjust if needed
import "./dashboard.css";

type Tab = "inventory" | "calculator";

type InventoryItem = {
  id: string;
  itemName: string;
  supplier?: string;
  category?: string;
  unit?: string;
  currentStock?: number;
  reorderPoint?: number;
  leadTimeDays?: number;
  wastePctHistorical?: number;
  pricePerUnitUSD?: number;
  estimatedExpirationDate?: string;
  avgDailyUsage?: number;
  storage?: string;

  daysToExpire?: number | null;
  excessAtRisk?: number;
  estimatedWaste?: number;
  wasteValueUSD?: number;
  atRisk?: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("inventory");
  const [uid, setUid] = useState<string | null>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [inventoryStats, setInventoryStats] = useState<any | null>(null);

  const [recipeId, setRecipeId] = useState<string>("");
  const [servings, setServings] = useState<number>(30);
  const [calcResult, setCalcResult] = useState<any[] | null>(null);

  const [status, setStatus] = useState<string>("");

  // ✅ Pagination state
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setUid(user.uid);
    });
    return () => unsub();
  }, [router]);

  async function loadData(userId: string) {
    setStatus("loading");

    const invSnap = await getDocs(
      query(collection(db, "users", userId, "inventory"), orderBy("itemName"))
    );

    const invRows: InventoryItem[] = invSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<InventoryItem, "id">),
    }));

    const { enriched, stats } = enrichInventoryWithWaste(invRows, 7);

    const supplierSet = new Set<string>();
    const categorySet = new Set<string>();
    for (const it of invRows) {
      if (it.supplier) supplierSet.add(String(it.supplier));
      if (it.category) categorySet.add(String(it.category));
    }

    const dashStats = {
      totalItems: enriched.length,
      suppliersCount: supplierSet.size,
      categoriesCount: categorySet.size,
      atRiskCount: stats.atRiskCount,
      wasteValueUSD: stats.wasteValueUSD,
    };

    // sort: at-risk first, then closest expiry
    enriched.sort((a, b) => {
      if (Number(b.atRisk) !== Number(a.atRisk)) return Number(b.atRisk) - Number(a.atRisk);
      const ad = a.daysToExpire ?? 9999;
      const bd = b.daysToExpire ?? 9999;
      return ad - bd;
    });

    setInventory(enriched);
    setInventoryStats(dashStats);

    // reset pagination when data reloads
    setPage(1);

    const recipeSnap = await getDocs(
      query(collection(db, "users", userId, "recipes"), orderBy("name"))
    );
    const recipeRows = recipeSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setRecipes(recipeRows);

    if (recipeRows.length && !recipeId) setRecipeId(recipeRows[0].id);

    setStatus("done");
  }

  useEffect(() => {
    if (uid) loadData(uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const inventoryByName = useMemo(() => {
    const m = new Map<string, any>();
    for (const it of inventory) m.set(it.itemName, it);
    return m;
  }, [inventory]);

  async function calculateOrder(e?: FormEvent) {
    e?.preventDefault();
    setCalcResult(null);
    setStatus("calculating");

    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) {
      setStatus("error");
      return;
    }

    const lines: any[] = [];
    for (const ing of recipe.ingredients || []) {
      const itemName = ing.itemName;
      const unit = ing.unit;
      const perServing = Number(ing.amountPerServing);

      const needed = perServing * servings;
      const inv = inventoryByName.get(itemName);
      const inStock = inv ? Number(inv.currentStock) : 0;
      const orderQty = Math.max(0, needed - inStock);

      lines.push({
        itemName,
        unit,
        needed: round(needed),
        inStock: round(inStock),
        orderQty: round(orderQty),
        supplier: inv?.supplier ?? "Unknown",
        wastePctHistorical: inv?.wastePctHistorical ?? null,
        leadTimeDays: inv?.leadTimeDays ?? null,
      });
    }

    setCalcResult(lines);
    setStatus("done");
  }

  const isLoading = status === "loading";

  // ✅ Pagination derived values
  const totalItems = inventory.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pagedInventory = inventory.slice(startIndex, endIndex);

  // keep page valid if pageSize changes or inventory changes
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, totalItems]);

  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  return (
    <main className="dash-page">
      <div className="dash-bg" aria-hidden="true">
        <FloatingLines
          enabledWaves={["top", "middle", "bottom"]}
          lineCount={[7, 6, 7]}
          lineDistance={[5, 5, 5]}
          animationSpeed={1}
          interactive={true}
          parallax={true}
        />
      </div>

      <div className="dash-content">
        <header className="dash-header">
          <div>
            <h1 className="dash-title">Dashboard</h1>
            <p className="dash-subtitle">Inventory overview + quick ordering tools.</p>
          </div>

          <div className="dash-actions">
            <button
              className={`dash-tab ${tab === "inventory" ? "active" : ""}`}
              onClick={() => setTab("inventory")}
              type="button"
            >
              Inventory
            </button>
            <button
              className={`dash-tab ${tab === "calculator" ? "active" : ""}`}
              onClick={() => setTab("calculator")}
              type="button"
            >
              Simple Order Calculator
            </button>

            <button className="dash-btn" onClick={() => router.push("/order-plan")} type="button">
              Plan Order
            </button>
            <button className="dash-btn" onClick={() => router.push("/sustainability")} type="button">
              Sustainability
            </button>
          </div>
        </header>

        {isLoading && (
          <div className="dash-loading">
            <div className="spinner" aria-hidden="true" />
            <span>Loading dashboard…</span>
          </div>
        )}

        {tab === "inventory" && (
          <section className="dash-section">
            {inventoryStats && (
              <div className="kpi-grid">
                <Stat label="Total items" value={inventoryStats.totalItems} />
                <Stat label="Suppliers" value={inventoryStats.suppliersCount} />
                <Stat label="Categories" value={inventoryStats.categoriesCount} />
                <Stat label="At-risk items" value={inventoryStats.atRiskCount} />
                <Stat label="Est. waste $" value={`$${inventoryStats.wasteValueUSD}`} />
              </div>
            )}

            <div className="table-card">
              <div className="table-card-header">
                <h2 className="section-title">Inventory Table</h2>
                <p className="section-note">Sorted: at-risk first, then closest expiry.</p>
              </div>

              <div className="table-wrap" role="region" aria-label="Inventory table" tabIndex={0}>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Status</th>
                      <th>Stock</th>
                      <th>Unit</th>
                      <th>Days to Expire</th>
                      <th>Excess at Risk</th>
                      <th>Est. Waste</th>
                      <th>Est. Waste $</th>
                      <th>Reorder Point</th>
                      <th>Lead Time</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagedInventory.map((it) => (
                      <tr key={it.id} className={it.atRisk ? "row-risk" : ""}>
                        <td className="cell-item">{it.itemName}</td>
                        <td>
                          <span className={`badge ${it.atRisk ? "risk" : "ok"}`}>
                            {it.atRisk ? "At Risk" : "OK"}
                          </span>
                        </td>
                        <td>{it.currentStock ?? "—"}</td>
                        <td>{it.unit ?? "—"}</td>
                        <td>{it.daysToExpire ?? "—"}</td>
                        <td>
                          {it.excessAtRisk ?? 0} {it.unit ?? ""}
                        </td>
                        <td>
                          <b>{it.estimatedWaste ?? 0}</b> {it.unit ?? ""}
                        </td>
                        <td>${it.wasteValueUSD ?? 0}</td>
                        <td>{it.reorderPoint ?? "—"}</td>
                        <td>{it.leadTimeDays != null ? `${it.leadTimeDays}d` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!inventory.length && !isLoading && (
                  <div className="empty-state">No inventory items found.</div>
                )}
              </div>

              {/* ✅ Pagination controls */}
              {!!inventory.length && (
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
                      style={{ opacity: canPrev ? 1 : 0.6, cursor: canPrev ? "pointer" : "not-allowed" }}
                    >
                      ⏮ First
                    </button>
                    <button
                      type="button"
                      className="dash-btn"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={!canPrev}
                      style={{ opacity: canPrev ? 1 : 0.6, cursor: canPrev ? "pointer" : "not-allowed" }}
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
                      style={{ opacity: canNext ? 1 : 0.6, cursor: canNext ? "pointer" : "not-allowed" }}
                    >
                      Next ▶
                    </button>
                    <button
                      type="button"
                      className="dash-btn"
                      onClick={() => setPage(totalPages)}
                      disabled={!canNext}
                      style={{ opacity: canNext ? 1 : 0.6, cursor: canNext ? "pointer" : "not-allowed" }}
                    >
                      Last ⏭
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "calculator" && (
          <section className="dash-section">
            <div className="panel-card">
              <div className="panel-header">
                <h2 className="section-title">Recipe Order Calculator</h2>
                <p className="section-note">Calculate what to order based on servings + current stock.</p>
              </div>

              <form className="calc-row" onSubmit={calculateOrder}>
                <label className="calc-label">
                  Recipe
                  <select
                    className="calc-select"
                    value={recipeId}
                    onChange={(e) => setRecipeId(e.target.value)}
                  >
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="calc-label">
                  Servings
                  <input
                    className="calc-input"
                    type="number"
                    value={servings}
                    min={1}
                    onChange={(e) => setServings(Number(e.target.value))}
                  />
                </label>

                <button className="primary" type="submit">
                  Calculate
                </button>
              </form>

              {calcResult && (
                <div className="table-wrap" role="region" aria-label="Order calculation table" tabIndex={0}>
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Ingredient</th>
                        <th>Needed</th>
                        <th>In Stock</th>
                        <th>Order</th>
                        <th>Supplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calcResult.map((r, idx) => (
                        <tr key={idx}>
                          <td className="cell-item">{r.itemName}</td>
                          <td>
                            {r.needed} {r.unit}
                          </td>
                          <td>
                            {r.inStock} {r.unit}
                          </td>
                          <td>
                            <b>{r.orderQty}</b> {r.unit}
                          </td>
                          <td>{r.supplier}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!calcResult && (
                <div className="helper-hint">
                  Pick a recipe, set servings, and click <b>Calculate</b>.
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { enrichInventoryWithWaste, round } from "../../../lib/waste"; // adjust if path differs

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

  // computed
  daysToExpire?: number | null;
  excessAtRisk?: number;
  estimatedWaste?: number;
  wasteValueUSD?: number;
  atRisk?: boolean;
};


export default function DashboarxsdPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("inventory");
  const [uid, setUid] = useState<string | null>(null);

  // data
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [inventoryStats, setInventoryStats] = useState<any | null>(null);

  // calculator state
  const [recipeId, setRecipeId] = useState<string>("");
  const [servings, setServings] = useState<number>(30);
  const [calcResult, setCalcResult] = useState<any[] | null>(null);
  const [status, setStatus] = useState<string>("");

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
    setStatus("Loading data...");

    // Inventory
    const invSnap = await getDocs(
      query(collection(db, "users", userId, "inventory"), orderBy("itemName"))
    );
    const invRows: InventoryItem[] = invSnap.docs.map((d) => ({
  id: d.id,
  ...(d.data() as Omit<InventoryItem, "id">),
}));

    const { enriched, stats } = enrichInventoryWithWaste(invRows, 7);

    // non-waste KPIs
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

    // Recipes
    const recipeSnap = await getDocs(
      query(collection(db, "users", userId, "recipes"), orderBy("name"))
    );
    const recipeRows = recipeSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setRecipes(recipeRows);

    if (recipeRows.length && !recipeId) setRecipeId(recipeRows[0].id);

    setStatus("✅ Loaded");
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

  async function calculateOrder() {
    setCalcResult(null);
    setStatus("Calculating...");

    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) {
      setStatus("❌ Recipe not found");
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
    setStatus("✅ Done");
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard</h1>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button onClick={() => setTab("inventory")}>Inventory</button>
        <button onClick={() => setTab("calculator")}>Order Calculator</button>
        <button onClick={() => router.push("/forecasts")}>Forecasts</button>
        <button onClick={() => router.push("/sustainability")}>Sustainability</button>
      </div>

      <p style={{ marginTop: 10 }}>{status}</p>

      {tab === "inventory" && (
        <div style={{ marginTop: 12 }}>
          <h2>Inventory</h2>

          {inventoryStats && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 12,
                marginTop: 12,
              }}
            >
              <Stat label="Total items" value={inventoryStats.totalItems} />
              <Stat label="Suppliers" value={inventoryStats.suppliersCount} />
              <Stat label="Categories" value={inventoryStats.categoriesCount} />
              <Stat label="At-risk items" value={inventoryStats.atRiskCount} />
              <Stat label="Est. waste $" value={`$${inventoryStats.wasteValueUSD}`} />
            </div>
          )}

          <table style={{ width: "100%", marginTop: 10 }}>
            <thead>
              <tr>
                <th align="left">Item</th>
                <th align="left">Status</th>
                <th align="left">Stock</th>
                <th align="left">Unit</th>
                <th align="left">Days to Expire</th>
                <th align="left">Excess at Risk</th>
                <th align="left">Est. Waste</th>
                <th align="left">Est. Waste $</th>
                <th align="left">Reorder Point</th>
                <th align="left">Lead Time</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((it) => (
                <tr key={it.id}>
                  <td>{it.itemName}</td>
                  <td>{it.atRisk ? "⚠️ At Risk" : "✅ OK"}</td>
                  <td>{it.currentStock}</td>
                  <td>{it.unit}</td>
                  <td>{it.daysToExpire ?? "—"}</td>
                  <td>
                    {it.excessAtRisk} {it.unit}
                  </td>
                  <td>
                    <b>{it.estimatedWaste}</b> {it.unit}
                  </td>
                  <td>${it.wasteValueUSD}</td>
                  <td>{it.reorderPoint}</td>
                  <td>{it.leadTimeDays}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "calculator" && (
        <div style={{ marginTop: 12 }}>
          <h2>Recipe Order Calculator</h2>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
            <label>
              Recipe:&nbsp;
              <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Servings:&nbsp;
              <input
                type="number"
                value={servings}
                min={1}
                onChange={(e) => setServings(Number(e.target.value))}
                style={{ width: 90 }}
              />
            </label>

            <button onClick={calculateOrder}>Calculate</button>
          </div>

          {calcResult && (
            <table style={{ width: "100%", marginTop: 12 }}>
              <thead>
                <tr>
                  <th align="left">Ingredient</th>
                  <th align="left">Needed</th>
                  <th align="left">In Stock</th>
                  <th align="left">Order</th>
                  <th align="left">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {calcResult.map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.itemName}</td>
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
          )}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  );
}

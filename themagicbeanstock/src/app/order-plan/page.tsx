"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";

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

  // summary stats
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
    // sort each supplier bucket by item name
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

    // 2) menu catalog (map menuItemId -> {name, recipeId})
    const menuSnap = await getDocs(collection(db, "users", uid, "menuCatalog"));
    const menuMap = new Map<string, MenuRow>();
    menuSnap.docs.forEach((d) => {
      const x: any = d.data();
      menuMap.set(d.id, { name: String(x.name ?? d.id), recipeId: String(x.recipeId ?? "") });
    });

    // 3) recipes (map recipeId -> recipe doc)
    const recipeSnap = await getDocs(collection(db, "users", uid, "recipes"));
    const recipeMap = new Map<string, RecipeRow>();
    recipeSnap.docs.forEach((d) => {
      const x: any = d.data();
      recipeMap.set(d.id, {
        name: x.name,
        ingredients: Array.isArray(x.ingredients) ? x.ingredients : [],
      });
    });

    // 4) inventory (map itemName -> inventory doc)
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

    // 5) build forecast display with names
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

    // 6) compute ingredient totals
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
    setStatus("✅ Order plan ready");
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1>AI Order Plan</h1>
      <p>
        Select a forecasted date. We’ll translate predicted menu demand into ingredient needs and
        order quantities.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button onClick={generatePlan}>Generate Plan</button>
      </div>

      <p style={{ marginTop: 10 }}>{status}</p>

      {/* Stats */}
      {(forecastDisplay.length > 0 || ingredientRows.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 16 }}>
          <Stat label="Menu items forecasted" value={stats.menuItems} />
          <Stat label="Total dishes predicted" value={stats.totalPredicted} />
          <Stat label="Ingredients tracked" value={stats.ingredients} />
          <Stat label="Ingredients needing order" value={stats.shortageLines} />
          <Stat label="Suppliers involved" value={stats.suppliersCount} />
          <Stat label="Inventory coverage" value={`${stats.coveragePct}%`} />
        </div>
      )}

      {/* Forecast table */}
      {forecastDisplay.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <h2>Forecasted Menu Demand</h2>
          <table style={{ width: "100%", marginTop: 10 }}>
            <thead>
              <tr>
                <th align="left">Menu Item</th>
                <th align="left">Menu ID</th>
                <th align="left">Predicted Units</th>
              </tr>
            </thead>
            <tbody>
              {forecastDisplay.map((r) => (
                <tr key={r.menuItemId}>
                  <td><b>{r.menuName}</b></td>
                  <td>{r.menuItemId}</td>
                  <td>{r.predictedUnits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Ingredient table */}
      {ingredientRows.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <h2>Ingredient Needs and Orders</h2>
          <table style={{ width: "100%", marginTop: 10 }}>
            <thead>
              <tr>
                <th align="left">Ingredient</th>
                <th align="left">Needed</th>
                <th align="left">In Stock</th>
                <th align="left">To Order</th>
                <th align="left">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {ingredientRows.map((r) => (
                <tr key={r.itemName}>
                  <td>{r.itemName}</td>
                  <td>{r.needed} {r.unit}</td>
                  <td>{r.inStock} {r.unit}</td>
                  <td><b>{r.toOrder}</b> {r.unit}</td>
                  <td>{r.supplier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Orders grouped by supplier */}
      {ordersBySupplier.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <h2>Order List by Supplier</h2>
          {ordersBySupplier.map(([supplier, items]) => (
            <div key={supplier} style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
              <h3 style={{ margin: 0 }}>{supplier}</h3>
              <ul style={{ marginTop: 8 }}>
                {items.map((it) => (
                  <li key={it.itemName}>
                    {it.itemName}: <b>{it.toOrder}</b> {it.unit} (need {it.needed}, have {it.inStock})
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
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

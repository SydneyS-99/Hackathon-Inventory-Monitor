"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

type Tab = "inventory" | "calculator";

export default function DashboarxsdPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("inventory");
  const [uid, setUid] = useState<string | null>(null);

  // data
  const [inventory, setInventory] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);

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

    const invSnap = await getDocs(
      query(collection(db, "users", userId, "inventory"), orderBy("itemName"))
    );
    setInventory(invSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

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

  function round(n: number) {
    return Math.round(n * 1000) / 1000;
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard</h1>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button onClick={() => setTab("inventory")}>Inventory</button>
        <button onClick={() => setTab("calculator")}>Order Calculator</button>
        <button onClick={() => router.push("/forecast")}>Forecasts</button>
      </div>

      <p style={{ marginTop: 10 }}>{status}</p>

      {tab === "inventory" && (
        <div style={{ marginTop: 12 }}>
          <h2>Inventory</h2>
          <table style={{ width: "100%", marginTop: 10 }}>
            <thead>
              <tr>
                <th align="left">Item</th>
                <th align="left">Stock</th>
                <th align="left">Unit</th>
                <th align="left">Reorder Point</th>
                <th align="left">Lead Time</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((it) => (
                <tr key={it.id}>
                  <td>{it.itemName}</td>
                  <td>{it.currentStock}</td>
                  <td>{it.unit}</td>
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
                    <td>{r.needed} {r.unit}</td>
                    <td>{r.inStock} {r.unit}</td>
                    <td><b>{r.orderQty}</b> {r.unit}</td>
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

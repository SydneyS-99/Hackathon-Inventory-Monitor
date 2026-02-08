import OpenAI from "openai";
import { NextResponse } from "next/server";
import { db } from "../../../../lib/firebase-admin"; 
import { promises as fs } from 'fs';
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export async function POST(req: Request) {
  try {
    const { messages, userId } = await req.json();

    // 1. Fetch Forecasts (Same as before)
    const forecastPath = path.resolve(process.cwd(), "ml", "current_forecasts.json");
    const fileData = await fs.readFile(forecastPath, 'utf8');
    const forecasts = JSON.parse(fileData);

    // 2. NEW: Fetch Inventory Levels from Firestore
    const inventorySnap = await db.collection("users").doc(userId).collection("inventory").get();
    const inventoryLevels = {};
    inventorySnap.forEach(doc => {
      inventoryLevels[doc.id] = doc.data().currentStock || 0;
    });

    // 3. Fetch Recipes & Build Context (Consolidated for the Optimizer)
    const catalogSnap = await db.collection("users").doc(userId).collection("menuCatalog").get();
    const productionContext = await Promise.all(catalogSnap.docs.map(async (doc) => {
      const item = doc.data();
      let ingredients = [];
      if (item.recipeId) {
        const recipeSnap = await db.collection("users").doc(userId).collection("recipes").doc(item.recipeId).get();
        if (recipeSnap.exists) ingredients = recipeSnap.data().ingredients || [];
      }
      return {
        name: item.menuItemName,
        weeklyForecast: forecasts[item.menuItemId] || 0,
        ingredients: ingredients
      };
    }));

    // 4. The Updated System Instruction
    const systemInstruction = {
  role: "system",
  content: `You are the Magic Bean Stock Inventory Optimizer. Your mission is to provide clear, actionable, and considerate recommendations.

  STRICT OUTPUT RULES:
  1. ONLY SHOW SHORTAGES: Do not list any ingredient where Current Stock is greater than the Required Amount. If you have enough, stay silent about it.
  2. CALCULATE THE GAP: For items in shortage, state exactly how much needs to be ordered (Required - Current Stock).
  3. NO MATH CLUTTER: Do not show the "47" baseline or the division steps.
  4. GROUP BY CATEGORY: Present the shortages in a clean, professional list.

  EXAMPLE TONE:
  "To prepare for the upcoming weekend rush, you have a few critical shortages that need ordering:
  - **Chicken Breast**: Need 4.28 kg more.
  - **Heavy Cream**: Need 2.59 L more.
  - **Avocados**: Need 28 more.
  
  Everything else is currently sufficient in your inventory."`
};

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [systemInstruction, ...messages],
      temperature: 0.1,
    });

    return NextResponse.json({ content: response.choices[0].message.content });

  } catch (error: any) {
    console.error("Advisor Error:", error);
    return NextResponse.json({ error: "System Error" }, { status: 500 });
  }
}
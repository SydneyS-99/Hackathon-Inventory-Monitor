import os, glob, joblib
import pandas as pd
import numpy as np
from datetime import timedelta
from sklearn.ensemble import RandomForestRegressor

import firebase_admin
from firebase_admin import credentials, firestore

SERVICE_ACCOUNT_PATH = "serviceAccountKey.json"
UID = "AVoYA5h1RWQC9NJQkR94SDudrm12"

DATA = "demo_menu_sales_history_180d.csv"
OUT = "models"
os.makedirs(OUT, exist_ok=True)

FEATURES = ["dow","month","trendIndex","isPromoDay","lag1","lag7","roll7","roll28"]

def make_features(g):
    g = g.sort_values("date").copy()
    g["dow"] = g["date"].dt.dayofweek
    g["month"] = g["date"].dt.month
    g["trendIndex"] = (g["date"] - g["date"].min()).dt.days
    g["isPromoDay"] = g["isPromoDay"].astype(int)
    g["lag1"] = g["unitsSold"].shift(1)
    g["lag7"] = g["unitsSold"].shift(7)
    g["roll7"] = g["unitsSold"].shift(1).rolling(7).mean()
    g["roll28"] = g["unitsSold"].shift(1).rolling(28).mean()
    return g.dropna()

def train_models(df):
    for mid, g in df.groupby("menuItemId"):
        g2 = make_features(g)
        X = g2[FEATURES]
        y = g2["unitsSold"]

        model = RandomForestRegressor(
            n_estimators=600,
            random_state=42,
            max_depth=12
        )
        model.fit(X, y)

        joblib.dump({"model": model, "features": FEATURES}, f"{OUT}/{mid}.joblib")

    print("✅ Trained RandomForest models for", df["menuItemId"].nunique(), "menu items")

def predict_next_7_days(df):
    rows = []
    for path in glob.glob(f"{OUT}/*.joblib"):
        mid = os.path.basename(path).replace(".joblib", "")
        pack = joblib.load(path)
        model = pack["model"]
        features = pack["features"]

        hist = df[df["menuItemId"] == mid].copy().sort_values("date")
        units = list(hist["unitsSold"].astype(float).values)
        min_date = hist["date"].min()
        last_date = hist["date"].max()

        for i in range(1, 8):
            d = last_date + timedelta(days=i)

            dow = d.dayofweek
            month = d.month
            trendIndex = (d - min_date).days
            isPromoDay = 0

            lag1 = units[-1]
            lag7 = units[-7] if len(units) >= 7 else units[-1]
            roll7 = float(np.mean(units[-7:])) if len(units) >= 7 else float(np.mean(units))
            roll28 = float(np.mean(units[-28:])) if len(units) >= 28 else float(np.mean(units))

            X = pd.DataFrame([[dow, month, trendIndex, isPromoDay, lag1, lag7, roll7, roll28]], columns=features)
            pred = int(round(model.predict(X)[0]))
            pred = max(0, pred)

            units.append(pred)
            rows.append({"date": d.date().isoformat(), "menuItemId": mid, "predictedUnits": pred})

    print("✅ Generated", len(rows), "forecast rows")
    return rows

def push_to_firestore(rows):
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    try:
        firebase_admin.initialize_app(cred)
    except ValueError:
        pass
    db = firestore.client()

    batch = db.batch()
    written = 0

    for r in rows:
        doc_id = f"{r['date']}_{r['menuItemId']}"
        ref = db.collection("users").document(UID).collection("forecasts").document(doc_id)

        batch.set(ref, {
            "date": r["date"],
            "menuItemId": r["menuItemId"],
            "predictedUnits": int(r["predictedUnits"]),
            "generatedAt": firestore.SERVER_TIMESTAMP,
            "model": "RandomForestRegressor"
        })

        written += 1
        if written % 450 == 0:
            batch.commit()
            batch = db.batch()
            print("Committed:", written)

    batch.commit()
    print("✅ Done. Forecast docs written:", written)

def main():
    df = pd.read_csv(DATA)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["menuItemId", "date"])

    train_models(df)
    rows = predict_next_7_days(df)
    push_to_firestore(rows)

if __name__ == "__main__":
    main()

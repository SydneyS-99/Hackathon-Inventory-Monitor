import os
import glob
import joblib
import pandas as pd
import numpy as np
from datetime import timedelta
from sklearn.ensemble import RandomForestRegressor

import firebase_admin
from firebase_admin import credentials, firestore

FEATURES = ["dow", "month", "trendIndex", "isPromoDay", "lag1", "lag7", "roll7", "roll28"]

def _get_firestore(service_account_path: str):
    if not firebase_admin._apps:
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def load_sales_from_firestore(db, uid: str) -> pd.DataFrame:
    docs = db.collection("users").document(uid).collection("salesDaily").stream()

    rows = []
    for d in docs:
        x = d.to_dict() or {}
        if not x.get("date") or not x.get("menuItemId"):
            continue
        rows.append(
            {
                "date": x["date"],
                "menuItemId": str(x["menuItemId"]),
                "unitsSold": float(x.get("unitsSold", 0)),
                "isPromoDay": bool(x.get("isPromoDay", False)),
            }
        )

    if not rows:
        return pd.DataFrame(columns=["date", "menuItemId", "unitsSold", "isPromoDay"])

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    df = df.sort_values(["menuItemId", "date"]).reset_index(drop=True)
    return df

def make_features(g: pd.DataFrame) -> pd.DataFrame:
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

def train_models(df: pd.DataFrame, out_dir: str) -> int:
    os.makedirs(out_dir, exist_ok=True)

    trained = 0
    for mid, g in df.groupby("menuItemId"):
        g2 = make_features(g)
        if len(g2) < 10:
            continue

        X = g2[FEATURES]
        y = g2["unitsSold"]

        model = RandomForestRegressor(n_estimators=600, random_state=42, max_depth=12)
        model.fit(X, y)

        joblib.dump({"model": model, "features": FEATURES}, os.path.join(out_dir, f"{mid}.joblib"))
        trained += 1

    return trained

def predict_next_7_days(df: pd.DataFrame, out_dir: str) -> list[dict]:
    rows = []

    for path in glob.glob(os.path.join(out_dir, "*.joblib")):
        mid = os.path.basename(path).replace(".joblib", "")
        pack = joblib.load(path)
        model = pack["model"]
        features = pack["features"]

        hist = df[df["menuItemId"] == mid].copy().sort_values("date")
        if hist.empty:
            continue

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

    return rows

def push_to_firestore(db, uid: str, rows: list[dict]) -> int:
    batch = db.batch()
    written = 0

    for r in rows:
        doc_id = f"{r['date']}_{r['menuItemId']}"
        ref = db.collection("users").document(uid).collection("forecasts").document(doc_id)

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

    batch.commit()
    return written

def run_training(uid: str, service_account_path: str, out_dir: str = "models") -> dict:
    db = _get_firestore(service_account_path)
    df = load_sales_from_firestore(db, uid)

    if df.empty:
        return {"ok": False, "message": "No salesDaily data found in Firestore for this user."}

    trained = train_models(df, out_dir)
    rows = predict_next_7_days(df, out_dir)
    written = push_to_firestore(db, uid, rows)

    return {
        "ok": True,
        "trained_models": trained,
        "forecast_rows": len(rows),
        "written": written,
    }

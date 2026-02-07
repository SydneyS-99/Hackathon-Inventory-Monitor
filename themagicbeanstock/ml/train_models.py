import pandas as pd
import numpy as np
import joblib, glob
from datetime import timedelta
import firebase_admin
from firebase_admin import credentials, firestore

SERVICE_ACCOUNT_PATH = "serviceAccountKey.json"
DATA = "demo_menu_sales_history_180d.csv"
MODELS_GLOB = "models/*.joblib"

UID = "AVoYA5h1RWQC9NJQkR94SDudrm12"

def main():
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    try:
        firebase_admin.initialize_app(cred)
    except ValueError:
        # already initialized
        pass
    db = firestore.client()

    df = pd.read_csv(DATA)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["menuItemId", "date"])

    rows_to_write = []

    for path in glob.glob(MODELS_GLOB):
        mid = path.split("/")[-1].replace(".joblib", "")
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

            X = pd.DataFrame(
                [[dow, month, trendIndex, isPromoDay, lag1, lag7, roll7, roll28]],
                columns=features
            )
            pred = int(round(model.predict(X)[0]))
            pred = max(0, pred)
            units.append(pred)

            rows_to_write.append({
                "date": d.date().isoformat(),
                "menuItemId": mid,
                "predictedUnits": pred
            })

    # Firestore batch writes (limit 500 per batch)
    batch = db.batch()
    written = 0

    for r in rows_to_write:
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

if __name__ == "__main__":
    main()

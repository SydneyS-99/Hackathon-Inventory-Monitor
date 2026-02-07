import pandas as pd
import joblib, os
from sklearn.ensemble import RandomForestRegressor

DATA = "demo_menu_sales_history_180d.csv"
OUT = "models"
os.makedirs(OUT, exist_ok=True)

df = pd.read_csv(DATA)
df["date"] = pd.to_datetime(df["date"])
df = df.sort_values(["menuItemId", "date"])

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

for mid, g in df.groupby("menuItemId"):
    g2 = make_features(g)
    X = g2[FEATURES]
    y = g2["unitsSold"]

    model = RandomForestRegressor(
        n_estimators=300,
        random_state=42,
        max_depth=12
    )
    model.fit(X, y)

    joblib.dump(
        {"model": model, "features": FEATURES},
        f"{OUT}/{mid}.joblib"
    )

print("✅ Trained RandomForest models for", df["menuItemId"].nunique(), "menu items")

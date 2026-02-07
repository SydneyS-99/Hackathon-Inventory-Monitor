import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor

DATA = "demo_menu_sales_history_180d.csv"
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

def mae(y, yhat): return float(np.mean(np.abs(y - yhat)))
def rmse(y, yhat): return float(np.sqrt(np.mean((y - yhat)**2)))
def mape(y, yhat):
    y = np.array(y)
    mask = y != 0
    if mask.sum() == 0: return float("nan")
    return float(np.mean(np.abs((y[mask] - yhat[mask]) / y[mask])) * 100.0)

summary = []

for mid, g in df.groupby("menuItemId"):
    g2 = make_features(g)
    n = len(g2)
    if n < 40:
        continue

    split = int(n * 0.8)
    train = g2.iloc[:split]
    test = g2.iloc[split:]

    Xtr, ytr = train[FEATURES], train["unitsSold"].values
    Xte, yte = test[FEATURES], test["unitsSold"].values

    model = RandomForestRegressor(n_estimators=300, random_state=42, max_depth=12)
    model.fit(Xtr, ytr)

    pred = model.predict(Xte)

    summary.append({
        "menuItemId": mid,
        "test_days": len(test),
        "MAE_units": mae(yte, pred),
        "RMSE_units": rmse(yte, pred),
        "MAPE_%": mape(yte, pred),
        "avg_units_sold": float(np.mean(yte)),
    })

out = pd.DataFrame(summary).sort_values("MAE_units")
print(out.to_string(index=False))
print("\nOverall MAE:", out["MAE_units"].mean())
print("Overall RMSE:", out["RMSE_units"].mean())

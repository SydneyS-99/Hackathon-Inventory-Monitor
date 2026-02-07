import pandas as pd
import numpy as np
import joblib
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

DATA = "demo_menu_sales_history_180d.csv"
MODEL_DIR = "models"

df = pd.read_csv(DATA)
df["date"] = pd.to_datetime(df["date"])
df = df.sort_values(["menuItemId","date"])

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

# --- sMAPE function ---
def smape(y_true, y_pred):
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    denom = (np.abs(y_true) + np.abs(y_pred)) / 2.0
    diff = np.abs(y_true - y_pred) / np.where(denom == 0, 1, denom)
    return np.mean(diff) * 100

all_actual = []
all_pred = []

print("\n📊 PER-MENU ITEM PERFORMANCE\n")

for mid, g in df.groupby("menuItemId"):
    g2 = make_features(g)
    if len(g2) < 40:
        continue

    test = g2.iloc[-30:]

    pack = joblib.load(f"{MODEL_DIR}/{mid}.joblib")
    model = pack["model"]

    X_test = test[FEATURES]
    y_test = test["unitsSold"]

    preds = model.predict(X_test)

    mae = mean_absolute_error(y_test, preds)
    mse = mean_squared_error(y_test, preds)
    rmse = np.sqrt(mse)
    r2 = r2_score(y_test, preds)
    smape_val = smape(y_test, preds)
    accuracy = 100 - smape_val

    print(f"{mid}:")
    print(f"   Accuracy: {accuracy:.2f}%")
    print(f"   sMAPE: {smape_val:.2f}%")
    print(f"   R^2: {r2:.3f}")
    print(f"   MAE: {mae:.2f}")
    print(f"   MSE: {mse:.2f}")
    print(f"   RMSE: {rmse:.2f}\n")

    all_actual.extend(y_test.tolist())
    all_pred.extend(preds.tolist())

# ---- OVERALL ----
mae = mean_absolute_error(all_actual, all_pred)
mse = mean_squared_error(all_actual, all_pred)
rmse = np.sqrt(mse)
r2 = r2_score(all_actual, all_pred)
smape_val = smape(all_actual, all_pred)
accuracy = 100 - smape_val

print("\n🏆 OVERALL MODEL PERFORMANCE")
print("--------------------------------")
print(f"Accuracy: {accuracy:.2f}%")
print(f"sMAPE: {smape_val:.2f}%")
print(f"R^2 Score: {r2:.3f}")
print(f"MAE: {mae:.2f}")
print(f"MSE: {mse:.2f}")
print(f"RMSE: {rmse:.2f}")
print("--------------------------------")

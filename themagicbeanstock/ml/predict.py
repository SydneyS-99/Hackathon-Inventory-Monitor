import joblib
import pandas as pd
import numpy as np
import json
import os
from datetime import datetime

def generate_forecasts():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(base_dir, "models")
    output_path = os.path.join(base_dir, "current_forecasts.json")
    
    now = datetime.now()
    
    # 1. DEFINE FEATURES IN THE EXACT ORDER DISCOVERED
    # Order: dow, month, trendIndex, isPromoDay, lag1, lag7, roll7, roll28
    ordered_cols = ['dow', 'month', 'trendIndex', 'isPromoDay', 'lag1', 'lag7', 'roll7', 'roll28']
    
    data = {
        'dow': [now.weekday()],         # Day of week (0-6)
        'month': [now.month],           # Month (1-12)
        'trendIndex': [1.0],            # Neutral trend
        'isPromoDay': [0],              # No promotion
        'lag1': [20],                   # Yesterday placeholder
        'lag7': [20],                   # Last week placeholder
        'roll7': [20],                  # 7-day average placeholder
        'roll28': [20]                  # 28-day average placeholder
    }
    
    # Create DataFrame and force the discovered order
    current_features = pd.DataFrame(data)[ordered_cols]
    
    forecast_results = {}

    if not os.path.exists(models_dir):
        print(f"CRITICAL ERROR: Models directory not found.")
        return

    for model_file in os.listdir(models_dir):
        if model_file.endswith(".joblib"):
            item_id = model_file.replace(".joblib", "")
            model_path = os.path.join(models_dir, model_file)
            
            try:
                loaded_object = joblib.load(model_path)
                model = None
                
                if isinstance(loaded_object, dict):
                    model = loaded_object.get('model') or loaded_object.get('regressor')
                else:
                    model = loaded_object

                if model and hasattr(model, 'predict'):
                    prediction = model.predict(current_features)
                    forecast_results[item_id] = int(max(0, round(float(prediction[0]))))
                else:
                    print(f"⚠️ No valid model in {model_file}")

            except Exception as e:
                print(f"❌ Error processing SKU {item_id}: {e}")

    # Write to the JSON Bridge
    with open(output_path, "w") as f:
        json.dump(forecast_results, f, indent=4)
    
    print(f"✅ Enterprise Forecasts synchronized to {output_path}")
    print(f"📊 Items Processed: {len(forecast_results)}")

if __name__ == "__main__":
    generate_forecasts()
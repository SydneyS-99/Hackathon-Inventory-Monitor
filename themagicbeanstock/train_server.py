import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from train_models import run_training

SERVICE_ACCOUNT_PATH = os.getenv("SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
MODELS_DIR = os.getenv("MODELS_DIR", "models")

app = FastAPI(title="Magic Bean Stock Trainer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TrainRequest(BaseModel):
    uid: str

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/train")
def train(req: TrainRequest):
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        raise HTTPException(status_code=500, detail=f"Missing {SERVICE_ACCOUNT_PATH}")

    uid = (req.uid or "").strip()
    if not uid:
        raise HTTPException(status_code=400, detail="uid is required")

    result = run_training(uid=uid, service_account_path=SERVICE_ACCOUNT_PATH, out_dir=MODELS_DIR)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("message", "Training failed"))

    return result

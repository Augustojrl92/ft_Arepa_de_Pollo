from fastapi import FastAPI
from app.api.v1.routes.api_keys import router as api_keys_router

app = FastAPI(
    title="Public API",
    version="1.0.0",
    description="Public microservice with API keys and rate limiting",
)

app.include_router(api_keys_router)

@app.get("/api/v1/health")
def health():
    return {"status": "ok"}
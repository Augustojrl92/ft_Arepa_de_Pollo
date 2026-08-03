from fastapi import FastAPI, Request
from app.api.v1.routes.api_keys import router as api_keys_router
from app.api.v1.routes.coalitions import router as coalitions_router
from app.api.v1.routes.users import router as users_router

app = FastAPI(
    title="Public API",
    version="1.0.0",
    description="Public microservice with API keys and rate limiting",
)

app.include_router(api_keys_router)
app.include_router(coalitions_router)
app.include_router(users_router)

@app.middleware("http")
async def add_rate_limit_headers(request: Request, call_next):
    """Advertise the remaining quota on successful responses.

    `require_api_key` records the usage on request.state; reading it here keeps
    the header logic in one place instead of every route, and means a route can
    never be added that silently omits it. Requests that never reached the
    dependency (health, docs, 404s) simply have nothing to report.
    """
    response = await call_next(request)

    usage = getattr(request.state, "rate_limit", None)
    if usage is not None:
        response.headers["X-RateLimit-Limit"] = str(usage.limit)
        response.headers["X-RateLimit-Remaining"] = str(usage.remaining)
        response.headers["X-RateLimit-Reset"] = str(usage.reset_after)

    return response


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}
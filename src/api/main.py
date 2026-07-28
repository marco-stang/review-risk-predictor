from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import insights, orders

app = FastAPI(title="ai-analytics-portal API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(orders.router)
app.include_router(insights.router)

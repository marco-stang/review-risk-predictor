from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import orders

app = FastAPI(title="ai-analytics-portal API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(orders.router)

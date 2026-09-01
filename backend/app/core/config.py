"""
Application configuration using Pydantic Settings.
Loads and validates environment variables from .env or container environment.
"""
from typing import List
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "ORCA Marine Intelligence"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    LOG_LEVEL: str = "info"

    SECRET_KEY: str = "default-insecure-secret-key-change-in-production"
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    # External ISRO / INCOIS / NavIC API Credentials
    MOSDAC_API_BASE_URL: str = "https://mosdac.gov.in/api"
    MOSDAC_API_KEY: str = ""

    INCOIS_ERDDAP_BASE_URL: str = "https://erddap.incois.gov.in/erddap"
    INCOIS_API_KEY: str = ""

    NAVIC_GATEWAY_URL: str = "https://navic-hub.isro.gov.in/api"
    NAVIC_API_KEY: str = ""

    # Emergency & Alerting Gateways
    COAST_GUARD_MRCC_WEBHOOK_URL: str = "https://mrcc-alerts.indiancoastguard.gov.in/webhook"
    SMS_GATEWAY_API_URL: str = "https://sms-gateway.gov.in/api/send"
    SMS_GATEWAY_API_KEY: str = ""

    # Background polling frequency
    ALERT_POLL_INTERVAL_SECONDS: int = 300

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()

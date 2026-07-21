from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from the .env file (see Part G of the plan)."""

    database_url: str = "postgresql+asyncpg://aggregator:secret@localhost:5432/aggregator"
    admin_api_key: str = "change-me"
    ingest_hour_utc: int = 2
    ingest_minute_utc: int = 7
    shomvob_token: str = ""
    gemini_api_key: str = ""
    openai_api_key: str = ""
    jwt_secret: str = "change-me-to-a-random-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 1 week
    upload_dir: str = "uploads"
    cors_origins: list[str] = ["http://localhost:3000"]
    
    # SMTP Config
    mail_host: str = "smtp.gmail.com"
    mail_port: int = 587
    mail_username: str = ""
    mail_password: str = ""
    mail_from_address: str = ""
    mail_from_name: str = "Opportunity Finder"
    app_url: str = "https://opportunityfinder.app"
    api_url: str = "http://localhost:8000"

    # Descriptive UA for outbound requests (Phase 8 — be polite to sources).
    user_agent: str = (
        "OpportunityFinder/1.0 (+https://opportunity-finder.example) "
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_user: str
    postgres_password: str
    postgres_db: str
    postgres_host: str
    postgres_port: int = 5432
    database_url: str
    upload_dir: str = "/app/uploads"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    # Google Sheets import credentials (optional)
    google_service_account_file: str | None = None
    google_service_account_json: str | None = None

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

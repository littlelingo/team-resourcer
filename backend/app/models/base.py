"""Re-exports the SQLAlchemy declarative Base for use by all models."""

from app.core.database import Base

__all__ = ["Base"]

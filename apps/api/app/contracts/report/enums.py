"""Enum definitions used by report contracts/tests.

This module re-exports the canonical enums from `app.db.models.report`
to maintain backward compatibility with older imports.
"""

from app.db.models.report import ReportFormat, ReportType

__all__ = ["ReportType", "ReportFormat"]

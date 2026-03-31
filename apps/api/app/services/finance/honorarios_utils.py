"""Helpers for automatic monthly fee (honorários) detection and note handling."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional
from uuid import UUID

from app.db.models.finance import FinancialTransaction, TransactionType

AUTO_FEE_MARKER = "honorários recorrentes"
CLIENT_AUTO_FEE_DESCRIPTION_RE = re.compile(r"^Honorários do escritório - \d{2}/\d{4}$")
OFFICE_AUTO_FEE_DESCRIPTION_RE = re.compile(r"^Honorários - .+ \([^)]+\) - \d{2}/\d{4}$")
CLIENT_ID_IN_NOTES_RE = re.compile(
    r"Cliente:\s*([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})",
    re.IGNORECASE,
)


def has_auto_fee_marker(notes: str | None) -> bool:
    """Return True when notes contain the automatic-fee marker."""
    return bool(notes and AUTO_FEE_MARKER in notes.lower())


def extract_related_client_id(notes: str | None) -> UUID | None:
    """Extract the mirrored client ID stored in office-side automatic fee notes."""
    if not notes:
        return None
    match = CLIENT_ID_IN_NOTES_RE.search(notes)
    if not match:
        return None
    try:
        return UUID(match.group(1))
    except ValueError:
        return None


def is_client_auto_fee_transaction(transaction: FinancialTransaction) -> bool:
    """Return True for the client-side automatic honorários expense."""
    return bool(
        transaction.transaction_type == TransactionType.DESPESA
        and CLIENT_AUTO_FEE_DESCRIPTION_RE.match(transaction.description or "")
        and has_auto_fee_marker(transaction.notes)
    )


def is_office_auto_fee_transaction(
    transaction: FinancialTransaction,
    office_client_id: UUID | None,
) -> bool:
    """Return True for the office-side automatic honorários revenue."""
    return bool(
        office_client_id
        and transaction.client_id == office_client_id
        and transaction.transaction_type == TransactionType.RECEITA
        and OFFICE_AUTO_FEE_DESCRIPTION_RE.match(transaction.description or "")
        and has_auto_fee_marker(transaction.notes)
        and extract_related_client_id(transaction.notes) is not None
    )


def is_auto_fee_transaction(
    transaction: FinancialTransaction,
    office_client_id: UUID | None,
) -> bool:
    """Return True for either side of an automatic honorários pair."""
    return is_client_auto_fee_transaction(transaction) or is_office_auto_fee_transaction(
        transaction,
        office_client_id,
    )


def split_auto_fee_notes(notes: str | None) -> tuple[str | None, str | None]:
    """Split auto-fee notes into metadata and optional user notes."""
    if not notes:
        return None, None

    metadata, separator, remainder = notes.partition("\n\n")
    if has_auto_fee_marker(metadata):
        return metadata.strip(), remainder.strip() or None
    if has_auto_fee_marker(notes):
        return notes.strip(), None
    return None, notes.strip() or None


def build_client_auto_fee_metadata(created_at: datetime | None) -> str:
    """Build default client-side metadata for automatic fees."""
    date_label = (created_at or datetime.utcnow()).strftime("%d/%m/%Y")
    return f"Gerado automaticamente em {date_label} (honorários recorrentes)."


def build_office_auto_fee_metadata(created_at: datetime | None, client_id: UUID) -> str:
    """Build default office-side metadata for automatic fees."""
    date_label = (created_at or datetime.utcnow()).strftime("%d/%m/%Y")
    return (
        f"Gerado automaticamente em {date_label} (honorários recorrentes). "
        f"Cliente: {client_id}"
    )


def compose_auto_fee_notes(metadata: str, user_notes: Optional[str]) -> str:
    """Combine preserved metadata with optional user-entered notes."""
    normalized_notes = (user_notes or "").strip()
    if normalized_notes:
        return f"{metadata}\n\n{normalized_notes}"
    return metadata

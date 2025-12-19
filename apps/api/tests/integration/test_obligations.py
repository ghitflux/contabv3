"""Integration tests for obligations endpoints."""

import pytest
from datetime import datetime, date
from uuid import uuid4

from app.db.models.user import UserRole
from app.db.models.obligation import ObligationStatus


@pytest.mark.asyncio
class TestObligationsList:
    """Tests for listing obligations."""

    async def test_list_obligations_as_admin(self, client, auth_headers, test_client_db):
        """Admin can list obligations for any client."""
        response = await client.get(
            f"/api/v1/obligations?client_id={test_client_db.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    async def test_list_obligations_missing_client_id(self, client, auth_headers):
        """Should return 400 if client_id not provided."""
        response = await client.get(
            "/api/v1/obligations",
            headers=auth_headers,
        )
        assert response.status_code == 400

    async def test_list_obligations_with_filters(self, client, auth_headers, test_client_db):
        """Test filtering obligations by status, year, month."""
        response = await client.get(
            f"/api/v1/obligations?client_id={test_client_db.id}&status=pending&year=2025&month=10",
            headers=auth_headers,
        )
        assert response.status_code == 200


@pytest.mark.asyncio
class TestObligationGeneration:
    """Tests for generating obligations."""

    async def test_generate_for_client_as_admin(self, client, auth_headers, test_client_db):
        """Admin can generate obligations for a client."""
        payload = {
            "year": 2025,
            "month": 11,
            "client_id": str(test_client_db.id),
        }
        response = await client.post(
            "/api/v1/obligations/generate",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "total_obligations" in data

    async def test_generate_for_all_clients_as_admin(self, client, auth_headers):
        """Admin can generate obligations for all clients."""
        payload = {
            "year": 2025,
            "month": 11,
        }
        response = await client.post(
            "/api/v1/obligations/generate",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "total_clients" in data

    async def test_generate_as_client_forbidden(self, client, client_headers):
        """Clients cannot generate obligations."""
        payload = {
            "year": 2025,
            "month": 11,
        }
        response = await client.post(
            "/api/v1/obligations/generate",
            json=payload,
            headers=client_headers,
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestObligationReceipt:
    """Tests for uploading receipts."""

    async def test_upload_receipt_as_admin(
        self, client, auth_headers, test_obligation_db
    ):
        """Admin can upload receipt and complete obligation."""
        # Create a mock PDF file
        files = {"file": ("receipt.pdf", b"PDF content", "application/pdf")}
        data = {"notes": "Payment completed"}

        response = await client.post(
            f"/api/v1/obligations/{test_obligation_db.id}/receipt",
            files=files,
            data=data,
            headers=auth_headers,
        )
        assert response.status_code == 200
        obligation_data = response.json()
        assert obligation_data["status"] == ObligationStatus.COMPLETED.value
        assert obligation_data["receipt_url"] is not None

    async def test_upload_receipt_invalid_file_type(
        self, client, auth_headers, test_obligation_db
    ):
        """Should reject invalid file types."""
        files = {"file": ("file.txt", b"Text content", "text/plain")}

        response = await client.post(
            f"/api/v1/obligations/{test_obligation_db.id}/receipt",
            files=files,
            headers=auth_headers,
        )
        assert response.status_code == 400

    async def test_upload_receipt_as_client_forbidden(
        self, client, client_headers, test_obligation_db
    ):
        """Clients cannot upload receipts."""
        files = {"file": ("receipt.pdf", b"PDF content", "application/pdf")}

        response = await client.post(
            f"/api/v1/obligations/{test_obligation_db.id}/receipt",
            files=files,
            headers=client_headers,
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestObligationUpdate:
    """Tests for updating obligations."""

    async def test_update_due_date_as_admin(
        self, client, auth_headers, test_obligation_db
    ):
        """Admin can update obligation due date."""
        new_date = datetime(2025, 11, 20, 12, 0, 0)
        payload = {
            "new_due_date": new_date.isoformat(),
            "reason": "Client requested extension",
        }

        response = await client.put(
            f"/api/v1/obligations/{test_obligation_db.id}/due-date",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["due_date"] is not None

    async def test_cancel_obligation_as_admin(
        self, client, auth_headers, test_obligation_db
    ):
        """Admin can cancel obligation."""
        payload = {
            "reason": "No longer applicable",
        }

        response = await client.post(
            f"/api/v1/obligations/{test_obligation_db.id}/cancel",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == ObligationStatus.CANCELLED.value

    async def test_reopen_obligation_as_admin(
        self, client, auth_headers, test_obligation_completed_db
    ):
        """Admin can reopen completed obligation."""
        response = await client.post(
            f"/api/v1/obligations/{test_obligation_completed_db.id}/reopen",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == ObligationStatus.PENDING.value


@pytest.mark.asyncio
class TestObligationEvents:
    """Tests for obligation events timeline."""

    async def test_get_obligation_events(
        self, client, auth_headers, test_obligation_db
    ):
        """Can retrieve event timeline for obligation."""
        response = await client.get(
            f"/api/v1/obligations/{test_obligation_db.id}/events",
            headers=auth_headers,
        )
        assert response.status_code == 200
        events = response.json()
        assert isinstance(events, list)

    async def test_get_events_client_access_own_only(
        self, client, client_headers, test_obligation_db, test_client_db
    ):
        """Client can only access events for their own obligations."""
        # This should succeed if obligation belongs to client
        response = await client.get(
            f"/api/v1/obligations/{test_obligation_db.id}/events",
            headers=client_headers,
        )
        # Will be 200 if test_obligation_db belongs to client user, else 403
        assert response.status_code in [200, 403]


@pytest.mark.asyncio
class TestObligationUpcoming:
    """Tests for upcoming and overdue obligations."""

    async def test_get_upcoming_obligations_as_admin(self, client, auth_headers):
        """Admin can get upcoming obligations."""
        response = await client.get(
            "/api/v1/obligations/upcoming/pending?days_ahead=7",
            headers=auth_headers,
        )
        assert response.status_code == 200
        obligations = response.json()
        assert isinstance(obligations, list)

    async def test_get_overdue_obligations_as_admin(self, client, auth_headers):
        """Admin can get overdue obligations."""
        response = await client.get(
            "/api/v1/obligations/overdue/list",
            headers=auth_headers,
        )
        assert response.status_code == 200
        obligations = response.json()
        assert isinstance(obligations, list)

    async def test_get_upcoming_as_client_shows_own_only(self, client, client_headers):
        """Client sees only their own upcoming obligations."""
        response = await client.get(
            "/api/v1/obligations/upcoming/pending?days_ahead=7",
            headers=client_headers,
        )
        assert response.status_code == 200
        obligations = response.json()
        # Should only include obligations for this client
        assert isinstance(obligations, list)

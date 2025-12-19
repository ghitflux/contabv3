"""
Unit tests for LicenseRepository.
"""

import pytest
from datetime import date, timedelta
from uuid import uuid4

from app.db.models.client import Client, ClientStatus
from app.db.models.license import License
from app.db.models.license_event import LicenseEvent
from app.db.repositories.license import LicenseRepository
from app.schemas.license import LicenseEventType, LicenseStatus, LicenseType


@pytest.fixture
def sample_client(test_session):
    """Create a sample client for testing."""
    client = Client(
        razao_social="Empresa Teste LTDA",
        nome_fantasia="Empresa Teste",
        cnpj="12.345.678/0001-90",
        email="teste@empresa.com",
        honorarios_mensais=1500.00,
        dia_vencimento=10,
        status=ClientStatus.ATIVO,
    )
    return client


@pytest.fixture
def license_repo(test_session):
    """Create a LicenseRepository instance."""
    return LicenseRepository(test_session)


@pytest.mark.asyncio
async def test_create_license(license_repo, test_session, sample_client):
    """Test creating a license."""
    await test_session.add(sample_client)
    await test_session.flush()

    license_obj = License(
        client_id=sample_client.id,
        license_type=LicenseType.ALVARA_FUNCIONAMENTO,
        registration_number="ALV-2024-12345",
        issuing_authority="Prefeitura Municipal",
        issue_date=date.today(),
        expiration_date=date.today() + timedelta(days=365),
        status=LicenseStatus.ATIVA,
        notes="Test license",
    )

    created = await license_repo.create(license_obj)
    await test_session.refresh(created)

    assert created.id is not None
    assert created.registration_number == "ALV-2024-12345"
    assert created.client_id == sample_client.id


@pytest.mark.asyncio
async def test_get_by_id(license_repo, test_session, sample_client):
    """Test getting a license by ID."""
    await test_session.add(sample_client)
    await test_session.flush()

    license_obj = License(
        client_id=sample_client.id,
        license_type=LicenseType.CERTIFICADO_DIGITAL,
        registration_number="CERT-001",
        issuing_authority="ICP Brasil",
        issue_date=date.today(),
        status=LicenseStatus.ATIVA,
    )
    await license_repo.create(license_obj)

    found = await license_repo.get_by_id(license_obj.id)

    assert found is not None
    assert found.id == license_obj.id
    assert found.registration_number == "CERT-001"


@pytest.mark.asyncio
async def test_get_by_client(license_repo, test_session, sample_client):
    """Test getting licenses by client."""
    await test_session.add(sample_client)
    await test_session.flush()

    # Create multiple licenses for the client
    license1 = License(
        client_id=sample_client.id,
        license_type=LicenseType.ALVARA_FUNCIONAMENTO,
        registration_number="ALV-001",
        issuing_authority="Prefeitura",
        issue_date=date.today(),
        status=LicenseStatus.ATIVA,
    )
    license2 = License(
        client_id=sample_client.id,
        license_type=LicenseType.CERTIFICADO_DIGITAL,
        registration_number="CERT-001",
        issuing_authority="ICP Brasil",
        issue_date=date.today(),
        status=LicenseStatus.ATIVA,
    )

    await license_repo.create(license1)
    await license_repo.create(license2)

    licenses = await license_repo.get_by_client(sample_client.id)

    assert len(licenses) == 2
    assert all(l.client_id == sample_client.id for l in licenses)


@pytest.mark.asyncio
async def test_list_with_filters(license_repo, test_session, sample_client):
    """Test listing licenses with filters."""
    await test_session.add(sample_client)
    await test_session.flush()

    # Create licenses with different types
    license1 = License(
        client_id=sample_client.id,
        license_type=LicenseType.ALVARA_FUNCIONAMENTO,
        registration_number="ALV-001",
        issuing_authority="Prefeitura Municipal",
        issue_date=date.today(),
        status=LicenseStatus.ATIVA,
    )
    license2 = License(
        client_id=sample_client.id,
        license_type=LicenseType.CERTIFICADO_DIGITAL,
        registration_number="CERT-001",
        issuing_authority="ICP Brasil",
        issue_date=date.today(),
        status=LicenseStatus.VENCIDA,
    )

    await license_repo.create(license1)
    await license_repo.create(license2)

    # Test filter by type
    licenses, total = await license_repo.list_with_filters(
        license_type=LicenseType.ALVARA_FUNCIONAMENTO
    )
    assert total == 1
    assert licenses[0].license_type == LicenseType.ALVARA_FUNCIONAMENTO

    # Test filter by status
    licenses, total = await license_repo.list_with_filters(
        status=LicenseStatus.VENCIDA
    )
    assert total == 1
    assert licenses[0].status == LicenseStatus.VENCIDA

    # Test search query
    licenses, total = await license_repo.list_with_filters(query="Prefeitura")
    assert total == 1
    assert "Prefeitura" in licenses[0].issuing_authority


@pytest.mark.asyncio
async def test_get_expiring_soon(license_repo, test_session, sample_client):
    """Test getting licenses expiring soon."""
    await test_session.add(sample_client)
    await test_session.flush()

    today = date.today()

    # Create license expiring in 15 days
    license_expiring = License(
        client_id=sample_client.id,
        license_type=LicenseType.ALVARA_FUNCIONAMENTO,
        registration_number="ALV-EXP-15",
        issuing_authority="Prefeitura",
        issue_date=today - timedelta(days=350),
        expiration_date=today + timedelta(days=15),
        status=LicenseStatus.ATIVA,
    )

    # Create license expiring in 45 days (should not be returned)
    license_not_expiring = License(
        client_id=sample_client.id,
        license_type=LicenseType.CERTIFICADO_DIGITAL,
        registration_number="CERT-EXP-45",
        issuing_authority="ICP Brasil",
        issue_date=today - timedelta(days=300),
        expiration_date=today + timedelta(days=45),
        status=LicenseStatus.ATIVA,
    )

    # Create expired license (should not be returned)
    license_expired = License(
        client_id=sample_client.id,
        license_type=LicenseType.LICENCA_AMBIENTAL,
        registration_number="LIC-EXPIRED",
        issuing_authority="Órgão Ambiental",
        issue_date=today - timedelta(days=400),
        expiration_date=today - timedelta(days=10),
        status=LicenseStatus.VENCIDA,
    )

    await license_repo.create(license_expiring)
    await license_repo.create(license_not_expiring)
    await license_repo.create(license_expired)

    expiring = await license_repo.get_expiring_soon(days=30)

    assert len(expiring) == 1
    assert expiring[0].registration_number == "ALV-EXP-15"


@pytest.mark.asyncio
async def test_get_expired(license_repo, test_session, sample_client):
    """Test getting expired licenses."""
    await test_session.add(sample_client)
    await test_session.flush()

    today = date.today()

    # Create expired license
    license_expired = License(
        client_id=sample_client.id,
        license_type=LicenseType.ALVARA_FUNCIONAMENTO,
        registration_number="ALV-EXPIRED",
        issuing_authority="Prefeitura",
        issue_date=today - timedelta(days=400),
        expiration_date=today - timedelta(days=10),
        status=LicenseStatus.VENCIDA,
    )

    # Create active license (should not be returned)
    license_active = License(
        client_id=sample_client.id,
        license_type=LicenseType.CERTIFICADO_DIGITAL,
        registration_number="CERT-ACTIVE",
        issuing_authority="ICP Brasil",
        issue_date=today - timedelta(days=100),
        expiration_date=today + timedelta(days=265),
        status=LicenseStatus.ATIVA,
    )

    await license_repo.create(license_expired)
    await license_repo.create(license_active)

    expired = await license_repo.get_expired()

    assert len(expired) == 1
    assert expired[0].registration_number == "ALV-EXPIRED"


@pytest.mark.asyncio
async def test_add_event(license_repo, test_session, sample_client):
    """Test adding an event to a license."""
    await test_session.add(sample_client)
    await test_session.flush()

    license_obj = License(
        client_id=sample_client.id,
        license_type=LicenseType.ALVARA_FUNCIONAMENTO,
        registration_number="ALV-001",
        issuing_authority="Prefeitura",
        issue_date=date.today(),
        status=LicenseStatus.ATIVA,
    )
    await license_repo.create(license_obj)

    event = await license_repo.add_event(
        license_id=license_obj.id,
        event_type=LicenseEventType.CREATED,
        description="License created for testing",
    )

    assert event.id is not None
    assert event.license_id == license_obj.id
    assert event.event_type == LicenseEventType.CREATED
    assert event.description == "License created for testing"


@pytest.mark.asyncio
async def test_get_events(license_repo, test_session, sample_client):
    """Test getting events for a license."""
    await test_session.add(sample_client)
    await test_session.flush()

    license_obj = License(
        client_id=sample_client.id,
        license_type=LicenseType.ALVARA_FUNCIONAMENTO,
        registration_number="ALV-001",
        issuing_authority="Prefeitura",
        issue_date=date.today(),
        status=LicenseStatus.ATIVA,
    )
    await license_repo.create(license_obj)

    # Add multiple events
    await license_repo.add_event(
        license_id=license_obj.id,
        event_type=LicenseEventType.CREATED,
        description="License created",
    )
    await license_repo.add_event(
        license_id=license_obj.id,
        event_type=LicenseEventType.RENEWED,
        description="License renewed",
    )

    events = await license_repo.get_events(license_obj.id)

    assert len(events) == 2
    # Events should be ordered by created_at desc, so newest first
    assert events[0].event_type == LicenseEventType.RENEWED
    assert events[1].event_type == LicenseEventType.CREATED


@pytest.mark.asyncio
async def test_update_license(license_repo, test_session, sample_client):
    """Test updating a license."""
    await test_session.add(sample_client)
    await test_session.flush()

    license_obj = License(
        client_id=sample_client.id,
        license_type=LicenseType.ALVARA_FUNCIONAMENTO,
        registration_number="ALV-001",
        issuing_authority="Prefeitura",
        issue_date=date.today(),
        status=LicenseStatus.ATIVA,
    )
    created = await license_repo.create(license_obj)

    # Update the license
    created.status = LicenseStatus.PENDENTE_RENOVACAO
    created.notes = "Updated notes"
    updated = await license_repo.update(created)

    assert updated.status == LicenseStatus.PENDENTE_RENOVACAO
    assert updated.notes == "Updated notes"


@pytest.mark.asyncio
async def test_delete_license(license_repo, test_session, sample_client):
    """Test deleting a license."""
    await test_session.add(sample_client)
    await test_session.flush()

    license_obj = License(
        client_id=sample_client.id,
        license_type=LicenseType.ALVARA_FUNCIONAMENTO,
        registration_number="ALV-001",
        issuing_authority="Prefeitura",
        issue_date=date.today(),
        status=LicenseStatus.ATIVA,
    )
    created = await license_repo.create(license_obj)

    deleted = await license_repo.delete(created.id)

    assert deleted is True

    # Verify it's deleted
    found = await license_repo.get_by_id(created.id)
    assert found is None


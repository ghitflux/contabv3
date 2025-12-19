"""
Unit tests for License model.
"""

import pytest
from datetime import date, timedelta
from uuid import uuid4

from app.db.models.license import License
from app.schemas.license import LicenseStatus, LicenseType


def test_license_creation():
    """Test license model creation"""
    license = License(
        id=uuid4(),
        client_id=uuid4(),
        license_type=LicenseType.ALVARA_FUNCIONAMENTO,
        registration_number="ALV-2024-12345",
        issuing_authority="Prefeitura Municipal",
        issue_date=date.today(),
        expiration_date=date.today() + timedelta(days=365),
        status=LicenseStatus.ATIVA,
        notes="Test license"
    )

    assert license.license_type == LicenseType.ALVARA_FUNCIONAMENTO
    assert license.registration_number == "ALV-2024-12345"
    assert license.status == LicenseStatus.ATIVA


def test_license_repr():
    """Test license __repr__ method"""
    license = License(
        id=uuid4(),
        client_id=uuid4(),
        license_type=LicenseType.CERTIFICADO_DIGITAL,
        registration_number="CERT-2024-001",
        issuing_authority="ICP Brasil",
        issue_date=date.today(),
        status=LicenseStatus.ATIVA
    )

    repr_str = repr(license)
    assert "License" in repr_str
    assert "CERTIFICADO_DIGITAL" in repr_str or "certificado_digital" in repr_str
    assert "CERT-2024-001" in repr_str
    assert "ATIVA" in repr_str or "ativa" in repr_str


def test_license_without_expiration():
    """Test license without expiration date"""
    license = License(
        id=uuid4(),
        client_id=uuid4(),
        license_type=LicenseType.INSCRICAO_MUNICIPAL,
        registration_number="IM-123456",
        issuing_authority="Prefeitura",
        issue_date=date.today(),
        expiration_date=None,  # Some licenses don't expire
        status=LicenseStatus.ATIVA
    )

    assert license.expiration_date is None
    assert license.status == LicenseStatus.ATIVA

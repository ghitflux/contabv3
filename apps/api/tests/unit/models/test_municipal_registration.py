"""
Unit tests for MunicipalRegistration model.
"""

import pytest
from datetime import date
from uuid import uuid4

from app.db.models.municipal_registration import MunicipalRegistration
from app.schemas.municipal_registration import MunicipalRegistrationStatus, StateCode


def test_municipal_registration_creation():
    """Test municipal registration model creation"""
    registration = MunicipalRegistration(
        id=uuid4(),
        client_id=uuid4(),
        city="São Paulo",
        state=StateCode.SP,
        registration_number="123.456.789-0",
        issue_date=date.today(),
        status=MunicipalRegistrationStatus.ATIVA,
        notes="Test registration"
    )

    assert registration.city == "São Paulo"
    assert registration.state == StateCode.SP
    assert registration.registration_number == "123.456.789-0"
    assert registration.status == MunicipalRegistrationStatus.ATIVA


def test_municipal_registration_repr():
    """Test municipal registration __repr__ method"""
    registration = MunicipalRegistration(
        id=uuid4(),
        client_id=uuid4(),
        city="Rio de Janeiro",
        state=StateCode.RJ,
        registration_number="987.654.321-0",
        issue_date=date.today(),
        status=MunicipalRegistrationStatus.ATIVA
    )

    repr_str = repr(registration)
    assert "MunicipalRegistration" in repr_str
    assert "Rio de Janeiro" in repr_str
    assert "RJ" in repr_str
    assert "987.654.321-0" in repr_str
    assert "ATIVA" in repr_str or "ativa" in repr_str


def test_municipal_registration_different_states():
    """Test registrations in different states"""
    states = [
        (StateCode.SP, "São Paulo"),
        (StateCode.RJ, "Rio de Janeiro"),
        (StateCode.MG, "Belo Horizonte"),
        (StateCode.RS, "Porto Alegre"),
    ]

    for state, city in states:
        registration = MunicipalRegistration(
            id=uuid4(),
            client_id=uuid4(),
            city=city,
            state=state,
            registration_number=f"{uuid4().hex[:11]}",
            issue_date=date.today(),
            status=MunicipalRegistrationStatus.ATIVA
        )

        assert registration.state == state
        assert registration.city == city
        assert registration.status == MunicipalRegistrationStatus.ATIVA


def test_municipal_registration_pending_status():
    """Test registration with pending status"""
    registration = MunicipalRegistration(
        id=uuid4(),
        client_id=uuid4(),
        city="Curitiba",
        state=StateCode.PR,
        registration_number="111.222.333-4",
        issue_date=date.today(),
        status=MunicipalRegistrationStatus.PENDENTE
    )

    assert registration.status == MunicipalRegistrationStatus.PENDENTE

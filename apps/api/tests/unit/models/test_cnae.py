"""
Unit tests for CNAE model.
"""

import pytest
from uuid import uuid4

from app.db.models.cnae import Cnae
from app.schemas.cnae import CnaeType


def test_cnae_creation():
    """Test CNAE model creation"""
    cnae = Cnae(
        id=uuid4(),
        client_id=uuid4(),
        cnae_code="6201-5/00",
        description="Desenvolvimento de programas de computador sob encomenda",
        cnae_type=CnaeType.PRINCIPAL,
        is_active=True
    )

    assert cnae.cnae_code == "6201-5/00"
    assert cnae.cnae_type == CnaeType.PRINCIPAL
    assert cnae.is_active is True


def test_cnae_repr():
    """Test CNAE __repr__ method"""
    cnae = Cnae(
        id=uuid4(),
        client_id=uuid4(),
        cnae_code="6201-5/00",
        description="Desenvolvimento de software",
        cnae_type=CnaeType.PRINCIPAL,
        is_active=True
    )

    repr_str = repr(cnae)
    assert "Cnae" in repr_str
    assert "6201-5/00" in repr_str
    assert "PRINCIPAL" in repr_str or "principal" in repr_str
    assert "True" in repr_str


def test_cnae_secondary_type():
    """Test CNAE with secondary type"""
    cnae = Cnae(
        id=uuid4(),
        client_id=uuid4(),
        cnae_code="6202-3/00",
        description="Desenvolvimento e licenciamento de programas de computador",
        cnae_type=CnaeType.SECUNDARIO,
        is_active=True
    )

    assert cnae.cnae_type == CnaeType.SECUNDARIO
    assert cnae.is_active is True


def test_cnae_inactive():
    """Test inactive CNAE"""
    cnae = Cnae(
        id=uuid4(),
        client_id=uuid4(),
        cnae_code="4711-3/01",
        description="Comércio varejista de mercadorias em geral",
        cnae_type=CnaeType.SECUNDARIO,
        is_active=False
    )

    assert cnae.is_active is False

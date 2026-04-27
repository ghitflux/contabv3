"""
Client service with business logic.
"""

import secrets
import string
from calendar import monthrange
from datetime import date
from typing import Optional
from uuid import UUID

from app.services.obligation.generator import ObligationGenerator

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_field, encrypt_field
from app.db.models.client import Client, ClientStatus, RegimeTributario, TipoEmpresa
from app.db.models.user import User, UserRole
from app.db.repositories.client import ClientRepository
from app.db.repositories.settings import SystemSettingsRepository
from app.db.repositories.user import UserRepository
from app.schemas.client import (
    ClientCreate,
    ClientCreateResult,
    ClientDraftCreate,
    ClientListItem,
    ClientResponse,
    ClientUpdate,
    ClientUserCredentials,
)
from app.services.security import enforce_password_policy


class ClientService:
    """Service for client operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize client service.

        Args:
            session: Database session
        """
        self.session = session
        self.repo = ClientRepository(session)

    def _encrypt_sensitive_fields(self, data: dict) -> dict:
        """Encrypt sensitive credential fields in-place."""
        sensitive_keys = [
            "senha_sistema",
            "senha_gov",
            "senha_prefeitura",
            "senha_seg_desemp",
            "senha_nfse",
            "senha_certificado_digital",
            "senha_gcw_resp",
        ]

        for key in sensitive_keys:
            if key in data:
                data[key] = encrypt_field(data[key])

        return data

    def _decrypt_sensitive_fields(self, data: dict) -> dict:
        """Decrypt sensitive credential fields in-place."""
        sensitive_keys = [
            "senha_sistema",
            "senha_gov",
            "senha_prefeitura",
            "senha_seg_desemp",
            "senha_nfse",
            "senha_certificado_digital",
            "senha_gcw_resp",
        ]

        for key in sensitive_keys:
            if key in data:
                try:
                    data[key] = decrypt_field(data[key])
                except Exception:
                    data[key] = data[key]

        return data

    def _build_client_response(self, client: Client) -> ClientResponse:
        """Serialize client data with decrypted sensitive fields."""
        data = ClientResponse.model_validate(client).model_dump()
        self._decrypt_sensitive_fields(data)
        return ClientResponse(**data)

    def _build_client_list_item(self, client: Client) -> ClientListItem:
        """Serialize list item data with decrypted sensitive fields."""
        data = ClientListItem.model_validate(client).model_dump()
        self._decrypt_sensitive_fields(data)
        return ClientListItem(**data)

    async def _generate_portal_password(self) -> str:
        """
        Generate a password that satisfies the current security policy.
        """
        specials = "!@#$%^&*()-_=+"
        rng = secrets.SystemRandom()

        def build(length: int) -> str:
            # Ensure minimum complexity regardless of policy (policy may be stricter).
            chars = [
                secrets.choice(string.ascii_lowercase),
                secrets.choice(string.ascii_uppercase),
                secrets.choice(string.digits),
                secrets.choice(specials),
            ]
            pool = string.ascii_letters + string.digits + specials
            chars.extend(secrets.choice(pool) for _ in range(max(0, length - len(chars))))
            rng.shuffle(chars)
            return "".join(chars)

        for length in (16, 20, 24, 32):
            for _ in range(20):
                candidate = build(length)
                try:
                    await enforce_password_policy(self.session, candidate)
                    return candidate
                except HTTPException:
                    continue

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate a compliant password",
        )

    async def _create_portal_user(
        self,
        name: str,
        email: str,
        password: str | None = None,
    ) -> tuple[UUID, str]:
        """
        Create a new cliente user for portal access and return (user_id, plain_password).
        """
        user_repo = UserRepository(self.session)
        existing = await user_repo.get_by_email(email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        if password:
            await enforce_password_policy(self.session, password)
            portal_password = password
        else:
            portal_password = await self._generate_portal_password()
        user = User(
            name=name,
            email=email,
            role=UserRole.CLIENTE,
            is_active=True,
            is_verified=False,
        )
        user.set_password(portal_password)
        user = await user_repo.create(user)

        return user.id, portal_password

    async def _update_portal_password(self, user_id: UUID | None, password: str) -> None:
        """Update portal user password if a linked user exists."""
        if not user_id:
            return

        await enforce_password_policy(self.session, password)
        user_repo = UserRepository(self.session)
        user = await user_repo.get_by_id(user_id)
        if user:
            user.set_password(password)
            await user_repo.update(user)

    async def _validate_user_link(self, user_id: UUID | None, current_client_id: UUID | None = None) -> None:
        """
        Ensure a user exists and is not already linked to another client.

        Args:
            user_id: User to link
            current_client_id: Current client (for updates)
        """
        if not user_id:
            return

        user_repo = UserRepository(self.session)
        user = await user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Associated user not found",
            )

        existing_client = await self.repo.get_by_user_id(user_id)
        if existing_client and existing_client.id != current_client_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User already linked to another client",
            )

    async def _ensure_drafts_enabled(self) -> None:
        """Check if client drafts feature is enabled in system settings."""
        settings_repo = SystemSettingsRepository(self.session)
        settings = await settings_repo.get_settings()
        enabled = settings.enable_client_drafts if settings else True

        if not enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Client drafts are disabled",
            )

    @staticmethod
    def _resolve_due_date_for_client(reference_month: date, due_day: int | None) -> date:
        """Resolve due date in month using client day, clamped by month length."""
        safe_due_day = due_day if isinstance(due_day, int) else 1
        safe_due_day = max(1, min(31, safe_due_day))
        last_day = monthrange(reference_month.year, reference_month.month)[1]
        return reference_month.replace(day=min(safe_due_day, last_day))

    async def _create_honorarios_transactions_for_client(
        self,
        client: Client,
        *,
        created_by_id: UUID | None,
        trigger_label: str,
    ) -> None:
        """
        Create recurring honorários transactions for a client (if eligible).

        Transactions are created for the current month with due_date based on client due day.
        """
        if not (
            client.deleted_at is None
            and client.status != ClientStatus.INATIVO
            and client.gerar_lancamentos_honorarios
            and client.honorarios_mensais
            and float(client.honorarios_mensais) > 0
        ):
            return

        from sqlalchemy import select

        from app.core.config import settings
        from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
        from app.services.finance.cash_account_service import CashAccountService

        reference_month = date.today().replace(day=1)
        due_date = self._resolve_due_date_for_client(reference_month, client.dia_vencimento)
        reference_label = reference_month.strftime("%m/%Y")
        creator_id = created_by_id or client.user_id

        if not creator_id:
            raise RuntimeError("created_by_id not available for honorarios auto-launch")

        cash_account_service = CashAccountService(self.session)
        client_cash = await cash_account_service.get_or_create_client_cash(client.id)
        office_cash = (
            await cash_account_service.get_or_create_office_cash()
            if settings.OFFICE_CLIENT_ID
            else None
        )

        # Client: accounts payable (expense)
        client_description = f"Honorários do escritório - {reference_label}"
        existing_client_tx = await self.session.scalar(
            select(FinancialTransaction.id)
            .where(
                FinancialTransaction.client_id == client.id,
                FinancialTransaction.reference_month == reference_month,
                FinancialTransaction.transaction_type == TransactionType.DESPESA,
                FinancialTransaction.description == client_description,
                FinancialTransaction.deleted_at.is_(None),
            )
            .limit(1)
        )
        if not existing_client_tx:
            self.session.add(
                FinancialTransaction(
                    client_id=client.id,
                    obligation_id=None,
                    bank_account_id=client_cash.id,
                    transaction_type=TransactionType.DESPESA,
                    amount=client.honorarios_mensais,
                    payment_method=None,
                    payment_status=PaymentStatus.PENDENTE,
                    due_date=due_date,
                    paid_date=None,
                    reference_month=reference_month,
                    description=client_description,
                    category=None,
                    notes=f"Gerado automaticamente {trigger_label} (honorários recorrentes).",
                    invoice_number=None,
                    created_by_id=creator_id,
                )
            )

        # Office: recurring revenue entry (if configured)
        if settings.OFFICE_CLIENT_ID:
            office_description = (
                f"Honorários - {client.razao_social} ({client.cnpj}) - {reference_label}"
            )
            existing_office_tx = await self.session.scalar(
                select(FinancialTransaction.id)
                .where(
                    FinancialTransaction.client_id == settings.OFFICE_CLIENT_ID,
                    FinancialTransaction.reference_month == reference_month,
                    FinancialTransaction.transaction_type == TransactionType.RECEITA,
                    FinancialTransaction.description == office_description,
                    FinancialTransaction.deleted_at.is_(None),
                )
                .limit(1)
            )
            if not existing_office_tx:
                self.session.add(
                    FinancialTransaction(
                        client_id=settings.OFFICE_CLIENT_ID,
                        obligation_id=None,
                        bank_account_id=office_cash.id,
                        transaction_type=TransactionType.RECEITA,
                        amount=client.honorarios_mensais,
                        payment_method=None,
                        payment_status=PaymentStatus.PENDENTE,
                        due_date=due_date,
                        paid_date=None,
                        reference_month=reference_month,
                        description=office_description,
                        category=None,
                        notes=(
                            f"Gerado automaticamente {trigger_label} (honorários recorrentes). "
                            f"Cliente: {client.id}"
                        ),
                        invoice_number=None,
                        created_by_id=creator_id,
                    )
                )
        else:
            print(
                "Warning: OFFICE_CLIENT_ID not configured; skipping office honorarios transaction creation"
            )

    async def create_client(
        self,
        client_data: ClientCreate,
        created_by_id: UUID | None = None,
    ) -> ClientCreateResult:
        """
        Create a new client.

        Args:
            client_data: Client creation data
            created_by_id: User ID that triggered creation (optional)

        Returns:
            Created client

        Raises:
            HTTPException: If CNPJ already exists
        """
        # Check if CNPJ already exists
        if await self.repo.cnpj_exists(client_data.cnpj):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="CNPJ already registered"
            )

        payload = client_data.model_dump()
        await self._validate_user_link(payload.get("user_id"))

        credentials: ClientUserCredentials | None = None
        portal_password = payload.get("senha_sistema")
        if not payload.get("user_id"):
            user_name = payload.get("responsavel_nome") or payload.get("razao_social")
            user_id, plain_password = await self._create_portal_user(
                user_name,
                payload["email"],
                portal_password,
            )
            payload["user_id"] = user_id
            credentials = ClientUserCredentials(access=payload["email"], credential=plain_password)
            if portal_password:
                payload["senha_sistema"] = portal_password
        elif portal_password:
            await self._update_portal_password(payload.get("user_id"), portal_password)

        payload = self._encrypt_sensitive_fields(payload)

        # Create client
        client = Client(**payload)
        client = await self.repo.create(client)
        await self.session.commit()
        await self.session.refresh(client)

        try:
            from app.core.config import settings
            from app.services.finance.cash_account_service import CashAccountService

            cash_account_service = CashAccountService(self.session)
            if settings.OFFICE_CLIENT_ID and client.id == settings.OFFICE_CLIENT_ID:
                await cash_account_service.get_or_create_office_cash()
            else:
                await cash_account_service.get_or_create_client_cash(client.id)
            await self.session.commit()
        except Exception as e:
            print(f"Warning: Failed to create cash account for client {client.id}: {e}")
            await self.session.rollback()

        # Generate obligations for current month
        try:
            from datetime import datetime
            today = datetime.now()
            generator = ObligationGenerator(self.session)
            await generator.generate_for_client(
                client=client,
                year=today.year,
                month=today.month,
                generated_by_id=payload.get("user_id")
            )
            await self.session.commit()
        except Exception as e:
            # Log error but don't fail client creation
            print(f"Warning: Failed to generate obligations for client {client.id}: {e}")
            pass

        # Create licenses based on licencas_necessarias
        try:
            from app.db.models.license import License, LicenseType, LicenseStatus
            from app.db.repositories.license import LicenseRepository
            from datetime import datetime, timedelta

            # Map licencas_necessarias to LicenseType
            license_mapping = {
                'licenca_sanitaria': LicenseType.LICENCA_SANITARIA,
                'arcb_bombeiros': LicenseType.LICENCA_BOMBEIROS,
                'alvara_funcionamento': LicenseType.ALVARA_FUNCIONAMENTO,
                'licenca_operacoes': LicenseType.ALVARA_FUNCIONAMENTO,
                'baixo_risco': LicenseType.ALVARA_FUNCIONAMENTO,
                'cert_acessibilidade': LicenseType.OUTROS,
            }

            licencas_necessarias = client.licencas_necessarias or []
            if licencas_necessarias:
                license_repo = LicenseRepository(self.session)
                today = datetime.now()

                for licenca_code in licencas_necessarias:
                    license_type = license_mapping.get(licenca_code)
                    if license_type:
                        # Create license card with pending status
                        license = License(
                            client_id=client.id,
                            license_type=license_type,
                            status=LicenseStatus.EM_PROCESSO,
                            registration_number="PENDENTE",
                            issuing_authority="A DEFINIR",
                            issue_date=today.date(),
                            expiration_date=None,
                            notes=f"Licença criada automaticamente ao cadastrar cliente. Preencha os dados quando disponível."
                        )
                        license = await license_repo.create(license)

                await self.session.commit()
        except Exception as e:
            # Log error but don't fail client creation
            print(f"Warning: Failed to create licenses for client {client.id}: {e}")
            pass

        # Create recurring honorarios transactions (client expense + office revenue)
        try:
            await self._create_honorarios_transactions_for_client(
                client,
                created_by_id=created_by_id or payload.get("user_id"),
                trigger_label="ao cadastrar cliente",
            )
            await self.session.commit()
        except Exception as e:
            print(f"Warning: Failed to create honorarios transactions for client {client.id}: {e}")
            await self.session.rollback()
            pass

        return ClientCreateResult(
            client=self._build_client_response(client),
            credentials=credentials,
        )

    async def get_client(self, client_id: UUID) -> ClientResponse:
        """
        Get client by ID.

        Args:
            client_id: Client UUID

        Returns:
            Client data

        Raises:
            HTTPException: If client not found
        """
        client = await self.repo.get_by_id(client_id)

        if not client or client.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found"
            )

        return self._build_client_response(client)

    async def get_client_by_cnpj(self, cnpj: str) -> ClientResponse:
        """
        Get client by CNPJ.

        Args:
            cnpj: Client CNPJ

        Returns:
            Client data

        Raises:
            HTTPException: If client not found
        """
        client = await self.repo.get_by_cnpj(cnpj)

        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found"
            )

        return self._build_client_response(client)

    async def update_client(
        self,
        client_id: UUID,
        client_data: ClientUpdate,
        updated_by_id: UUID | None = None,
    ) -> ClientResponse:
        """
        Update client.

        Args:
            client_id: Client UUID
            client_data: Client update data
            updated_by_id: User ID that triggered update (optional)

        Returns:
            Updated client

        Raises:
            HTTPException: If client not found or CNPJ already exists
        """
        # Get client
        client = await self.repo.get_by_id(client_id)

        if not client or client.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found"
            )

        # Check if CNPJ is being changed and already exists
        if client_data.cnpj and client_data.cnpj != client.cnpj:
            if await self.repo.cnpj_exists(client_data.cnpj, exclude_id=client_id):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="CNPJ already registered"
                )

        # Update fields
        update_data = client_data.model_dump(exclude_unset=True)
        portal_password = update_data.get("senha_sistema")
        if portal_password:
            target_user_id = update_data.get("user_id") or client.user_id
            await self._update_portal_password(target_user_id, portal_password)
        await self._validate_user_link(update_data.get("user_id"), current_client_id=client_id)
        update_data = self._encrypt_sensitive_fields(update_data)

        for field, value in update_data.items():
            setattr(client, field, value)

        client = await self.repo.update(client)
        await self.session.commit()
        await self.session.refresh(client)

        # Ensure recurring honorários launch is created/updated after edition
        try:
            await self._create_honorarios_transactions_for_client(
                client,
                created_by_id=updated_by_id or update_data.get("user_id"),
                trigger_label="ao editar cliente",
            )
            await self.session.commit()
        except Exception as e:
            print(f"Warning: Failed to create honorarios transactions for updated client {client.id}: {e}")
            await self.session.rollback()
            pass

        return self._build_client_response(client)

    async def delete_client(self, client_id: UUID) -> None:
        """
        Delete client (soft delete).

        Args:
            client_id: Client UUID

        Raises:
            HTTPException: If client not found
        """
        client = await self.repo.get_by_id(client_id)

        if not client or client.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found"
            )

        client.soft_delete()
        await self.session.commit()

    async def list_clients(
        self,
        query: Optional[str] = None,
        cnpj: Optional[str] = None,
        status: Optional[str] = None,
        starts_with: Optional[str] = None,
        regime_tributario: Optional[str] = None,
        tipo_empresa: Optional[str] = None,
        page: int = 1,
        size: int = 10,
    ) -> dict:
        """
        List clients with filters and pagination.

        Args:
            query: Search term
            status: Filter by status
            starts_with: Filter by first letter
            page: Page number (1-indexed)
            size: Page size

        Returns:
            Paginated client list
        """
        if size == 0:
            skip = 0
            limit = None
            page = 1
        else:
            skip = (page - 1) * size
            limit = size

        # Convert status string to enum
        status_enum = None
        if status:
            try:
                status_enum = ClientStatus(status)
            except ValueError:
                pass

        regime_enum = None
        if regime_tributario:
            try:
                regime_enum = RegimeTributario(regime_tributario)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid regime_tributario: {regime_tributario}",
                )

        tipo_enum = None
        if tipo_empresa:
            try:
                tipo_enum = TipoEmpresa(tipo_empresa)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid tipo_empresa: {tipo_empresa}",
                )

        clients, total = await self.repo.list_with_filters(
            query=query,
            cnpj=cnpj,
            status=status_enum,
            starts_with=starts_with,
            regime_tributario=regime_enum,
            tipo_empresa=tipo_enum,
            skip=skip,
            limit=limit,
        )

        # Convert to list items
        items = [self._build_client_list_item(c) for c in clients]

        # Calculate pages
        if size == 0:
            pages = 1 if total > 0 else 0
        else:
            pages = (total + size - 1) // size if size > 0 else 0

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
        }

    async def search_clients(self, query: str, limit: int = 10) -> list[dict]:
        """
        Quick search for autocomplete.

        Args:
            query: Search term
            limit: Maximum results

        Returns:
            List of clients (simplified)
        """
        clients = await self.repo.search(query, limit)

        return [
            {
                "id": str(c.id),
                "razao_social": c.razao_social,
                "cnpj": c.cnpj,
            }
            for c in clients
        ]

    async def get_stats(self) -> dict:
        """
        Get client statistics.

        Returns:
            Dictionary with client statistics including:
            - total: Total number of clients
            - by_status: Breakdown by status
            - by_regime: Breakdown by tax regime
            - total_revenue: Total monthly revenue
        """
        from sqlalchemy import func, select

        active_filter = Client.deleted_at.is_(None)

        # Total clients
        total_query = select(func.count(Client.id)).where(active_filter)
        total_result = await self.session.execute(total_query)
        total = total_result.scalar() or 0

        # By status
        status_query = (
            select(Client.status, func.count(Client.id))
            .where(active_filter)
            .group_by(Client.status)
        )
        status_result = await self.session.execute(status_query)
        by_status = {status: count for status, count in status_result.all()}

        # By regime
        regime_query = (
            select(Client.regime_tributario, func.count(Client.id))
            .where(active_filter)
            .group_by(Client.regime_tributario)
        )
        regime_result = await self.session.execute(regime_query)
        by_regime = {regime: count for regime, count in regime_result.all()}

        # Total revenue
        revenue_query = select(func.sum(Client.honorarios_mensais)).where(
            active_filter,
            Client.status != ClientStatus.INATIVO,
        )
        revenue_result = await self.session.execute(revenue_query)
        total_revenue = revenue_result.scalar() or 0.0

        return {
            "total": total,
            "by_status": by_status,
            "by_regime": by_regime,
            "total_revenue": float(total_revenue),
        }

    async def get_client_by_user_id(self, user_id: UUID) -> ClientResponse:
        """
        Get client by user ID.

        Args:
            user_id: User UUID

        Returns:
            Client data

        Raises:
            HTTPException: If client not found or user not linked
        """
        client = await self.repo.get_by_user_id(user_id)

        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found for this user"
            )

        return self._build_client_response(client)

    async def save_draft(self, draft_data: ClientDraftCreate, user_id: UUID) -> UUID:
        """
        Save client form draft.

        Args:
            draft_data: Draft data
            user_id: User ID who created the draft

        Returns:
            Draft ID
        """
        from sqlalchemy import select
        from app.db.models.client_draft import ClientDraft

        await self._ensure_drafts_enabled()

        draft_json = draft_data.model_dump(exclude={"draft_name"})

        result = await self.session.execute(
            select(ClientDraft).where(ClientDraft.user_id == user_id)
        )
        draft = result.scalar_one_or_none()

        if draft:
            draft.draft_data = draft_json
            draft.notes = draft_data.draft_name
        else:
            draft = ClientDraft(
                user_id=user_id,
                draft_data=draft_json,
                notes=draft_data.draft_name,
            )
            self.session.add(draft)

        await self.session.commit()
        await self.session.refresh(draft)

        return draft.id

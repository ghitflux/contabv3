"""
Master script to run all seeds in correct order.
"""

import asyncio

import importlib.util
import sys
from pathlib import Path

scripts_dir = Path(__file__).parent

# Load and run each seed script
spec = importlib.util.spec_from_file_location("seed_obligation_types", scripts_dir / "seed_obligation_types.py")
seed_obligation_types_mod = importlib.util.module_from_spec(spec)
sys.modules["seed_obligation_types"] = seed_obligation_types_mod
spec.loader.exec_module(seed_obligation_types_mod)
seed_obligation_types = seed_obligation_types_mod.seed_obligation_types

spec = importlib.util.spec_from_file_location("seed_clients", scripts_dir / "seed_clients.py")
seed_clients_mod = importlib.util.module_from_spec(spec)
sys.modules["seed_clients"] = seed_clients_mod
spec.loader.exec_module(seed_clients_mod)
seed_clients = seed_clients_mod.seed_clients

spec = importlib.util.spec_from_file_location("seed_obligations", scripts_dir / "seed_obligations.py")
seed_obligations_mod = importlib.util.module_from_spec(spec)
sys.modules["seed_obligations"] = seed_obligations_mod
spec.loader.exec_module(seed_obligations_mod)
seed_obligations = seed_obligations_mod.seed_obligations

spec = importlib.util.spec_from_file_location("seed_licenses", scripts_dir / "seed_licenses.py")
seed_licenses_mod = importlib.util.module_from_spec(spec)
sys.modules["seed_licenses"] = seed_licenses_mod
spec.loader.exec_module(seed_licenses_mod)
seed_licenses = seed_licenses_mod.seed_licenses

spec = importlib.util.spec_from_file_location("seed_notifications", scripts_dir / "seed_notifications.py")
seed_notifications_mod = importlib.util.module_from_spec(spec)
sys.modules["seed_notifications"] = seed_notifications_mod
spec.loader.exec_module(seed_notifications_mod)
seed_notifications = seed_notifications_mod.seed_notifications


async def seed_all():
    """Run all seeds in order."""
    print("=" * 60)
    print("Starting database seeding...")
    print("=" * 60)

    # 1. Seed obligation types first (required for obligations)
    print("\n[1/5] Seeding obligation types...")
    await seed_obligation_types()

    # 2. Seed clients
    print("\n[2/5] Seeding clients...")
    await seed_clients()

    # 3. Seed obligations (requires clients and obligation types)
    print("\n[3/5] Seeding obligations...")
    await seed_obligations()

    # 4. Seed licenses (requires clients)
    print("\n[4/5] Seeding licenses...")
    await seed_licenses()

    # 5. Seed notifications (requires users and optionally clients/obligations)
    print("\n[5/5] Seeding notifications...")
    await seed_notifications()

    print("\n" + "=" * 60)
    print("All seeds completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed_all())


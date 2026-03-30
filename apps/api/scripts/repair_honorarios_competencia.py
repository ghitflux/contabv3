"""
Repair script for honorários saved one month ahead of the correct competence.

Run with: python -m scripts.repair_honorarios_competencia
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import db_manager
from app.services.finance import HonorariosRepairService


async def repair_honorarios_competencia() -> int:
    """Run the repair and return the desired process exit code."""
    print("[*] Starting honorários competence repair...")

    async with db_manager.session_factory() as session:
        service = HonorariosRepairService(session)
        summary = await service.repair_shifted_honorarios()

    print(f"[INFO] Scanned: {summary['scanned']}")
    print(f"[INFO] Updated: {summary['updated']}")
    print(f"[INFO] Skipped: {summary['skipped']}")
    print(f"[INFO] Conflicts: {len(summary['conflicts'])}")

    if summary["conflicts"]:
        print("[WARN] Conflicts detected. No automatic move was applied to these transactions:")
        for conflict in summary["conflicts"]:
            print(f"  - {conflict}")
        return 1

    print("[SUCCESS] Honorários competence repair completed without conflicts.")
    return 0


async def main() -> None:
    exit_code = 0
    try:
        exit_code = await repair_honorarios_competencia()
    except Exception as exc:
        print(f"[ERROR] Failed to repair honorários competence: {exc}")
        import traceback

        traceback.print_exc()
        exit_code = 1
    finally:
        await db_manager.close()

    if exit_code != 0:
        raise SystemExit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())

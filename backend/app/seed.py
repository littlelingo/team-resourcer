"""Seed script — populates sample data for manual testing.

Run via: make seed
Which executes: docker compose exec backend python -m app.seed

Idempotent: checks for FunctionalArea named "Engineering" before inserting.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.agency import Agency
from app.models.functional_area import FunctionalArea
from app.models.program import Program
from app.models.program_assignment import ProgramAssignment
from app.models.team import Team
from app.models.team_member import TeamMember
from app.schemas.team_member import TeamMemberCreate
from app.services.member_service import create_member


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # --- Idempotency check ---
        result = await db.execute(
            select(FunctionalArea).where(FunctionalArea.name == "Engineering")
        )
        if result.scalar_one_or_none() is not None:
            print("Seed data already present — skipping.")
            return

        # ------------------------------------------------------------------ #
        # 0. Agencies
        # ------------------------------------------------------------------ #
        va = Agency(name="VA", description="Department of Veterans Affairs")
        cms = Agency(name="CMS", description="Centers for Medicare & Medicaid Services")
        sec = Agency(name="SEC", description="Securities and Exchange Commission")
        db.add_all([va, cms, sec])
        await db.flush()
        print(f"Created Agency: {va.name} (id={va.id})")
        print(f"Created Agency: {cms.name} (id={cms.id})")
        print(f"Created Agency: {sec.name} (id={sec.id})")

        # ------------------------------------------------------------------ #
        # 1. Functional Areas
        # ------------------------------------------------------------------ #
        engineering = FunctionalArea(name="Engineering", description="Engineering department")
        product = FunctionalArea(name="Product", description="Product department")
        db.add_all([engineering, product])
        await db.flush()
        print(f"Created FunctionalArea: {engineering.name} (id={engineering.id})")
        print(f"Created FunctionalArea: {product.name} (id={product.id})")

        # ------------------------------------------------------------------ #
        # 2. Teams (lead_id set later, after members are created)
        # ------------------------------------------------------------------ #
        platform_team = Team(
            name="Platform Team",
            functional_area_id=engineering.id,
            description="Core infrastructure and platform services",
        )
        growth_team = Team(
            name="Growth Team",
            functional_area_id=product.id,
            description="User acquisition and retention",
        )
        db.add_all([platform_team, growth_team])
        await db.flush()
        print(f"Created Team: {platform_team.name} (id={platform_team.id})")
        print(f"Created Team: {growth_team.name} (id={growth_team.id})")

        # Commit so that create_member (which also commits) can reference these
        # functional area and team IDs from a clean transaction.
        await db.commit()

        # ------------------------------------------------------------------ #
        # 3. Team Members — create_member handles history and commits each one
        # ------------------------------------------------------------------ #
        alice = await create_member(
            db,
            TeamMemberCreate(
                employee_id="E001",
                first_name="Alice",
                last_name="Johnson",
                title="Staff Engineer",
                location="San Francisco, CA",
                email="alice.johnson@example.com",
                phone="+1-415-555-0101",
                slack_handle="@alice",
                salary=120000,
                bonus=15000,
                pto_used=40,
                functional_area_id=engineering.id,
                team_id=platform_team.id,
            ),
        )
        print(f"Created TeamMember: {alice.name} (uuid={alice.uuid})")

        bob = await create_member(
            db,
            TeamMemberCreate(
                employee_id="E002",
                first_name="Bob",
                last_name="Smith",
                title="Senior Engineer",
                location="Austin, TX",
                email="bob.smith@example.com",
                phone="+1-512-555-0102",
                slack_handle="@bob",
                salary=110000,
                bonus=12000,
                pto_used=32,
                functional_area_id=engineering.id,
                team_id=platform_team.id,
            ),
        )
        print(f"Created TeamMember: {bob.name} (uuid={bob.uuid})")

        carol = await create_member(
            db,
            TeamMemberCreate(
                employee_id="E003",
                first_name="Carol",
                last_name="Williams",
                title="Senior Product Manager",
                location="New York, NY",
                email="carol.williams@example.com",
                phone="+1-212-555-0103",
                slack_handle="@carol",
                salary=115000,
                bonus=14000,
                pto_used=45,
                functional_area_id=product.id,
                team_id=growth_team.id,
            ),
        )
        print(f"Created TeamMember: {carol.name} (uuid={carol.uuid})")

        # ------------------------------------------------------------------ #
        # 4. Programs
        # ------------------------------------------------------------------ #
        alpha = Program(
            name="Alpha Program", description="First flagship initiative", agency_id=va.id
        )
        beta = Program(
            name="Beta Program", description="Second growth initiative", agency_id=cms.id
        )
        db.add_all([alpha, beta])
        await db.flush()
        print(f"Created Program: {alpha.name} (id={alpha.id})")
        print(f"Created Program: {beta.name} (id={beta.id})")

        # ------------------------------------------------------------------ #
        # 5. Program Assignments
        # ------------------------------------------------------------------ #
        db.add_all(
            [
                ProgramAssignment(member_uuid=alice.uuid, program_id=alpha.id, role="Tech Lead"),
                ProgramAssignment(member_uuid=bob.uuid, program_id=alpha.id, role="Developer"),
                ProgramAssignment(
                    member_uuid=carol.uuid, program_id=beta.id, role="Product Manager"
                ),
            ]
        )
        await db.flush()
        print(f"Assigned {alice.name} → {alpha.name} (Tech Lead)")
        print(f"Assigned {bob.name} → {alpha.name} (Developer)")
        print(f"Assigned {carol.name} → {beta.name} (Product Manager)")

        # ------------------------------------------------------------------ #
        # 6. Supervisor relationship: Alice supervises Bob
        # ------------------------------------------------------------------ #
        result = await db.execute(select(TeamMember).where(TeamMember.uuid == bob.uuid))
        bob_row = result.scalar_one()
        bob_row.supervisor_id = alice.uuid
        await db.flush()
        print(f"Set supervisor: {alice.name} supervises {bob.name}")

        # ------------------------------------------------------------------ #
        # 7. Team leads: Alice leads Platform Team, Carol leads Growth Team
        # ------------------------------------------------------------------ #
        result = await db.execute(select(Team).where(Team.id == platform_team.id))
        platform_row = result.scalar_one()
        platform_row.lead_id = alice.uuid

        result = await db.execute(select(Team).where(Team.id == growth_team.id))
        growth_row = result.scalar_one()
        growth_row.lead_id = carol.uuid

        await db.flush()
        print(f"Set team lead: {alice.name} leads {platform_team.name}")
        print(f"Set team lead: {carol.name} leads {growth_team.name}")

        # ------------------------------------------------------------------ #
        # Final commit
        # ------------------------------------------------------------------ #
        await db.commit()
        print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())

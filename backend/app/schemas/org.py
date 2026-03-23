from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrgTreeNode(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: UUID
    name: str
    title: str | None
    image_path: str | None
    direct_reports: list["OrgTreeNode"] = []


OrgTreeNode.model_rebuild()


class SupervisorUpdate(BaseModel):
    supervisor_id: UUID | None = None

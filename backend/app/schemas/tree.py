"""Pydantic schemas for tree node/edge responses."""

from typing import Any

from pydantic import BaseModel


class TreeNodePosition(BaseModel):
    x: float = 0
    y: float = 0


class TreeNode(BaseModel):
    id: str
    type: str
    data: dict[str, Any]
    position: TreeNodePosition = TreeNodePosition()


class TreeEdge(BaseModel):
    id: str
    source: str
    target: str


class TreeResponse(BaseModel):
    nodes: list[TreeNode]
    edges: list[TreeEdge]

from .base import ApiModel


class CurrentUser(ApiModel):
    id: str
    email: str | None = None
    display_name: str | None = None

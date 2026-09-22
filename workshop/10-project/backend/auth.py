"""Demo login gate for the finance swarm portal.

DEMO AUTH ONLY — hardcoded admin/admin credential check, not a real
authentication system. Do not reuse this pattern outside a workshop demo:
no hashing, no JWT, no persistence beyond an in-memory session token.
"""

DEMO_USERNAME = "admin"
DEMO_PASSWORD = "admin"
DEMO_TOKEN = "demo-session"


def check_credentials(username: str, password: str) -> str | None:
    """Returns a session token if the demo credentials match, else None."""
    if username == DEMO_USERNAME and password == DEMO_PASSWORD:
        return DEMO_TOKEN
    return None

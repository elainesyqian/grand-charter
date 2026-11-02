"""Domain errors raised by policy and services; main.py maps them to HTTP responses.

Services never import FastAPI, so they can be reused from the seed script and tests.
"""


class DomainError(Exception):
    status_code = 400

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class NotFound(DomainError):
    status_code = 404


class Conflict(DomainError):
    """The record is not in the state the action requires (or changed concurrently)."""

    status_code = 409


class InvalidRequest(DomainError):
    status_code = 400


class PayloadTooLarge(DomainError):
    status_code = 413

"""AIP v0.1 structural and semantic validation."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping, Sequence

from jsonschema import Draft202012Validator, FormatChecker, ValidationError

AIP_VERSION = "0.1"
AUDIT_LOG_VERSION = "1.0"

SCHEMA_URLS = {
    "identity": "https://schema.gazebohq.com/v0.1/identity.json",
    "policy": "https://schema.gazebohq.com/v0.1/policy.json",
    "audit_log": "https://schema.gazebohq.com/v0.1/audit-log.json",
}

SchemaKind = str
Document = Mapping[str, Any]


@dataclass(frozen=True)
class ValidationOptions:
    """Options that affect validation without fetching remote resources."""

    trusted_mirrors: Mapping[str, Sequence[str]] | None = None


@dataclass(frozen=True)
class ValidationIssue:
    """A machine-readable validation problem."""

    path: tuple[str | int, ...]
    message: str
    code: str


@dataclass(frozen=True)
class ValidationResult:
    """The result of validating one AIP document."""

    valid: bool
    data: Document | None = None
    errors: tuple[ValidationIssue, ...] = ()


_SCHEMA_FILES = {
    "identity": "identity.json",
    "policy": "policy.json",
    "audit_log": "audit-log.json",
}


@lru_cache(maxsize=None)
def _validator(kind: SchemaKind) -> Draft202012Validator:
    schema_path = Path(__file__).parent / "schemas" / _SCHEMA_FILES[kind]
    with schema_path.open(encoding="utf-8") as schema_file:
        schema = json.load(schema_file)
    return Draft202012Validator(schema, format_checker=FormatChecker())


def _issue(error: ValidationError) -> ValidationIssue:
    return ValidationIssue(
        path=tuple(error.absolute_path),
        message=error.message,
        code=str(error.validator or "validation_error"),
    )


def _trusted_mirrors(
    options: ValidationOptions | Mapping[str, Any] | None,
    kind: SchemaKind,
) -> Sequence[str]:
    if options is None:
        return ()

    if isinstance(options, ValidationOptions):
        mirrors = options.trusted_mirrors or {}
    else:
        mirrors = options.get("trusted_mirrors", options.get("trustedMirrors", {}))

    if not isinstance(mirrors, Mapping):
        return ()
    values = mirrors.get(kind, ())
    return values if isinstance(values, Sequence) and not isinstance(values, str) else ()


def _validate_document(
    input_document: Any,
    kind: SchemaKind,
    options: ValidationOptions | Mapping[str, Any] | None,
) -> ValidationResult:
    errors = tuple(
        sorted(
            (_issue(error) for error in _validator(kind).iter_errors(input_document)),
            key=lambda item: tuple(str(part) for part in item.path),
        )
    )
    if errors:
        return ValidationResult(valid=False, errors=errors)

    assert isinstance(input_document, Mapping)
    schema_reference = input_document["$schema"]
    if schema_reference != SCHEMA_URLS[kind] and schema_reference not in _trusted_mirrors(
        options, kind
    ):
        return ValidationResult(
            valid=False,
            errors=(
                ValidationIssue(
                    path=("$schema",),
                    message=(
                        "must use the canonical AIP schema URL or an explicitly "
                        "trusted equivalent mirror"
                    ),
                    code="untrusted_schema_reference",
                ),
            ),
        )

    return ValidationResult(valid=True, data=dict(input_document))


def _invalid(
    errors: Sequence[ValidationIssue],
) -> ValidationResult:
    return ValidationResult(valid=False, errors=tuple(errors))


def _action_allowed(declared_actions: set[str], requested_action: str) -> bool:
    if requested_action in declared_actions:
        return True
    resource, separator, _ = requested_action.partition(":")
    return bool(separator) and f"{resource}:*" in declared_actions


def _unique_scope(
    items: Sequence[Mapping[str, Any]],
    path: tuple[str | int, ...],
) -> list[ValidationIssue]:
    errors: list[ValidationIssue] = []
    services: set[str] = set()

    for index, item in enumerate(items):
        service = item["service"]
        if service in services:
            errors.append(
                ValidationIssue(
                    path=(*path, index, "service"),
                    message=f'service "{service}" must appear only once',
                    code="custom",
                )
            )
        services.add(service)

        actions: set[str] = set()
        for action_index, action in enumerate(item["actions"]):
            if action in actions:
                errors.append(
                    ValidationIssue(
                        path=(*path, index, "actions", action_index),
                        message=f'action "{action}" must appear only once',
                        code="custom",
                    )
                )
            actions.add(action)

    return errors


def validate_identity(
    input_document: Any,
    options: ValidationOptions | Mapping[str, Any] | None = None,
) -> ValidationResult:
    result = _validate_document(input_document, "identity", options)
    if not result.valid:
        return result

    assert result.data is not None
    errors = _unique_scope(result.data["scope"], ("scope",))
    return _invalid(errors) if errors else result


def validate_policy(
    input_document: Any,
    options: ValidationOptions | Mapping[str, Any] | None = None,
) -> ValidationResult:
    result = _validate_document(input_document, "policy", options)
    if not result.valid:
        return result

    assert result.data is not None
    document = result.data
    errors = _unique_scope(document["policy"], ("policy",))
    allowed = {
        item["service"]: set(item["actions"]) for item in document["policy"]
    }

    for rule_index, rule in enumerate(document.get("approval_rules", [])):
        actions: set[str] = set()
        for action_index, action in enumerate(rule["actions"]):
            if action in actions:
                errors.append(
                    ValidationIssue(
                        path=("approval_rules", rule_index, "actions", action_index),
                        message=f'action "{action}" must appear only once',
                        code="custom",
                    )
                )
            actions.add(action)

            if rule["service"] not in allowed or not _action_allowed(
                allowed[rule["service"]], action
            ):
                errors.append(
                    ValidationIssue(
                        path=("approval_rules", rule_index, "actions", action_index),
                        message="approval rule actions must already be granted by policy",
                        code="custom",
                    )
                )

    return _invalid(errors) if errors else result


def validate_audit_log(
    input_document: Any,
    options: ValidationOptions | Mapping[str, Any] | None = None,
) -> ValidationResult:
    return _validate_document(input_document, "audit_log", options)


def validate_policy_against_identity(
    policy_input: Any,
    identity_input: Any,
    options: ValidationOptions | Mapping[str, Any] | None = None,
) -> ValidationResult:
    policy_result = validate_policy(policy_input, options)
    identity_result = validate_identity(identity_input, options)
    errors = [
        *(() if policy_result.valid else policy_result.errors),
        *(() if identity_result.valid else identity_result.errors),
    ]
    if not policy_result.valid or not identity_result.valid:
        return ValidationResult(valid=False, errors=tuple(errors))

    assert policy_result.data is not None
    assert identity_result.data is not None
    identity_scope = {
        item["service"]: set(item["actions"])
        for item in identity_result.data["scope"]
    }

    for item_index, item in enumerate(policy_result.data["policy"]):
        declared_actions = identity_scope.get(item["service"])
        for action_index, action in enumerate(item["actions"]):
            if declared_actions is None or not _action_allowed(
                declared_actions, action
            ):
                errors.append(
                    ValidationIssue(
                        path=("policy", item_index, "actions", action_index),
                        message=(
                            "policy action must be equal to or narrower than "
                            "identity scope"
                        ),
                        code="scope_narrowing",
                    )
                )

    if policy_result.data["agent_id"] != identity_result.data["id"]:
        errors.append(
            ValidationIssue(
                path=("agent_id",),
                message="policy agent_id must match identity id",
                code="identity_mismatch",
            )
        )

    if policy_result.data["version"] != identity_result.data["version"]:
        errors.append(
            ValidationIssue(
                path=("version",),
                message="policy version must match identity version",
                code="identity_mismatch",
            )
        )

    return _invalid(errors) if errors else policy_result
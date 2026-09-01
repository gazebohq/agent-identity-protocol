import json
import unittest
from pathlib import Path

from gazebo_agent_identity_protocol import (
    SCHEMA_URLS,
    ValidationOptions,
    validate_audit_log,
    validate_identity,
    validate_policy,
    validate_policy_against_identity,
)


PACKAGE_ROOT = Path(__file__).parents[1]
CANONICAL_PACKAGE = PACKAGE_ROOT.parent / "agent-identity-protocol"
SHARED_FIXTURES = (
    CANONICAL_PACKAGE
    / "test"
    / "fixtures"
)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


class ConformanceTests(unittest.TestCase):
    def test_shared_fixtures(self):
        manifest = load_json(SHARED_FIXTURES / "manifest.json")

        for fixture in manifest:
            input_document = load_json(SHARED_FIXTURES / fixture["file"])
            if fixture["type"] == "identity":
                result = validate_identity(input_document)
            elif fixture["type"] == "policy":
                result = validate_policy(input_document)
            elif fixture["type"] == "audit-log":
                result = validate_audit_log(input_document)
            else:
                result = validate_policy_against_identity(
                    input_document["policy"],
                    input_document["identity"],
                )

            self.assertEqual(
                result.valid,
                fixture["valid"],
                fixture["name"],
            )

    def test_trusted_mirror_is_explicit(self):
        identity = load_json(SHARED_FIXTURES / "identity/minimal.json")
        identity["$schema"] = "https://mirror.example.test/aip/identity.json"

        self.assertFalse(validate_identity(identity).valid)
        self.assertTrue(
            validate_identity(
                identity,
                ValidationOptions(
                    trusted_mirrors={
                        "identity": ["https://mirror.example.test/aip/identity.json"]
                    }
                ),
            ).valid
        )

    def test_canonical_schema_urls_are_exposed(self):
        self.assertEqual(
            SCHEMA_URLS["identity"],
            "https://schema.gazebohq.com/v0.1/identity.json",
        )
        self.assertEqual(
            SCHEMA_URLS["policy"],
            "https://schema.gazebohq.com/v0.1/policy.json",
        )
        self.assertEqual(
            SCHEMA_URLS["audit_log"],
            "https://schema.gazebohq.com/v0.1/audit-log.json",
        )

    def test_bundled_schemas_match_canonical_documents(self):
        bundled_schemas = (
            PACKAGE_ROOT
            / "src"
            / "gazebo_agent_identity_protocol"
            / "schemas"
        )

        for filename in ("identity.json", "policy.json", "audit-log.json"):
            self.assertEqual(
                load_json(bundled_schemas / filename),
                load_json(CANONICAL_PACKAGE / "schemas" / filename),
                filename,
            )


if __name__ == "__main__":
    unittest.main()
import importlib.util
import pathlib
import sys
import types


ROOT = pathlib.Path(__file__).resolve().parents[1]


class FakeDynArray(list):
    @classmethod
    def __class_getitem__(cls, _item):
        return cls


class FakeContract:
    pass


def identity_decorator(*_args, **_kwargs):
    return lambda function: function


fake_gl = types.SimpleNamespace(
    Contract=FakeContract,
    public=types.SimpleNamespace(write=identity_decorator, view=identity_decorator),
)
fake_genlayer = types.ModuleType("genlayer")
fake_genlayer.gl = fake_gl
fake_genlayer.DynArray = FakeDynArray
sys.modules["genlayer"] = fake_genlayer

spec = importlib.util.spec_from_file_location("paper_signal_contract", ROOT / "contracts" / "paper_signal_registry.py")
contract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contract)


def assessment(**updates):
    value = {
        "queried_doi": "10.1002/jcb.28088",
        "pubmed_doi": "10.1002/jcb.28088",
        "pubmed_update_class": contract.PUBMED_RETRACTED,
        "crossref_update_type": contract.CROSSREF_RETRACTION,
        "related_doi": "10.1002/jcb.30201",
        "status": contract.RETRACTION_REPORTED,
        "evidence": ["PubMed labels this a retracted publication."],
        "reasoning": "The target article record explicitly reports a retraction.",
    }
    value.update(updates)
    return value


def test_doi_prefix_and_case_are_normalized():
    assert contract._normalize_doi(" https://doi.org/10.1002/JCB.28088 ") == "10.1002/jcb.28088"


def test_rejects_non_pubmed_or_non_article_urls():
    assert contract._is_pubmed_article_url("https://pubmed.ncbi.nlm.nih.gov/30485508/")
    assert not contract._is_pubmed_article_url("https://pubmed.ncbi.nlm.nih.gov/help/")
    assert not contract._is_pubmed_article_url("https://example.org/30485508")


def test_retraction_requires_explicit_source_signal():
    valid = contract._validate_assessment(assessment(), "10.1002/jcb.28088")
    assert valid["status"] == contract.RETRACTION_REPORTED
    invalid = assessment(pubmed_update_class=contract.PUBMED_CURRENT, crossref_update_type=contract.CROSSREF_NONE)
    try:
        contract._validate_assessment(invalid, "10.1002/jcb.28088")
    except ValueError as error:
        assert "explicit source metadata" in str(error)
    else:
        raise AssertionError("Unsupported retraction status was accepted")


def test_no_update_requires_both_sources_to_report_none():
    valid = assessment(
        pubmed_update_class=contract.PUBMED_CURRENT,
        crossref_update_type=contract.CROSSREF_NONE,
        related_doi="",
        status=contract.NO_UPDATE_REPORTED,
    )
    assert contract._validate_assessment(valid, "10.1002/jcb.28088")["status"] == contract.NO_UPDATE_REPORTED
    invalid = dict(valid, crossref_update_type=contract.CROSSREF_UNKNOWN)
    try:
        contract._validate_assessment(invalid, "10.1002/jcb.28088")
    except ValueError as error:
        assert "conflicts" in str(error)
    else:
        raise AssertionError("Unknown Crossref status was reported as no update")


def test_substantive_status_requires_matching_pubmed_identity_and_evidence():
    invalid = [
        assessment(pubmed_doi=""),
        assessment(evidence=[]),
        assessment(pubmed_update_class=contract.PUBMED_CURRENT, crossref_update_type=contract.CROSSREF_NONE,
                   status=contract.CORRECTION_REPORTED),
    ]
    for value in invalid:
        try:
            contract._validate_assessment(value, "10.1002/jcb.28088")
        except ValueError:
            pass
        else:
            raise AssertionError("Unsupported substantive result was accepted")


def test_rejects_wrong_article_and_oversized_evidence():
    wrong_article = assessment(pubmed_doi="10.1002/other")
    too_long = assessment(evidence=["x" * (contract.MAX_EVIDENCE_CHARS + 1)])
    for value in (wrong_article, too_long):
        try:
            contract._validate_assessment(value, "10.1002/jcb.28088")
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid assessment passed contract validation")

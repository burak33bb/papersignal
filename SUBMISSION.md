# Project submission draft — PaperSignal

## Title

PaperSignal: Consensus-backed publication update registry

## Short description

PaperSignal checks official PubMed and Crossref records for a paper’s correction, expression-of-concern, or retraction metadata, then stores the evidence and consensus result in a shared GenLayer contract.

## Project description

Publication notices can be missed when readers encounter a paper outside its publisher page. PaperSignal lets a researcher or librarian check a DOI against its official PubMed article record and Crossref work metadata. GenLayer validators inspect both sources independently, reconcile the exact DOI and update relationship through comparative equivalence, and write a source-linked result to an append-only Intelligent Contract registry. The web app submits contract transactions and reads the shared history back from GenLayer.

Each saved record includes the source classifications, related DOI when present, short evidence excerpts, source links, and a concise explanation. The contract rejects mismatched article identifiers, unsupported retraction claims, invalid evidence, and a “no update” result when either source reports an update. Ambiguous or conflicting evidence remains visible as a review-needed result.

PaperSignal reports publication metadata only. It does not judge scientific quality or provide clinical advice. `NO_UPDATE_REPORTED` means only that the two checked records did not report an update; it is not proof that no notice exists elsewhere.

## Deployment references

- Source repository: https://github.com/burak33bb/papersignal
- Live app: https://burak33bb.github.io/papersignal/
- Deployed GenLayer Studionet contract: add the address after deploying in Studio.
- Finalized `review_publication` transaction: add its hash after the sample call.
- Example input: DOI `10.1002/jcb.28088`; PubMed `https://pubmed.ncbi.nlm.nih.gov/30485508/`

## Reviewer walkthrough

1. Open the live app; its shared contract history loads automatically.
2. Use **Load verified example** to fill the DOI and official PubMed page.
3. Connect a wallet on GenLayer Studionet.
4. Submit **Check with validators** and inspect the finalized transaction.
5. Open the saved record’s evidence panel and follow both official source links.


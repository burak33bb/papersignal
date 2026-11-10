# PaperSignal

**Live app:** https://burak33bb.github.io/papersignal/  
**Source:** https://github.com/burak33bb/papersignal

PaperSignal tracks publication-update metadata for a DOI. It asks GenLayer validators to inspect the official PubMed record and the DOI's Crossref work record, compare the two source views, and save a source-linked assessment in a shared Intelligent Contract registry.

## Why it exists

Correction, expression-of-concern, and retraction notices can be easy to miss when a paper is encountered outside its publisher page. PaperSignal makes the metadata check repeatable and leaves an auditable history that readers can inspect. It deliberately does not assess scientific quality, clinical value, or whether a paper should guide care.

## How consensus is used

`review_publication(doi, pubmed_url)` checks URL and DOI shape, derives the PMID from the official article URL, fetches the record from NCBI E-utilities and the Crossref work record independently through GenLayer's nondeterministic web renderer, asks validators to classify the exact DOI and update relationship, then applies comparative equivalence to reconcile the source interpretation. Using E-utilities avoids the PubMed HTML page's validator-facing 403 responses while preserving the official PubMed record as the cited source. Contract-side validation rejects mismatched identifiers, unsupported classifications, malformed evidence, and claims of no update when either source says otherwise. Successful reports are appended to onchain history.

The contract keeps source URLs, short excerpts, source classifications, the related DOI when available, a concise explanation, and the resulting status. Read methods expose the full history, latest result, and latest result for one DOI. The browser app submits real contract calls through `genlayer-js` and reloads records from that same contract.

## Status meaning

- `RETRACTION_REPORTED`, `CORRECTION_REPORTED`, `EXPRESSION_OF_CONCERN_REPORTED`: the fetched metadata explicitly reports the corresponding update. Inspect the cited sources and DOI relationship.
- `NO_UPDATE_REPORTED`: neither fetched record reports an update. This is not proof that no notice exists elsewhere.
- `SOURCE_DISAGREEMENT`: the source interpretations conflict.
- `NEEDS_REVIEW`: identifiers or source content are missing or ambiguous.

PaperSignal is a metadata aid, not a safety certification or a substitute for checking the publisher's notice.

## Run locally

Requirements: Node.js 20+ and npm.

```sh
npm install
npm run check
npm run build
npm run dev
```

Open the local Vite URL. Deploy `contracts/paper_signal_registry.py` in GenLayer Studio, then set that address as `CONTRACT_ADDRESS` in `src/config.js`. The hosted app is already configured with its shared registry and loads its history automatically. Use **Load verified example**, connect a Studionet wallet, submit **Check with validators**, and inspect the transaction and saved record.

The example is PubMed PMID 30485508, a retracted publication whose page links to the retraction notice and original DOI. Use it to demonstrate the distinction between a retraction notice and the original article's status.

## Sources

- PubMed help: https://pubmed.ncbi.nlm.nih.gov/help/
- Example PubMed record: https://pubmed.ncbi.nlm.nih.gov/30485508/
- Crossref REST API: https://www.crossref.org/documentation/retrieve-metadata/rest-api/
- Crossref update relations: https://www.crossref.org/documentation/register-maintain-records/maintaining-your-metadata/registering-updates/
- GenLayer: https://docs.genlayer.com/

## Limitations

Coverage depends on what PubMed and Crossref have deposited and what their live pages return to the GenLayer renderer. A missing Crossref relation is not proof of no notice. Source HTML may be unavailable or change; in those cases the contract should fail safely or return `NEEDS_REVIEW`, and users should inspect the linked source records. Contract history is append-only and each deployment has a fixed 200-record cap.

## License

MIT. See [LICENSE](LICENSE).

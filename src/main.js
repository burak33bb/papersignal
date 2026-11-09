import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, ExecutionResult } from "genlayer-js/types";
import { CONTRACT_ADDRESS, EXAMPLE_DOI, EXAMPLE_PUBMED, EXPLORER } from "./config.js";
import { connect, shortAddress } from "./wallet.js";
import "./styles.css";

const $ = (selector) => document.querySelector(selector);
const reader = createClient({ chain: studionet });
let writer = null;
let account = "";
const contractAddress = CONTRACT_ADDRESS;
let busy = false;
let toastTimer;

$("#connect").addEventListener("click", connectWallet);
$("#review-form").addEventListener("submit", reviewPublication);
$("#refresh").addEventListener("click", () => loadRecords("finalized", true));
$("#example").addEventListener("click", loadExample);
if (window.ethereum) {
  window.ethereum.on?.("accountsChanged", (accounts) => setAccount(accounts[0] || ""));
  window.ethereum.on?.("chainChanged", () => location.reload());
  window.ethereum.request({ method: "eth_accounts" }).then((accounts) => setAccount(accounts[0] || "")).catch(() => {});
}
setStatus("Loading shared registry", "Reading PaperSignal's shared Studionet history. A wallet is only needed to submit a new check.", "pending");
loadRecords();

async function connectWallet() {
  if (!window.ethereum) return setStatus("Wallet not found", "Install or open a browser wallet to submit a consensus check.", "error");
  try {
    setAccount(await connect(window.ethereum));
    setStatus("Wallet connected", `${shortAddress(account)} · GenLayer Studionet`, "success");
  } catch (error) {
    setStatus("Connection failed", readableError(error), "error");
  }
}

function setAccount(address) {
  account = address;
  writer = address ? createClient({ chain: studionet, account: address, provider: window.ethereum }) : null;
  $("#connect").textContent = shortAddress(address);
  $("#connect").classList.toggle("connected", Boolean(address));
}

function loadExample(event) {
  event.preventDefault();
  $("#doi").value = EXAMPLE_DOI;
  $("#pubmed-url").value = EXAMPLE_PUBMED;
  $("#doi").focus();
}

async function reviewPublication(event) {
  event.preventDefault();
  if (busy) return;
  if (!contractAddress) return setStatus("Connect a contract first", "Paste the deployed PaperSignal address in the registry panel below.", "error");
  if (!writer) return connectWallet();

  const doi = $("#doi").value.trim();
  const pubmedUrl = $("#pubmed-url").value.trim();
  if (!/^10\.\d{4,9}\/\S+$/i.test(doi)) return notify("Use a DOI such as 10.1002/jcb.28088.");
  if (!isPubMedArticleUrl(pubmedUrl)) return notify("Use the official PubMed page for the original article.");

  setBusy(true);
  setStatus("Confirm in your wallet", "The contract will compare official PubMed and Crossref records. Do not submit again while consensus runs.", "pending");
  try {
    const hash = await writer.writeContract({
      address: contractAddress,
      functionName: "review_publication",
      args: [doi, pubmedUrl],
      value: BigInt(0),
    });
    showTransaction(hash);
    setStatus("Consensus running", "Validators are reading both sources independently. Keep this page open or use the transaction link.", "pending");
    await waitForOutcome(hash);
  } catch (error) {
    setStatus("Transaction failed", readableError(error), "error");
    notify(readableError(error));
  } finally {
    setBusy(false);
  }
}

async function waitForOutcome(hash) {
  try {
    const accepted = await reader.waitForTransactionReceipt({
      hash, status: TransactionStatus.ACCEPTED, interval: 3000, retries: 180, fullTransaction: false,
    });
    assertSuccessful(accepted);
    setStatus("Consensus accepted", "Loading the saved record while finality completes.", "success");
    await loadRecords("accepted", false);
    const finalized = await reader.waitForTransactionReceipt({
      hash, status: TransactionStatus.FINALIZED, interval: 3000, retries: 240, fullTransaction: false,
    });
    assertSuccessful(finalized);
    setStatus("Check finalized", "The consensus result is stored in the PaperSignal registry.", "success");
    await loadRecords("finalized", false);
  } catch (error) {
    const message = readableError(error);
    if (message.includes("timed out waiting for transaction")) {
      setStatus("Still processing", "Do not submit the same DOI again yet. Check the transaction link for its current status.", "pending");
    } else {
      setStatus("Consensus did not save a record", message, "error");
      notify("Open the transaction details and check Result and Error Detail before retrying.");
    }
  }
}

async function loadRecords(stateStatus = "finalized", announce = true) {
  if (!contractAddress) return;
  try {
    const countValue = await reader.readContract({ address: contractAddress, functionName: "get_record_count", args: [], stateStatus });
    const count = Number(countValue);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("The contract returned an invalid record count.");
    $("#record-count").textContent = String(count);
    if (count === 0) {
      renderRecords([]);
      if (announce) setStatus("Registry ready", "The shared PaperSignal registry is connected. No checks have been recorded yet.", "success");
      return;
    }
    const start = Math.max(1, count - 19);
    const rows = [];
    for (let id = count; id >= start; id -= 1) {
      const value = await reader.readContract({ address: contractAddress, functionName: "get_record", args: [id], stateStatus });
      const record = parseValue(value);
      if (record && typeof record === "object") rows.push(record);
    }
    renderRecords(rows);
    if (announce) setStatus("Registry ready", `${count} shared check${count === 1 ? "" : "s"} loaded from Studionet.`, "success");
  } catch (error) {
    setStatus("Could not read contract", `${readableError(error)} · check the address and network.`, "error");
  }
}

function renderRecords(records) {
  const host = $("#records");
  host.replaceChildren();
  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = '<div class="empty-glyph">∿</div><b>No checks recorded yet</b><p>Accepted consensus checks will appear here with their DOI, status, and source links.</p>';
    host.append(empty);
    return;
  }
  for (const record of records) host.append(renderRecord(record));
}

function renderRecord(record) {
  const article = document.createElement("article");
  article.className = "record-card";
  const status = String(record.status || "NEEDS_REVIEW");
  const label = status.replaceAll("_", " ");
  const statusClass = status === "RETRACTION_REPORTED" ? "status-red" : status === "NO_UPDATE_REPORTED" ? "status-green" : status === "NEEDS_REVIEW" || status === "SOURCE_DISAGREEMENT" ? "status-amber" : "status-blue";
  article.innerHTML = `
    <div class="record-top"><span class="record-id">CHECK ${escapeHtml(String(record.id).padStart(3,"0"))}</span><span class="badge ${statusClass}">${escapeHtml(label)}</span></div>
    <h3>${escapeHtml(record.doi || "DOI unavailable")}</h3>
    <div class="record-meta"><span>PubMed: ${escapeHtml(record.pubmed_update_class || "UNKNOWN")}</span><span>Crossref: ${escapeHtml(record.crossref_update_type || "UNKNOWN")}</span></div>
    <p class="record-reason">${escapeHtml(record.reasoning || "No explanation recorded.")}</p>
    <details class="record-details"><summary>Evidence and sources</summary><ul>${(Array.isArray(record.evidence) ? record.evidence : []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><div class="source-links"><a href="${safeHref(record.pubmed_url)}" target="_blank" rel="noreferrer">PubMed ↗</a><a href="${safeHref(record.crossref_url)}" target="_blank" rel="noreferrer">Crossref ↗</a></div></details>
    <div class="record-footer"><span>ONCHAIN RECORD #${escapeHtml(String(record.id))}</span><span>${escapeHtml((record.related_doi || "No linked update DOI").slice(0, 90))}</span></div>`;
  return article;
}

function showTransaction(hash) {
  const link = $("#tx-link");
  link.href = `${EXPLORER}/tx/${hash}`;
  link.hidden = false;
  link.textContent = `View ${hash.slice(0, 10)}… ↗`;
}

function setStatus(title, message, kind) {
  $("#status-title").textContent = title;
  $("#status-message").textContent = message;
  $("#status-panel").dataset.kind = kind;
}

function setBusy(value) {
  busy = value;
  $("#review-submit").disabled = value;
  $("#review-submit").innerHTML = value ? 'Consensus in progress <span class="spinner"></span>' : 'Check with validators <span>→</span>';
}

function assertSuccessful(receipt) {
  if (receipt?.txExecutionResultName && receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`Contract execution: ${receipt.txExecutionResultName}`);
  }
}

function isPubMedArticleUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "pubmed.ncbi.nlm.nih.gov" && /^\/\d+\/?$/.test(url.pathname);
  } catch { return false; }
}

function parseValue(value) {
  if (value && typeof value === "object" && !ArrayBuffer.isView(value)) return value;
  const text = typeof value === "string" ? value : new TextDecoder().decode(value);
  return JSON.parse(text);
}

function safeHref(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && ["pubmed.ncbi.nlm.nih.gov", "api.crossref.org"].includes(url.hostname)) return url.href;
  } catch { /* show no link for invalid source values */ }
  return "#";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function readableError(error) {
  if (error?.code === 4001) return "Wallet request rejected.";
  return String(error?.shortMessage || error?.message || "Request failed.");
}

function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3600);
}

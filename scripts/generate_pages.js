#!/usr/bin/env node
"use strict";

// Renders a static profile page per company into companies/<id>.html from
// templates/company-page.html. Safe to run before data/stats.json exists
// (renders zeroed vote stats), lets this run standalone locally too.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "companies.json");
const STATS_PATH = path.join(ROOT, "data", "stats.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "company-page.html");
const OUT_DIR = path.join(ROOT, "companies");

function readJsonSafe(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function statusLabel(status) {
  return { blacklist: "Blacklist", whitelist: "Whitelist", pending: "Pending" }[status] || status;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Adds target="_blank" to every link, merging "noopener" into any rel
// GitHub already set (e.g. rel="nofollow") instead of overwriting it, so
// we don't lose that and don't end up with two conflicting rel attributes.
function openLinksInNewTab(html) {
  return html.replace(/<a\s+([^>]*?)>/g, (match, attrs) => {
    let out = /\btarget=/.test(attrs) ? attrs : `${attrs} target="_blank"`;
    out = /\brel="/.test(out)
      ? out.replace(/rel="([^"]*)"/, (m, rel) => (rel.includes("noopener") ? m : `rel="${rel} noopener"`))
      : `${out} rel="noopener"`;
    return `<a ${out}>`;
  });
}

// GitHub renders the comment's markdown server-side (see scrape_stats.js,
// "full+json" media type) and sanitizes the result, so bodyHtml is safe to
// drop into the page as-is. Fall back to escaped plain text for old
// stats.json entries scraped before bodyHtml existed.
function renderComments(comments) {
  if (!comments || comments.length === 0) {
    return '<p class="comment-empty">No comments yet.</p>';
  }
  return comments
    .map((c) => {
      const body = c.bodyHtml ? openLinksInNewTab(c.bodyHtml) : `<p>${escapeHtml(c.body)}</p>`;
      return `
      <div class="comment">
        <div class="comment-header">
          <a href="${escapeHtml(c.url || "#")}" target="_blank" rel="noopener">@${escapeHtml(c.author)}</a>
          <span class="comment-date">${escapeHtml((c.createdAt || "").slice(0, 10))}</span>
        </div>
        <div class="comment-body">${body}</div>
      </div>`;
    })
    .join("");
}

function main() {
  const companies = readJsonSafe(DATA_PATH, []);
  const stats = readJsonSafe(STATS_PATH, {});
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const c of companies) {
    const s = stats[c.id] || {};
    const totalVotes = s.totalVotes || 0;
    const pctPositiveRaw = s.pctPositive ?? 0;
    const pctNegativeRaw = s.pctNegative ?? 0;

    const html = template
      .replaceAll("{{name}}", escapeHtml(c.name))
      .replaceAll("{{status}}", c.status)
      .replaceAll("{{statusLabel}}", statusLabel(c.status))
      .replaceAll("{{category}}", escapeHtml(c.category.join(", ") || "none"))
      .replaceAll("{{linkedinURL}}", c.linkedinURL || "")
      .replaceAll("{{issueUrl}}", c.issue_url || "")
      .replaceAll("{{dateAdded}}", c.dateAdded)
      .replaceAll("{{submittedBy}}", escapeHtml(c.submittedBy))
      .replaceAll("{{thumbsUp}}", s.thumbsUp ?? 0)
      .replaceAll("{{thumbsDown}}", s.thumbsDown ?? 0)
      .replaceAll("{{totalVotes}}", totalVotes)
      .replaceAll("{{pctPositive}}", s.pctPositive == null ? "N/A" : `${s.pctPositive}%`)
      .replaceAll("{{pctNegative}}", s.pctNegative == null ? "N/A" : `${s.pctNegative}%`)
      .replaceAll("{{pctPositiveRaw}}", pctPositiveRaw)
      .replaceAll("{{pctNegativeRaw}}", pctNegativeRaw)
      .replaceAll("{{commentCount}}", s.commentCount ?? 0)
      .replaceAll("{{commentsHtml}}", renderComments(s.comments));

    fs.writeFileSync(path.join(OUT_DIR, `${c.id}.html`), html);
  }

  console.log(`Generated ${companies.length} company page(s) in companies/`);
}

main();

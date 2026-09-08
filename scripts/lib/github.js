"use strict";

const API = "https://api.github.com";

function ghClient(token) {
  return async function gh(pathname, options = {}) {
    const res = await fetch(`${API}${pathname}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {}),
      },
    });
    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      throw new Error(`GitHub API ${options.method || "GET"} ${pathname} failed: ${res.status} ${body}`);
    }
    return res.status === 204 || res.status === 404 ? null : res.json();
  };
}

// Follows GitHub's page-based pagination (per_page=100) until a short page
// comes back. Used for endpoints that can return more than one page, like
// issue comments.
async function paginate(gh, pathname) {
  const out = [];
  let page = 1;
  while (true) {
    const sep = pathname.includes("?") ? "&" : "?";
    const batch = await gh(`${pathname}${sep}per_page=100&page=${page}`);
    if (!batch || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return out;
}

module.exports = { ghClient, paginate };

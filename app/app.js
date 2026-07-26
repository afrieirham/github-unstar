const STORAGE_KEY = "srm-staged";

const state = {
  repos: [],
  staged: [],
  loading: false,
  committing: false,
  reviewMode: false,
  drawerOpen: false,
};

const $ = (id) => document.getElementById(id);

const el = {
  authStatus: $("authStatus"),
  btnStaged: $("btnStaged"),
  btnRefresh: $("btnRefresh"),
  search: $("search"),
  hideArchived: $("hideArchived"),
  hideForks: $("hideForks"),
  sortBy: $("sortBy"),
  selectAll: $("selectAll"),
  counts: $("counts"),
  error: $("error"),
  toast: $("toast"),
  loading: $("loading"),
  empty: $("empty"),
  list: $("list"),
  drawerBackdrop: $("drawerBackdrop"),
  stagedDrawer: $("stagedDrawer"),
  btnCloseDrawer: $("btnCloseDrawer"),
  stagedEmpty: $("stagedEmpty"),
  stagedList: $("stagedList"),
  stagedReview: $("stagedReview"),
  reviewText: $("reviewText"),
  commitProgress: $("commitProgress"),
  progressFill: $("progressFill"),
  progressText: $("progressText"),
  commitError: $("commitError"),
  btnUnstageAll: $("btnUnstageAll"),
  btnReview: $("btnReview"),
  btnCommit: $("btnCommit"),
};

function showError(msg) {
  if (!msg) {
    el.error.classList.add("hidden");
    el.error.textContent = "";
    return;
  }
  el.error.textContent = msg;
  el.error.classList.remove("hidden");
}

function toast(msg, type = "ok") {
  el.toast.textContent = msg;
  el.toast.className = `toast ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.add("hidden"), 3500);
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function loadStaged() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.staged = raw ? JSON.parse(raw) : [];
  } catch {
    state.staged = [];
  }
}

function saveStaged() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.staged));
  } catch {
    // ignore storage errors
  }
}

function isStaged(name) {
  return state.staged.includes(name);
}

function stage(name) {
  if (!state.staged.includes(name)) {
    state.staged.push(name);
    saveStaged();
  }
}

function unstage(name) {
  state.staged = state.staged.filter((n) => n !== name);
  saveStaged();
}

function clearStaged() {
  state.staged = [];
  saveStaged();
}

function getStagedRepos() {
  return state.staged
    .map((name) => state.repos.find((r) => r.full_name === name))
    .filter(Boolean);
}

function getFiltered() {
  const q = el.search.value.trim().toLowerCase();
  const hideArchived = el.hideArchived.checked;
  const hideForks = el.hideForks.checked;
  const sortBy = el.sortBy.value;

  let list = state.repos.filter((r) => {
    if (hideArchived && r.archived) return false;
    if (hideForks && r.fork) return false;
    if (!q) return true;
    const hay = [r.full_name, r.description, r.language, r.owner]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  const cmp = {
    starred_at_desc: (a, b) =>
      (b.starred_at || "").localeCompare(a.starred_at || ""),
    starred_at_asc: (a, b) =>
      (a.starred_at || "").localeCompare(b.starred_at || ""),
    name_asc: (a, b) => a.full_name.localeCompare(b.full_name),
    stars_desc: (a, b) =>
      (b.stargazers_count || 0) - (a.stargazers_count || 0),
    pushed_at_desc: (a, b) =>
      (b.pushed_at || "").localeCompare(a.pushed_at || ""),
  };

  list.sort(cmp[sortBy] || cmp.starred_at_desc);
  return list;
}

function updateStagedButton() {
  el.btnStaged.textContent = `Staged (${state.staged.length})`;
  el.btnStaged.disabled = state.staged.length === 0 && !state.drawerOpen;
}

function updateCounts(visible) {
  const stagedVisible = visible.filter((r) => isStaged(r.full_name)).length;
  el.counts.textContent = `${state.staged.length} staged · ${visible.length} shown · ${state.repos.length} total`;

  const allVisibleStaged =
    visible.length > 0 && stagedVisible === visible.length;
  el.selectAll.checked = allVisibleStaged;
  el.selectAll.indeterminate =
    stagedVisible > 0 && stagedVisible < visible.length;
}

function render() {
  const visible = getFiltered();
  el.list.innerHTML = "";
  updateStagedButton();

  if (state.loading) {
    el.loading.classList.remove("hidden");
    el.empty.classList.add("hidden");
    updateCounts(visible);
    return;
  }
  el.loading.classList.add("hidden");

  if (visible.length === 0) {
    el.empty.classList.remove("hidden");
    updateCounts(visible);
    return;
  }
  el.empty.classList.add("hidden");

  const frag = document.createDocumentFragment();
  for (const repo of visible) {
    const staged = isStaged(repo.full_name);
    const li = document.createElement("li");
    li.className = `repo-item${staged ? " staged" : ""}`;

    const tags = [];
    if (repo.language)
      tags.push(`<span class="tag">${escapeHtml(repo.language)}</span>`);
    if (repo.archived) tags.push(`<span class="tag warn">archived</span>`);
    if (repo.fork) tags.push(`<span class="tag">fork</span>`);
    if (repo.private) tags.push(`<span class="tag">private</span>`);

    li.innerHTML = `
      <input type="checkbox" data-repo="${escapeAttr(repo.full_name)}" ${staged ? "checked" : ""} />
      <div class="repo-main">
        <h3>
          <a href="${escapeAttr(repo.html_url)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(repo.full_name)}
          </a>
        </h3>
        ${repo.description
          ? `<p class="repo-desc">${escapeHtml(repo.description)}</p>`
          : ""
        }
        <div class="meta">
          <span>★ ${repo.stargazers_count.toLocaleString()}</span>
          ${tags.join("")}
        </div>
      </div>
      <div class="repo-side">
        <div>Starred ${formatDate(repo.starred_at)}</div>
        <div>Pushed ${formatDate(repo.pushed_at)}</div>
      </div>
    `;
    frag.appendChild(li);
  }
  el.list.appendChild(frag);
  updateCounts(visible);
}

function renderStagedList() {
  const stagedRepos = getStagedRepos();
  const count = stagedRepos.length;

  updateStagedButton();
  el.btnUnstageAll.disabled = state.committing || count === 0;
  el.btnReview.disabled = state.committing || count === 0;
  el.btnCloseDrawer.disabled = state.committing;

  if (count === 0) {
    el.stagedEmpty.classList.remove("hidden");
    el.stagedList.classList.add("hidden");
  } else {
    el.stagedEmpty.classList.add("hidden");
    el.stagedList.classList.remove("hidden");
  }

  if (state.reviewMode && count > 0) {
    el.stagedReview.classList.remove("hidden");
    el.btnReview.classList.add("hidden");
    el.btnCommit.classList.remove("hidden");
    el.btnCommit.textContent = `Commit unstar (${count})`;
    el.reviewText.textContent = `You are about to unstar ${count} repositor${count === 1 ? "y" : "ies"}. This cannot be undone from this app.`;
  } else {
    el.stagedReview.classList.add("hidden");
    el.btnReview.classList.remove("hidden");
    el.btnCommit.classList.add("hidden");
  }

  el.stagedList.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const repo of stagedRepos) {
    const li = document.createElement("li");
    li.className = "staged-item";

    const tags = [];
    if (repo.language)
      tags.push(`<span class="tag">${escapeHtml(repo.language)}</span>`);
    if (repo.archived) tags.push(`<span class="tag warn">archived</span>`);
    if (repo.fork) tags.push(`<span class="tag">fork</span>`);

    li.innerHTML = `
      <div class="staged-main">
        <a href="${escapeAttr(repo.html_url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(repo.full_name)}
        </a>
        <div class="meta">${tags.join("")}</div>
      </div>
      <button class="btn btn-small btn-unstage" data-repo="${escapeAttr(repo.full_name)}" ${state.committing ? "disabled" : ""}>
        Unstage
      </button>
    `;
    frag.appendChild(li);
  }
  el.stagedList.appendChild(frag);
}

function openDrawer() {
  if (state.committing) return;
  state.drawerOpen = true;
  el.drawerBackdrop.classList.remove("hidden");
  el.stagedDrawer.classList.add("open");
  el.stagedDrawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderStagedList();
}

function closeDrawer() {
  if (state.committing) return;
  state.drawerOpen = false;
  state.reviewMode = false;
  el.drawerBackdrop.classList.add("hidden");
  el.stagedDrawer.classList.remove("open");
  el.stagedDrawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  el.commitProgress.classList.add("hidden");
  el.commitError.classList.add("hidden");
  renderStagedList();
}

function updateProgress(done, total) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  el.progressFill.style.width = `${pct}%`;
  el.progressText.textContent = `Unstarring ${done} of ${total}…`;
}

const COMMIT_CHUNK_SIZE = 10;

async function commitUnstar() {
  const stagedRepos = getStagedRepos();
  if (stagedRepos.length === 0 || state.committing) return;

  state.committing = true;
  el.commitProgress.classList.remove("hidden");
  el.commitError.classList.add("hidden");
  updateProgress(0, stagedRepos.length);
  renderStagedList();

  const allResults = [];
  const failed = [];
  const total = stagedRepos.length;

  for (let i = 0; i < total; i += COMMIT_CHUNK_SIZE) {
    const chunk = stagedRepos.slice(i, i + COMMIT_CHUNK_SIZE);
    const repoNames = chunk.map((r) => r.full_name);

    try {
      const res = await fetch("/api/unstar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repos: repoNames }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unstar failed");

      for (const r of data.results || []) {
        allResults.push(r);
        if (!r.ok) failed.push(r.repo);
      }
    } catch (err) {
      for (const name of repoNames) {
        allResults.push({ repo: name, ok: false, error: err.message });
        failed.push(name);
      }
    }

    updateProgress(Math.min(i + COMMIT_CHUNK_SIZE, total), total);
  }

  const succeeded = allResults.filter((r) => r.ok).length;
  const failedCount = allResults.length - succeeded;

  if (failedCount === 0) {
    state.staged = [];
    saveStaged();
    toast(`Unstarred ${succeeded} repos`);
    closeDrawer();
    await loadStarred();
  } else {
    state.staged = [...new Set(failed)];
    saveStaged();
    const failedList = allResults
      .filter((r) => !r.ok)
      .map((r) => r.repo)
      .slice(0, 5);
    const more = failedCount > 5 ? ` and ${failedCount - 5} more` : "";
    el.commitError.textContent = `${failedCount} failed (${failedList.join(", ")}${more}). They remain staged.`;
    el.commitError.classList.remove("hidden");
    toast(`${failedCount} unstar failed. Check the drawer.`, "err");
  }

  state.committing = false;
  el.commitProgress.classList.add("hidden");
  renderStagedList();
  render();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

async function checkAuth() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    if (data.ok) {
      el.authStatus.textContent = `@${data.user}`;
      el.authStatus.className = "badge ok";
      return true;
    }
    el.authStatus.textContent = "Not authenticated";
    el.authStatus.className = "badge err";
    showError(data.error || "gh not authenticated");
    return false;
  } catch {
    el.authStatus.textContent = "Server error";
    el.authStatus.className = "badge err";
    showError("Cannot reach local server");
    return false;
  }
}

async function loadStarred() {
  state.loading = true;
  showError("");
  render();
  try {
    const res = await fetch("/api/starred");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load");

    state.repos = data.repos || [];

    // Drop staged repos that are no longer starred.
    const existing = new Set(state.repos.map((r) => r.full_name));
    const before = state.staged.length;
    state.staged = state.staged.filter((name) => existing.has(name));
    if (state.staged.length !== before) {
      saveStaged();
    }

    toast(`Loaded ${state.repos.length} starred repos`);
  } catch (err) {
    showError(err.message);
    state.repos = [];
  } finally {
    state.loading = false;
    render();
  }
}

// events
el.list.addEventListener("change", (e) => {
  const t = e.target;
  if (t.matches('input[type="checkbox"][data-repo]')) {
    const name = t.getAttribute("data-repo");
    if (t.checked) stage(name);
    else unstage(name);
    render();
    if (state.drawerOpen) renderStagedList();
  }
});

el.selectAll.addEventListener("change", () => {
  const visible = getFiltered();
  if (el.selectAll.checked) {
    for (const r of visible) stage(r.full_name);
  } else {
    for (const r of visible) unstage(r.full_name);
  }
  render();
  if (state.drawerOpen) renderStagedList();
});

el.search.addEventListener("input", () => render());
el.hideArchived.addEventListener("change", () => render());
el.hideForks.addEventListener("change", () => render());
el.sortBy.addEventListener("change", () => render());
el.btnRefresh.addEventListener("click", () => loadStarred());

el.btnStaged.addEventListener("click", () => openDrawer());
el.btnCloseDrawer.addEventListener("click", () => closeDrawer());
el.drawerBackdrop.addEventListener("click", () => closeDrawer());

el.btnUnstageAll.addEventListener("click", () => {
  if (state.committing) return;
  if (state.staged.length > 0 && !confirm("Unstage all repos?")) return;
  clearStaged();
  renderStagedList();
  render();
});

el.stagedList.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-unstage");
  if (!btn || state.committing) return;
  const name = btn.getAttribute("data-repo");
  unstage(name);
  renderStagedList();
  render();
});

el.btnReview.addEventListener("click", () => {
  if (state.committing || state.staged.length === 0) return;
  state.reviewMode = true;
  renderStagedList();
});

el.btnCommit.addEventListener("click", () => commitUnstar());

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.drawerOpen && !state.committing) {
    closeDrawer();
  }
});

// init
loadStaged();
renderStagedList();

(async () => {
  const authed = await checkAuth();
  if (authed) await loadStarred();
})();

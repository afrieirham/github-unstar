const state = {
  repos: [],
  selected: new Set(),
  loading: false,
};

const $ = (id) => document.getElementById(id);

const el = {
  authStatus: $("authStatus"),
  btnRefresh: $("btnRefresh"),
  search: $("search"),
  hideArchived: $("hideArchived"),
  hideForks: $("hideForks"),
  sortBy: $("sortBy"),
  selectAll: $("selectAll"),
  counts: $("counts"),
  btnUnstar: $("btnUnstar"),
  error: $("error"),
  toast: $("toast"),
  loading: $("loading"),
  empty: $("empty"),
  list: $("list"),
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

function getFiltered() {
  const q = el.search.value.trim().toLowerCase();
  const hideArchived = el.hideArchived.checked;
  const hideForks = el.hideForks.checked;
  const sortBy = el.sortBy.value;

  let list = state.repos.filter((r) => {
    if (hideArchived && r.archived) return false;
    if (hideForks && r.fork) return false;
    if (!q) return true;
    const hay = [
      r.full_name,
      r.description,
      r.language,
      r.owner,
    ]
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

function updateCounts(visible) {
  const selectedVisible = visible.filter((r) =>
    state.selected.has(r.full_name)
  ).length;
  el.counts.textContent = `${state.selected.size} selected · ${visible.length} shown · ${state.repos.length} total`;
  el.btnUnstar.disabled = state.selected.size === 0 || state.loading;
  el.btnUnstar.textContent =
    state.selected.size > 0
      ? `Unstar selected (${state.selected.size})`
      : "Unstar selected";

  const allVisibleSelected =
    visible.length > 0 && selectedVisible === visible.length;
  el.selectAll.checked = allVisibleSelected;
  el.selectAll.indeterminate =
    selectedVisible > 0 && selectedVisible < visible.length;
}

function render() {
  const visible = getFiltered();
  el.list.innerHTML = "";

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
    const li = document.createElement("li");
    const selected = state.selected.has(repo.full_name);
    li.className = `repo-item${selected ? " selected" : ""}`;

    const tags = [];
    if (repo.language) tags.push(`<span class="tag">${escapeHtml(repo.language)}</span>`);
    if (repo.archived) tags.push(`<span class="tag warn">archived</span>`);
    if (repo.fork) tags.push(`<span class="tag">fork</span>`);
    if (repo.private) tags.push(`<span class="tag">private</span>`);

    li.innerHTML = `
      <input type="checkbox" data-repo="${escapeAttr(repo.full_name)}" ${selected ? "checked" : ""} />
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
    // drop selections that no longer exist
    for (const name of [...state.selected]) {
      if (!state.repos.some((r) => r.full_name === name)) {
        state.selected.delete(name);
      }
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

async function unstarSelected() {
  const repos = [...state.selected];
  if (repos.length === 0) return;
  const ok = confirm(
    `Unstar ${repos.length} repositor${repos.length === 1 ? "y" : "ies"}?\n\nThis cannot be undone from this app (you can re-star later on GitHub).`
  );
  if (!ok) return;

  el.btnUnstar.disabled = true;
  state.loading = true;
  try {
    const res = await fetch("/api/unstar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repos }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unstar failed");

    const failed = (data.results || []).filter((r) => !r.ok);
    if (failed.length) {
      toast(
        `Unstarred ${data.succeeded}, failed ${data.failed}`,
        "err"
      );
      console.warn(failed);
    } else {
      toast(`Unstarred ${data.succeeded} repos`);
    }

    // remove successful ones from local state
    const succeeded = new Set(
      (data.results || []).filter((r) => r.ok).map((r) => r.repo)
    );
    state.repos = state.repos.filter((r) => !succeeded.has(r.full_name));
    for (const name of succeeded) state.selected.delete(name);
  } catch (err) {
    showError(err.message);
    toast(err.message, "err");
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
    if (t.checked) state.selected.add(name);
    else state.selected.delete(name);
    render();
  }
});

el.selectAll.addEventListener("change", () => {
  const visible = getFiltered();
  if (el.selectAll.checked) {
    for (const r of visible) state.selected.add(r.full_name);
  } else {
    for (const r of visible) state.selected.delete(r.full_name);
  }
  render();
});

el.search.addEventListener("input", () => render());
el.hideArchived.addEventListener("change", () => render());
el.hideForks.addEventListener("change", () => render());
el.sortBy.addEventListener("change", () => render());
el.btnRefresh.addEventListener("click", () => loadStarred());
el.btnUnstar.addEventListener("click", () => unstarSelected());

// init
(async () => {
  const authed = await checkAuth();
  if (authed) await loadStarred();
})();
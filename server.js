const express = require("express");
const { execFile } = require("child_process");
const path = require("path");
const util = require("util");

const execFileAsync = util.promisify(execFile);
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/** Run a gh CLI command and return stdout as string */
async function runGh(args, { timeout = 120000 } = {}) {
  try {
    const { stdout, stderr } = await execFileAsync("gh", args, {
      timeout,
      maxBuffer: 20 * 1024 * 1024,
      env: process.env,
    });
    if (stderr && !stdout) {
      console.warn("gh stderr:", stderr);
    }
    return stdout;
  } catch (err) {
    const msg =
      err.stderr?.toString()?.trim() ||
      err.stdout?.toString()?.trim() ||
      err.message;
    const error = new Error(msg);
    error.code = err.code;
    throw error;
  }
}

/** GET /api/status — check gh auth */
app.get("/api/status", async (_req, res) => {
  try {
    const out = await runGh(["auth", "status"]);
    const user = await runGh(["api", "user", "--jq", ".login"]);
    res.json({
      ok: true,
      user: user.trim(),
      detail: out.trim(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error:
        err.message ||
        "gh CLI not found or not authenticated. Run: gh auth login",
    });
  }
});

/** GET /api/starred — list all starred repos (paginated via gh) */
app.get("/api/starred", async (_req, res) => {
  try {
    // --paginate follows Link headers; -q keeps only fields we need
    const raw = await runGh(
      [
        "api",
        "--paginate",
        "user/starred",
        "-H",
        "Accept: application/vnd.github.star+json",
        "--jq",
        ".[] | {starred_at, repo: {full_name: .repo.full_name, name: .repo.name, owner: .repo.owner.login, description: .repo.description, html_url: .repo.html_url, language: .repo.language, stargazers_count: .repo.stargazers_count, pushed_at: .repo.pushed_at, private: .repo.private, archived: .repo.archived, fork: .repo.fork}}",
      ],
      { timeout: 300000 }
    );

    // gh --paginate with --jq may emit one JSON object per line
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const repos = lines.map((line) => {
      const item = JSON.parse(line);
      return {
        full_name: item.repo.full_name,
        name: item.repo.name,
        owner: item.repo.owner,
        description: item.repo.description || "",
        html_url: item.repo.html_url,
        language: item.repo.language || "",
        stargazers_count: item.repo.stargazers_count || 0,
        pushed_at: item.repo.pushed_at,
        starred_at: item.starred_at,
        private: !!item.repo.private,
        archived: !!item.repo.archived,
        fork: !!item.repo.fork,
      };
    });

    res.json({ count: repos.length, repos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to fetch starred" });
  }
});

/** POST /api/unstar — bulk unstar
 * body: { repos: ["owner/name", ...] }
 */
app.post("/api/unstar", async (req, res) => {
  const repos = req.body?.repos;
  if (!Array.isArray(repos) || repos.length === 0) {
    return res.status(400).json({ error: "repos must be a non-empty array" });
  }

  const results = [];
  for (const fullName of repos) {
    if (typeof fullName !== "string" || !fullName.includes("/")) {
      results.push({ repo: fullName, ok: false, error: "invalid name" });
      continue;
    }
    const [owner, repo] = fullName.split("/");
    try {
      await runGh([
        "api",
        "--method",
        "DELETE",
        `/user/starred/${owner}/${repo}`,
      ]);
      results.push({ repo: fullName, ok: true });
    } catch (err) {
      results.push({
        repo: fullName,
        ok: false,
        error: err.message || "failed",
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  res.json({ succeeded, failed, results });
});

/** POST /api/star — bulk star (optional helper)
 * body: { repos: ["owner/name", ...] }
 */
app.post("/api/star", async (req, res) => {
  const repos = req.body?.repos;
  if (!Array.isArray(repos) || repos.length === 0) {
    return res.status(400).json({ error: "repos must be a non-empty array" });
  }

  const results = [];
  for (const fullName of repos) {
    if (typeof fullName !== "string" || !fullName.includes("/")) {
      results.push({ repo: fullName, ok: false, error: "invalid name" });
      continue;
    }
    const [owner, repo] = fullName.split("/");
    try {
      await runGh([
        "api",
        "--method",
        "PUT",
        `/user/starred/${owner}/${repo}`,
        "-H",
        "Content-Length: 0",
      ]);
      results.push({ repo: fullName, ok: true });
    } catch (err) {
      results.push({
        repo: fullName,
        ok: false,
        error: err.message || "failed",
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  res.json({ succeeded, failed, results });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Starred Repo Manager → http://127.0.0.1:${PORT}`);
  console.log("Make sure you are logged in: gh auth status");
});
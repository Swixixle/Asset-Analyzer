// STATUS: PR comment posting not yet implemented.
// The action currently runs analysis and writes output artifacts.
// It does not post a PR comment. This is a known gap — see RISKS_AND_GAPS.md R5.
//
// PARTIAL: GitHub Action — posts to a configurable Debrief API (`api.debrief.app` in this template).
// Planned: PR comments, status checks, org-specific base URLs via inputs.
// Status: Requires secrets, correct API host, and API compatibility review before production use.

import * as core from "@actions/core";
import * as github from "@actions/github";

async function run(): Promise<void> {
  const apiKey = core.getInput("api-key");
  const mode = core.getInput("mode") || "learner";
  const repoUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}`;

  core.info(`Running Debrief on ${repoUrl} in ${mode} mode...`);

  const response = await fetch("https://api.debrief.app/v1/analyze", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ repoUrl, mode }),
  });

  if (!response.ok) {
    core.setFailed(`Debrief API error: ${response.status} ${response.statusText}`);
    return;
  }

  const body = (await response.json()) as { jobId?: string; projectId?: string | number };
  core.info(`Job queued: ${String(body.jobId ?? "")}`);

  const projectId = body.projectId != null ? String(body.projectId) : "";
  const reportUrl = projectId ? `https://app.debrief.app/projects/${projectId}` : "";
  core.setOutput("report-url", reportUrl);
  core.setOutput("dci-score", "");
  core.setOutput("critical-issues", "");
  core.info("Debrief analysis queued successfully.");
}

run().catch(core.setFailed);

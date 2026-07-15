/**
 * Example: fetch an overview of a GitHub repository (description, stars,
 * forks, primary language, license, issue counts, latest release) using
 * zodql and the GitHub GraphQL API.
 *
 * Run it with:
 *
 *   GITHUB_TOKEN=<your token> pnpm example:github-repo-overview <owner>/<repo>
 *
 * For example:
 *
 *   GITHUB_TOKEN=ghp_xxx pnpm example:github-repo-overview facebook/react
 *
 * Pass `--print-query` to print the compiled GraphQL document and exit without
 * contacting the API (no token required) — handy for seeing what zodql emits.
 *
 * See ./README.md for details, including how to create a token.
 */
import { createGitHubClient } from "./client.js";
import { repositoryOverviewQuery } from "./query.js";
import type { RepositoryOverview } from "./schema.js";

function parseRepoArg(arg: string | undefined): { owner: string; name: string } {
  const match = arg?.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) {
    throw new Error(`Expected a repository as "<owner>/<repo>", got: ${arg ?? "(nothing)"}`);
  }
  return { owner: match[1]!, name: match[2]! };
}

function printUsageAndExit(): never {
  console.error(
    [
      "Usage: pnpm example:github-repo-overview <owner>/<repo>",
      "",
      "  <owner>/<repo>   Repository to inspect, e.g. facebook/react",
      "",
      "Environment:",
      "  GITHUB_TOKEN     GitHub token with read access to the repository (required)",
      "",
      "Flags:",
      "  --print-query    Print the compiled GraphQL query and exit (no token needed)",
    ].join("\n")
  );
  process.exit(1);
}

function formatOverview(repo: RepositoryOverview): string {
  const lines: string[] = [
    repo.nameWithOwner + (repo.isPrivate ? " (private)" : ""),
    repo.url,
    "",
    repo.description ?? "(no description)",
    "",
    `Language: ${repo.primaryLanguage?.name ?? "(none detected)"}`,
    `License:  ${repo.licenseInfo ? `${repo.licenseInfo.name}${repo.licenseInfo.spdxId ? ` (${repo.licenseInfo.spdxId})` : ""}` : "(none)"}`,
    `Stars:    ${repo.stargazerCount}`,
    `Forks:    ${repo.forkCount}`,
    `Issues:   ${repo.openIssues.totalCount} open / ${repo.closedIssues.totalCount} closed`,
  ];

  if (repo.latestRelease) {
    lines.push(
      `Latest release: ${repo.latestRelease.tagName}${repo.latestRelease.name ? ` — ${repo.latestRelease.name}` : ""}`
    );
    lines.push(`  ${repo.latestRelease.url}`);
  } else {
    lines.push("Latest release: (none published)");
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const printQuery = args.includes("--print-query");
  const positional = args.filter((arg) => !arg.startsWith("--"));

  if (printQuery) {
    console.log(repositoryOverviewQuery.queryString);
    return;
  }

  const { owner, name } = positional.length > 0 ? parseRepoArg(positional[0]) : printUsageAndExit();

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("Missing GITHUB_TOKEN environment variable.\n");
    printUsageAndExit();
  }

  const client = createGitHubClient(token);

  console.error(`Fetching overview for ${owner}/${name}...`);

  const { response, parseResponse } = await client.request(repositoryOverviewQuery, { owner, name });

  // GraphQL errors are returned in a 200 response body, so zodql never throws
  // them for us — we check them ourselves before validating `data`.
  if (response.errors && response.errors.length > 0) {
    console.error("GitHub returned GraphQL errors:");
    for (const error of response.errors) {
      console.error(`  - ${error.message}`);
    }
    process.exit(1);
  }

  const { data } = await parseResponse();

  if (!data.repository) {
    throw new Error(`Repository ${owner}/${name} was not found (or the token can't access it).`);
  }

  console.log(formatOverview(data.repository));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

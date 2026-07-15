/**
 * CLI plumbing shared by the three "without zodql" implementations, so each
 * `main.ts` can stay focused on the part that differs — how the GraphQL library
 * defines, types, and executes the query. The argument parsing, output
 * formatting, and endpoint/auth constants are identical across all of them (and
 * mirror the zodql version's ../main.ts).
 */
export const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

/** GitHub requires a User-Agent header on every request. */
export const USER_AGENT = "zodql-example-github-repo-overview";

/**
 * The overview shape each approach ends up with. The codegen, gql.tada, and Zeus
 * result types are all structurally equal to this — the whole point of the
 * comparison — so each `main.ts` hands its typed result straight to
 * `formatOverview` without a cast.
 *
 * Nullable fields are written as optional (`?:`) because the libraries model
 * "nullable" differently: codegen and gql.tada emit `T | null`, while Zeus emits
 * `T | null | undefined`. Making them optional accepts all three; the formatter
 * below treats missing/null identically anyway.
 */
export interface RepositoryOverview {
  name: string;
  nameWithOwner: string;
  description?: string | null;
  url: string;
  isPrivate: boolean;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage?: { name: string } | null;
  licenseInfo?: { name: string; spdxId?: string | null } | null;
  openIssues: { totalCount: number };
  closedIssues: { totalCount: number };
  latestRelease?: { name?: string | null; tagName: string; url: string; publishedAt?: string | null } | null;
}

export function parseRepoArg(arg: string | undefined): { owner: string; name: string } {
  const match = arg?.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) {
    throw new Error(`Expected a repository as "<owner>/<repo>", got: ${arg ?? "(nothing)"}`);
  }
  return { owner: match[1]!, name: match[2]! };
}

export function printUsageAndExit(script: string): never {
  console.error(
    [
      `Usage: pnpm ${script} <owner>/<repo>`,
      "",
      "  <owner>/<repo>   Repository to inspect, e.g. facebook/react",
      "",
      "Environment:",
      "  GITHUB_TOKEN     GitHub token with read access to the repository (required)",
      "",
      "Flags:",
      "  --print-query    Print the GraphQL query and exit (no token needed)",
    ].join("\n")
  );
  process.exit(1);
}

export function formatOverview(repo: RepositoryOverview): string {
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

/**
 * Parse `process.argv` the same way the zodql example does: a `--print-query`
 * short-circuit that needs no token, otherwise a required `<owner>/<repo>`.
 */
export function parseCliArgs(
  script: string
): { printQuery: true } | { printQuery: false; owner: string; name: string } {
  const args = process.argv.slice(2);
  if (args.includes("--print-query")) {
    return { printQuery: true };
  }
  const positional = args.filter((arg) => !arg.startsWith("--"));
  if (positional.length === 0) {
    printUsageAndExit(script);
  }
  return { printQuery: false, ...parseRepoArg(positional[0]) };
}

export function requireToken(script: string): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("Missing GITHUB_TOKEN environment variable.\n");
    printUsageAndExit(script);
  }
  return token;
}

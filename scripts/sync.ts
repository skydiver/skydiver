#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write

/**
 * Generates README.md from README.base.md + repos.yaml + live GitHub data.
 *
 * The base template uses placeholders:
 *   {{REPOS}}         → tables for normal categories
 *   {{HALL_OF_FAME}}  → tables for collapsed categories
 *
 * Usage: deno run --allow-run --allow-read --allow-write scripts/sync.ts
 */

import { parse } from "https://deno.land/std@0.224.0/yaml/mod.ts";

interface Category {
  name: string;
  emoji: string;
  repos: string[];
  collapsed?: boolean;
  hidden?: boolean;
  showStars?: boolean;
}

const EXCLUDED_CATEGORIES = ["Uncategorized"];

interface Config {
  owner: string;
  categories: Category[];
}

interface RepoMeta {
  description: string;
  language: string;
  stars: number;
}

const ROOT = new URL("..", import.meta.url).pathname;
const YAML_PATH = `${ROOT}templates/repos.yaml`;
const BASE_PATH = `${ROOT}templates/README.base.md`;
const OUTPUT_PATH = `${ROOT}README.md`;

async function fetchRepoMetadata(): Promise<Map<string, RepoMeta>> {
  const cmd = new Deno.Command("gh", {
    args: ["repo", "list", "--limit", "500", "--json", "name,description,primaryLanguage,isPrivate,isFork,stargazerCount"],
    stdout: "piped",
  });

  const { stdout } = await cmd.output();
  const result = JSON.parse(new TextDecoder().decode(stdout)) as Array<Record<string, unknown>>;
  const repos = result.filter((r) => !r.isPrivate && !r.isFork);

  const map = new Map<string, RepoMeta>();
  for (const repo of repos) {
    map.set(repo.name as string, {
      description: (repo.description as string) ?? "",
      language:
        (repo.primaryLanguage as { name: string } | null)?.name ?? "",
      stars: (repo.stargazerCount as number) ?? 0,
    });
  }
  return map;
}

function generateTable(
  category: Category,
  owner: string,
  metadata: Map<string, RepoMeta>,
  headingLevel: string
): string {
  const stars = category.showStars;

  const header = stars
    ? "| | Project | Description | Language | ⭐ |"
    : "| | Project | Description | Language |";

  const separator = stars
    ? "|---|---------|-------------|----------|---:|"
    : "|---|---------|-------------|----------|";

  const lines: string[] = [`${headingLevel} ${category.name}`, "", header, separator];

  for (const repo of category.repos) {
    const meta = metadata.get(repo);
    const description = meta?.description ?? "";
    const language = meta?.language ?? "";
    const url = `https://github.com/${owner}/${repo}`;
    const row = stars
      ? `| ${category.emoji} | [${repo}](${url}) | ${description} | ${language} | ${meta?.stars ?? 0} |`
      : `| ${category.emoji} | [${repo}](${url}) | ${description} | ${language} |`;
    lines.push(row);
  }

  return lines.join("\n");
}

async function main() {
  const config = parse(await Deno.readTextFile(YAML_PATH)) as Config;
  const base = await Deno.readTextFile(BASE_PATH);
  const metadata = await fetchRepoMetadata();

  const missing: string[] = [];
  for (const category of config.categories) {
    for (const repo of category.repos) {
      if (!metadata.has(repo)) {
        missing.push(repo);
      }
    }
  }

  if (missing.length > 0) {
    console.warn(`Warning: ${missing.length} repo(s) not found on GitHub:`);
    for (const name of missing) {
      console.warn(`  - ${name}`);
    }
  }

  const visible = config.categories.filter(
    (c) => !c.hidden && !EXCLUDED_CATEGORIES.includes(c.name)
  );
  const normal = visible.filter((c) => !c.collapsed);
  const collapsed = visible.filter((c) => c.collapsed);

  const reposContent = normal
    .map((c) => generateTable(c, config.owner, metadata, "##"))
    .join("\n\n");

  const hallOfFameContent = collapsed
    .map((c) => generateTable(c, config.owner, metadata, "###"))
    .join("\n\n");

  const readme = base
    .replace("{{REPOS}}", reposContent)
    .replace("{{HALL_OF_FAME}}", hallOfFameContent);

  await Deno.writeTextFile(OUTPUT_PATH, readme);
  console.log(
    `Generated README.md with ${config.categories.length} categories (${normal.length} normal, ${collapsed.length} collapsed)`
  );
}

main();

#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write

/**
 * Discovers new public repos from GitHub and adds them
 * to the "Uncategorized" section in repos.yaml.
 *
 * Usage: deno run --allow-run --allow-read --allow-write scripts/pull.ts
 */

import { parse, stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";

interface Category {
  name: string;
  emoji: string;
  repos: string[];
}

interface Config {
  owner: string;
  categories: Category[];
}

const YAML_PATH = new URL("../templates/repos.yaml", import.meta.url).pathname;
const UNCATEGORIZED_NAME = "Uncategorized";
const UNCATEGORIZED_EMOJI = "❓";

async function fetchPublicRepos(): Promise<string[]> {
  const jqFilter = `[.[] | select(.isPrivate == false and .isFork == false) | .name] | sort[]`;
  const cmd = new Deno.Command("gh", {
    args: ["repo", "list", "--limit", "500", "--json", "name,isPrivate,isFork", "--jq", jqFilter],
    stdout: "piped",
  });

  const { stdout } = await cmd.output();
  const text = new TextDecoder().decode(stdout);
  return text.trim().split("\n").filter(Boolean);
}

async function main() {
  const configText = await Deno.readTextFile(YAML_PATH);
  const config = parse(configText) as Config;

  const existing = new Set(config.categories.flatMap((c) => c.repos));
  const remoteRepos = await fetchPublicRepos();
  const missing = remoteRepos.filter((name) => !existing.has(name));

  if (missing.length === 0) {
    console.log("All repos are accounted for.");
    return;
  }

  console.log(`Found ${missing.length} new repo(s):`);
  for (const name of missing) {
    console.log(`  + ${name}`);
  }

  let uncategorized = config.categories.find(
    (c) => c.name === UNCATEGORIZED_NAME
  );

  if (!uncategorized) {
    uncategorized = {
      name: UNCATEGORIZED_NAME,
      emoji: UNCATEGORIZED_EMOJI,
      repos: [],
    };
    config.categories.push(uncategorized);
  }

  uncategorized.repos.push(...missing);

  await Deno.writeTextFile(YAML_PATH, stringify(config));
  console.log(
    `\nUpdated repos.yaml — move repos from "${UNCATEGORIZED_NAME}" to the right category.`
  );
}

main();

import fs from "node:fs/promises";
import path from "node:path";
import { getOctokit } from "@actions/github";
import { confirm, select } from "@inquirer/prompts";
import { Command } from "commander";
import { execa } from "execa";
import semver from "semver";
import fg from "fast-glob";
import YAML from "yaml";
//#region src/cli/ux.ts
const PREFIX = "🐳";
function formatMessage(message) {
	return message.split(/\r?\n/).map((line) => `${PREFIX} ${line}`).join("\n");
}
//#endregion
//#region src/core/errors.ts
var DomainError = class extends Error {
	code;
	hint;
	context;
	constructor(code, message, options) {
		super(message);
		this.name = "DomainError";
		this.code = code;
		this.hint = options?.hint;
		this.context = options?.context;
	}
};
function toErrorMessage(error) {
	if (error instanceof DomainError) {
		const lines = [`[${error.code}] ${error.message}`];
		if (error.hint) lines.push(`💡 Hint: ${error.hint}`);
		if (error.context && Object.keys(error.context).length > 0) lines.push(`📦 Context: ${JSON.stringify(error.context, null, 2)}`);
		return lines.join("\n");
	}
	if (error instanceof Error) return error.stack ?? error.message;
	return String(error);
}
//#endregion
//#region src/core/changelog-path.ts
async function exists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}
async function resolveChangelogPath(params) {
	const { rootDir, packageDir, isMonorepo, changelogPathInput } = params;
	if (changelogPathInput) {
		const resolved = path.resolve(rootDir, changelogPathInput);
		if (!await exists(resolved)) throw new DomainError("CHANGELOG_NOT_FOUND", `Changelog not found: ${resolved}`);
		return {
			path: resolved,
			source: "input"
		};
	}
	if (isMonorepo) {
		const packageChangelog = path.join(packageDir, "CHANGELOG.md");
		if (await exists(packageChangelog)) return {
			path: packageChangelog,
			source: "package-default"
		};
	}
	const rootChangelog = path.join(rootDir, "CHANGELOG.md");
	if (await exists(rootChangelog)) return {
		path: rootChangelog,
		source: "root-default"
	};
	throw new DomainError("CHANGELOG_NOT_FOUND", "No changelog file found.", { hint: "Create CHANGELOG.md or pass changelog-path input." });
}
//#endregion
//#region src/core/changelog.ts
async function readChangelogEntry(params) {
	const { changelogPath, packageName, version } = params;
	const unscopedName = packageName.split("/").pop() ?? packageName;
	const candidates = [
		`${packageName}@${version}`,
		`${unscopedName}@${version}`,
		`v${version}`,
		version
	];
	const lines = (await fs.readFile(changelogPath, "utf8")).split(/\r?\n/);
	const headings = [];
	for (let i = 0; i < lines.length; i += 1) {
		const m = lines[i].match(/^##\s+(.+)$/);
		if (!m) continue;
		const raw = m[1].trim();
		headings.push({
			index: i,
			raw
		});
	}
	const found = headings.find((item) => candidates.some((candidate) => item.raw.includes(candidate)));
	if (!found) throw new DomainError("CHANGELOG_ENTRY_NOT_FOUND", `Version entry not found in changelog for ${packageName}@${version}.`);
	const next = headings.find((item) => item.index > found.index);
	const end = next ? next.index : lines.length;
	const body = lines.slice(found.index + 1, end).join("\n").trim();
	if (!body) throw new DomainError("CHANGELOG_ENTRY_EMPTY", `Changelog entry is empty for ${found.raw}.`);
	return {
		title: found.raw,
		body
	};
}
//#endregion
//#region src/core/github-client.ts
function createGitHubReleaseClient(octokit, repoContext) {
	const { owner, repo } = repoContext;
	return {
		async getReleaseByTag(tag) {
			try {
				return { id: (await octokit.rest.repos.getReleaseByTag({
					owner,
					repo,
					tag
				})).data.id };
			} catch (error) {
				if (isNotFoundError(error)) return null;
				throw error;
			}
		},
		async createRelease(input) {
			return { html_url: (await octokit.rest.repos.createRelease({
				owner,
				repo,
				tag_name: input.tag_name,
				name: input.name,
				body: input.body,
				target_commitish: input.target_commitish,
				prerelease: input.prerelease
			})).data.html_url };
		},
		async updateRelease(input) {
			return { html_url: (await octokit.rest.repos.updateRelease({
				owner,
				repo,
				release_id: input.release_id,
				tag_name: input.tag_name,
				name: input.name,
				body: input.body,
				target_commitish: input.target_commitish,
				prerelease: input.prerelease
			})).data.html_url };
		},
		async getTagCommit(tag) {
			try {
				const ref = await octokit.rest.git.getRef({
					owner,
					repo,
					ref: `tags/${tag}`
				});
				const sha = ref.data.object.sha;
				if (ref.data.object.type === "commit") return sha;
				return (await octokit.rest.git.getTag({
					owner,
					repo,
					tag_sha: sha
				})).data.object.sha;
			} catch (error) {
				if (isNotFoundError(error)) return null;
				throw error;
			}
		},
		async getRefCommit(ref) {
			const normalized = ref.replace(/^refs\//, "");
			try {
				const data = await octokit.rest.git.getRef({
					owner,
					repo,
					ref: normalized
				});
				if (data.data.object.type === "commit") return data.data.object.sha;
				return (await octokit.rest.git.getTag({
					owner,
					repo,
					tag_sha: data.data.object.sha
				})).data.object.sha;
			} catch (error) {
				if (isNotFoundError(error)) return null;
				throw error;
			}
		}
	};
}
function isNotFoundError(error) {
	return typeof error === "object" && error !== null && "status" in error && error.status === 404;
}
//#endregion
//#region src/core/tag.ts
function getUnscopedName(packageName) {
	return packageName.split("/").at(-1) ?? packageName;
}
function parseTag(tag, allowVersionOnlyTag) {
	const scopedOrPlain = /^(@?[^@\s]+)@(.+)$/;
	const versionWithV = /^v(.+)$/;
	const packageMatch = tag.match(scopedOrPlain);
	if (packageMatch) {
		const packageName = packageMatch[1];
		const version = semver.valid(packageMatch[2]);
		if (!version) throw new DomainError("INVALID_TAG", `Invalid semver in tag: ${tag}`);
		return {
			rawTag: tag,
			normalizedVersion: version,
			packageName,
			unscopedName: getUnscopedName(packageName),
			isPrerelease: semver.prerelease(version) !== null
		};
	}
	if (!allowVersionOnlyTag) throw new DomainError("INVALID_TAG", `Tag must include package name in monorepo mode: ${tag}`, { hint: "Use <package>@<version> format." });
	const vMatch = tag.match(versionWithV);
	const candidate = vMatch ? vMatch[1] : tag;
	const version = semver.valid(candidate);
	if (!version) throw new DomainError("INVALID_TAG", `Unsupported tag format: ${tag}`, { hint: "Use @scope/name@1.2.3, name@1.2.3, v1.2.3 or 1.2.3." });
	return {
		rawTag: tag,
		normalizedVersion: version,
		isPrerelease: semver.prerelease(version) !== null
	};
}
//#endregion
//#region src/core/github-tags.ts
function selectTagsForPackage(params) {
	const result = [];
	const targetUnscoped = params.packageName.split("/").pop() ?? params.packageName;
	for (const rawTag of params.tags) try {
		const parsed = parseTag(rawTag, params.allowVersionOnlyTag);
		if (!parsed.packageName) {
			result.push({
				rawTag,
				version: parsed.normalizedVersion,
				isPrerelease: parsed.isPrerelease
			});
			continue;
		}
		const parsedUnscoped = parsed.packageName.split("/").pop() ?? parsed.packageName;
		if (!(parsed.packageName === params.packageName || parsedUnscoped === targetUnscoped)) continue;
		result.push({
			rawTag,
			version: parsed.normalizedVersion,
			isPrerelease: parsed.isPrerelease
		});
	} catch {}
	return result.sort((a, b) => semver.rcompare(a.version, b.version));
}
//#endregion
//#region src/core/package-resolver.ts
async function readJson(filePath) {
	const content = await fs.readFile(filePath, "utf8");
	return JSON.parse(content);
}
async function loadWorkspaceGlobs(rootDir) {
	const rootPkg = await readJson(path.join(rootDir, "package.json"));
	const fromPkg = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces?.packages;
	if (fromPkg && fromPkg.length > 0) return fromPkg;
	const pnpmWsPath = path.join(rootDir, "pnpm-workspace.yaml");
	try {
		const pnpmWsContent = await fs.readFile(pnpmWsPath, "utf8");
		return YAML.parse(pnpmWsContent)?.packages ?? [];
	} catch {
		return [];
	}
}
function matchPackageBySpecifier(packages, specifier) {
	const trimmed = specifier.trim();
	if (!trimmed) throw new DomainError("INVALID_PACKAGE_SPEC", "Package name must be non-empty.");
	const exact = packages.filter((item) => item.name === trimmed);
	if (exact.length === 1) return exact[0];
	const unscoped = trimmed.split("/").pop() ?? trimmed;
	const byUnscoped = packages.filter((item) => (item.name.split("/").pop() ?? item.name) === unscoped);
	if (byUnscoped.length === 1) return byUnscoped[0];
	if (byUnscoped.length > 1) throw new DomainError("PACKAGE_AMBIGUOUS", `Ambiguous package "${trimmed}". Matches: ${byUnscoped.map((p) => p.name).join(", ")}.`);
	throw new DomainError("PACKAGE_NOT_FOUND", `Unknown package "${trimmed}". Known packages: ${packages.map((p) => p.name).join(", ")}.`);
}
async function scanWorkspacePackages(rootDir) {
	const globs = await loadWorkspaceGlobs(rootDir);
	if (globs.length === 0) return [];
	const packageJsonFiles = await fg(globs.map((item) => `${item}/package.json`), {
		cwd: rootDir,
		absolute: true,
		dot: false
	});
	const result = [];
	for (const file of packageJsonFiles) {
		const pkg = await readJson(file);
		if (!pkg.name) continue;
		result.push({
			name: pkg.name,
			dir: path.dirname(file)
		});
	}
	return result;
}
async function resolvePackageDir(params) {
	const { rootDir, packageName, fallbackRootPackageName } = params;
	const workspacePackages = await scanWorkspacePackages(rootDir);
	if (!(workspacePackages.length > 0)) {
		const rootPkg = await readJson(path.join(rootDir, "package.json"));
		const name = packageName ?? fallbackRootPackageName ?? rootPkg.name;
		if (!name) throw new DomainError("PACKAGE_NAME_NOT_FOUND", "Cannot resolve package name from package.json.");
		return {
			isMonorepo: false,
			packageName: name,
			packageDir: rootDir
		};
	}
	if (!packageName) throw new DomainError("MONOREPO_PACKAGE_NAME_REQUIRED", "Monorepo tag must include package name.", { hint: "Use tag like @scope/name@1.2.3 or name@1.2.3." });
	const exact = workspacePackages.filter((item) => item.name === packageName);
	if (exact.length === 1) return {
		isMonorepo: true,
		packageName: exact[0].name,
		packageDir: exact[0].dir
	};
	if (exact.length > 1) throw new DomainError("PACKAGE_CONFLICT", `Multiple packages matched: ${packageName}`);
	const unscoped = packageName.split("/").pop() ?? packageName;
	const byUnscoped = workspacePackages.filter((item) => item.name.split("/").pop() === unscoped);
	if (byUnscoped.length === 1) return {
		isMonorepo: true,
		packageName: byUnscoped[0].name,
		packageDir: byUnscoped[0].dir
	};
	if (byUnscoped.length > 1) throw new DomainError("PACKAGE_CONFLICT", `Unscoped package name is ambiguous: ${unscoped}`);
	throw new DomainError("PACKAGE_NOT_FOUND", `Package from tag was not found: ${packageName}`);
}
async function isMonorepoWorkspace(rootDir) {
	return (await scanWorkspacePackages(rootDir)).length > 0;
}
//#endregion
//#region src/core/npm.ts
async function hasNpmVersion(packageName, version) {
	try {
		return (await execa("npm", [
			"view",
			`${packageName}@${version}`,
			"version",
			"--json"
		])).stdout.trim().length > 0;
	} catch {
		return false;
	}
}
async function publishNpmPackage(input) {
	const args = ["publish"];
	if (input.packageName.startsWith("@")) args.push("--access", "public");
	if (input.isPrerelease) args.push("--tag", "next");
	try {
		await execa("npm", ["pack", "--dry-run"], { cwd: input.packageDir });
		await execa("npm", args, {
			cwd: input.packageDir,
			stdio: "inherit"
		});
	} catch (error) {
		const stderr = error.stderr || "";
		if (stderr.includes("401") || stderr.includes("403") || stderr.includes("ENEEDAUTH")) throw new DomainError("NPM_PUBLISH_AUTH_ERROR", "npm publish failed due to authentication error.", { hint: "Ensure you are logged in or have a valid .npmrc with auth token. For example: //registry.npmjs.org/:_authToken=<YOUR_TOKEN>" });
		throw error;
	}
}
//#endregion
//#region src/core/ref-guard.ts
async function assertTagRefConsistency(input) {
	if (!input.ref) return;
	const tagCommit = await input.client.getTagCommit(input.tag);
	const refCommit = await input.client.getRefCommit(input.ref);
	if (!tagCommit || !refCommit) {
		input.warn?.(`Skip tag/ref consistency check. tagCommit=${tagCommit ?? "null"} refCommit=${refCommit ?? "null"}`);
		return;
	}
	if (tagCommit !== refCommit) throw new DomainError("TAG_REF_MISMATCH", "Tag and ref point to different commits.", { context: {
		tag: input.tag,
		ref: input.ref,
		tagCommit,
		refCommit
	} });
}
//#endregion
//#region src/core/release.ts
async function ensureRelease(input) {
	const existing = await input.client.getReleaseByTag(input.tag);
	if (!existing) return {
		githubReleaseUrl: (await input.client.createRelease({
			tag_name: input.tag,
			name: input.title,
			body: input.body,
			target_commitish: input.targetCommitish,
			prerelease: input.isPrerelease
		})).html_url,
		action: "created"
	};
	return {
		githubReleaseUrl: (await input.client.updateRelease({
			release_id: existing.id,
			tag_name: input.tag,
			name: input.title,
			body: input.body,
			target_commitish: input.targetCommitish,
			prerelease: input.isPrerelease
		})).html_url,
		action: "updated"
	};
}
//#endregion
//#region src/core/publish-service.ts
async function publishRelease(req, deps) {
	const rootDir = process.cwd();
	const isMonorepo = await isMonorepoWorkspace(rootDir);
	const firstParsed = parseTag(req.tag, !isMonorepo);
	const resolvedPackage = await resolvePackageDir({
		rootDir,
		packageName: firstParsed.packageName
	});
	const parsed = firstParsed.packageName ? firstParsed : {
		...firstParsed,
		packageName: resolvedPackage.packageName,
		unscopedName: resolvedPackage.packageName.split("/").pop() ?? resolvedPackage.packageName
	};
	const packageName = parsed.packageName ?? resolvedPackage.packageName;
	const changelogPath = await resolveChangelogPath({
		rootDir,
		packageDir: resolvedPackage.packageDir,
		isMonorepo: resolvedPackage.isMonorepo,
		changelogPathInput: req.changelogPathInput
	});
	const entry = await readChangelogEntry({
		changelogPath: changelogPath.path,
		packageName,
		version: parsed.normalizedVersion
	});
	deps.logger.info(`🐳 Resolved package: ${resolvedPackage.packageName}`);
	deps.logger.info(`🐳 Resolved changelog: ${path.relative(rootDir, changelogPath.path)} (${changelogPath.source})`);
	if (deps.releaseClient.getTagCommit && deps.releaseClient.getRefCommit) await assertTagRefConsistency({
		tag: req.tag,
		ref: req.ref,
		client: {
			getTagCommit: deps.releaseClient.getTagCommit,
			getRefCommit: deps.releaseClient.getRefCommit
		},
		warn: (msg) => deps.logger.warn?.(msg)
	});
	const ensured = await ensureRelease({
		client: deps.releaseClient,
		tag: req.tag,
		title: entry.title,
		body: entry.body,
		targetCommitish: req.ref,
		isPrerelease: parsed.isPrerelease
	});
	let npmStatus = "skipped";
	if (req.publishNpm) if (await hasNpmVersion(packageName, parsed.normalizedVersion)) {
		npmStatus = "already-exists";
		deps.logger.warn?.(`npm version already exists: ${packageName}@${parsed.normalizedVersion}`);
	} else {
		await publishNpmPackage({
			packageDir: resolvedPackage.packageDir,
			packageName,
			isPrerelease: parsed.isPrerelease
		});
		npmStatus = "published";
	}
	return {
		packageName: resolvedPackage.packageName,
		packageDir: resolvedPackage.packageDir,
		version: parsed.normalizedVersion,
		releaseTag: req.tag,
		releaseTitle: entry.title,
		githubReleaseUrl: ensured.githubReleaseUrl,
		releaseAction: ensured.action,
		npmStatus,
		changelogPath: changelogPath.path,
		changelogPathSource: changelogPath.source
	};
}
//#endregion
//#region src/cli.ts
if (!process.env.VITEST) main();
function main() {
	runCli().catch((error) => {
		const msg = error instanceof Error ? error.message : String(error);
		if (msg.includes("SIGINT") || msg.includes("User force closed")) {
			console.log(formatMessage("Cancelled..."));
			process.exit(0);
		}
		console.error(toErrorMessage(error));
		process.exit(1);
	});
}
async function runCli() {
	const args = parseArgs(process.argv.slice(2));
	const token = resolveToken(args.token);
	const { owner, repo } = await getRepo();
	const octokit = getOctokit(token);
	const rootDir = process.cwd();
	const packages = await listPackages(rootDir);
	if (packages.length === 0) throw new Error(formatMessage("No publishable packages found."));
	const packageSpecifier = args.package?.trim();
	const selectedPackage = packageSpecifier ? matchPackageBySpecifier(packages, packageSpecifier) : packages.length === 1 ? packages[0] : await select({
		message: "Select package to release",
		choices: packages.map((item) => ({
			name: item.name,
			value: item
		}))
	});
	const tagsResponse = await octokit.paginate(octokit.rest.repos.listTags, {
		owner,
		repo,
		per_page: 100
	});
	const isMonorepo = await isMonorepoWorkspace(rootDir);
	const selectableTags = selectTagsForPackage({
		tags: tagsResponse.map((item) => item.name),
		packageName: selectedPackage.name,
		allowVersionOnlyTag: !isMonorepo
	});
	if (selectableTags.length === 0) throw new Error(formatMessage(`No tags found for package ${selectedPackage.name}. Use --tag to specify one manually.`));
	const tagFromArgs = args.tag?.trim();
	if (packageSpecifier && tagFromArgs) {
		if (!selectableTags.some((item) => item.rawTag === tagFromArgs)) throw new Error(formatMessage(`Tag "${tagFromArgs}" does not match package ${selectedPackage.name} (not in this package's release tags on GitHub).`));
	}
	const selectedTag = tagFromArgs || await select({
		message: "Select tag to release",
		choices: selectableTags.map((item) => ({
			name: `${item.rawTag}${item.isPrerelease ? " (prerelease)" : ""}`,
			value: item.rawTag
		}))
	});
	const parsed = parseTag(selectedTag, !isMonorepo);
	const resolvedPackage = await resolvePackageDir({
		rootDir,
		packageName: parsed.packageName ?? selectedPackage.name
	});
	const entry = await readChangelogEntry({
		changelogPath: (await resolveChangelogPath({
			rootDir,
			packageDir: resolvedPackage.packageDir,
			isMonorepo: resolvedPackage.isMonorepo
		})).path,
		packageName: resolvedPackage.packageName,
		version: parsed.normalizedVersion
	});
	console.log(`\n${formatMessage("GitHub Release preview 🔍")}`);
	console.log(formatMessage(`  - package: ${resolvedPackage.packageName}`));
	console.log(formatMessage(`  - tag: ${selectedTag}`));
	console.log(formatMessage(`  - version: ${parsed.normalizedVersion}`));
	console.log(formatMessage(`  - changelog title: ${entry.title}`));
	console.log(formatMessage(`  - changelog body:\n${entry.body.split("\n").map((line) => `    ${line}`).join("\n")}`));
	const releaseActionLabel = await octokit.rest.repos.getReleaseByTag({
		owner,
		repo,
		tag: selectedTag
	}).then(() => true).catch((error) => {
		if (typeof error === "object" && error !== null && "status" in error && error.status === 404) return false;
		throw error;
	}) ? "Update" : "Create";
	if (!(args.yes ? true : await confirm({
		message: `${releaseActionLabel} GitHub Release?`,
		default: true
	}))) {
		console.log(formatMessage("Cancelled..."));
		return;
	}
	let shouldPublishNpm = args.publishNpm;
	if (args.publishNpm && !args.yes) {
		shouldPublishNpm = await confirm({
			message: "Publish package to npm as well?",
			default: false
		});
		if (!shouldPublishNpm) console.log(formatMessage("Skip npm publish, continue with GitHub Release only."));
	}
	const releaseClient = createGitHubReleaseClient(octokit, {
		owner,
		repo
	});
	const result = await publishRelease({
		tag: selectedTag,
		ref: args.ref,
		publishNpm: shouldPublishNpm
	}, {
		releaseClient,
		logger: {
			info: (msg) => console.log(msg),
			warn: (msg) => console.warn(msg)
		}
	});
	console.log(`\n${formatMessage("GitHub Release published 🎉")}`);
	console.log(formatMessage(`  - action: ${result.releaseAction}`));
	console.log(formatMessage(`  - url: ${result.githubReleaseUrl}`));
}
function parseArgs(argv) {
	const program = new Command().name("tofrankie-release").description("Create or update GitHub Release from local repository").option("--token <token>", "GitHub token").option("--package <name>", "package name from package.json (skip package prompt)").option("--tag <tag>", "tag to release (skip tag prompt)").option("--ref <ref>", "ref to validate against tag").option("--publish-npm", "publish package to npm", false).option("-y, --yes", "skip confirmation prompt", false);
	program.parse(argv, { from: "user" });
	const opts = program.opts();
	return {
		token: opts.token,
		package: opts.package,
		tag: opts.tag,
		ref: opts.ref,
		publishNpm: opts.publishNpm,
		yes: opts.yes
	};
}
function resolveToken(argvToken) {
	const token = argvToken ?? process.env.GITHUB_RELEASE_TOKEN ?? process.env.GITHUB_TOKEN;
	if (!token) throw new Error("Missing GitHub token. Use --token or env GITHUB_RELEASE_TOKEN/GITHUB_TOKEN.");
	return token;
}
function parseRepoFromOrigin(origin) {
	const ssh = origin.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
	if (ssh) return {
		owner: ssh[1],
		repo: ssh[2]
	};
	return null;
}
async function getRepo() {
	const parsed = parseRepoFromOrigin((await execa("git", [
		"config",
		"--get",
		"remote.origin.url"
	])).stdout.trim());
	if (!parsed) throw new Error("Cannot resolve GitHub repo from git origin.");
	return parsed;
}
async function listPackages(rootDir) {
	if (await isMonorepoWorkspace(rootDir)) return scanWorkspacePackages(rootDir);
	const rootPkg = JSON.parse(await fs.readFile(path.join(rootDir, "package.json"), "utf8"));
	if (!rootPkg.name) throw new Error("Root package.json is missing name.");
	return [{
		name: rootPkg.name,
		dir: rootDir
	}];
}
//#endregion
export { parseArgs, parseRepoFromOrigin, resolveToken };

//# sourceMappingURL=cli.mjs.map
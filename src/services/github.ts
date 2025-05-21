import { fetch } from "undici";
import { Octokit } from "@octokit/rest";

import { CacheService } from "./cache.js";
import { Config } from "./config.js";
import { AppError } from "../middlewares/errorHandler.js";
import { logger } from "../utils/logger.js";
import { getFilePlatform } from "../utils/platform.js";
import { toString as streamToString } from "../utils/stream.js";

export interface ReleaseAsset {
    name: string;
    contentType: string;
    platform: string;
    url: string;
    downloadUrl: string;
    size: number;
}

export interface Release {
    notes?: string;
    assets: ReleaseAsset[];
    publishedAt: string | null;
    version: string;
}

interface GitHubRelease {
    body?: string | null;
    assets: {
        name: string;
        content_type: string;
        url: string;
        browser_download_url: string;
        size: number;
    }[];
    tag_name: string;
    published_at: string | null;
    created_at: string | null;
}

export class GitHubService {
    private config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    private getOctokit(application: string): Octokit {
        const appConfig = this.config.applications[application];
        if (!appConfig) {
            throw new AppError(404, `Application ${application} not found`);
        }

        // use app-specific token if available, otherwise use global token
        const token = appConfig.token || this.config.github?.token;
        if (appConfig.private && !token) {
            throw new AppError(401, `No GitHub token available for private repository ${application}`);
        }

        return new Octokit({ auth: token });
    }

    private cacheRelease(application: string, release: GitHubRelease): Release {
        logger.info(`release - caching ${application} ${ release.tag_name }`);

        const appConfig = this.config.applications[application];
        const cacheService = CacheService.init("github", 900);
        const cacheKey = CacheService.generateKey(appConfig.repository.owner, appConfig.repository.name, "release");

        const assets = release.assets.map(asset => {
            const platform = getFilePlatform(asset.name);
            return {
                name: asset.name,
                contentType: asset.content_type,
                platform,
                url: asset.url,
                downloadUrl: asset.browser_download_url,
                size: asset.size,
            };
        }).filter(asset => asset.platform !== null || asset.name === "RELEASES") as ReleaseAsset[];

        const latestRelease = {
            notes: release.body || "",
            version: release.tag_name.replace(/^v/, ""),
            assets,
            publishedAt: release.published_at || release.created_at,
        };

        cacheService.set(cacheKey, latestRelease);

        logger.info(`release - successfully cached ${application} ${ release.tag_name }`);

        return latestRelease;
    }

    async getLatestRelease(application: string): Promise<Release> {
        try {
            const appConfig = this.config.applications[application];
            if (!appConfig) {
                throw new AppError(404, `Application ${application} not found`);
            }

            const octokit = this.getOctokit(application);
            const cacheService = CacheService.init("github", 900);

            const cacheKey = CacheService.generateKey(appConfig.repository.owner, appConfig.repository.name, "release");
            const cachedRelease = cacheService.get<Release>(cacheKey);
            if (cachedRelease) return cachedRelease;

            // only search for prereleases if `prerelease` is set
            if (appConfig.prerelease) {
                const { data: releases } = await octokit.repos.listReleases({
                    owner: appConfig.repository.owner,
                    repo: appConfig.repository.name,
                    per_page: 100,
                });

                const release = releases.find(release => !release.draft && release.prerelease);

                if (!release) {
                    throw new Error("Did not find any prereleases.");
                }

                return this.cacheRelease(application, release);
            }

            // otherwise, get the latest release
            const { data: release } = await octokit.repos.getLatestRelease({
                owner: appConfig.repository.owner,
                repo: appConfig.repository.name,
            });

            return this.cacheRelease(application, release);
        } catch (error) {
            logger.error("Failed to fetch latest release:", error);
            throw new AppError(500, "Failed to fetch latest release from GitHub");
        }
    }

    async getLatestReleasesMetadata(application: string): Promise<string | undefined> {
        try {
            const appConfig = this.config.applications[application];
            if (!appConfig) {
                throw new AppError(404, `Application ${application} not found`);
            }
            const cacheService = CacheService.init("github", 900);

            const cacheKey = CacheService.generateKey(appConfig.repository.owner, appConfig.repository.name, "win32:RELEASES");
            const cachedReleasesMetadata = cacheService.get<string>(cacheKey);
            if (cachedReleasesMetadata) return cachedReleasesMetadata;

            const release = await this.getLatestRelease(application);
            const asset = release.assets?.find(asset => asset.name === "RELEASES");

            if (!asset) {
                throw new AppError(404, "RELEASES file not found.");
            }

            const response = await fetch(asset.url, {
                headers: {
                    accept: "application/octet-stream",
                    authorization: `token ${appConfig.token || this.config.github?.token}`,
                    "user-agent": "Quark - Electron Update Server (https://github.com/iamtraction/quark)",
                },
            });

            if (!response.body) {
                throw new AppError(500, "RELEASES file doesn't contain any content.");
            }

            let content = await streamToString(response.body);
            const matches = content.match(/[^ ]*\.nupkg/gim);

            if (!matches?.length) {
                throw new AppError(500, "RELEASES content doesn't contain .nupkg files.");
            }

            for (const match of matches) {
                const nuPKG = asset.downloadUrl.replace("RELEASES", match);
                content = content.replace(match, nuPKG);
            }

            cacheService.set(cacheKey, content);

            return content;
        } catch (error) {
            logger.error("Failed to get RELEASES file -", error);
            throw error;
        }
    }
}

import url from "node:url";
import { Router, Request, Response } from "express";
import { fetch } from "undici";

import { loadApplicationConfig, loadConfig } from "../services/config.js";
import { GitHubService } from "../services/github.js";
import { AppError } from "../middlewares/errorHandler.js";
import { getPreferredExtension, resolvePlatform, resolvePlatformFromUserAgent } from "../utils/platform.js";

const router = Router({ mergeParams: true });

const handleDownload = async (req: Request, res: Response, platform: string | null) => {
    if (!platform) {
        throw new AppError(400, "The platform is not supported.");
    }

    const qs = url.parse(req.url, true).query;
    const isUpdate = qs?.update?.toString().toLowerCase() === "true";
    const format = qs?.format?.toString().toLowerCase();
    const extension = format ? "." + format : getPreferredExtension(platform, isUpdate);

    const config = await loadConfig();
    const appConfig = await loadApplicationConfig(req.params.application);

    const githubService = new GitHubService(config);
    const latestRelease = await githubService.getLatestRelease(req.params.application);

    const platformAssets = latestRelease.assets?.filter(asset => asset.platform === platform);
    const preferredAsset = platformAssets?.find(asset => asset.name.toLowerCase().endsWith(extension.toLowerCase()));
    const targetAsset = format ? preferredAsset : (preferredAsset || platformAssets?.[0]);

    if (!targetAsset) {
        throw new AppError(400, format ? `No ${ format } release found for the platform ${ platform }.` : `No release found for the platform ${ platform }.`);
    }

    const isPrivateDownload = appConfig.private && (config.github?.token || appConfig.token);

    if (isPrivateDownload) {
        const assetUrl = targetAsset.url;

        try {
            const assetRes = await fetch(assetUrl, {
                headers: {
                    accept: "application/octet-stream",
                    authorization: `token ${ config.github?.token || appConfig.token }`,
                },
                redirect: "manual",
            });

            const location = assetRes.headers.get("location");
            if (!location) {
                throw new AppError(500, "Failed to get the download location.");
            }

            res.setHeader("location", location).status(302).end();
            return;
        } catch (error) {
            throw new AppError(500, "Failed to get the release asset.");
        }
    }

    res.setHeader("location", targetAsset.downloadUrl).status(302).end();
}

router.get("/", async (req: Request, res: Response) => {
    const platform = resolvePlatformFromUserAgent(req.useragent);
    await handleDownload(req, res, platform);
});

router.get("/:platform", async (req: Request, res: Response) => {
    const platform = resolvePlatform(req.params.platform);
    await handleDownload(req, res, platform);
});

export default router;

import url from "node:url";
import { Router, Request, Response } from "express";
import { fetch } from "undici";

import { loadApplicationConfig, loadConfig } from "../services/config.js";
import { GitHubService } from "../services/github.js";
import { AppError } from "../middlewares/errorHandler.js";
import { getPreferredExtension, resolvePlatform } from "../utils/platform.js";

const router = Router({ mergeParams: true });

router.get("/:platform", async (req: Request, res: Response) => {
    const qs = url.parse(req.url, true).query;
    const isUpdate = qs?.update?.toString().toLowerCase() === "true";
    const format = qs?.format?.toString().toLowerCase();
    const platform = resolvePlatform(req.params.platform);
    const extension = format ? "." + format : getPreferredExtension(platform, isUpdate);

    if (!platform) {
        throw new AppError(400, `The platform ${ platform } is not supported.`);
    }

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

        fetch(assetUrl, {
            headers: {
                accept: "application/octet-stream",
                authorization: `token ${ config.github?.token || appConfig.token }`,
            },
            redirect: "manual",
        }).then(assetRes => {
            res.setHeader("Location", assetRes.headers.get("Location") || "");
            res.status(302).end();
        });
        return;
    }

    res.writeHead(302, {
        location: targetAsset.downloadUrl,
    }).end();
});

export default router;

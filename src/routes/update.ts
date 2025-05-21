import { Router, Request, Response } from "express";
import semver from "semver";

import { loadApplicationConfig, loadConfig } from "../services/config.js";
import { GitHubService } from "../services/github.js";
import { AppError } from "../middlewares/errorHandler.js";
import { getPreferredExtension, resolvePlatform } from "../utils/platform.js";

const router = Router({ mergeParams: true });

router.get("/:platform/:version", async (req: Request, res: Response) => {
    if (!semver.valid(req.params.version)) {
        throw new AppError(400, "The specified version is not valid.");
    }

    const platform = resolvePlatform(req.params.platform);
    const extension = getPreferredExtension(platform, true);

    if (!platform) {
        throw new AppError(400, `The platform ${ platform } is not supported.`);
    }

    const config = await loadConfig();
    const appConfig = await loadApplicationConfig(req.params.application);

    const githubService = new GitHubService(config);
    const latestRelease = await githubService.getLatestRelease(req.params.application);

    const platformAssets = latestRelease.assets?.filter(asset => asset.platform === platform);
    const preferredAsset = platformAssets?.find(asset => asset.name.toLowerCase().endsWith(extension.toLowerCase()));
    const targetAsset = preferredAsset || platformAssets?.[0];

    if (!targetAsset) {
        res.status(204).end();
        return;
    }

    if (semver.compare(req.params.version, latestRelease.version) === 0) {
        res.status(204).end();
        return;
    }

    const isPrivateDownload = appConfig.private && (config.github?.token || appConfig.token);
    const serverUrl = process.env.URL || `${ req.protocol }://${ req.get("host") }`;

    res.status(200).json({
        name: latestRelease.version,
        notes: latestRelease.notes,
        pub_date: latestRelease.publishedAt,
        url: isPrivateDownload
            ?   `${ serverUrl }/download/${ platform }?update=true`
            :   targetAsset.url,
    });
});

router.get("/win32/:version/RELEASES", async (req: Request, res: Response) => {
    const config = await loadConfig();

    const githubService = new GitHubService(config);
    const releasesMetadata = await githubService.getLatestReleasesMetadata(req.params.application);

    if (!releasesMetadata) {
        res.status(204).end();
        return;
    }

    res.writeHead(200, {
        "content-length": Buffer.byteLength(releasesMetadata, "utf8"),
        "content-type": "application/octet-stream",
    }).end(releasesMetadata);
});

export default router;

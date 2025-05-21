import { Router, Request, Response } from "express";

import { loadApplicationConfig, loadConfig } from "../services/config.js";
import { GitHubService } from "../services/github.js";

const router = Router({ mergeParams: true });

router.get("/", async (req: Request, res: Response) => {
    const config = await loadConfig();
    const appConfig = await loadApplicationConfig(req.params.application);

    const githubService = new GitHubService(config);
    const latestRelease = await githubService.getLatestRelease(req.params.application);

    res.status(200).json({
        owner: appConfig.repository.owner,
        name: appConfig.repository.name,
        repository: appConfig.repository.owner + "/" + appConfig.repository.name,
        version: latestRelease.version,
        publishedAt: latestRelease.publishedAt,
        assets: latestRelease.assets,
        changelog: `https://github.com/${ appConfig.repository.owner }/${ appConfig.repository.name }/releases/tag/${ latestRelease.version }`,
        releases: `https://github.com/${ appConfig.repository.owner }/${ appConfig.repository.name }/releases`,
        github: `https://github.com/${ appConfig.repository.owner }/${ appConfig.repository.name }`,
    });
});

export default router;

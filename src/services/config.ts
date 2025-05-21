import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import yaml from "yaml";

import { AppError } from "../middlewares/errorHandler.js";
import { logger } from "../utils/logger.js";
import { CacheService } from "./cache.js";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RepositoryConfig {
    owner: string;
    name: string;
}

export interface ApplicationConfig {
    repository: {
        owner: string;
        name: string;
    };
    prerelease?: boolean;
    private?: boolean;
    token?: string;
}

export interface Config {
    github?: {
        token?: string;
    };
    applications: Record<string, ApplicationConfig>;
}

export const loadConfig = async (): Promise<Config> => {
    try {
        const cacheService = CacheService.init("settings");
        const cachedConfig = cacheService.get<Config>("config");
        if (cachedConfig) {
            logger.info("configuration - loaded cache");
            return cachedConfig;
        }

        logger.info("configuration - loading from file...");

        const configPath = process.env.CONFIG_PATH || path.join(__dirname, "..", "config.yaml");
        const configFile = await fs.readFile(configPath, "utf-8");
        const config = yaml.parse(configFile) as Config;

        // validate applications
        if (!config.applications || Object.keys(config.applications).length === 0) {
            throw new Error("No applications configured");
        }

        // validate each application
        for (const [appId, appConfig] of Object.entries(config.applications)) {
            if (!appConfig.repository) {
                throw new Error(`Repository configuration missing for application ${appId}`);
            }

            if (!appConfig.repository.owner) {
                throw new Error(`Repository owner missing for application ${appId}`);
            }

            if (!appConfig.repository.name) {
                throw new Error(`Repository name missing for application ${appId}`);
            }

            // check if private repository has a token
            if (appConfig.private && !appConfig.token && !config.github?.token) {
                throw new Error(`No GitHub token available for private repository ${appId}`);
            }
        }

        cacheService.set("config", config);
        logger.info("configuration - successfully loaded");
        return config;
    } catch (error) {
        logger.error("configuration - failed to load -", error);
        throw new AppError(500, "Failed to load configuration.");
    }
};

export const loadApplicationConfig = async (application: string): Promise<ApplicationConfig> => {
    try {
        const config = await loadConfig();
        const appConfig = config.applications[application];
        if (!appConfig) {
            throw new Error(`Application ${ application } not found in configuration`);
        }
        return appConfig;
    } catch (error) {
        logger.error("application configuration - failed to load -", error);
        throw new AppError(500, `Failed to load application configuration for ${ application }.`);
    }
};

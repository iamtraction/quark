import express from "express";
import ua from "express-useragent";

import { setupErrorHandling } from "./middlewares/errorHandler.js";
import { logger } from "./utils/logger.js";

import downloadRouter from "./routes/download.js";
import overviewRouter from "./routes/overview.js";
import updateRouter from "./routes/update.js";

async function main() {
    const app = express();
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    const host = process.env.HOST || "0.0.0.0";

    // setup middlewares
    app.use(ua.express());

    // setup routes
    app.use("/:application", overviewRouter);
    app.use("/:application/download", downloadRouter);
    app.use("/:application/update", updateRouter);

    // setup error handling
    setupErrorHandling(app);

    // start server
    app.listen(port, host, () => {
        logger.info(`Server listening on http://${ host }:${ port }`);
    });
}

main().catch((error) => {
    logger.error("Failed to start the server.", error);
    process.exit(1);
});

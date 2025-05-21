import { Application, Request, Response } from "express";

import { logger } from "../utils/logger.js";

export class AppError extends Error {
    constructor(public statusCode: number, message: string) {
        super(message);
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export function setupErrorHandling(app: Application): void {
    // handle 404 errors
    app.use((req: Request, res: Response) => {
        res.status(404).json({
            status: "error",
            message: `Route ${req.originalUrl} not found.`,
        });
    });

    // global error handler
    app.use((err: Error, req: Request, res: Response) => {
        logger.error("Error:", err);

        if (err instanceof AppError) {
            res.status(err.statusCode).json({
                status: "error",
                message: err.message,
            });
            return;
        }

        // handle unexpected errors
        res.status(500).json({
            status: "error",
            message: "Internal Server Error",
        });
    });
}

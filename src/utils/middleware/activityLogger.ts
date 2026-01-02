import { Request, Response, NextFunction } from 'express';
import { logActivity } from '../lib/activityLogger';

type EntityTypeResolver =
  | string
  | ((req: Request, res: Response) => string | undefined);

type ActivityConfig = {
  action: string;
  entityType?: EntityTypeResolver;
  getEntityId?: (req: Request, res: Response) => string | undefined;
  getMetadata?: (req: Request, res: Response) => Record<string, unknown>;
};

export function activityLogger(config: ActivityConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", async () => {
      // Only log successful mutations
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      const userId = req.user?.id;

      const entityType =
        typeof config.entityType === "function"
          ? config.entityType(req, res)
          : config.entityType;

      await logActivity({
        userId,
        action: config.action,
        entityType,
        entityId: config.getEntityId?.(req, res),
        metadata: config.getMetadata?.(req, res),
      });
    });

    next();
  };
}

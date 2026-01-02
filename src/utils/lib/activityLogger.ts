import pool from "../config";

type ActivityLogParams = {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  metadata,
}: ActivityLogParams) {
  try {
    await pool.query(
      `
      INSERT INTO activity_log
        (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        userId ?? null,
        action,
        entityType ?? null,
        entityId ?? null,
        metadata ?? null,
      ]
    );
  } catch (err) {
    // Never block the request because of logging
    console.error('Activity log failed:', err);
  }
}
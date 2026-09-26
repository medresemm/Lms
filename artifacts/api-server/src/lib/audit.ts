import { auditEventsTable, db } from "@workspace/db";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { sendCriticalEventEmail } from "./applicationEmail.js";

export type AuditEvent = {
  eventType: string;
  actorClerkUserId: string;
  targetType: string;
  targetId?: string | number | null;
  details?: Record<string, unknown>;
  deduplicationKey?: string;
  notifyOwner?: boolean;
};

const ownerEmailEventTypes = new Set([
  "application.submitted",
  "application.approved",
  "application.rejected",
  "student.deleted",
  "teacher.assignment",
]);

function shouldNotifyOwner(event: AuditEvent) {
  if (event.notifyOwner !== undefined) return event.notifyOwner;
  if (ownerEmailEventTypes.has(event.eventType)) return true;
  if (event.eventType === "user.role.updated") {
    const newRole = event.details?.newRole;
    return newRole === "teacher" || newRole === "supervisor" || newRole === "owner_assistant";
  }
  return false;
}

/**
 * Audit persistence is deliberately best-effort from the request's point of view:
 * a notification/storage outage must never roll back the mutation that triggered it.
 * The unique key makes retries and duplicate webhook/request attempts harmless.
 */
export async function recordAuditEvent(event: AuditEvent) {
  const deduplicationKey = event.deduplicationKey ??
    `${event.eventType}:${event.targetType}:${event.targetId ?? ""}:${event.actorClerkUserId}`;
  try {
    const [row] = await db.insert(auditEventsTable).values({
      eventType: event.eventType,
      actorClerkUserId: event.actorClerkUserId,
      targetType: event.targetType,
      targetId: event.targetId == null ? null : String(event.targetId),
      details: event.details ?? {},
      deduplicationKey,
    }).onConflictDoNothing({ target: auditEventsTable.deduplicationKey }).returning();
    if (!row) return;
    const ownerEmail = process.env.SYSTEM_OWNER_EMAIL?.trim();
    if (ownerEmail && shouldNotifyOwner(event)) {
      void sendCriticalEventEmail({
        to: ownerEmail,
        eventType: event.eventType,
        actor: event.actorClerkUserId,
        target: `${event.targetType}:${event.targetId ?? ""}`,
        details: JSON.stringify(event.details ?? {}),
      }).catch(() => undefined);
    }
  } catch {
    // Audit/notification failures are isolated from business mutations.
  }
}

export type AuditEventFilters = {
  limit?: number;
  eventType?: string;
  targetType?: string;
  fromDate?: string;
  toDate?: string;
};

export async function listAuditEvents(filters: AuditEventFilters = {}) {
  const conditions = [
    filters.eventType ? eq(auditEventsTable.eventType, filters.eventType) : undefined,
    filters.targetType ? eq(auditEventsTable.targetType, filters.targetType) : undefined,
    filters.fromDate ? gte(auditEventsTable.createdAt, new Date(`${filters.fromDate}T00:00:00.000Z`)) : undefined,
    filters.toDate ? lt(auditEventsTable.createdAt, new Date(new Date(`${filters.toDate}T00:00:00.000Z`).getTime() + 86400000)) : undefined,
  ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  return db.select().from(auditEventsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditEventsTable.createdAt), desc(auditEventsTable.id))
    .limit(limit);
}

export async function deleteAuditEvent(id: number) {
  const [deleted] = await db.delete(auditEventsTable)
    .where(eq(auditEventsTable.id, id))
    .returning({ id: auditEventsTable.id });
  return deleted ?? null;
}

export async function deleteAllAuditEvents() {
  const deleted = await db.delete(auditEventsTable).returning({ id: auditEventsTable.id });
  return deleted.length;
}
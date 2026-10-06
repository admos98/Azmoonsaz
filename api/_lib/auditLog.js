/**
 * Best-effort security audit write (F-13).
 *
 * Rationale: audit failures must never fail the user's action (the action
 * itself already succeeded), but they must never be silent either — every
 * failure is logged to stderr so serverless logs carry the gap.
 *
 * Table: public.audit_logs — RLS enabled + FORCE, zero policies (deny-all),
 * EXECUTE/grants revoked from anon/authenticated; writes only land through
 * the service-role client (the same pattern as rate_limits / F-04).
 */
export async function auditLog(admin, entry) {
  try {
    const { error } = await admin.from('audit_logs').insert({
      actor_type: entry.actorType, // 'teacher' | 'student' | 'system'
      actor_id: entry.actorId || null,
      action: entry.action,
      entity_type: entry.entityType || null,
      entity_id: entry.entityId || null,
      metadata: entry.metadata || {},
    });
    if (error) throw error;
  } catch (error) {
    console.error('[audit] write failed', entry.action, error?.message || error);
  }
}

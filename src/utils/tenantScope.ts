/**
 * Multi-tenant isolation: every school is a separate tenant.
 * Class names (e.g. "JSS1A") are NOT globally unique — only UUIDs are.
 * Always filter queries with school_id from the logged-in user.
 */

export function assertSchoolId(schoolId: string | undefined | null): string {
  if (!schoolId) {
    throw new Error('School context is required. User must be logged in with a valid school.');
  }
  return schoolId;
}

/** Build a scoped class map query — never load all schools' classes. */
export function classSelectFields(): string {
  return 'id, name, school_id';
}

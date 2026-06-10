/** School tiers from lowest (early years) to highest (tertiary). */
export const SCHOOL_TYPE_OPTIONS = [
  { value: 'nursery', label: 'Nursery', description: 'Early years / pre-primary (ages 3–5)' },
  { value: 'primary', label: 'Primary', description: 'Primary school (Basic 1–6)' },
  { value: 'secondary', label: 'Secondary', description: 'Junior & senior secondary' },
  { value: 'tertiary', label: 'Tertiary', description: 'College, polytechnic, or university' },
] as const;

export type SchoolType = (typeof SCHOOL_TYPE_OPTIONS)[number]['value'];

export const SCHOOL_TYPE_VALUES = SCHOOL_TYPE_OPTIONS.map((o) => o.value);

/** Highest tier among selected types (for legacy `school_type` column). */
export function highestSchoolType(types: SchoolType[]): SchoolType {
  const order = SCHOOL_TYPE_VALUES as readonly string[];
  return types.reduce<SchoolType>((highest, type) =>
    order.indexOf(type) > order.indexOf(highest) ? type : highest
  , types[0]);
}

export function formatSchoolTypesLabel(types: SchoolType[]): string {
  if (types.length === 0) return 'Select school types';
  return SCHOOL_TYPE_OPTIONS.filter((o) => types.includes(o.value))
    .map((o) => o.label)
    .join(', ');
}

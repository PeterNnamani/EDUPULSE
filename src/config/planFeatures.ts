/**
 * PLAN FEATURES - single source of truth for subscription tiers.
 *
 * Maps each plan tier to its feature flags, student limit and pricing.
 * Used by useFeatureAccess / FeatureGate (gating) and SubscriptionsPage (pricing).
 */

export type PlanTier = 'starter' | 'growth' | 'enterprise' | 'enterprise_plus';

export type FeatureKey =
  | 'risk_detection'
  | 'counselor'
  | 'interventions'
  | 'duty_attendance'
  | 'teacher_activity'
  | 'advanced_analytics'
  | 'finance_automation'
  | 'virtual_accounts'
  | 'reconciliation'
  | 'audit_logs'
  | 'principal_oversight'
  | 'preschool_assessment'
  | 'birthday_automation'
  | 'school_messaging';

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  maxStudents: number; // Infinity for unlimited
  popular?: boolean;
  tagline: string;
  features: Record<FeatureKey, boolean>;
  /** Human-readable feature bullets for the pricing card. */
  highlights: string[];
}

const ALL_FEATURES: FeatureKey[] = [
  'risk_detection',
  'counselor',
  'interventions',
  'duty_attendance',
  'teacher_activity',
  'advanced_analytics',
  'finance_automation',
  'virtual_accounts',
  'reconciliation',
  'audit_logs',
  'principal_oversight',
  'preschool_assessment',
  'birthday_automation',
  'school_messaging',
];

function featureSet(enabled: FeatureKey[]): Record<FeatureKey, boolean> {
  return ALL_FEATURES.reduce((acc, f) => {
    acc[f] = enabled.includes(f);
    return acc;
  }, {} as Record<FeatureKey, boolean>);
}

export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 49000,
    annualPrice: 490000,
    maxStudents: 300,
    tagline: 'Essentials for small schools',
    features: featureSet(['birthday_automation', 'preschool_assessment']),
    highlights: [
      'Attendance & grade management',
      'Parent portal',
      'Kindergarten assessments',
      'Birthday automation',
      'Up to 300 students',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 99000,
    annualPrice: 990000,
    maxStudents: 1000,
    popular: true,
    tagline: 'For growing schools that need insight',
    features: featureSet([
      'risk_detection',
      'counselor',
      'interventions',
      'teacher_activity',
      'duty_attendance',
      'birthday_automation',
      'preschool_assessment',
      'finance_automation',
    ]),
    highlights: [
      'Everything in Starter',
      'AI risk detection',
      'Counselor & interventions',
      'Teacher activity monitoring',
      'Duty attendance',
      'Finance automation',
      'Up to 1,000 students',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 199000,
    annualPrice: 1990000,
    maxStudents: Infinity,
    tagline: 'Full platform for large institutions',
    features: featureSet([
      'risk_detection',
      'counselor',
      'interventions',
      'teacher_activity',
      'duty_attendance',
      'advanced_analytics',
      'finance_automation',
      'virtual_accounts',
      'reconciliation',
      'audit_logs',
      'principal_oversight',
      'birthday_automation',
      'preschool_assessment',
      'school_messaging',
    ]),
    highlights: [
      'Everything in Growth',
      'Advanced analytics',
      'Virtual accounts (Monnify)',
      'Payment reconciliation',
      'Audit & compliance logs',
      'Principal oversight',
      'School messaging & announcements',
      'Unlimited students',
    ],
  },
  enterprise_plus: {
    id: 'enterprise_plus',
    name: 'Enterprise Plus',
    monthlyPrice: 349000,
    annualPrice: 3490000,
    maxStudents: Infinity,
    tagline: 'Premium support & every feature',
    features: featureSet(ALL_FEATURES),
    highlights: [
      'Everything in Enterprise',
      'School messaging & announcements',
      'Dedicated account manager',
      'Priority feature requests',
      'Custom integrations',
      'Training sessions',
      'Unlimited students',
    ],
  },
};

export const PLAN_ORDER: PlanTier[] = ['starter', 'growth', 'enterprise', 'enterprise_plus'];

/** Annual discount as a percentage vs paying monthly for 12 months. */
export function annualDiscountPct(plan: PlanDefinition): number {
  const monthlyYear = plan.monthlyPrice * 12;
  if (monthlyYear <= 0) return 0;
  return Math.round(((monthlyYear - plan.annualPrice) / monthlyYear) * 100);
}

/** Normalize a stored plan string (incl. legacy values) to a known tier. */
/** Higher rank = higher tier (used when multiple active subscriptions exist). */
export function planTierRank(plan: string | null | undefined): number {
  const tier = normalizePlan(plan);
  const idx = PLAN_ORDER.indexOf(tier);
  return idx >= 0 ? idx : 0;
}

export function normalizePlan(plan: string | null | undefined): PlanTier {
  const p = (plan ?? '').toLowerCase().trim();
  if (p === 'professional') return 'growth';
  if (p === 'lifetime') return 'enterprise_plus';
  if (p === 'starter' || p === 'growth' || p === 'enterprise' || p === 'enterprise_plus') {
    return p;
  }
  return 'starter';
}

export function getPlanDefinition(plan: string | null | undefined): PlanDefinition {
  return PLAN_DEFINITIONS[normalizePlan(plan)];
}

export function planHasFeature(plan: string | null | undefined, feature: FeatureKey): boolean {
  return getPlanDefinition(plan).features[feature];
}

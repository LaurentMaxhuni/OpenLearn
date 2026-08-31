export const DOMAIN_LIMITS = {
  shortText: {
    minLength: 1,
    maxLength: 240,
  },
  longText: {
    minLength: 1,
    maxLength: 4_000,
  },
  boundedOpaqueText: {
    minLength: 1,
    maxLength: 512,
  },
  identifier: {
    minLength: 1,
    maxLength: 128,
  },
  safeHttpsUrl: {
    maxLength: 2_048,
  },
  contextEntries: {
    min: 0,
    max: 50,
  },
  milestones: {
    min: 1,
    max: 50,
  },
  topicsPerPlan: {
    min: 1,
    max: 200,
  },
  planItemsPerPlan: {
    min: 1,
    max: 1_000,
  },
  resourcesPerItem: {
    min: 0,
    max: 20,
  },
  canonicalText: {
    maxLength: 200_000,
  },
} as const;

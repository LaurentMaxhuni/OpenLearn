import type { LearnerActionState } from '@openlearn/ui';

export type ActionStatesByPlan = Readonly<
  Record<string, Readonly<Record<string, LearnerActionState>>>
>;

export const actionStatesForPlan = (
  states: ActionStatesByPlan,
  planId: string,
): Readonly<Record<string, LearnerActionState>> => states[planId] ?? {};

export const setActionState = (
  states: ActionStatesByPlan,
  planId: string,
  itemId: string,
  state: LearnerActionState,
): ActionStatesByPlan => ({
  ...states,
  [planId]: {
    ...(states[planId] ?? {}),
    [itemId]: state,
  },
});

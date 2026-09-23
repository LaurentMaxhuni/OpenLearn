import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  acceptedNoProgressFixture,
  brandIdentifier,
} from '@openlearn/domain';
import {
  createApplication,
  createPersonalizationApplication,
  type ActorContext,
} from '@openlearn/application';
import {
  createPostgresApplicationState,
  createPostgresPool,
  runMigrations,
} from '../src/index.js';

const connectionString = process.env.OPENLEARN_TEST_DATABASE_URL;

test('PostgreSQL persists plans, progress, personalization, and owner isolation', {
  skip: connectionString === undefined,
}, async () => {
  if (connectionString === undefined) return;

  const pool = createPostgresPool({ connectionString, max: 4 });
  const ownerResult = brandIdentifier('internal_owner', `owner-integration-${randomUUID()}`);
  if (!ownerResult.ok) throw new Error('Could not create an integration-test owner.');
  const ownerId = ownerResult.value;
  const actor: ActorContext = {
    ownerId,
    scopes: [
      'plan:read',
      'plan:write',
      'progress:write',
      'personalization:read',
      'personalization:write',
    ],
    actorClass: 'dashboard_session',
  };
  const allocator = { allocate: (kind: string) => `integration-${kind}-${randomUUID()}` };
  const clock = { now: () => new Date() };
  const operationIds = { next: () => randomUUID() };

  try {
    const migrations = await runMigrations(pool);
    assert.ok(migrations.applied.length <= 1);
    const migrationRecord = await pool.query(
      'SELECT version FROM openlearn_schema_migrations WHERE version = $1',
      [1],
    );
    assert.equal(migrationRecord.rowCount, 1);

    const state = createPostgresApplicationState({ pool, clock });
    const application = createApplication({
      state,
      allocator,
      clock,
      operationIds,
      dashboardOrigin: 'https://dashboard.example.test',
    });
    const personalization = createPersonalizationApplication({
      planReader: state,
      state,
      allocator,
      clock,
      operationIds,
    });
    const fixture = acceptedNoProgressFixture();
    const { missingOptionalPaths: _missingOptionalPaths, ...candidate } = fixture.content;
    const created = await application.createPlanView(actor, {
      idempotencyKey: `create-${randomUUID()}`,
      candidate,
      acceptedAt: new Date().toISOString(),
    });
    assert.equal(created.outcome, 'succeeded');
    if (created.value === undefined) throw new Error('Plan creation returned no handoff.');

    const listed = await application.listPlanViews?.(actor);
    assert.equal(listed?.outcome, 'succeeded');
    assert.equal(listed?.value?.length, 1);
    assert.equal(listed?.value?.[0]?.goalTitle, fixture.content.goal.title);

    const itemId = fixture.content.milestones[0]?.topics[0]?.items[0]?.itemId;
    if (itemId === undefined) throw new Error('The fixture has no progress item.');
    const confirmedAt = new Date().toISOString();
    const progress = await Promise.all([
      application.applyProgressAction(actor, {
        planId: created.value.planId,
        itemId,
        action: 'start_item',
        expectedRevisionId: created.value.revisionId,
        expectedProgressVersion: 0,
        idempotencyKey: `progress-a-${randomUUID()}`,
        confirmedAt,
      }),
      application.applyProgressAction(actor, {
        planId: created.value.planId,
        itemId,
        action: 'start_item',
        expectedRevisionId: created.value.revisionId,
        expectedProgressVersion: 0,
        idempotencyKey: `progress-b-${randomUUID()}`,
        confirmedAt,
      }),
    ]);
    assert.deepEqual(
      progress.map((result) => result.outcome).sort(),
      ['conflict', 'succeeded'],
    );

    const initialPersonalization = await personalization.getPersonalization(actor, {
      planId: created.value.planId,
    });
    assert.equal(initialPersonalization.value?.consent.state, 'disabled');
    const consent = await personalization.changePersonalizationConsent(actor, {
      planId: created.value.planId,
      action: 'enable',
      expectedStateVersion: 0,
    });
    assert.equal(consent.outcome, 'succeeded');
    const feedback = await personalization.recordLearnerFeedback(actor, {
      planId: created.value.planId,
      area: 'difficulty',
      value: 'too_hard',
      expectedStateVersion: 1,
    });
    assert.equal(feedback.outcome, 'succeeded');
    const persistedPersonalization = await personalization.getPersonalization(actor, {
      planId: created.value.planId,
    });
    assert.equal(persistedPersonalization.value?.stateVersion, 2);
    assert.equal(persistedPersonalization.value?.feedback.length, 1);

    const otherOwnerResult = brandIdentifier('internal_owner', `owner-integration-${randomUUID()}`);
    if (!otherOwnerResult.ok) throw new Error('Could not create a second integration-test owner.');
    const otherActor: ActorContext = { ...actor, ownerId: otherOwnerResult.value };
    const hidden = await application.getPlanView(otherActor, { planId: created.value.planId });
    assert.equal(hidden.error?.code, 'unavailable');
  } finally {
    try {
      await pool.query('DELETE FROM openlearn_operations WHERE owner_id = $1', [ownerId]);
      await pool.query('DELETE FROM openlearn_mutation_markers WHERE owner_id = $1', [ownerId]);
      await pool.query('DELETE FROM openlearn_plan_tombstones WHERE owner_id = $1', [ownerId]);
      await pool.query('DELETE FROM openlearn_plans WHERE owner_id = $1', [ownerId]);
    } finally {
      await pool.end();
    }
  }
});

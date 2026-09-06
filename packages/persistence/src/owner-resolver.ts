import type { InternalOwnerId } from '@openlearn/domain';
import type { Clock } from '@openlearn/application';
import type { SqlPool } from './sql.js';

export interface ExternalPrincipal {
  readonly issuer: string;
  readonly subject: string;
}

export interface PrincipalOwnerResolver {
  resolve(principal: ExternalPrincipal): Promise<InternalOwnerId | undefined>;
  provision(
    principal: ExternalPrincipal,
    ownerId: InternalOwnerId,
  ): Promise<InternalOwnerId>;
  revoke(principal: ExternalPrincipal): Promise<boolean>;
}

const requirePrincipal = (principal: ExternalPrincipal): void => {
  if (
    principal.issuer.length === 0 ||
    principal.issuer.length > 2048 ||
    principal.subject.length === 0 ||
    principal.subject.length > 512
  ) {
    throw new Error('External principal is outside the supported bounds.');
  }
}

export const createPostgresPrincipalResolver = (options: {
  readonly pool: SqlPool;
  readonly clock?: Clock;
}): PrincipalOwnerResolver => {
  const now = () => (options.clock?.now() ?? new Date()).toISOString();

  const resolve = async (
    principal: ExternalPrincipal,
  ): Promise<InternalOwnerId | undefined> => {
    requirePrincipal(principal);
    const result = await options.pool.query(
      `UPDATE openlearn_identity_principals SET last_seen_at = $3
       WHERE issuer = $1 AND subject = $2
       RETURNING owner_id`,
      [principal.issuer, principal.subject, now()],
    );
    const ownerId = result.rows[0]?.owner_id;
    return typeof ownerId === 'string' ? ownerId as InternalOwnerId : undefined;
  };

  const provision = async (
    principal: ExternalPrincipal,
    ownerId: InternalOwnerId,
  ): Promise<InternalOwnerId> => {
    requirePrincipal(principal);
    if (ownerId.length === 0 || ownerId.length > 128) {
      throw new Error('Internal owner id is outside the supported bounds.');
    }
    const result = await options.pool.query(
      `INSERT INTO openlearn_identity_principals
        (issuer, subject, owner_id, created_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (issuer, subject) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
       RETURNING owner_id`,
      [principal.issuer, principal.subject, ownerId, now()],
    );
    const resolved = result.rows[0]?.owner_id;
    if (typeof resolved !== 'string') {
      throw new Error('Identity principal could not be provisioned.');
    }
    return resolved as InternalOwnerId;
  };

  const revoke = async (principal: ExternalPrincipal): Promise<boolean> => {
    requirePrincipal(principal);
    const result = await options.pool.query(
      'DELETE FROM openlearn_identity_principals WHERE issuer = $1 AND subject = $2',
      [principal.issuer, principal.subject],
    );
    return (result.rowCount ?? result.rows.length) === 1;
  };

  return { resolve, provision, revoke };
};

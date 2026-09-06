import type { InternalOwnerId } from '@openlearn/domain';
import type { ExternalPrincipal, PrincipalResolver } from './authenticator.js';

const key = (principal: ExternalPrincipal): string =>
  `${principal.issuer}\u0000${principal.subject}`;

export const createStaticPrincipalResolver = (
  entries: readonly {
    readonly issuer: string;
    readonly subject: string;
    readonly ownerId: InternalOwnerId;
  }[],
): PrincipalResolver => {
  const owners = new Map(
    entries.map((entry) => [key(entry), entry.ownerId] as const),
  );
  return {
    async resolve(principal) {
      return owners.get(key(principal));
    },
  };
};

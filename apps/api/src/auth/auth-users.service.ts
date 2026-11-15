import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users } from '../database/schema.js';

type GoogleIdentity = {
  provider: 'google';
  subject: string;
  email: string;
  name: string | null;
};

@Injectable()
export class AuthUsersService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async findOrCreate(identity: GoogleIdentity) {
    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.googleSubject, identity.subject))
      .limit(1);
    if (existing) return existing;

    const [created] = await this.db
      .insert(users)
      .values({
        googleSubject: identity.subject,
        email: identity.email,
        name: (identity.name?.trim() || identity.email).slice(0, 120),
      })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    // Another callback may have created the same Google user concurrently.
    const [concurrent] = await this.db
      .select()
      .from(users)
      .where(eq(users.googleSubject, identity.subject))
      .limit(1);
    if (concurrent) return concurrent;

    // Never link an existing account based only on a matching email.
    throw new ConflictException(
      'Unable to create an account for this Google identity',
    );
  }
}

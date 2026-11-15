import { ConflictException } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { AuthUsersService } from './auth-users.service.js';

describe('AuthUsersService', () => {
  const identity = {
    provider: 'google' as const,
    subject: 'google-sub',
    email: 'user@example.com',
    name: 'User',
  };
  const user = {
    id: 'user-id',
    googleSubject: identity.subject,
    email: identity.email,
    name: 'User',
  };
  const limit = vi.fn();
  const returning = vi.fn();
  const values = vi.fn();
  const insert = vi.fn();
  let service: AuthUsersService;

  beforeEach(async () => {
    vi.resetAllMocks();
    values.mockReturnValue({ onConflictDoNothing: () => ({ returning }) });
    insert.mockReturnValue({ values });
    const module = await Test.createTestingModule({
      providers: [
        AuthUsersService,
        {
          provide: getDrizzleToken(),
          useValue: {
            select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
            insert,
          },
        },
      ],
    }).compile();
    service = module.get(AuthUsersService);
  });

  it('returns the existing Google user without inserting', async () => {
    limit.mockResolvedValue([user]);
    await expect(service.findOrCreate(identity)).resolves.toEqual(user);
    expect(insert).not.toHaveBeenCalled();
  });

  it('creates a user on first login', async () => {
    limit.mockResolvedValue([]);
    returning.mockResolvedValue([user]);
    await expect(service.findOrCreate(identity)).resolves.toEqual(user);
    expect(values).toHaveBeenCalledWith({
      googleSubject: identity.subject,
      email: identity.email,
      name: identity.name,
    });
  });

  it('uses email as the name when Google provides no name', async () => {
    limit.mockResolvedValue([]);
    returning.mockResolvedValue([user]);
    await service.findOrCreate({ ...identity, name: null });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ name: identity.email }),
    );
  });

  it('handles concurrent creation of the same Google user', async () => {
    limit.mockResolvedValueOnce([]).mockResolvedValueOnce([user]);
    returning.mockResolvedValue([]);
    await expect(service.findOrCreate(identity)).resolves.toEqual(user);
  });

  it('does not link accounts by email after a uniqueness conflict', async () => {
    limit.mockResolvedValue([]);
    returning.mockResolvedValue([]);
    await expect(service.findOrCreate(identity)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

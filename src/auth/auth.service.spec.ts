import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AccountLockoutService } from './services/account-lockout.service';
import { faker } from '@faker-js/faker';

describe('AuthService', () => {
  let service: AuthService;
  let mockUsersService: Partial<UsersService>;
  let mockLockoutService: Partial<AccountLockoutService>;

  beforeEach(async () => {
    mockUsersService = {
      findByEmailOrPhoneNumber: jest.fn().mockResolvedValue({
        id: faker.string.uuid(),
        password: 'valid-password'
      })
    };

    mockLockoutService = {
      isAccountLocked: jest.fn().mockResolvedValue(false),
      resetAttempts: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: AccountLockoutService, useValue: mockLockoutService }
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('validates user with correct credentials', async () => {
    const user = await service.validateUser('test@example.com', 'valid-password');
    expect(user).toBeDefined();
    expect(mockLockoutService.resetAttempts).toHaveBeenCalled();
  });

  it('rejects invalid credentials', async () => {
    mockUsersService.findByEmailOrPhoneNumber = jest.fn().mockResolvedValue(null);
    await expect(service.validateUser('invalid@test.com', 'wrong-pass'))
      .rejects.toThrow('Invalid credentials');
  });
});

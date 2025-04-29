import { RedisHealth } from './redis-health';

describe('RedisHealth', () => {
  it('should be defined', () => {
    expect(new RedisHealth()).toBeDefined();
  });
});

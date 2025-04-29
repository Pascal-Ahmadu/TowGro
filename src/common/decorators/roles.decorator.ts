import { SetMetadata } from '@nestjs/common';

// Add export keyword if missing
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
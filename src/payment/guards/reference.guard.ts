import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ReferenceGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const reference = request.params.reference;

    // Check if reference exists
    if (!reference) {
      throw new BadRequestException('Reference parameter is required');
    }

    // Validate reference format
    const validReferenceRegex = /^[a-zA-Z0-9_-]{3,100}$/;
    if (!validReferenceRegex.test(reference)) {
      throw new BadRequestException(
        'Reference must contain only alphanumeric characters, underscores, and hyphens, and be between 3-100 characters',
      );
    }

    return true;
  }
}

import { Injectable, NestMiddleware, PayloadTooLargeException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import * as bytes from 'bytes';

@Injectable()
export class RequestSizeLimitMiddleware implements NestMiddleware {
  private readonly maxSize: number;

  constructor(private readonly configService: ConfigService) {
    // Default to 1MB if not specified
    const configSize = this.configService.get<string>('MAX_REQUEST_SIZE', '1mb');
    this.maxSize = bytes.parse(configSize);
  }

  use(req: Request, res: Response, next: NextFunction) {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > this.maxSize) {
      throw new PayloadTooLargeException(
        `Request body too large (${bytes.format(contentLength)}). Maximum size allowed is ${bytes.format(this.maxSize)}.`
      );
    }
    
    next();
  }
}
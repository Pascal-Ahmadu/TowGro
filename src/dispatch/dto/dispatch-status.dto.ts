// dto/dispatch-status.dto.ts
import { IsNotEmpty, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for updating dispatch status
 */
export class DispatchStatusDto {
  @ApiProperty({
    description: 'UUID of the dispatch to update',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  readonly dispatchId: string;

  @ApiProperty({
    description: 'Updated status of the dispatch',
    enum: [
      'pending',
      'assigned',
      'en_route',
      'in_progress',
      'completed',
      'cancelled',
      'payment_pending',
      'payment_completed',
      'failed',
    ],
    example: 'assigned',
  })
  @IsEnum(
    [
      'pending',
      'assigned',
      'en_route',
      'in_progress',
      'completed',
      'cancelled',
      'payment_pending',
      'payment_completed',
      'failed',
    ],
    {
      message: 'Status must be a valid dispatch status',
    },
  )
  @IsNotEmpty()
  readonly status: string;
}

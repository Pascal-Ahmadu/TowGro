import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';
import { CreateDispatchDto } from './dto/create-dispatch.dto';
import { DispatchStatusDto } from './dto/dispatch-status.dto';
import { Dispatch } from './entities/dispatch.entity';

/**
 * Controller for dispatch-related API endpoints
 */
@ApiTags('dispatch')
@Controller('dispatch')
@UseInterceptors(ClassSerializerInterceptor)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  /**
   * Creates a new dispatch request
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new dispatch request' })
  @ApiCreatedResponse({
    description: 'The dispatch has been successfully created',
    type: Dispatch,
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async create(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    createDispatchDto: CreateDispatchDto,
  ): Promise<Dispatch> {
    return this.dispatchService.createDispatch(createDispatchDto);
  }

  /**
   * Retrieves the status of a dispatch by ID
   */
  @Get(':id/status')
  @ApiOperation({ summary: 'Get dispatch status by ID' })
  @ApiParam({ name: 'id', description: 'Dispatch UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns the status of the dispatch',
    type: DispatchStatusDto,
  })
  @ApiNotFoundResponse({ description: 'Dispatch not found' })
  @ApiBadRequestResponse({ description: 'Invalid UUID format' })
  async getStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<DispatchStatusDto> {
    return this.dispatchService.getDispatchStatus(id);
  }

  /**
   * Updates the status of a dispatch
   */
  @Patch('status')
  @ApiOperation({ summary: 'Update dispatch status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The dispatch status has been successfully updated',
    type: Dispatch,
  })
  @ApiNotFoundResponse({ description: 'Dispatch not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async updateStatus(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    statusDto: DispatchStatusDto,
  ): Promise<Dispatch> {
    return this.dispatchService.updateDispatchStatus(statusDto);
  }
}

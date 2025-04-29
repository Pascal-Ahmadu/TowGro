import { Controller, Get, Res } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { Response } from 'express';

@Controller('metrics')
export class MetricsController extends PrometheusController {
  @Public()
  @Get()
  getMetrics(@Res() response: Response) {
    return super.index(response);
  }
}

import { Module } from '@nestjs/common';
import { HealthService } from './health.service.js';

@Module({
  providers: [HealthService],
})
export class HealthModule {}

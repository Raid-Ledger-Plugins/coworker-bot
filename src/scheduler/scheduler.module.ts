import { Module } from '@nestjs/common';
import { VisitModule } from '../visit/visit.module.js';
import { SchedulerService } from './scheduler.service.js';
import { VisitEligibilityService } from './visit-eligibility.service.js';

@Module({
  imports: [VisitModule],
  providers: [SchedulerService, VisitEligibilityService],
  exports: [SchedulerService, VisitEligibilityService],
})
export class SchedulerModule {}

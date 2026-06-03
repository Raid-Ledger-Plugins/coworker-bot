import { Module } from '@nestjs/common';
import { VisitModule } from '../visit/visit.module.js';
import { TextModule } from '../text/text.module.js';
import { SchedulerService } from './scheduler.service.js';
import { VisitEligibilityService } from './visit-eligibility.service.js';

@Module({
  imports: [VisitModule, TextModule],
  providers: [SchedulerService, VisitEligibilityService],
  exports: [SchedulerService, VisitEligibilityService],
})
export class SchedulerModule {}

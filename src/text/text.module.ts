import { Module } from '@nestjs/common';
import { LinesModule } from '../lines/lines.module.js';
import { ListenerModule } from '../listener/listener.module.js';
import { TextContextService } from './text-context.service.js';
import { TextEligibilityService } from './text-eligibility.service.js';
import { TextPostOrchestratorService } from './text-post-orchestrator.service.js';

@Module({
  imports: [LinesModule, ListenerModule],
  providers: [
    TextContextService,
    TextEligibilityService,
    TextPostOrchestratorService,
  ],
  exports: [TextEligibilityService, TextPostOrchestratorService],
})
export class TextModule {}

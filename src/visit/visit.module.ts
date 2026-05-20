import { Module } from '@nestjs/common';
import { ClipsModule } from '../clips/clips.module.js';
import { ListenerModule } from '../listener/listener.module.js';
import { VisitOrchestratorService } from './visit-orchestrator.service.js';

@Module({
  imports: [ClipsModule, ListenerModule],
  providers: [VisitOrchestratorService],
  exports: [VisitOrchestratorService],
})
export class VisitModule {}

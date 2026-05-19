import { Module } from '@nestjs/common';
import { ClipsModule } from '../clips/clips.module.js';
import { VisitOrchestratorService } from './visit-orchestrator.service.js';
import { VoiceActivityService } from '../voice-activity/voice-activity.service.js';

@Module({
  imports: [ClipsModule],
  providers: [VisitOrchestratorService, VoiceActivityService],
  exports: [VisitOrchestratorService],
})
export class VisitModule {}

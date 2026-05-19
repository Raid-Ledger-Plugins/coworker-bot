import { Module } from '@nestjs/common';
import { ClipsModule } from '../clips/clips.module.js';
import { VisitModule } from '../visit/visit.module.js';
import { CoworkerCommandsService } from './coworker.commands.js';

@Module({
  imports: [ClipsModule, VisitModule],
  providers: [CoworkerCommandsService],
  exports: [CoworkerCommandsService],
})
export class CommandsModule {}

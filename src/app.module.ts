import { Module } from '@nestjs/common';
import { BotModule } from './bot/bot.module.js';
import { ClipsModule } from './clips/clips.module.js';
import { LinesModule } from './lines/lines.module.js';
import { CommandsModule } from './commands/commands.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { StateModule } from './state/state.module.js';
import { TextModule } from './text/text.module.js';
import { VisitModule } from './visit/visit.module.js';

@Module({
  imports: [
    StateModule,
    BotModule,
    ClipsModule,
    LinesModule,
    VisitModule,
    TextModule,
    SchedulerModule,
    CommandsModule,
  ],
})
export class AppModule {}

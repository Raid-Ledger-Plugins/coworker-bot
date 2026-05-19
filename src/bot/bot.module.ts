import { Global, Module } from '@nestjs/common';
import { DiscordClientService } from './discord-client.service.js';

@Global()
@Module({
  providers: [DiscordClientService],
  exports: [DiscordClientService],
})
export class BotModule {}

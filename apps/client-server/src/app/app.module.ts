import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccountModule } from './account/account.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [AccountModule, WebsocketModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

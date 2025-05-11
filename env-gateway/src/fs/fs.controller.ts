import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload, Transport } from '@nestjs/microservices';
import { FSCloseRequest, FSDocSyncEvent, FSExtEvent, FSOpenRequest, Message } from 'src/common/message';
import { FSService } from './fs.service';
import { promises as fs } from 'node:fs';
import { SyncService } from './sync.service';

@Controller('api')
export class FSController {
  root = '/home/devuser/workspace';

  constructor(
    private readonly fsService: FSService,
    private readonly syncService: SyncService,
  ) {}

  @MessagePattern('fs:open', Transport.REDIS)
  async fsOpen(@Payload() msg: Message<FSOpenRequest>) {
    const path = this.root + msg.payload.path;
    try {
      const stat = await fs.stat(path);
      if (stat.isDirectory()) {
        return await this.fsService.openDir(msg.meta.uid, path);
      }
      return this.syncService.openFile(msg.meta.uid, path);
    } catch (err) {
      console.log(err);
      return [];
    }
  }

  @MessagePattern('fs:close', Transport.REDIS)
  async fsClose(@Payload() msg: Message<FSCloseRequest>) {
    const path = this.root + msg.payload.path;
    try {
      const stat = await fs.stat(path);
      if (stat.isDirectory()) {
        return this.fsService.closeDir(msg.meta.uid, path);
      }
      return this.syncService.closeFile(msg.meta.uid, path);
    } catch (err) {
      console.log(err);
      return;
    }
  }

  @EventPattern('watch-event', Transport.REDIS)
  handleEvent(@Payload() event: FSExtEvent) {
    this.fsService.handleEvent(event);
  }

  @EventPattern('fs:sync', Transport.REDIS)
  handleFSUpdate(@Payload() msg: Message<FSDocSyncEvent>) {
    this.syncService.handleFSUpdate(msg);
  }
}

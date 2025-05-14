import { promises as fs } from 'node:fs';
import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload, Transport } from '@nestjs/microservices';
import {
  EnvPingEvent,
  FSCloseRequest,
  FSDocSyncEvent,
  FSExtEvent,
  FSOpenRequest,
  FSSaveRequest,
  Message,
} from 'src/common/message';
import { FSService } from './fs.service';
import { SyncService } from './sync.service';

@Controller('api')
export class GatewayController {
  root = '/home/devuser/workspace';

  constructor(
    private readonly fsService: FSService,
    private readonly syncService: SyncService,
  ) {}

  @EventPattern('env.ping', Transport.REDIS)
  handleHeartbeat(@Payload() msg: Message<EnvPingEvent>) {
    this.fsService.handleHeartbeat(msg.meta.uid);
  }
  @MessagePattern('env.shutdown', Transport.REDIS)
  shutdown() {
    this.fsService.dispose();
  }

  @MessagePattern('env.fs.open', Transport.REDIS)
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
  @MessagePattern('env.fs.close', Transport.REDIS)
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
  @EventPattern('env.fs.watch', Transport.REDIS)
  handleEvent(@Payload() event: FSExtEvent) {
    this.fsService.handleEvent(event);
  }

  @EventPattern('env.fs.sync', Transport.REDIS)
  handleFSUpdate(@Payload() msg: Message<FSDocSyncEvent>) {
    this.syncService.handleFSUpdate(msg);
  }
  @EventPattern('env.fs.save', Transport.REDIS)
  async handleFSSave(@Payload() msg: Message<FSSaveRequest>) {
    await this.syncService.handleFSSave(msg);
  }
}

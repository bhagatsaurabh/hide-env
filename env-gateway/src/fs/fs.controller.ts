import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload, Transport } from '@nestjs/microservices';
import { FSCloseRequest, FSExtEvent, FSOpenRequest, Message } from 'src/common/message';
import { FSService } from './fs.service';

@Controller('api/fs')
export class FSController {
  constructor(private readonly fsService: FSService) {}

  @MessagePattern('fs:open', Transport.REDIS)
  async fsOpen(@Payload() msg: Message<FSOpenRequest>) {
    return await this.fsService.open(msg.meta.uid, msg.payload.path);
  }

  @MessagePattern('fs:close', Transport.REDIS)
  fsClose(@Payload() msg: Message<FSCloseRequest>) {
    return this.fsService.close(msg.meta.uid, msg.payload.path);
  }

  @EventPattern('watch-event', Transport.REDIS)
  handleEvent(@Payload() event: FSExtEvent) {
    this.fsService.handleEvent(event);
  }
}

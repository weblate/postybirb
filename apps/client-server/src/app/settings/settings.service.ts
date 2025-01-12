import { InjectRepository } from '@mikro-orm/nestjs';
import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { SETTINGS_UPDATES } from '@postybirb/socket-events';
import {
  StartupOptions,
  getStartupOptions,
  setStartupOptions,
} from '@postybirb/utils/electron';
// eslint-disable-next-line import/no-extraneous-dependencies
import { PostyBirbService } from '../common/service/postybirb-service';
import { Settings } from '../database/entities';
import { PostyBirbRepository } from '../database/repositories/postybirb-repository';
import { DatabaseUpdateSubscriber } from '../database/subscribers/database.subscriber';
import { WSGateway } from '../web-socket/web-socket-gateway';
import { UpdateSettingsDto } from './dtos/update-settings.dto';
import { SettingsConstants } from './settings.constants';

@Injectable()
export class SettingsService
  extends PostyBirbService<Settings>
  implements OnModuleInit
{
  constructor(
    dbSubscriber: DatabaseUpdateSubscriber,
    @InjectRepository(Settings)
    repository: PostyBirbRepository<Settings>,
    @Optional() webSocket: WSGateway
  ) {
    super(repository, webSocket);
    repository.addUpdateListener(dbSubscriber, [Settings], () => this.emit());
  }

  /**
   * Initializes default settings if required.
   */
  async onModuleInit() {
    if (
      !(await this.repository.count({
        profile: SettingsConstants.DEFAULT_PROFILE_NAME,
      }))
    ) {
      this.createDefaultAccount();
    }
  }

  // Not sure if we'll ever need this
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  create(createDto: unknown): Promise<Settings> {
    throw new Error('Method not implemented.');
  }

  /**
   * Creates the default settings record.
   */
  private createDefaultAccount() {
    const entity = this.repository.create({
      profile: SettingsConstants.DEFAULT_PROFILE_NAME,
      settings: SettingsConstants.DEFAULT_SETTINGS,
    });

    this.repository
      .persistAndFlush(entity)
      .then(() => {
        this.logger.withMetadata(entity).debug('Default settings created');
      })
      .catch((err: Error) => {
        this.logger.withError(err).error('Unablet to create default settings');
      });
  }

  /**
   * Emits settings.
   */
  async emit() {
    super.emit({
      event: SETTINGS_UPDATES,
      data: await this.findAll(),
    });
  }

  public getStartupSettings() {
    return getStartupOptions();
  }

  /**
   * Updates app startup settings.
   */
  public updateStartupSettings(startUpOptions: Partial<StartupOptions>) {
    if (startUpOptions.appDataPath) {
      // eslint-disable-next-line no-param-reassign
      startUpOptions.appDataPath = startUpOptions.appDataPath.trim();
    }

    if (startUpOptions.port) {
      // eslint-disable-next-line no-param-reassign
      startUpOptions.port = startUpOptions.port.trim();
      const port = parseInt(startUpOptions.port, 10);
      if (Number.isNaN(port) || port < 1024 || port > 65535) {
        throw new BadRequestException('Invalid port');
      }
    }

    setStartupOptions({ ...startUpOptions });
  }

  /**
   * Updates a settings profile.
   *
   * @param {UpdateSettingsDto} updateSettingsDto
   */
  async update(id: string, updateSettingsDto: UpdateSettingsDto) {
    this.logger
      .withMetadata(updateSettingsDto)
      .info(`Updating Settings '${id}'`);
    return this.repository.update(id, updateSettingsDto);
  }
}

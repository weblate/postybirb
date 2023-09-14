/* eslint-disable no-param-reassign */
import { serialize, wrap } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { SUBMISSION_UPDATES } from '@postybirb/socket-events';
import {
  FileSubmission,
  FileSubmissionMetadata,
  MessageSubmission,
  ScheduleType,
  SubmissionMetadataType,
  SubmissionType,
} from '@postybirb/types';
import { v4 } from 'uuid';
import { PostyBirbService } from '../../common/service/postybirb-service';
import { Submission } from '../../database/entities';
import { PostyBirbRepository } from '../../database/repositories/postybirb-repository';
import { MulterFileInfo } from '../../file/models/multer-file-info';
import { WSGateway } from '../../web-socket/web-socket-gateway';
import { WebsiteOptionsService } from '../../website-options/website-options.service';
import { CreateSubmissionDto } from '../dtos/create-submission.dto';
import { UpdateSubmissionDto } from '../dtos/update-submission.dto';
import { FileSubmissionService } from './file-submission.service';
import { MessageSubmissionService } from './message-submission.service';

type SubmissionEntity = Submission<SubmissionMetadataType>;

/**
 * Service that handles the vast majority of submission management logic.
 *
 * @class SubmissionService
 */
@Injectable()
export class SubmissionService extends PostyBirbService<SubmissionEntity> {
  constructor(
    @InjectRepository(Submission)
    repository: PostyBirbRepository<SubmissionEntity>,
    @Inject(forwardRef(() => WebsiteOptionsService))
    private readonly submissionOptionsService: WebsiteOptionsService,
    private readonly fileSubmissionService: FileSubmissionService,
    private readonly messageSubmissionService: MessageSubmissionService,
    @Optional() webSocket: WSGateway
  ) {
    super(repository, webSocket);
  }

  /**
   * Emits submissions onto websocket.
   */
  public async emit() {
    super.emit({
      event: SUBMISSION_UPDATES,
      data: (await this.findAll()).map((s) => s.toJSON()),
    });
  }

  /**
   * Creates a submission.
   * @todo need to make transactional
   *
   * @param {CreateSubmissionDto} createSubmissionDto
   * @param {MulterFileInfo} [file]
   * @return {*}  {Promise<Submission<SubmissionMetadataType>>}
   */
  async create(
    createSubmissionDto: CreateSubmissionDto,
    file?: MulterFileInfo
  ): Promise<SubmissionEntity> {
    this.logger.info(createSubmissionDto, 'Creating Submission');
    const submission = this.repository.create({
      ...createSubmissionDto,
      isScheduled: false,
      schedule: {
        scheduledFor: undefined,
        scheduleType: ScheduleType.NONE,
      },
      options: [],
      metadata: {},
    });

    switch (createSubmissionDto.type) {
      case SubmissionType.MESSAGE: {
        if (file) {
          throw new BadRequestException(
            'A file was provided for SubmissionType Message.'
          );
        }

        await this.messageSubmissionService.populate(
          submission as MessageSubmission,
          createSubmissionDto
        );
        break;
      }

      case SubmissionType.FILE: {
        if (!file) {
          throw new BadRequestException(
            'No file provided for SubmissionType FILE.'
          );
        }

        await this.fileSubmissionService.populate(
          submission as FileSubmission,
          createSubmissionDto,
          file
        );
        break;
      }

      default: {
        throw new BadRequestException(
          `Unknown SubmissionType: ${createSubmissionDto.type}.`
        );
      }
    }

    let name = 'New submission';
    if (createSubmissionDto.name) {
      name = createSubmissionDto.name;
    } else if (file) {
      name = file.filename;
    }

    submission.options.add(
      await this.submissionOptionsService.createDefaultSubmissionOptions(
        submission,
        name
      )
    );

    await this.repository.persistAndFlush(submission);
    this.emit();
    return submission;
  }

  async update(id: string, update: UpdateSubmissionDto) {
    this.logger.info(update, `Updating Submission '${id}'`);
    const submission = await this.findById(id, { failOnMissing: true });

    submission.isScheduled = update.isScheduled ?? submission.isScheduled;
    submission.schedule = {
      scheduledFor: update.scheduledFor ?? submission.schedule.scheduledFor,
      scheduleType: update.scheduleType ?? submission.schedule.scheduleType,
    };
    submission.metadata = {
      ...submission.metadata,
      ...update.metadata,
    };

    const optionChanges: Promise<unknown>[] = [];

    // Removes unused website options
    if (update.deletedWebsiteOptions?.length) {
      update.deletedWebsiteOptions.forEach((deletedOptionId) => {
        optionChanges.push(
          this.submissionOptionsService.remove(deletedOptionId)
        );
      });
    }

    // Creates or updates new website options
    if (update.newOrUpdatedOptions?.length) {
      update.newOrUpdatedOptions.forEach((option) => {
        if (option.createdAt) {
          optionChanges.push(
            this.submissionOptionsService.update(option.id, {
              data: option.data,
            })
          );
        } else {
          optionChanges.push(
            this.submissionOptionsService.create({
              account: option.account,
              data: option.data,
              submission: submission.id,
            })
          );
        }
      });
    }

    await Promise.allSettled(optionChanges);

    try {
      await this.repository.flush();
      this.emit();
      return await this.findById(id);
    } catch (err) {
      throw new BadRequestException(err);
    }
  }

  public async remove(id: string) {
    await super.remove(id);
    this.emit();
  }

  /**
   * Duplicates a submission.
   * @param {string} id
   */
  public async duplicate(id: string) {
    this.logger.info(`Duplicating Submission '${id}'`);
    const entityToDuplicate = await this.repository.findOne(
      { id },
      { populate: true }
    );

    if (!entityToDuplicate) {
      throw new NotFoundException(`No entity with id '${id}' found`);
    }

    const copy = serialize(entityToDuplicate, {
      populate: true,
      ignoreSerializers: true,
    });
    copy.id = v4();
    copy.options.forEach((option) => {
      option.id = v4();
      delete option.submission;
    });
    const metadata = copy.metadata as FileSubmissionMetadata;
    copy.files.forEach((fileEntity) => {
      delete fileEntity.submission;
      const oldId = fileEntity.id;
      // Fix metadata
      const index = metadata.order.findIndex(
        (fileId) => fileId === fileEntity.id
      );
      fileEntity.id = v4();
      if (index > -1) {
        metadata.order[index] = fileEntity.id;
      }

      if (metadata.fileMetadata[oldId]) {
        metadata.fileMetadata[fileEntity.id] = metadata.fileMetadata[oldId];
        delete metadata.fileMetadata[oldId];
      }

      if (fileEntity.altFile) {
        fileEntity.altFile.id = v4();
        delete fileEntity.altFile.parent;
      }

      if (fileEntity.file) {
        fileEntity.file.id = v4();
        delete fileEntity.file.parent;
      }

      if (fileEntity.thumbnail) {
        fileEntity.thumbnail.id = v4();
        delete fileEntity.thumbnail.parent;
      }
    });

    const created = this.repository.create(copy);
    await this.repository.persistAndFlush(created);
    this.emit();
  }
}

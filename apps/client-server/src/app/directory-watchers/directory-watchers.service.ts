import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DirectoryWatcherImportAction, SubmissionType } from '@postybirb/types';
import { readFile, readdir, stat, writeFile } from 'fs/promises';
import { getType } from 'mime';
import { join } from 'path';
import { PostyBirbService } from '../common/service/postybirb-service';
import { DirectoryWatcher } from '../database/entities';
import { PostyBirbRepository } from '../database/repositories/postybirb-repository';
import { MulterFileInfo } from '../file/models/multer-file-info';
import { SubmissionService } from '../submission/services/submission.service';
import { IsTestEnvironment } from '../utils/test.util';
import { WSGateway } from '../web-socket/web-socket-gateway';
import { CreateDirectoryWatcherDto } from './dtos/create-directory-watcher.dto';
import { UpdateDirectoryWatcherDto } from './dtos/update-directory-watcher.dto';
import { FileSubmissionService } from '../submission/services/file-submission.service';

type WatcherMetadata = {
  read: string[];
};

/**
 * A directory watcher service that reads created watchers and checks
 * for new files added to the folder.
 *
 * If a new file is detected it will attempt to process it.
 *
 * @class DirectoryWatchersService
 * @extends {PostyBirbService<DirectoryWatcher>}
 */
@Injectable()
export class DirectoryWatchersService extends PostyBirbService<DirectoryWatcher> {
  constructor(
    @InjectRepository(DirectoryWatcher)
    repository: PostyBirbRepository<DirectoryWatcher>,
    private readonly submissionService: SubmissionService,
    private readonly fileSubmissionService: FileSubmissionService,
    @Optional() webSocket?: WSGateway
  ) {
    super(repository, webSocket);
  }

  /**
   * CRON run read of paths.
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  private async run() {
    if (!IsTestEnvironment()) {
      const entities = await this.repository.findAll();
      entities.filter((e) => !!e.path).forEach((e) => this.read(e));
    }
  }

  /**
   * Reads directory for processable files.
   *
   * @param {DirectoryWatcher} watcher
   */
  private async read(watcher: DirectoryWatcher) {
    let meta: WatcherMetadata = { read: [] };
    const metaFileName = join(watcher.path, 'pb-meta.json');
    if ((await stat(metaFileName)).isFile()) {
      meta = JSON.parse(
        (await readFile(metaFileName)).toString()
      ) as WatcherMetadata;
      if (!meta.read) {
        meta.read = []; // protect user modification
      }
    }

    const filesInDirectory = (await readdir(watcher.path))
      .filter((file) => file !== 'pb-meta.json')
      .filter((file) => !meta.read.includes(file));
    await Promise.allSettled(
      filesInDirectory.map((file) =>
        this.processFile(watcher, file).then(() => {
          // Only update list when successful
          meta.read.push(file);
        })
      )
    );

    // Update metadata after all is processed
    writeFile(metaFileName, JSON.stringify(meta, null, 1))
      .then(() =>
        this.logger.debug({}, `Metadata updated for '${metaFileName}'`)
      )
      .catch((err) => {
        this.logger.error(
          err,
          `Failed to update metadata for '${metaFileName}'`
        );
      });
  }

  /**
   * Attempts to process file and apply action.
   *
   * @param {DirectoryWatcher} watcher
   * @param {string} fileName
   */
  private async processFile(watcher: DirectoryWatcher, fileName: string) {
    const filePath = join(watcher.path, fileName);
    const multerInfo: MulterFileInfo = {
      fieldname: '',
      origin: 'directory-watcher',
      originalname: fileName,
      encoding: '',
      mimetype: getType(fileName),
      size: 0,
      destination: '',
      filename: fileName,
      path: filePath,
    };
    this.logger.debug(`Processing file ${filePath}`);
    switch (watcher.importAction) {
      case DirectoryWatcherImportAction.NEW_SUBMISSION:
        await this.submissionService.create(
          {
            name: fileName,
            type: SubmissionType.FILE,
          },
          multerInfo
        );
        break;
      case DirectoryWatcherImportAction.ADD_TO_SUBMISSION:
        // eslint-disable-next-line no-restricted-syntax
        for (const submissionId of watcher.submissionIds ?? []) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await this.fileSubmissionService.appendFile(
              submissionId,
              multerInfo
            );
          } catch (err) {
            this.logger.error(err, 'Unable to append file');
            throw err;
          }
        }

        break;
      default:
        break;
    }
  }

  async create(
    createDto: CreateDirectoryWatcherDto
  ): Promise<DirectoryWatcher> {
    const entity = this.repository.create(createDto);
    await this.repository.persistAndFlush(entity);
    return entity;
  }

  update(id: string, update: UpdateDirectoryWatcherDto) {
    this.logger.info(update, `Updating DirectoryWatcher '${id}'`);
    return this.repository.update(id, update);
  }
}
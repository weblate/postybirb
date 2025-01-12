import {
  DefaultDescriptionValue,
  DefaultTagValue,
  ISubmissionDto,
  ISubmissionFileDto,
  ISubmissionMetadata,
  ISubmissionScheduleInfo,
  IWebsiteFormFields,
  NULL_ACCOUNT_ID,
  ScheduleType,
  SubmissionRating,
  SubmissionType,
  WebsiteOptionsDto,
} from '@postybirb/types';
import { Moment } from 'moment';
import submissionsApi from '../../api/submission.api';

export class SubmissionDto<
  T extends ISubmissionMetadata = ISubmissionMetadata,
  O extends IWebsiteFormFields = IWebsiteFormFields
> implements ISubmissionDto<T>
{
  createdAt!: string;

  files!: ISubmissionFileDto[];

  id!: string;

  isScheduled!: boolean;

  metadata!: T;

  options!: WebsiteOptionsDto<IWebsiteFormFields>[];

  schedule!: ISubmissionScheduleInfo;

  type!: SubmissionType;

  updatedAt!: string;

  private defaultOption?: WebsiteOptionsDto;

  constructor(entity: ISubmissionDto) {
    Object.assign(this, entity);
    this.files = this.files ?? [];
    if (!this.metadata) {
      this.metadata = {} as T;
    }
    if (!this.options) {
      this.options = [
        {
          id: '',
          createdAt: '',
          updatedAt: '',
          submission: {} as ISubmissionDto,
          account: NULL_ACCOUNT_ID,
          isDefault: true,
          data: {
            title: '',
            tags: DefaultTagValue,
            description: DefaultDescriptionValue,
            rating: SubmissionRating.GENERAL,
          },
        },
      ];
    }
  }

  public hasValidScheduleTime(): boolean {
    return this.schedule.scheduledFor
      ? Date.now() <= new Date(this.schedule.scheduledFor).getTime()
      : true;
  }

  public getDefaultOptions(): WebsiteOptionsDto<O> {
    if (!this.defaultOption) {
      this.defaultOption = this.options.find(
        (o) => o.isDefault
      ) as WebsiteOptionsDto<O>;
    }
    return this.defaultOption as WebsiteOptionsDto<O>;
  }

  public removeOption(option: WebsiteOptionsDto<O>) {
    this.options = this.options.filter((opt) => opt.id !== option.id);
  }

  public addOption(option: WebsiteOptionsDto<O>) {
    this.options = [...this.options, option];
  }

  public updateSchedule(date: Moment | null) {
    return submissionsApi.update(this.id, {
      isScheduled: this.isScheduled,
      scheduleType: ScheduleType.SINGLE,
      scheduledFor: date ? date.toISOString() : undefined,
      metadata: this.metadata,
    });
  }

  public copy(): SubmissionDto<T, O> {
    return new SubmissionDto(JSON.parse(JSON.stringify(this)));
  }

  public overwrite(from: SubmissionDto<T, O>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.apply(this, from.copy() as any);
  }

  public isTemplate(): boolean {
    return Boolean(this.metadata.template);
  }

  public getTemplateName() {
    return this.metadata.template?.name ?? 'Template';
  }
}

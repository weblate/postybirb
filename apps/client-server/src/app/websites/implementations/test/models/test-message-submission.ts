import {
  DescriptionField,
  RatingField,
  TagField,
  TextField,
} from '@postybirb/form-builder';
import {
  IBaseWebsiteOptions,
  DefaultTagValue,
  DescriptionValue,
  SubmissionRating,
  TagValue,
} from '@postybirb/types';
import { DefaultRatingOptions } from '../../../models/default-website-options';

export class TestMessageSubmission implements IBaseWebsiteOptions {
  @TextField({ label: 'Title', defaultValue: '' })
  title?: string;

  @TagField({ label: 'Tags', defaultValue: DefaultTagValue })
  tags: TagValue;

  @DescriptionField({
    label: 'Description',
    defaultValue: {
      overrideDefault: false,
      description: '',
    },
  })
  description: DescriptionValue;

  @RatingField({
    label: 'Rating',
    defaultValue: undefined,
    options: DefaultRatingOptions,
  })
  rating: SubmissionRating;
}

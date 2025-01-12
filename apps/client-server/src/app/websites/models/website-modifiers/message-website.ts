import {
  IWebsiteFormFields,
  MessageSubmission,
  PostData,
  ValidationResult,
} from '@postybirb/types';
import { Class } from 'type-fest';

import { UnknownWebsite } from '../../website';

export const MessageWebsiteKey = 'MessageModel';

/**
 * Defines methods for allowing message (notification, journal, blob, etc.) based posting.
 * @interface MessageWebsite
 */
export interface MessageWebsite<T extends IWebsiteFormFields> {
  MessageModel: Class<T>;

  createMessageModel(): T;

  onPostMessageSubmission(
    postData: PostData<MessageSubmission, T>,
    cancellationToken: unknown
  ): Promise<unknown>;

  onValidateMessageSubmission(
    postData: PostData<MessageSubmission, T>
  ): Promise<ValidationResult<T>>;
}

export function isMessageWebsite(
  websiteInstance: UnknownWebsite
): websiteInstance is MessageWebsite<IWebsiteFormFields> & UnknownWebsite {
  return Boolean(
    (websiteInstance as MessageWebsite<IWebsiteFormFields> & UnknownWebsite)
      .supportsMessage
  );
}

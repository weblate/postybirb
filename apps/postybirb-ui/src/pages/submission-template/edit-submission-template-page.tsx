import {
  EuiBreadcrumb,
  EuiButton,
  EuiHeader,
  EuiHeaderLogo,
  EuiHeaderSection,
  EuiHeaderSectionItem,
  EuiLoadingSpinner,
  EuiSpacer,
  EuiTitle,
} from '@elastic/eui';
import { SubmissionType } from '@postybirb/types';
import { useMemo } from 'react';
import { FormattedMessage } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import SubmissionProvider, {
  useSubmission,
} from '../../hooks/submission/use-submission';
import NotFound from '../not-found/not-found';
import { FileSubmissionPath, MessageSubmissionPath } from '../route-paths';
import SubmissionEditForm from '../../components/submissions/submission-edit-form/submission-edit-form';

function EditSubmissionPageNavHeader() {
  const history = useNavigate();
  const { isLoading, isSaving, isChanged, submission, save } = useSubmission();
  const defaultOption = submission.getDefaultOptions();
  const breadcrumbs: EuiBreadcrumb[] = useMemo(
    () => [
      {
        text:
          submission.type === SubmissionType.FILE ? (
            <FormattedMessage
              id="file-submissions"
              defaultMessage="File Submissions"
            />
          ) : (
            <FormattedMessage
              id="message-submissions"
              defaultMessage="Message Submissions"
            />
          ),
        href: '#',
        onClick: (e) => {
          e.preventDefault();
          history(
            submission.type === SubmissionType.FILE
              ? FileSubmissionPath
              : MessageSubmissionPath
          );
        },
      },
      {
        text: (
          <div>
            <span>{defaultOption.data.title}</span>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defaultOption.data.title]
  );

  return (
    <EuiHeader
      style={{ position: 'sticky', top: 0 }}
      sections={[
        {
          items: [
            <EuiHeaderLogo iconType="documentEdit" />,
            <EuiHeaderSection>
              <EuiTitle size="xs">
                <h4>
                  <FormattedMessage
                    id="submissions.edit-page-header"
                    defaultMessage="Edit Submission"
                  />
                </h4>
              </EuiTitle>
            </EuiHeaderSection>,
          ],
          breadcrumbs,
          breadcrumbProps: {
            lastBreadcrumbIsCurrentPage: true,
          },
        },
        {
          items: [
            <EuiHeaderSection>
              <EuiHeaderSectionItem>
                <EuiButton
                  size="s"
                  disabled={!isChanged || isSaving}
                  isLoading={isSaving || isLoading}
                  onClick={() => {
                    save();
                  }}
                >
                  <FormattedMessage
                    id="submission.save"
                    defaultMessage="Save"
                  />
                </EuiButton>
              </EuiHeaderSectionItem>
            </EuiHeaderSection>,
          ],
        },
      ]}
    />
  );
}

function EditSubmissionTemplatePageInternal() {
  const { isLoading } = useSubmission();

  return (
    <div className="postybirb__submission-edit-page">
      <EditSubmissionPageNavHeader />
      <EuiSpacer size="m" />
      {isLoading ? (
        <div className="w-full text-center">
          <EuiLoadingSpinner size="xxl" />
        </div>
      ) : (
        <SubmissionEditForm />
      )}
    </div>
  );
}

export default function EditSubmissionTemplatePage() {
  const { id } = useParams();

  if (!id) {
    return <NotFound />;
  }

  return (
    <SubmissionProvider id={id}>
      <EditSubmissionTemplatePageInternal />
    </SubmissionProvider>
  );
}

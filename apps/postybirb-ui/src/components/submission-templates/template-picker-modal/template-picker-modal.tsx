import {
  EuiButton,
  EuiButtonEmpty,
  EuiCheckbox,
  EuiCheckboxGroup,
  EuiComboBox,
  EuiComboBoxOptionOption,
  EuiForm,
  EuiFormRow,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiSpacer,
} from '@elastic/eui';
import {
  EuiCheckboxGroupIdToSelectedMap,
  EuiCheckboxGroupOption,
} from '@elastic/eui/src/components/form/checkbox/checkbox_group';
import {
  AccountId,
  IAccountDto,
  NULL_ACCOUNT_ID,
  SubmissionId,
  SubmissionType,
  WebsiteOptionsDto,
} from '@postybirb/types';
import { useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { useWebsites } from '../../../hooks/account/use-websites';
import { SubmissionDto } from '../../../models/dtos/submission.dto';
import { SubmissionTemplateStore } from '../../../stores/submission-template.store';
import { SubmissionStore } from '../../../stores/submission.store';
import { useStore } from '../../../stores/use-store';

type TemplatePickerModalProps = {
  submissionId?: SubmissionId;
  type: SubmissionType;
  onClose: () => void;
  onApply: (options: WebsiteOptionsDto[]) => void;
};

const formId = 'template-picker-form';

type SubmissionOptionPair = {
  option: WebsiteOptionsDto;
  submission: SubmissionDto;
};

type AccountGroup = {
  account: IAccountDto;
  submissions: SubmissionOptionPair[];
};

function groupWebsiteOptions(
  submissions: SubmissionDto[],
  accounts: IAccountDto[]
): Record<string, AccountGroup> {
  const groups: Record<string, AccountGroup> = {};
  submissions.forEach((submission) => {
    submission.options.forEach((option) => {
      const account =
        accounts.find((a) => a.id === option.account) ??
        ({
          id: NULL_ACCOUNT_ID,
          name: 'Default',
          websiteInfo: {
            websiteDisplayName: 'Default',
          },
        } as IAccountDto);
      if (!groups[account.id]) {
        groups[account.id] = {
          account,
          submissions: [],
        };
      }

      groups[account.id].submissions.push({
        submission,
        option,
      });
    });
  });

  return groups;
}

export default function TemplatePickerModal(props: TemplatePickerModalProps) {
  const { submissionId, type, onApply, onClose } = props;
  const { state: templateState } = useStore(SubmissionTemplateStore);
  const { state: submissionsState } = useStore(SubmissionStore);
  const { accounts } = useWebsites();
  const [selected, setSelected] = useState<
    EuiComboBoxOptionOption<SubmissionDto>[]
  >([]);
  const [selectedWebsiteOptions, setSelectedWebsiteOptions] =
    useState<Record<AccountId, WebsiteOptionsDto | null>>();
  const [overrideDescription, setOverrideDescription] = useState(true);
  const [overrideTitle, setOverrideTitle] = useState(false);

  const templates = templateState.filter((s) => s.type === type);
  const submissions = submissionsState.filter((s) => s.id !== submissionId);

  const templateOptions: EuiComboBoxOptionOption<SubmissionDto>[] =
    templates.map((template) => ({
      label: template.getTemplateName(),
      key: template.id,
      value: template,
    }));

  const submissionOptions: EuiComboBoxOptionOption<SubmissionDto>[] =
    submissions.map((submission) => ({
      label: submission.getDefaultOptions().data.title ?? 'Unknown',
      key: submission.id,
      value: submission,
    }));

  const options: EuiComboBoxOptionOption<SubmissionDto>[] = [
    {
      isGroupLabelOption: true,
      label: 'Templates',
      options: templateOptions,
    },
    {
      isGroupLabelOption: true,
      label: 'Submissions',
      options: submissionOptions,
    },
  ];

  const selectedTemplates: EuiComboBoxOptionOption<SubmissionDto>[] =
    selected.map((s) => ({
      label: s.label,
      key: s.key,
      value: s.value,
      prepend: <span>{s.value?.getTemplateName()} -</span>,
    }));

  const selectedGroups = groupWebsiteOptions(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    selectedTemplates.map((s) => s.value!),
    accounts
  );

  const groupedFormRows = selectedWebsiteOptions
    ? Object.values(selectedGroups).map((group) => {
        // Uses group.account.id for null type to keep id uniqueness for radio values
        const nullId = group.account.id;
        const idMap: EuiCheckboxGroupIdToSelectedMap = {};
        const checkboxOptions: EuiCheckboxGroupOption[] = [
          {
            label: <FormattedMessage id="none" defaultMessage="None" />,
            id: nullId,
          },
        ];

        const currentSelection = selectedWebsiteOptions[group.account.id];
        idMap[currentSelection?.id ?? nullId] = true;
        group.submissions.forEach(({ submission, option }) => {
          checkboxOptions.push({
            id: option.id,
            label: submission.getDefaultOptions().data.title ?? 'Unknown',
          });
        });

        return (
          <EuiFormRow
            label={
              group.account.id === NULL_ACCOUNT_ID
                ? 'Default'
                : `${group.account.websiteInfo.websiteDisplayName} - ${group.account.name}`
            }
          >
            <EuiCheckboxGroup
              compressed
              idToSelectedMap={idMap}
              options={checkboxOptions}
              onChange={(id) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const opt = group.submissions.find(
                  ({ option }) => option.id === id
                );
                setSelectedWebsiteOptions({
                  ...selectedWebsiteOptions,
                  [group.account.id]: opt ? opt.option : null,
                });
              }}
            />
          </EuiFormRow>
        );
      })
    : null;

  const overrideOptions = groupedFormRows ? (
    <>
      <EuiCheckbox
        checked={overrideTitle}
        label={
          <FormattedMessage
            id="import.override-title"
            defaultMessage="Replace title"
          />
        }
        id="import-template-override-title"
        onChange={() => {
          setOverrideTitle(!overrideTitle);
        }}
      />
      <EuiCheckbox
        checked={overrideDescription}
        label={
          <FormattedMessage
            id="import.override-description"
            defaultMessage="Replace description"
          />
        }
        id="import-template-override-description"
        onChange={() => {
          setOverrideDescription(!overrideDescription);
        }}
      />
    </>
  ) : null;

  return (
    <EuiModal onClose={onClose}>
      <EuiModalHeader>
        <EuiModalHeaderTitle>
          <FormattedMessage
            id="template.picker-modal-header"
            defaultMessage="Choose Templates"
          />
        </EuiModalHeaderTitle>
      </EuiModalHeader>
      <EuiModalBody>
        <EuiForm
          id={formId}
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            if (selectedWebsiteOptions) {
              onApply(
                (
                  Object.values(selectedWebsiteOptions).filter(
                    (o) => o !== null
                  ) as WebsiteOptionsDto[]
                ).map((o: WebsiteOptionsDto) => {
                  const option = { ...o };
                  // Remove fields based on override options
                  // Or remove if the fields are just empty
                  if (
                    !overrideDescription ||
                    option.data.description?.description.trim()
                  ) {
                    delete option.data.description;
                  }
                  if (!overrideTitle || !option.data.title?.trim()) {
                    delete option.data.title;
                  }
                  return option;
                })
              );
            }
          }}
        >
          <EuiComboBox
            fullWidth
            isClearable
            options={options}
            selectedOptions={selectedTemplates}
            onChange={(newOpts) => {
              setSelected(newOpts);

              // On first option pick
              if (!selectedWebsiteOptions && newOpts.length) {
                const sub: Record<AccountId, WebsiteOptionsDto> = {};
                newOpts[0].value?.options.forEach((o) => {
                  sub[o.account] = o;
                });
                setSelectedWebsiteOptions(sub);
              }

              // Reset
              if (!newOpts.length) {
                setSelectedWebsiteOptions(undefined);
              }
            }}
          />
          <EuiSpacer size="s" />
          {overrideOptions}
          <EuiSpacer size="s" />
          {groupedFormRows}
        </EuiForm>
      </EuiModalBody>
      <EuiModalFooter>
        <EuiButtonEmpty onClick={onClose}>
          <FormattedMessage id="cancel" defaultMessage="Cancel" />
        </EuiButtonEmpty>
        <EuiButton
          type="submit"
          form={formId}
          fill
          disabled={Object.values(selectedWebsiteOptions ?? {}).length === 0}
        >
          <FormattedMessage id="apply" defaultMessage="Apply" />
        </EuiButton>
      </EuiModalFooter>
    </EuiModal>
  );
}

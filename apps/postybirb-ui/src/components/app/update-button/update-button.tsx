/* eslint-disable react/no-danger */
import {
  EuiButton,
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHorizontalRule,
  EuiPopover,
  EuiProgress,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from '@elastic/eui';
import { useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { useQuery } from 'react-query';
import updateApi from '../../../api/update.api';
import { ArrowUpIcon } from '../../shared/icons/Icons';
import './update-button.css';

export default function UpdateButton() {
  const [showNotes, setShowNotes] = useState(false);
  const { data } = useQuery(
    'update',
    () => updateApi.checkForUpdates().then((res) => res.body),
    {
      refetchInterval: 30_000,
    }
  );

  const show = data?.updateAvailable ?? false;
  const patchNotes = data?.updateNotes ?? [];
  const disable = (data?.updateDownloaded || data?.updateDownloading) ?? false;
  return show ? (
    <EuiFlexGroup responsive={false} gutterSize="xs" alignItems="center">
      <EuiFlexItem grow>
        <EuiButton
          size="s"
          color="success"
          aria-label="Update PostyBirb"
          fullWidth
          iconType={ArrowUpIcon}
          disabled={disable}
          onClick={() => {
            updateApi.startUpdate();
          }}
        >
          <FormattedMessage id="update" defaultMessage="Update" />
        </EuiButton>
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiPopover
          anchorPosition="rightCenter"
          button={
            <EuiButtonIcon
              title="Patch Notes"
              color="success"
              size="s"
              iconType="article"
              aria-label="Information about the update"
              onClick={() => {
                setShowNotes(!showNotes);
              }}
            />
          }
          isOpen={showNotes}
          closePopover={() => setShowNotes(false)}
        >
          {patchNotes.map((note) => (
            <div>
              <EuiTitle size="xs">
                <h4>{note.version}</h4>
              </EuiTitle>
              <EuiSpacer size="xs" />
              <div
                className="postybirb__update-button-css-override"
                dangerouslySetInnerHTML={{ __html: note.note ?? '' }}
              />
              {patchNotes.length > 1 ? <EuiHorizontalRule /> : null}
            </div>
          ))}
        </EuiPopover>
      </EuiFlexItem>
      {data?.updateProgress ? (
        <>
          <EuiFlexItem grow={false}>
            <EuiText>
              <p>{data.updateProgress || 0}</p>
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiProgress value={data.updateProgress || 0} max={100} size="xs" />
          </EuiFlexItem>
        </>
      ) : null}
    </EuiFlexGroup>
  ) : null;
}

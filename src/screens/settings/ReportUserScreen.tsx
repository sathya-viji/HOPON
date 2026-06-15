import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import { ReportForm, type ReportReasonOption } from './ReportFormScreen';
import { submitReport } from '@/api/safety';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'ReportUser'>;

const REASONS: ReportReasonOption[] = [
  { label: 'Inappropriate behaviour', value: 'inappropriate_content' },
  { label: 'Harassment or threats', value: 'harassment' },
  { label: 'Fake profile', value: 'fake_profile' },
  { label: 'No-show pattern', value: 'no_show' },
  { label: 'Spam or scam', value: 'spam' },
  { label: 'Safety concern', value: 'safety_concern' },
  { label: 'Other', value: 'other' },
];

export function ReportUserScreen({ navigation, route }: Props) {
  return (
    <ReportForm
      title="Report user"
      intro="What's the issue? We review all reports and take action within 24 hours."
      reasons={REASONS}
      onBack={() => navigation.goBack()}
      submit={(reason, notes) => submitReport('user', route.params.userId, reason, notes)}
      onDone={() => navigation.goBack()}
    />
  );
}

import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import { ReportForm } from './ReportFormScreen';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'ReportUser'>;

const REASONS = [
  'Inappropriate behaviour',
  'Harassment or threats',
  'Fake profile',
  'No-show pattern',
  'Spam or scam',
  'Other',
];

export function ReportUserScreen({ navigation }: Props) {
  return (
    <ReportForm
      title="Report user"
      intro="What's the issue? We review all reports and take action within 24 hours."
      reasons={REASONS}
      onBack={() => navigation.goBack()}
      onSubmit={() => navigation.goBack()}
    />
  );
}

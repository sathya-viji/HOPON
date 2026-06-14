import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import { ReportForm } from './ReportFormScreen';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'ReportProblem'>;

const REASONS = [
  "Something doesn't work",
  'I have a suggestion',
  'I saw a bug',
  'Something else',
];

export function ReportProblemScreen({ navigation }: Props) {
  return (
    <ReportForm
      title="Report a problem"
      intro="Tell us what's wrong. We read every report."
      reasons={REASONS}
      onBack={() => navigation.goBack()}
      onSubmit={() => navigation.goBack()}
    />
  );
}

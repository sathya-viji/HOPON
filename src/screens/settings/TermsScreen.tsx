import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import { DocumentScreen } from '@/components/molecules/DocumentScreen';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'Terms'>;

const SECTIONS: [string, string][] = [
  ['1. Acceptance', 'By using hopon you agree to these Terms. If you do not agree, do not use the service. hopon is intended for adults aged 18 and over.'],
  ['2. What hopon is', 'hopon is a platform for discovering and joining spontaneous real-world plans with people nearby. We facilitate connections but are not responsible for what happens during in-person meetings.'],
  ['3. Your account', 'You are responsible for maintaining the security of your account and for all activity under it. Your phone number is your identity — keep it current.'],
  ['4. Acceptable use', 'You agree not to use hopon to harass, threaten, or harm others; post false or misleading information; or use automated tools to access the service.'],
  ['5. Plans and meetings', 'hopon does not vet, verify, or guarantee the safety of any plan or participant. Always meet in public places. Trust your instincts.'],
  ['6. Content', 'You retain ownership of content you post. By posting, you grant hopon a licence to display it within the service.'],
  ['7. Attendance score', 'Your attendance percentage is calculated automatically from your join and show-up history. It is visible to other users as a trust signal.'],
  ['8. Termination', 'We may suspend or terminate accounts that violate these Terms. You may delete your account at any time from Settings.'],
  ['9. Limitation of liability', 'hopon is provided "as is". We are not liable for any harm arising from in-person meetings facilitated through the platform.'],
  ['10. Changes', 'We may update these Terms. Continued use of hopon after changes constitutes acceptance.'],
];

export function TermsScreen({ navigation }: Props) {
  return (
    <DocumentScreen
      title="Terms of Service"
      sections={SECTIONS}
      contactPrompt="Questions? Contact us at"
      contactEmail="hello@hopon.app"
      onBack={() => navigation.goBack()}
    />
  );
}

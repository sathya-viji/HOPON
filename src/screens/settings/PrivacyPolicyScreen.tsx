import React from 'react';
import { DocumentScreen } from '@/components/molecules/DocumentScreen';

type Props = { navigation: { goBack: () => void } };

const SECTIONS: [string, string][] = [
  ['1. What we collect', 'We collect your phone number, name, date of birth, gender, neighbourhood, profile photo, and activity interests when you sign up. We also collect usage data such as plans you create, join, or view.'],
  ['2. How we use it', 'Your data is used to show your profile to other users, match you with nearby plans, calculate your attendance score, and improve the hopon experience. We do not sell your data to third parties.'],
  ['3. What others can see', 'Your name, photo, neighbourhood, interests, attendance score, and plan history are visible to other hopon users. Your phone number is never shown publicly.'],
  ['4. Location', 'hopon uses your neighbourhood to surface nearby plans. We do not continuously track your precise location in the background.'],
  ['5. Data retention', 'Your data is retained as long as your account is active. You can delete your account at any time from Settings — this permanently removes your profile and associated data.'],
  ['6. Third-party services', 'We use third-party services for authentication and infrastructure. These services process data only as necessary to operate hopon and are bound by their own privacy policies.'],
  ['7. Children', 'hopon is strictly for users aged 18 and over. We do not knowingly collect data from anyone under 18.'],
  ['8. Your rights', 'You can update your profile at any time, request a copy of your data, or delete your account from Settings → Delete account.'],
  ['9. Changes', 'We may update this policy from time to time. We will notify you of significant changes through the app.'],
];

export function PrivacyPolicyScreen({ navigation }: Props) {
  return (
    <DocumentScreen
      title="Privacy Policy"
      sections={SECTIONS}
      contactPrompt="Privacy questions? Contact us at"
      contactEmail="privacy@hopon.app"
      onBack={() => navigation.goBack()}
    />
  );
}

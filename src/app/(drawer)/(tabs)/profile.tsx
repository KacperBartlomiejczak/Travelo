import { useTranslation } from 'react-i18next';

import { EmptyScreen } from '@/features/nav/EmptyScreen';

export default function ProfileScreen() {
  const { t } = useTranslation();
  return <EmptyScreen title={t('nav.profileTitle')} message={t('nav.comingSoon')} />;
}

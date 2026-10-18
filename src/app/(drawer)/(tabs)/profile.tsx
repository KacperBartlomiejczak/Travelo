import { useTranslation } from 'react-i18next';

import { EmptyScreen } from '@/features/nav/EmptyScreen';

export default function SettingsScreen() {
  const { t } = useTranslation();
  return <EmptyScreen title={t('nav.settings')} message={t('nav.comingSoon')} />;
}

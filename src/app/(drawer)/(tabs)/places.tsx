import { useTranslation } from 'react-i18next';

import { EmptyScreen } from '@/features/nav/EmptyScreen';

export default function PlacesScreen() {
  const { t } = useTranslation();
  return <EmptyScreen title={t('nav.places')} message={t('nav.comingSoon')} />;
}

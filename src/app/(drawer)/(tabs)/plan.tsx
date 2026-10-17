import { useTranslation } from 'react-i18next';

import { EmptyScreen } from '@/features/nav/EmptyScreen';

export default function PlanScreen() {
  const { t } = useTranslation();
  return <EmptyScreen title={t('nav.plan')} message={t('nav.comingSoon')} />;
}

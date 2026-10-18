import { useTranslation } from 'react-i18next';

import { EmptyScreen } from '@/features/nav/EmptyScreen';

export default function ExpensesScreen() {
  const { t } = useTranslation();
  return <EmptyScreen title={t('nav.expenses')} message={t('nav.comingSoon')} />;
}

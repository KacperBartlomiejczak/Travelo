import { CalendarDays, MapPin, Plane, Receipt, Settings } from 'lucide-react-native';

import i18n from '@/i18n';

import { NAV_TABS } from '../tabs';

describe('NAV_TABS (pill-nav-and-dialog A7)', () => {
  it('lists the five screens in order with their i18n keys and icons', () => {
    expect(NAV_TABS.map(({ key, labelKey, Icon }) => [key, labelKey, Icon])).toEqual([
      ['index', 'nav.trip', Plane],
      ['expenses', 'nav.expenses', Receipt],
      ['places', 'nav.places', MapPin],
      ['plan', 'nav.plan', CalendarDays],
      ['settings', 'nav.settings', Settings],
    ]);
  });

  it('has Polish labels', async () => {
    await i18n.changeLanguage('pl');
    expect(NAV_TABS.map((tab) => i18n.t(tab.labelKey))).toEqual(['Podróż', 'Wydatki', 'Miejsca', 'Plan', 'Ustawienia']);
  });

  it('has English labels', async () => {
    await i18n.changeLanguage('en');
    expect(NAV_TABS.map((tab) => i18n.t(tab.labelKey))).toEqual(['Trip', 'Expenses', 'Places', 'Plan', 'Settings']);
    await i18n.changeLanguage('pl');
  });
});

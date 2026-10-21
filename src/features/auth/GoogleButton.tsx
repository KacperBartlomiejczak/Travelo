import { useTheme } from '@/theme/legacy/useTheme';

import { BrandButton } from './BrandButton';
import { GoogleLogo } from './GoogleLogo';

type Props = { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };

// Google's light button (auth-onboarding D10): white, a 1dp grey border, dark text, the multicolour "G" on the left.
export function GoogleButton(props: Props) {
  const { google } = useTheme().colors.brand;
  return <BrandButton brand="google" Logo={GoogleLogo} colors={google} {...props} />;
}

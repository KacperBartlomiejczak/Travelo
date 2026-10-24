import { partnerBrand } from '@/theme/tokens';

import { BrandButton } from './BrandButton';
import { DiscordLogo } from './DiscordLogo';

type Props = { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };

// Discord's blurple button (auth-onboarding D13): white text and the white Discord logo on the left.
export function DiscordButton(props: Props) {
  return <BrandButton brand="discord" Logo={DiscordLogo} colors={partnerBrand.discord} {...props} />;
}

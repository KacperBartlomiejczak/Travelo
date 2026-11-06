import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FullScreenError } from '@/features/auth/FullScreenError';
import { LegalDocSchema, LegalDocumentSchema, type LegalDocument } from '@/schemas/legal';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const { typography, spacing, layout } = tokens;

// The text is bundled in the i18n dictionaries, so there is no loading state and it works offline. A broken dictionary
// or an unknown `doc` shows the error state instead of crashing.
function useLegalDocument(doc: string | undefined): LegalDocument | null {
  const { t } = useTranslation();
  const name = LegalDocSchema.safeParse(doc);
  if (!name.success) return null;
  const parsed = LegalDocumentSchema.safeParse(t(`legal.${name.data}`, { returnObjects: true }));
  return parsed.success ? parsed.data : null;
}

export function LegalScreen({ doc }: { doc: string | undefined }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const content = useLegalDocument(doc);

  if (!content) {
    return (
      <FullScreenError
        testID="legal-error"
        message={t('legal.error')}
        retryLabel={t('legal.back')}
        onRetry={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    );
  }

  return (
    <View testID="legal-screen" style={{ flex: 1, backgroundColor: theme.background.canvas }}>
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          maxWidth: layout.maxContentWidth,
          alignSelf: 'center',
          gap: spacing[3],
          paddingHorizontal: width < layout.compactBreakpoint ? spacing[4] : spacing[5],
          paddingTop: spacing[4],
          paddingBottom: insets.bottom + spacing[4],
        }}
      >
        <Text accessibilityRole="header" style={[typography.styles.headingMD, { color: theme.text.primary }]}>
          {content.title}
        </Text>
        <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]}>{content.updated}</Text>
        {content.sections.map((section, i) => (
          <View key={i} style={{ gap: spacing[2] }}>
            {section.heading !== '' && (
              <Text accessibilityRole="header" style={[typography.styles.headingSM, { color: theme.text.primary }]}>
                {section.heading}
              </Text>
            )}
            {section.paragraphs.map((paragraph, j) => (
              <Text key={j} style={[typography.styles.bodyMD, { color: theme.text.primary }]}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

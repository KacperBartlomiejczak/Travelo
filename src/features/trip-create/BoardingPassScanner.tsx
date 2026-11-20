import { CameraView, useCameraPermissions } from 'expo-camera';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextButton } from '@/components/TextButton';
import { findAirport } from '@/lib/airport-search';
import { parseBcbp } from '@/lib/ticket-parse/bcbp';
import { deviceToday } from '@/lib/trip-sections';
import type { BoardingPass } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Direction = 'outbound' | 'return';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The scanned pass and the direction it belongs to (Z2); the caller adds it to the draft and closes. */
  onAdd: (pass: BoardingPass, direction: Direction) => void;
};

const BARCODE_TYPES = ['pdf417', 'aztec', 'qr'] as const;

// Live scan of a boarding pass code, on the phone only (ticket-import D10, Z6). The parser drops the name and the booking code (Z5).
export function BoardingPassScanner({ visible, onClose, onAdd }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [pass, setPass] = useState<BoardingPass | null>(null);
  const [direction, setDirection] = useState<Direction>('outbound');
  const [unrecognised, setUnrecognised] = useState(false);

  function onScanned(data: string) {
        const found = parseBcbp(data, deviceToday(new Date()), (iata) => findAirport(iata) !== undefined);
    if (found) setPass(found);
    else setUnrecognised(true);
  }

  const text = [tokens.typography.styles.bodyMD, { color: theme.text.primary }];
  let body;
  if (!permission) {
    body = (
      <View testID="scanner-loading" style={{ padding: tokens.layout.screenGutter, alignItems: 'center' }}>
        <ActivityIndicator accessibilityLabel={t('newTrip.flights.import.cameraLoading')} color={theme.brand.primary} />
      </View>
    );
  } else if (!permission.granted) {
    body = (
      <View style={{ gap: tokens.spacing[4], padding: tokens.layout.screenGutter }}>
        {!permission.canAskAgain && <Text style={text}>{t('newTrip.flights.import.cameraDenied')}</Text>}
        {permission.canAskAgain ? (
          <PrimaryButton label={t('newTrip.flights.import.cameraAllow')} onPress={() => void requestPermission()} />
        ) : (
          <PrimaryButton label={t('newTrip.flights.import.openSettings')} onPress={() => void Linking.openSettings()} />
        )}
      </View>
    );
  } else if (pass) {
    body = (
      <View style={{ gap: tokens.spacing[4], padding: tokens.layout.screenGutter }}>
        <Text accessibilityRole="header" style={[tokens.typography.styles.headingSM, { color: theme.text.primary }]}>
          {t('newTrip.flights.import.scanDirection')}
        </Text>
        <SegmentedControl
          label={t('newTrip.flights.direction')}
          options={[
            { value: 'outbound', label: t('newTrip.flights.outbound') },
            { value: 'return', label: t('newTrip.flights.return') },
          ]}
          value={direction}
          onChange={setDirection}
        />
        <PrimaryButton label={t('newTrip.flights.import.add')} onPress={() => onAdd(pass, direction)} />
        <TextButton variant="secondary" label={t('newTrip.flights.import.scanAgain')} onPress={() => setPass(null)} />
      </View>
    );
  } else {
    body = (
      <View style={{ flex: 1 }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          accessibilityLabel={t('newTrip.flights.import.scannerHint')}
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={({ data }) => onScanned(data)}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: tokens.layout.screenGutter,
            paddingBottom: insets.bottom + tokens.spacing[4],
            backgroundColor: theme.surface.overlay,
          }}
        >
          <Text accessibilityLiveRegion="polite" style={text}>
            {unrecognised ? t('newTrip.flights.import.unrecognized') : t('newTrip.flights.import.scannerHint')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => setUnrecognised(false)}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background.canvas,
          paddingTop: insets.top,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: tokens.layout.screenGutter,
          }}
        >
          <Text accessibilityRole="header" style={[tokens.typography.styles.headingSM, { color: theme.text.primary, flexShrink: 1 }]}>
            {t('newTrip.flights.import.scannerTitle')}
          </Text>
          <IconButton icon={X} label={t('common.close')} onPress={onClose} />
        </View>
        {body}
      </View>
    </Modal>
  );
}

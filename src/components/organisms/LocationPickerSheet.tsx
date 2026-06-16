import React, { useState, useRef, useCallback } from 'react';
import { Modal, View, TextInput, FlatList, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes, fontFamilies } from '@/theme/tokens';
import { placesAutocomplete, placeDetails, newPlacesSession, type PlacePrediction } from '@/api/places';
import type { HomeLocation } from '@/api/hooks/useHomeLocation';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectManual: (loc: HomeLocation) => void;
  onSelectGPS: () => void;
}

export function LocationPickerSheet({ visible, onClose, onSelectManual, onSelectGPS }: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState(false);
  const sessionRef = useRef(newPlacesSession());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) { setPredictions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await placesAutocomplete(text, sessionRef.current);
        setPredictions(results);
      } catch {
        setPredictions([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }, []);

  const pickPrediction = useCallback(async (p: PlacePrediction) => {
    setPicking(true);
    try {
      const details = await placeDetails(p.placeId, sessionRef.current);
      sessionRef.current = newPlacesSession();
      onSelectManual({ label: p.main, lat: details.lat, lng: details.lng, source: 'manual' });
      setQuery('');
      setPredictions([]);
      onClose();
    } catch {
      // ignore
    } finally {
      setPicking(false);
    }
  }, [onSelectManual, onClose]);

  const handleGPS = useCallback(() => {
    onClose();
    setQuery('');
    setPredictions([]);
    onSelectGPS();
  }, [onClose, onSelectGPS]);

  const handleClose = useCallback(() => {
    setQuery('');
    setPredictions([]);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: spacing.xxxl }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />

          <View style={{ paddingHorizontal: spacing.screenPx, marginBottom: spacing.md }}>
            <T.LabelLg>Change location</T.LabelLg>
          </View>

          <Pressable
            onPress={handleGPS}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.screenPx, paddingVertical: spacing.md, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="crosshair" size={iconSizes.sm} color={colors.coral} />
            </View>
            <View>
              <T.LabelMd>Use my current location</T.LabelMd>
              <T.Meta>GPS · updates automatically</T.Meta>
            </View>
          </Pressable>

          <View style={{ paddingHorizontal: spacing.screenPx, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 44, borderRadius: radii.md, borderWidth: borderWidths.medium, borderColor: colors.borderMid, backgroundColor: colors.surface }}>
              <Icon name="search" size={iconSizes.xs} color={colors.textDim} />
              <TextInput
                value={query}
                onChangeText={onChangeText}
                placeholder="Search a neighbourhood or city…"
                placeholderTextColor={colors.textDim}
                autoFocus
                style={{ flex: 1, fontFamily: fontFamilies.regular, fontSize: 15, color: colors.text }}
              />
              {searching && <ActivityIndicator size="small" color={colors.textDim} />}
            </View>
          </View>

          {picking && (
            <View style={{ padding: spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator color={colors.coral} />
            </View>
          )}

          <FlatList
            data={predictions}
            keyExtractor={(p) => p.placeId}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 300 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pickPrediction(item)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.screenPx, paddingVertical: spacing.md, borderBottomWidth: borderWidths.hairline, borderBottomColor: colors.border }}
              >
                <Icon name="map-pin" size={iconSizes.xs} color={colors.textDim} />
                <View style={{ flex: 1 }}>
                  <T.LabelSm>{item.main}</T.LabelSm>
                  {!!item.secondary && <T.Meta numberOfLines={1}>{item.secondary}</T.Meta>}
                </View>
              </Pressable>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

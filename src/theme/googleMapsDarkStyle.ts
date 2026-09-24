/**
 * Muted Google Maps (Android) styles, mirroring Apple Maps' 'mutedStandard'
 * used on iOS. Two things react-native-maps can't do via plain props on
 * Android: (1) `userInterfaceStyle` only affects Apple Maps, so dark mode
 * needs an explicit dark palette here; (2) `showsPointsOfInterests` isn't
 * reliably honoured by the Google Maps SDK, so decluttering POI/transit
 * icons has to go through this style JSON too.
 */
import type { MapStyleElement } from 'react-native-maps';

// Hides business/landmark and transit icons+labels (kept as a plain marker
// soup otherwise), and road-shield icons — shared by both themes. Place
// names (administrative.locality, e.g. "ADYAR") are kept since they help
// locate plans. Every OTHER street name label is the actual text clutter at
// neighbourhood zoom — targeting `road.local`/`road.arterial` specifically
// didn't hide them (this region's road data isn't consistently subtyped that
// way), so instead: turn road labels off entirely, then re-enable only
// road.highway labels, which is subtype-independent. Road geometry/colors
// are untouched — `visibility: 'simplified'` on road geometry caused an
// ANR/crash on this Android Google Maps SDK, and the plain line colors were
// already fine.
const MUTED_FEATURES: MapStyleElement[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
];

// MUTED_FEATURES goes LAST in both exports below: this Android Google Maps
// SDK build resolves conflicting rules by array order (last one wins) rather
// than by selector specificity, so a generic all-features `labels.text.fill`
// color rule appearing after a feature-specific `visibility: 'off'` was
// silently re-enabling those labels. Keeping the hide rules last makes them
// the final word regardless of what broader color rules came before.
export const GOOGLE_MAPS_MUTED_STYLE_LIGHT: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#f2f2f2' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e0ebe0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d7e3ee' }] },
  ...MUTED_FEATURES,
];

export const GOOGLE_MAPS_MUTED_STYLE_DARK: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#1d2129' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d2129' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a929e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d4dae2' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f3324' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2f38' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1d2129' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a4152' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1d2129' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b9c1cc' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1a2b' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d8c' }] },
  ...MUTED_FEATURES,
];

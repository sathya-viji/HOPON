/**
 * Google Places (New) — autocomplete + details for the location picker.
 *
 * Two calls make a "session": several autocomplete requests (as the user types)
 * + one Place Details on selection, grouped by a sessionToken for billing. The
 * key is client-embedded (EXPO_PUBLIC) — restrict it to the Places API and proxy
 * via an Edge Function before scale (flagged follow-up in the Wave 2 report).
 */
const KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const BASE = 'https://places.googleapis.com/v1';

// Bias predictions toward the launch city (Bangalore) without hard-restricting.
const LOCATION_BIAS = {
  circle: { center: { latitude: 12.9716, longitude: 77.5946 }, radius: 50000 },
};

export interface PlacePrediction {
  placeId: string;
  main: string;       // structured main text, e.g. "Third Wave Coffee"
  secondary: string;  // structured secondary text, e.g. "Koramangala, Bengaluru"
}

export interface PlaceLocation {
  label: string;
  lat: number;
  lng: number;
}

/** Opaque per-session token (groups autocomplete + details for billing). */
export function newPlacesSession(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

interface AutocompleteJson {
  suggestions?: { placePrediction?: {
    placeId: string;
    text?: { text?: string };
    structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
  } }[];
}

export async function placesAutocomplete(input: string, sessionToken: string): Promise<PlacePrediction[]> {
  if (!KEY) throw new Error('Places API key missing');
  const res = await fetch(`${BASE}/places:autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY },
    body: JSON.stringify({ input, sessionToken, locationBias: LOCATION_BIAS }),
  });
  if (!res.ok) throw new Error(`places autocomplete ${res.status}`);
  const json = (await res.json()) as AutocompleteJson;
  return (json.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
    .map((p) => ({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secondary: p.structuredFormat?.secondaryText?.text ?? '',
    }));
}

interface DetailsJson {
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
  displayName?: { text?: string };
}

export async function placeDetails(placeId: string, sessionToken: string): Promise<PlaceLocation> {
  if (!KEY) throw new Error('Places API key missing');
  const res = await fetch(`${BASE}/places/${placeId}?sessionToken=${encodeURIComponent(sessionToken)}`, {
    headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'location,formattedAddress,displayName' },
  });
  if (!res.ok) throw new Error(`place details ${res.status}`);
  const json = (await res.json()) as DetailsJson;
  if (!json.location) throw new Error('place details: no location');
  return {
    label: json.displayName?.text ?? json.formattedAddress ?? '',
    lat: json.location.latitude,
    lng: json.location.longitude,
  };
}

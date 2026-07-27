"use client";

export interface GeocodedAddress {
  lat: number;
  lng: number;
  formattedAddress?: string;
  placeId?: string;
  isApproximate?: boolean;
}

export async function geocodeAddress(address: {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
} | string): Promise<GeocodedAddress | null> {
  let street = '';
  let number = '';
  let neighborhood = '';
  let city = 'Campina Grande';
  let state = 'PB';
  let zipCode = '';

  if (typeof address === 'string') {
    street = address;
  } else if (address) {
    street = address.street || '';
    number = address.number || '';
    neighborhood = address.neighborhood || '';
    city = address.city || 'Campina Grande';
    state = address.state || 'PB';
    zipCode = address.zipCode || '';
  }

  if (!street && !zipCode) return null;

  const fullQuery = street.toLowerCase().includes('campina grande') 
    ? street 
    : `${street} ${number}, ${neighborhood}, ${city} - ${state}, Brasil`.replace(/\s+/g, ' ').trim();

  return searchFreeTextAddress(fullQuery);
}

// Busca Livre por Texto (Geocoding API + Text Search Multi-Provider)
export async function searchFreeTextAddress(originalQuery: string): Promise<GeocodedAddress | null> {
  const query = originalQuery.trim();
  if (!query) return null;

  const fullQuery = query.toLowerCase().includes('campina grande') || query.toLowerCase().includes('pb')
    ? query
    : `${query}, Campina Grande - PB, Brasil`;

  // ETAPA 1: Esri ArcGIS World Geocoding
  try {
    const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(fullQuery)}&f=json&maxLocations=1`;
    const esriRes = await fetch(esriUrl);
    const esriData = await esriRes.json();
    if (esriData && esriData.candidates && esriData.candidates.length > 0) {
      const candidate = esriData.candidates[0];
      const loc = candidate.location;
      const score = candidate.score || 100;
      return { 
        lat: loc.y, 
        lng: loc.x, 
        formattedAddress: candidate.address || fullQuery,
        isApproximate: score < 80
      };
    }
  } catch (e) {}

  // ETAPA 2: Photon API (Komoot / OpenStreetMap)
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(fullQuery)}&limit=1`);
    const data = await res.json();
    if (data && data.features && data.features.length > 0) {
      const feat = data.features[0];
      const coords = feat.geometry.coordinates;
      const props = feat.properties;
      const formatted = [props.name, props.street, props.housenumber, props.city || 'Campina Grande', props.state || 'PB']
        .filter(Boolean)
        .join(', ');

      return { 
        lat: coords[1], 
        lng: coords[0],
        formattedAddress: formatted || fullQuery,
        isApproximate: false
      };
    }
  } catch (e) {}

  // ETAPA 3: OpenStreetMap Nominatim
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`);
    const data = await res.json();
    if (data && data.length > 0) {
      return { 
        lat: parseFloat(data[0].lat), 
        lng: parseFloat(data[0].lon),
        formattedAddress: data[0].display_name,
        isApproximate: data[0].type === 'administrative' || data[0].type === 'city'
      };
    }
  } catch (e) {}

  return null;
}
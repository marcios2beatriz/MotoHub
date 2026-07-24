"use client";

export interface GeocodedAddress {
  lat: number;
  lng: number;
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

  // 1. Busca Direta via Nominatim OpenStreetMap (Endereço Completo com Número)
  if (street) {
    try {
      const fullQuery = `${street} ${number}, ${neighborhood}, ${city} - ${state}, Brasil`.replace(/\s+/g, ' ').trim();
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }

      // Tentar sem o número para garantir que acha a rua no bairro correto
      const queryStreetNeighborhood = `${street}, ${neighborhood}, ${city} - ${state}, Brasil`.replace(/\s+/g, ' ').trim();
      const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStreetNeighborhood)}&limit=1`);
      const data2 = await res2.json();
      if (data2 && data2.length > 0) {
        return { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) };
      }
    } catch (e) {}
  }

  // 2. Busca via Photon API (Suporta locais comerciais e condomínios)
  if (street) {
    try {
      const photonQuery = `${street} ${number}, ${city}`.replace(/\s+/g, ' ').trim();
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(photonQuery)}&limit=1`);
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates;
        return { lat: coords[1], lng: coords[0] };
      }
    } catch (e) {}
  }

  // 3. Geocodificação por CEP via ViaCEP + Nominatim
  if (zipCode) {
    const cleanCep = zipCode.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const cepData = await res.json();
        if (cepData && !cepData.erro) {
          const cepQuery = `${cepData.logradouro} ${number}, ${cepData.bairro}, ${cepData.localidade} - ${cepData.uf}, Brasil`;
          const resNom = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cepQuery)}&limit=1`);
          const nomData = await resNom.json();
          if (nomData && nomData.length > 0) {
            return { lat: parseFloat(nomData[0].lat), lng: parseFloat(nomData[0].lon) };
          }
        }
      } catch (e) {}
    }
  }

  return null;
}
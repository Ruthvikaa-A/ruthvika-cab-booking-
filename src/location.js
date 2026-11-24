import { BENGALURU_PLACES, BANGALORE_BOUNDS } from "./data";

const insideBengaluru = (lat, lon) =>
  lat >= BANGALORE_BOUNDS.minLat && lat <= BANGALORE_BOUNDS.maxLat &&
  lon >= BANGALORE_BOUNDS.minLon && lon <= BANGALORE_BOUNDS.maxLon;

const normalize = (place) => ({
  name: place.name,
  label: place.label || `${place.name}, Bengaluru, Karnataka`,
  lat: Number(place.lat), lon: Number(place.lon),
  source: place.source || "Bengaluru locality database"
});

export async function searchBengaluru(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  const needle = q.toLowerCase();

  const local = BENGALURU_PLACES
    .filter(p => p.name.toLowerCase().includes(needle) || p.label.toLowerCase().includes(needle))
    .map(normalize);

  let remote = [];
  try {
    const params = new URLSearchParams({
      q: `${q}, Bengaluru, Karnataka, India`,
      limit: "12",
      lang: "en",
      lat: "12.9716",
      lon: "77.5946",
      bbox: `${BANGALORE_BOUNDS.minLon},${BANGALORE_BOUNDS.minLat},${BANGALORE_BOUNDS.maxLon},${BANGALORE_BOUNDS.maxLat}`
    });
    const response = await fetch(`https://photon.komoot.io/api/?${params}`);
    if (response.ok) {
      const data = await response.json();
      remote = (data.features || []).map(f => {
        const [lon, lat] = f.geometry.coordinates;
        const p = f.properties || {};
        const name = p.name || p.street || p.locality || p.district || q;
        const area = [p.suburb, p.city || p.district, "Bengaluru"].filter(Boolean).join(", ");
        return { name, label: `${name}${area ? `, ${area}` : ""}`, lat, lon, source: "OpenStreetMap" };
      }).filter(p => insideBengaluru(p.lat, p.lon));
    }
  } catch {
    // The offline Bengaluru list remains available when the public geocoder is offline.
  }

  const combined = [...local, ...remote];
  const unique = new Map();
  combined.forEach(p => {
    const key = `${p.name.toLowerCase()}-${p.lat.toFixed(4)}-${p.lon.toFixed(4)}`;
    if (!unique.has(key)) unique.set(key, p);
  });
  const matches = [...unique.values()].slice(0, 18);
  // Keep the dropdown useful for misspellings or unfamiliar addresses: offer popular Bengaluru destinations.
  if (matches.length === 0) {
    return BENGALURU_PLACES.slice(0, 12).map(p => ({
      ...normalize(p), source: "Popular Bengaluru locations"
    }));
  }
  return matches;
}

export async function getRoadRoute(from, to) {
  const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Routing service unavailable");
  const data = await response.json();
  if (data.code !== "Ok" || !data.routes?.length) throw new Error("No road route returned");
  const route = data.routes[0];
  return {
    km: route.distance / 1000,
    minutes: route.duration / 60,
    geometry: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    approximate: false
  };
}

export function straightLineEstimate(from, to) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(to.lat - from.lat);
  const dLon = rad(to.lon - from.lon);
  const a = Math.sin(dLat/2)**2 + Math.cos(rad(from.lat))*Math.cos(rad(to.lat))*Math.sin(dLon/2)**2;
  return {
    km: 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)),
    minutes: 0,
    geometry: [[from.lat, from.lon], [to.lat, to.lon]],
    approximate: true
  };
}
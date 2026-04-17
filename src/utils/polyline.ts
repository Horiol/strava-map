/**
 * Decodes a polyline string into an array of [lat, lng] coordinates.
 *
 * Uses Google's polyline algorithm, which is the same format Strava
 * emits in `activity.map.summary_polyline`.
 */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  if (!encoded || typeof encoded !== 'string') {
    return []
  }

  const factor = Math.pow(10, precision)
  const coordinates: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let byte = 0
    let shift = 0
    let result = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lat += deltaLat

    shift = 0
    result = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lng += deltaLng

    coordinates.push([lat / factor, lng / factor])
  }

  return coordinates
}

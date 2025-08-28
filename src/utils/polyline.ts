/**
 * Decodes a polyline string into an array of [lat, lng] coordinates
 * Uses Google's polyline algorithm which is used by Strava
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
    // Decode latitude
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

    // Decode longitude
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

/**
 * Encodes an array of [lat, lng] coordinates into a polyline string
 */
export function encodePolyline(coordinates: [number, number][], precision = 5): string {
  if (!coordinates || coordinates.length === 0) {
    return ''
  }

  const factor = Math.pow(10, precision)
  let encoded = ''
  let prevLat = 0
  let prevLng = 0

  for (const [lat, lng] of coordinates) {
    const roundedLat = Math.round(lat * factor)
    const roundedLng = Math.round(lng * factor)

    const deltaLat = roundedLat - prevLat
    const deltaLng = roundedLng - prevLng

    prevLat = roundedLat
    prevLng = roundedLng

    encoded += encodeValue(deltaLat)
    encoded += encodeValue(deltaLng)
  }

  return encoded
}

function encodeValue(value: number): string {
  value = value < 0 ? ~(value << 1) : value << 1
  let encoded = ''

  while (value >= 0x20) {
    encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63)
    value >>= 5
  }

  encoded += String.fromCharCode(value + 63)
  return encoded
}

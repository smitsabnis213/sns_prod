import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coordinates } from '../types'

const buddyIcon = L.divIcon({
  className: 'map-pin map-pin--buddy',
  html: '<span aria-hidden="true"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})
const destinationIcon = L.divIcon({
  className: 'map-pin map-pin--destination',
  html: '<span aria-hidden="true"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

function FitMarkers({ points }: { points: Coordinates[] }) {
  const map = useMap()
  if (points.length > 1) {
    map.fitBounds(points.map((point) => [point.latitude, point.longitude]), { padding: [30, 30] })
  } else if (points.length === 1) {
    map.setView([points[0].latitude, points[0].longitude], 14)
  }
  return null
}

export function MapPreview({
  destination,
  current,
}: {
  destination?: Coordinates
  current?: Coordinates
}) {
  const points = [current, destination].filter((point): point is Coordinates => Boolean(point))
  if (!points.length) {
    return (
      <div className="map-empty" role="status">
        <span className="map-empty__grid" aria-hidden="true" />
        <strong>Map location unavailable</strong>
        <span>A destination or Buddy location will appear here when the order data includes it.</span>
      </div>
    )
  }

  const center: [number, number] = [points[0].latitude, points[0].longitude]
  return (
    <div className="map-frame" aria-label="Order location map">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMarkers points={points} />
        {current && <Marker position={[current.latitude, current.longitude]} icon={buddyIcon} />}
        {destination && <Marker position={[destination.latitude, destination.longitude]} icon={destinationIcon} />}
      </MapContainer>
      <div className="map-legend">
        {current && <span><i className="legend-dot legend-dot--buddy" /> Buddy location</span>}
        {destination && <span><i className="legend-dot legend-dot--destination" /> Delivery address</span>}
      </div>
    </div>
  )
}

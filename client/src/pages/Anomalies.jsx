import AnomalyFeed from '../components/AnomalyFeed'

export default function Anomalies() {
  return (
    <div className="max-w-4xl mx-auto py-6">
      <AnomalyFeed limit={500} />
    </div>
  )
}

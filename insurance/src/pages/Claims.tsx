import { useState } from 'react'
import { Search, CheckCircle, XCircle, AlertTriangle, Download, Eye } from 'lucide-react'

const mockClaims = [
  {
    id: '1',
    claim_id: 'CLM-2026-001',
    damage_location: { lat: 19.076, lng: 72.8777 },
    damage_type: 'tire_puncture',
    validation_result: 'CONFIRMED',
    nearest_pothole_id: 'PH-1234',
    distance_meters: 12,
    risk_score: 8.7,
    confidence: 0.94,
    created_at: '2026-03-23T10:30:00Z',
    insurance_company: 'SafeDrive Insurance'
  },
  {
    id: '2',
    claim_id: 'CLM-2026-002',
    damage_location: { lat: 19.078, lng: 72.879 },
    damage_type: 'suspension_damage',
    validation_result: 'DISPUTED',
    nearest_pothole_id: 'PH-1235',
    distance_meters: 45,
    risk_score: 5.2,
    confidence: 0.62,
    created_at: '2026-03-22T14:15:00Z',
    insurance_company: 'QuickClaim Corp'
  },
  {
    id: '3',
    claim_id: 'CLM-2026-003',
    damage_location: { lat: 19.072, lng: 72.875 },
    damage_type: 'other',
    validation_result: 'UNCONFIRMED',
    nearest_pothole_id: null,
    distance_meters: 250,
    risk_score: 1.5,
    confidence: 0.78,
    created_at: '2026-03-22T09:45:00Z',
    insurance_company: 'AutoSecure'
  },
  {
    id: '4',
    claim_id: 'CLM-2026-004',
    damage_location: { lat: 19.080, lng: 72.882 },
    damage_type: 'tire_puncture',
    validation_result: 'CONFIRMED',
    nearest_pothole_id: 'PH-1236',
    distance_meters: 8,
    risk_score: 9.1,
    confidence: 0.97,
    created_at: '2026-03-21T16:20:00Z',
    insurance_company: 'SafeDrive Insurance'
  },
]

const getResultIcon = (result: string) => {
  switch (result) {
    case 'CONFIRMED':
      return <CheckCircle size={16} className="text-green-400" />
    case 'DISPUTED':
      return <AlertTriangle size={16} className="text-yellow-400" />
    case 'UNCONFIRMED':
      return <XCircle size={16} className="text-red-400" />
    default:
      return null
  }
}

const getResultStyle = (result: string) => {
  switch (result) {
    case 'CONFIRMED':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'DISPUTED':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'UNCONFIRMED':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    default:
      return ''
  }
}

export default function Claims() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedClaim, setSelectedClaim] = useState<typeof mockClaims[0] | null>(null)

  const filteredClaims = mockClaims.filter(claim => {
    const matchesSearch = claim.claim_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.insurance_company.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || claim.validation_result === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: mockClaims.length,
    confirmed: mockClaims.filter(c => c.validation_result === 'CONFIRMED').length,
    disputed: mockClaims.filter(c => c.validation_result === 'DISPUTED').length,
    unconfirmed: mockClaims.filter(c => c.validation_result === 'UNCONFIRMED').length,
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl p-4 border border-surface-light">
          <p className="text-sm text-gray-500">Total Claims</p>
          <p className="text-2xl font-bold font-mono mt-1">{stats.total}</p>
        </div>
        <div className="bg-surface rounded-xl p-4 border border-surface-light">
          <p className="text-sm text-gray-500">Confirmed</p>
          <p className="text-2xl font-bold font-mono mt-1 text-green-400">{stats.confirmed}</p>
        </div>
        <div className="bg-surface rounded-xl p-4 border border-surface-light">
          <p className="text-sm text-gray-500">Disputed</p>
          <p className="text-2xl font-bold font-mono mt-1 text-yellow-400">{stats.disputed}</p>
        </div>
        <div className="bg-surface rounded-xl p-4 border border-surface-light">
          <p className="text-sm text-gray-500">Unconfirmed</p>
          <p className="text-2xl font-bold font-mono mt-1 text-red-400">{stats.unconfirmed}</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by claim ID or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-surface-light rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'CONFIRMED', 'DISPUTED', 'UNCONFIRMED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                statusFilter === status
                  ? 'bg-primary text-white'
                  : 'bg-surface text-gray-400 hover:text-white border border-surface-light'
              }`}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>
        <button className="flex items-center justify-center px-4 py-2 bg-surface border border-surface-light rounded-lg text-sm hover:bg-surface-light transition">
          <Download size={16} className="mr-2" />
          Export
        </button>
      </div>

      {/* Claims List */}
      <div className="bg-surface rounded-xl border border-surface-light overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-500 border-b border-surface-light bg-surface-light/50">
              <th className="px-4 py-3 font-medium">Claim ID</th>
              <th className="px-4 py-3 font-medium">Result</th>
              <th className="px-4 py-3 font-medium">Risk Score</th>
              <th className="px-4 py-3 font-medium">Distance</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filteredClaims.map((claim) => (
              <tr key={claim.id} className="border-b border-surface-light/50 hover:bg-surface-light/30">
                <td className="px-4 py-3 font-mono">{claim.claim_id}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getResultStyle(claim.validation_result)}`}>
                    {getResultIcon(claim.validation_result)}
                    <span className="ml-1.5">{claim.validation_result}</span>
                  </span>
                </td>
                <td className="px-4 py-3 font-mono">
                  <span className={claim.risk_score >= 7 ? 'text-red-400' : claim.risk_score >= 4 ? 'text-yellow-400' : 'text-green-400'}>
                    {claim.risk_score}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-gray-400">{claim.distance_meters}m</td>
                <td className="px-4 py-3">{claim.insurance_company}</td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(claim.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <button 
                    onClick={() => setSelectedClaim(claim)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-surface-light rounded"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl max-w-lg w-full border border-surface-light">
            <div className="p-4 border-b border-surface-light flex items-center justify-between">
              <h3 className="font-semibold">Claim Details</h3>
              <button 
                onClick={() => setSelectedClaim(null)}
                className="text-gray-500 hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Claim ID</p>
                  <p className="font-mono">{selectedClaim.claim_id}</p>
                </div>
                <div>
                  <p className="text-gray-500">Result</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getResultStyle(selectedClaim.validation_result)}`}>
                    {getResultIcon(selectedClaim.validation_result)}
                    <span className="ml-1.5">{selectedClaim.validation_result}</span>
                  </span>
                </div>
                <div>
                  <p className="text-gray-500">Risk Score</p>
                  <p className="font-mono">{selectedClaim.risk_score}</p>
                </div>
                <div>
                  <p className="text-gray-500">Confidence</p>
                  <p className="font-mono">{(selectedClaim.confidence * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-gray-500">Distance to Nearest</p>
                  <p className="font-mono">{selectedClaim.distance_meters}m</p>
                </div>
                <div>
                  <p className="text-gray-500">Damage Type</p>
                  <p className="capitalize">{selectedClaim.damage_type.replace('_', ' ')}</p>
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Location</p>
                <p className="font-mono text-sm mt-1">
                  {selectedClaim.damage_location.lat.toFixed(6)}, {selectedClaim.damage_location.lng.toFixed(6)}
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-surface-light flex space-x-3">
              <button 
                onClick={() => setSelectedClaim(null)}
                className="flex-1 py-2 bg-surface-light rounded-lg font-medium hover:bg-gray-700 transition"
              >
                Close
              </button>
              <button className="flex-1 py-2 bg-primary rounded-lg font-medium hover:bg-primary-light transition">
                Validate Manually
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

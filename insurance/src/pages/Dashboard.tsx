import { 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Activity,
  RefreshCw
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

// Mock data for demonstration
const mockSummary = {
  total_potholes: 1247,
  active_potholes: 892,
  resolved_potholes: 355,
  verified_potholes: 634,
  avg_severity: 2.8,
  reports_today: 47,
  reports_this_week: 312,
  reports_this_month: 847,
  city: 'Mumbai'
}

const mockTrends = [
  { date: 'Mon', count: 42, avg_severity: 2.5 },
  { date: 'Tue', count: 38, avg_severity: 2.8 },
  { date: 'Wed', count: 51, avg_severity: 3.1 },
  { date: 'Thu', count: 45, avg_severity: 2.9 },
  { date: 'Fri', count: 62, avg_severity: 2.7 },
  { date: 'Sat', count: 35, avg_severity: 2.4 },
  { date: 'Sun', count: 28, avg_severity: 2.2 },
]

const mockSeverityData = [
  { name: 'Minor', value: 234, color: '#4ade80' },
  { name: 'Low', value: 312, color: '#a3e635' },
  { name: 'Moderate', value: 398, color: '#facc15' },
  { name: 'High', value: 203, color: '#f97316' },
  { name: 'Critical', value: 100, color: '#ef4444' },
]

const mockClaims = [
  { 
    claim_id: 'CLM-001', 
    result: 'CONFIRMED', 
    risk_score: 8.5, 
    distance: 15,
    date: '2026-03-23'
  },
  { 
    claim_id: 'CLM-002', 
    result: 'DISPUTED', 
    risk_score: 5.2, 
    distance: 85,
    date: '2026-03-22'
  },
  { 
    claim_id: 'CLM-003', 
    result: 'UNCONFIRMED', 
    risk_score: 2.1, 
    distance: 250,
    date: '2026-03-22'
  },
]

export default function Dashboard() {
  // In production, uncomment these and remove mock data
  // const { data: summary } = useQuery({
  //   queryKey: ['summary'],
  //   queryFn: () => axiosInstance.get('/analytics/summary').then(r => r.data),
  //   refetchInterval: 30000,
  // })

  // const { data: trends } = useQuery({
  //   queryKey: ['trends'],
  //   queryFn: () => axiosInstance.get('/analytics/trends', { params: { period: 'daily', days: 7 } }).then(r => r.data),
  // })

  const stats = [
    { 
      label: 'Total Potholes', 
      value: mockSummary.total_potholes.toLocaleString(), 
      icon: MapPin, 
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20'
    },
    { 
      label: 'Active (Unresolved)', 
      value: mockSummary.active_potholes.toLocaleString(), 
      icon: AlertTriangle, 
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20'
    },
    { 
      label: 'Verified', 
      value: mockSummary.verified_potholes.toLocaleString(), 
      icon: CheckCircle, 
      color: 'text-green-400',
      bgColor: 'bg-green-500/20'
    },
    { 
      label: 'Reports Today', 
      value: mockSummary.reports_today, 
      icon: Clock, 
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20'
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div 
            key={stat.label} 
            className="bg-surface rounded-xl p-5 border border-surface-light"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon size={20} className={stat.color} />
              </div>
              <RefreshCw size={16} className="text-gray-600 cursor-pointer hover:text-gray-400" />
            </div>
            <p className="text-2xl font-bold font-mono">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-surface rounded-xl p-5 border border-surface-light">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold flex items-center">
              <TrendingUp size={18} className="mr-2 text-primary" />
              Reports Trend (Last 7 Days)
            </h3>
            <select className="bg-surface-light text-sm px-3 py-1.5 rounded-lg border border-gray-700">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={mockTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#252532" />
              <XAxis dataKey="date" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a24', 
                  border: '1px solid #333',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#ff4444" 
                strokeWidth={2}
                dot={{ fill: '#ff4444', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Distribution */}
        <div className="bg-surface rounded-xl p-5 border border-surface-light">
          <h3 className="font-semibold mb-6 flex items-center">
            <Activity size={18} className="mr-2 text-primary" />
            Severity Distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={mockSeverityData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {mockSeverityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a24', 
                  border: '1px solid #333',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {mockSeverityData.map((item) => (
              <div key={item.name} className="flex items-center text-xs">
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-400">{item.name}</span>
                <span className="ml-auto font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Claims */}
      <div className="bg-surface rounded-xl p-5 border border-surface-light">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recent Claim Validations</h3>
          <button className="text-sm text-primary hover:underline">
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-surface-light">
                <th className="pb-3 font-medium">Claim ID</th>
                <th className="pb-3 font-medium">Result</th>
                <th className="pb-3 font-medium">Risk Score</th>
                <th className="pb-3 font-medium">Distance (m)</th>
                <th className="pb-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {mockClaims.map((claim) => (
                <tr key={claim.claim_id} className="border-b border-surface-light/50">
                  <td className="py-3 font-mono">{claim.claim_id}</td>
                  <td className="py-3">
                    <span 
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        claim.result === 'CONFIRMED' 
                          ? 'bg-green-500/20 text-green-400'
                          : claim.result === 'DISPUTED'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {claim.result}
                    </span>
                  </td>
                  <td className="py-3 font-mono">{claim.risk_score}</td>
                  <td className="py-3 font-mono text-gray-400">{claim.distance}</td>
                  <td className="py-3 text-gray-400">{claim.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

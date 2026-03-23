import { useState } from 'react'
import { BarChart3, TrendingUp, MapPin, Calendar, Download } from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'

const mockMonthlyData = [
  { month: 'Jan', reports: 423, resolved: 156, avgSeverity: 2.9 },
  { month: 'Feb', reports: 512, resolved: 198, avgSeverity: 3.1 },
  { month: 'Mar', reports: 478, resolved: 201, avgSeverity: 2.8 },
  { month: 'Apr', reports: 534, resolved: 234, avgSeverity: 3.0 },
  { month: 'May', reports: 612, resolved: 287, avgSeverity: 2.7 },
  { month: 'Jun', reports: 698, resolved: 312, avgSeverity: 2.5 },
]

const mockTopRoads = [
  { road: 'MG Road', count: 89, avgSeverity: 3.4, trend: '+12%' },
  { road: 'SV Road', count: 76, avgSeverity: 3.1, trend: '+8%' },
  { road: 'Nehru Road', count: 65, avgSeverity: 2.9, trend: '-3%' },
  { road: 'Linking Road', count: 54, avgSeverity: 3.5, trend: '+15%' },
  { road: 'Juhu Beach Road', count: 48, avgSeverity: 2.6, trend: '-5%' },
]

const mockHourlyData = [
  { hour: '00:00', count: 12 },
  { hour: '04:00', count: 8 },
  { hour: '08:00', count: 45 },
  { hour: '12:00', count: 38 },
  { hour: '16:00', count: 52 },
  { hour: '20:00', count: 28 },
]

export default function Analytics() {
  const [period, setPeriod] = useState('monthly')

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          {['weekly', 'monthly', 'yearly'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                period === p
                  ? 'bg-primary text-white'
                  : 'bg-surface text-gray-400 hover:text-white border border-surface-light'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <button className="flex items-center px-4 py-2 bg-surface border border-surface-light rounded-lg text-sm hover:bg-surface-light transition">
          <Download size={16} className="mr-2" />
          Export Report
        </button>
      </div>

      {/* Reports Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Reports */}
        <div className="bg-surface rounded-xl p-5 border border-surface-light">
          <h3 className="font-semibold mb-6 flex items-center">
            <TrendingUp size={18} className="mr-2 text-primary" />
            Reports Over Time
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={mockMonthlyData}>
              <defs>
                <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ff4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#252532" />
              <XAxis dataKey="month" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a24', 
                  border: '1px solid #333',
                  borderRadius: '8px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="reports" 
                stroke="#ff4444" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorReports)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Resolution Rate */}
        <div className="bg-surface rounded-xl p-5 border border-surface-light">
          <h3 className="font-semibold mb-6 flex items-center">
            <BarChart3 size={18} className="mr-2 text-green-400" />
            Reports vs Resolutions
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#252532" />
              <XAxis dataKey="month" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a24', 
                  border: '1px solid #333',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="reports" fill="#ff4444" radius={[4, 4, 0, 0]} name="Reports" />
              <Bar dataKey="resolved" fill="#4ade80" radius={[4, 4, 0, 0]} name="Resolved" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Roads */}
      <div className="bg-surface rounded-xl p-5 border border-surface-light">
        <h3 className="font-semibold mb-6 flex items-center">
          <MapPin size={18} className="mr-2 text-yellow-400" />
          Roads with Most Potholes
        </h3>
        <div className="space-y-3">
          {mockTopRoads.map((road, index) => (
            <div 
              key={road.road} 
              className="flex items-center p-3 bg-surface-light/50 rounded-lg"
            >
              <span className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm mr-3">
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium">{road.road}</p>
                <p className="text-sm text-gray-500">{road.count} potholes • Avg severity: {road.avgSeverity}</p>
              </div>
              <span className={`text-sm font-medium px-2 py-1 rounded ${
                road.trend.startsWith('+') 
                  ? 'bg-red-500/20 text-red-400' 
                  : 'bg-green-500/20 text-green-400'
              }`}>
                {road.trend}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Peak Hours */}
      <div className="bg-surface rounded-xl p-5 border border-surface-light">
        <h3 className="font-semibold mb-6 flex items-center">
          <Calendar size={18} className="mr-2 text-purple-400" />
          Peak Reporting Hours
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={mockHourlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#252532" />
            <XAxis dataKey="hour" stroke="#666" fontSize={12} />
            <YAxis stroke="#666" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a1a24', 
                border: '1px solid #333',
                borderRadius: '8px'
              }}
            />
            <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

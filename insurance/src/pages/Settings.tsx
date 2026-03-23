import { useState } from 'react'
import { User, Bell, Shield, Webhook, Key, Save } from 'lucide-react'

export default function Settings() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [notifications, setNotifications] = useState({
    newReports: true,
    claimsValidation: true,
    dailySummary: false,
  })

  return (
    <div className="max-w-3xl space-y-6">
      {/* Profile Settings */}
      <div className="bg-surface rounded-xl p-6 border border-surface-light">
        <h3 className="font-semibold mb-4 flex items-center">
          <User size={18} className="mr-2 text-primary" />
          Company Profile
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Company Name</label>
            <input 
              type="text" 
              defaultValue="SafeDrive Insurance"
              className="w-full bg-surface-light rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Contact Email</label>
            <input 
              type="email" 
              defaultValue="claims@safedrive.com"
              className="w-full bg-surface-light rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">API Key</label>
            <div className="flex">
              <input 
                type="password" 
                defaultValue="sk_live_xxxxxxxxxxxx"
                className="flex-1 bg-surface-light rounded-lg-l px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                disabled
              />
              <button className="bg-surface-light px-4 rounded-r-lg border-l border-gray-700 hover:bg-gray-700 transition">
                <Key size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-surface rounded-xl p-6 border border-surface-light">
        <h3 className="font-semibold mb-4 flex items-center">
          <Bell size={18} className="mr-2 text-primary" />
          Notifications
        </h3>
        <div className="space-y-4">
          {[
            { key: 'newReports', label: 'New Pothole Reports', description: 'Get notified when new potholes are reported in your area' },
            { key: 'claimsValidation', label: 'Claims Validation', description: 'Receive alerts for claim validation requests' },
            { key: 'dailySummary', label: 'Daily Summary', description: 'Get a daily report of road conditions' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 bg-surface-light/50 rounded-lg">
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={notifications[item.key as keyof typeof notifications]}
                  onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook Settings */}
      <div className="bg-surface rounded-xl p-6 border border-surface-light">
        <h3 className="font-semibold mb-4 flex items-center">
          <Webhook size={18} className="mr-2 text-primary" />
          Webhook Configuration
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Webhook URL</label>
            <input 
              type="url" 
              placeholder="https://your-server.com/webhooks/safaroad"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full bg-surface-light rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-gray-500 mt-1">
              We'll POST pothole data to this URL when events occur
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Webhook Secret</label>
            <input 
              type="password" 
              placeholder="Leave empty to generate new secret"
              className="w-full bg-surface-light rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            />
          </div>
          <div className="p-3 bg-surface-light/50 rounded-lg">
            <p className="text-sm font-medium mb-2">Events to subscribe:</p>
            <div className="flex flex-wrap gap-2">
              {['pothole.reported', 'pothole.verified', 'pothole.resolved', 'claim.validated'].map((event) => (
                <span key={event} className="px-2 py-1 bg-background rounded text-xs font-mono text-gray-400">
                  {event}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-surface rounded-xl p-6 border border-surface-light">
        <h3 className="font-semibold mb-4 flex items-center">
          <Shield size={18} className="mr-2 text-primary" />
          Security
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-surface-light/50 rounded-lg">
            <div>
              <p className="font-medium">Two-Factor Authentication</p>
              <p className="text-sm text-gray-500">Add an extra layer of security</p>
            </div>
            <button className="px-4 py-2 bg-primary/20 text-primary rounded-lg text-sm font-medium hover:bg-primary/30 transition">
              Enable
            </button>
          </div>
          <div className="flex items-center justify-between p-3 bg-surface-light/50 rounded-lg">
            <div>
              <p className="font-medium">API Rate Limits</p>
              <p className="text-sm text-gray-500">1000 requests per minute</p>
            </div>
            <span className="text-sm text-gray-400">Current plan</span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="flex items-center px-6 py-3 bg-primary rounded-lg font-medium hover:bg-primary-light transition">
          <Save size={18} className="mr-2" />
          Save Changes
        </button>
      </div>
    </div>
  )
}

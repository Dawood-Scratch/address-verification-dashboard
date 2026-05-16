import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Send, ClipboardList, BarChart2,
  Key, LogOut, CheckCircle2, XCircle, Clock, AlertTriangle,
  Search, Download, RefreshCw, Plus, Eye, Copy, ChevronDown,
  MapPin, Shield, TrendingUp, Users, Activity
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://web-production-dc1f3.up.railway.app'

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_VERIFICATIONS = [
  { id: 'VRF-001', customer: 'James Okafor', email: 'james@example.com', address: '12 Baker Street, London, NW1 6XE', status: 'verified', risk: 0.1, distance: 45, timestamp: '2026-05-16T09:12:00Z', method: 'GPS' },
  { id: 'VRF-002', customer: 'Amina Hassan', email: 'amina@example.com', address: '7 Victoria Road, Manchester, M14 5RP', status: 'review', risk: 0.7, distance: 820, timestamp: '2026-05-16T08:45:00Z', method: 'GPS' },
  { id: 'VRF-003', customer: 'Peter Mensah', email: 'peter@example.com', address: '3 Elm Close, Birmingham, B15 2TT', status: 'verified', risk: 0.2, distance: 120, timestamp: '2026-05-16T08:20:00Z', method: 'GPS' },
  { id: 'VRF-004', customer: 'Sarah Williams', email: 'sarah@example.com', address: '45 High Street, Leeds, LS1 4AX', status: 'declined', risk: null, distance: null, timestamp: '2026-05-16T07:55:00Z', method: 'N/A' },
  { id: 'VRF-005', customer: 'David Asante', email: 'david@example.com', address: '88 Park Lane, Liverpool, L1 8JQ', status: 'verified', risk: 0.15, distance: 67, timestamp: '2026-05-15T17:30:00Z', method: 'GPS' },
  { id: 'VRF-006', customer: 'Fatima Al-Rashid', email: 'fatima@example.com', address: '22 Queen Street, Edinburgh, EH2 1JX', status: 'pending', risk: null, distance: null, timestamp: '2026-05-15T16:10:00Z', method: 'Pending' },
  { id: 'VRF-007', customer: 'Michael Boateng', email: 'michael@example.com', address: '5 Castle Road, Cardiff, CF10 3NP', status: 'verified', risk: 0.05, distance: 23, timestamp: '2026-05-15T14:45:00Z', method: 'GPS' },
  { id: 'VRF-008', customer: 'Ngozi Eze', email: 'ngozi@example.com', address: '17 Riverside Drive, Bristol, BS1 4RR', status: 'review', risk: 0.85, distance: 2400, timestamp: '2026-05-15T13:20:00Z', method: 'GPS' },
]

const CHART_DATA = [
  { day: 'Mon', verified: 12, review: 2, declined: 1 },
  { day: 'Tue', verified: 18, review: 3, declined: 2 },
  { day: 'Wed', verified: 15, review: 1, declined: 0 },
  { day: 'Thu', verified: 22, review: 4, declined: 3 },
  { day: 'Fri', verified: 19, review: 2, declined: 1 },
  { day: 'Sat', verified: 8, review: 1, declined: 0 },
  { day: 'Sun', verified: 5, review: 0, declined: 0 },
]

const PIE_DATA = [
  { name: 'Verified', value: 68, color: '#22c55e' },
  { name: 'Review', value: 18, color: '#f59e0b' },
  { name: 'Declined', value: 9, color: '#ef4444' },
  { name: 'Pending', value: 5, color: '#94a3b8' },
]

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [form, setForm] = useState({ org: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.org || !form.email || !form.password) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onLogin({ org: form.org, email: form.email })
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Shield className="w-8 h-8 text-blue-700" />
          </div>
          <h1 className="text-3xl font-bold text-white">VerifyNow</h1>
          <p className="text-blue-200 mt-1">Client Dashboard</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Sign in to your account</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organisation Name</label>
              <input
                type="text"
                placeholder="e.g. ABC Bank"
                value={form.org}
                onChange={e => setForm({ ...form, org: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="you@organisation.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Demo: enter any values to proceed
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
  }
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    verified: 'bg-green-100 text-green-700',
    review: 'bg-amber-100 text-amber-700',
    declined: 'bg-red-100 text-red-700',
    pending: 'bg-gray-100 text-gray-600',
  }
  const icons = {
    verified: <CheckCircle2 className="w-3 h-3" />,
    review: <AlertTriangle className="w-3 h-3" />,
    declined: <XCircle className="w-3 h-3" />,
    pending: <Clock className="w-3 h-3" />,
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${map[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ─── Overview Page ────────────────────────────────────────────────────────────
function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Overview</h2>
        <p className="text-sm text-gray-500 mt-0.5">Your verification activity at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Requests" value="99" sub="This month" color="blue" />
        <StatCard icon={CheckCircle2} label="Verified" value="68" sub="68.7% success rate" color="green" />
        <StatCard icon={AlertTriangle} label="Requires Review" value="18" sub="Manual check needed" color="amber" />
        <StatCard icon={XCircle} label="Declined" value="9" sub="Customer declined" color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Verifications This Week</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={CHART_DATA} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="verified" fill="#22c55e" radius={[4, 4, 0, 0]} name="Verified" />
              <Bar dataKey="review" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Review" />
              <Bar dataKey="declined" fill="#ef4444" radius={[4, 4, 0, 0]} name="Declined" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {PIE_DATA.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Recent Verifications</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {MOCK_VERIFICATIONS.slice(0, 5).map(v => (
            <div key={v.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                  {v.customer.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-800">{v.customer}</div>
                  <div className="text-xs text-gray-400">{v.address.split(',')[0]}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {v.distance !== null && (
                  <span className="text-xs text-gray-400">{v.distance}m</span>
                )}
                <StatusBadge status={v.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Send Verification Page ───────────────────────────────────────────────────
function SendVerificationPage({ orgName }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', postcode: '' })
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [link, setLink] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [sendError, setSendError] = useState('')

  const handleSend = async (e) => {
    e.preventDefault()
    setLoading(true)
    setSendError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.name,
          customerEmail: form.email,
          phone: form.phone,
          orgName: orgName,
          address: form.address,
          city: form.city,
          postcode: form.postcode
        })
      })
      const result = await response.json()
      if (response.ok) {
        setLink(result.verify_link)
        setEmailSent(result.email_sent)
        setSent(true)
      } else {
        setSendError(result.error || 'Failed to send verification request')
      }
    } catch (err) {
      setSendError('Network error — could not reach the server')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900">Send Verification Request</h2>
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Verification Request Sent!</h3>
          <p className="text-sm text-gray-500 mb-3">
            A verification link has been generated for <strong>{form.name}</strong>.
          </p>
          {emailSent ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 mb-4 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Email sent to <strong>{form.email}</strong>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-4 text-sm text-amber-700">
              Email delivery unavailable — share the link below manually.
            </div>
          )}
          <div className="bg-gray-50 rounded-lg p-3 text-left mb-4">
            <p className="text-xs text-gray-500 mb-1 font-medium">Verification Link:</p>
            <p className="text-xs text-blue-600 break-all font-mono">{link}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { navigator.clipboard.writeText(link) }}
              className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50"
            >
              <Copy className="w-4 h-4" /> Copy Link
            </button>
            <button
              onClick={() => { setSent(false); setForm({ name: '', email: '', phone: '', address: '', city: '', postcode: '' }) }}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700"
            >
              Send Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Send Verification Request</h2>
        <p className="text-sm text-gray-500 mt-0.5">Enter customer details to generate and send a verification link</p>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-2xl">
        {sendError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {sendError}
          </div>
        )}
        <form onSubmit={handleSend} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. James Okafor"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="customer@email.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+44 7700 000000"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Registered Address *</label>
              <input
                required
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. 12 Baker Street"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                required
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                placeholder="e.g. London"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
              <input
                required
                value={form.postcode}
                onChange={e => setForm({ ...form, postcode: e.target.value })}
                placeholder="e.g. NW1 6XE"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
            <strong>What happens next:</strong> The customer will receive a link via email/SMS. When they click it, they will see the consent screen and verify their location in one tap.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Generating Link...' : 'Send Verification Request'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Verifications List Page ──────────────────────────────────────────────────
function VerificationsPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const filtered = MOCK_VERIFICATIONS.filter(v => {
    const matchSearch = v.customer.toLowerCase().includes(search.toLowerCase()) ||
      v.id.toLowerCase().includes(search.toLowerCase()) ||
      v.address.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || v.status === filter
    return matchSearch && matchFilter
  })

  const exportCSV = () => {
    const headers = ['ID', 'Customer', 'Address', 'Status', 'Risk Score', 'Distance (m)', 'Timestamp']
    const rows = MOCK_VERIFICATIONS.map(v => [
      v.id, v.customer, v.address, v.status,
      v.risk ?? 'N/A', v.distance ?? 'N/A',
      new Date(v.timestamp).toLocaleString()
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'verifications.csv'; a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Verifications</h2>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} records found</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 shadow-sm"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, ID or address..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="verified">Verified</option>
          <option value="review">Requires Review</option>
          <option value="declined">Declined</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Address</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Distance</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Risk</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(v => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-5 py-3.5">
                  <div className="font-medium text-gray-800">{v.customer}</div>
                  <div className="text-xs text-gray-400">{v.id}</div>
                </td>
                <td className="px-5 py-3.5 text-gray-500 hidden md:table-cell max-w-xs truncate">{v.address}</td>
                <td className="px-5 py-3.5"><StatusBadge status={v.status} /></td>
                <td className="px-5 py-3.5 text-gray-500 hidden lg:table-cell">
                  {v.distance !== null ? `${v.distance}m` : '—'}
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  {v.risk !== null ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${v.risk < 0.4 ? 'bg-green-500' : v.risk < 0.7 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${v.risk * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{v.risk}</span>
                    </div>
                  ) : '—'}
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-xs">
                  {new Date(v.timestamp).toLocaleDateString()}
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => setSelected(v)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No verifications match your search.</div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Verification Detail</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">ID</span><span className="font-mono text-gray-800">{selected.id}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium text-gray-800">{selected.customer}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="text-gray-800">{selected.email}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Address</span><span className="text-gray-800 text-right max-w-xs">{selected.address}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><StatusBadge status={selected.status} /></div>
              <div className="flex justify-between"><span className="text-gray-500">Distance</span><span className="text-gray-800">{selected.distance !== null ? `${selected.distance}m` : 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Risk Score</span><span className="text-gray-800">{selected.risk !== null ? selected.risk : 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="text-gray-800">{selected.method}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Timestamp</span><span className="text-gray-800">{new Date(selected.timestamp).toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── API Keys Page ────────────────────────────────────────────────────────────
function ApiKeysPage() {
  const [keys] = useState([
    { id: 1, name: 'Production Key', key: 'vfy_live_sk_••••••••••••••••••••••3f8a', created: '2026-01-15', lastUsed: '2026-05-16', active: true },
    { id: 2, name: 'Test Key', key: 'vfy_test_sk_••••••••••••••••••••••9c2d', created: '2026-03-01', lastUsed: '2026-05-14', active: true },
  ])
  const [copied, setCopied] = useState(null)

  const copy = (id, val) => {
    navigator.clipboard.writeText(val)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">API Keys</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your API credentials for system integration</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Generate New Key
        </button>
      </div>

      <div className="space-y-4">
        {keys.map(k => (
          <div key={k.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Key className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-800 text-sm">{k.name}</div>
                  <div className="text-xs text-gray-400">Created {k.created} · Last used {k.lastUsed}</div>
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${k.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {k.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2.5">
              <code className="text-xs text-gray-600 flex-1 font-mono">{k.key}</code>
              <button
                onClick={() => copy(k.id, k.key)}
                className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied === k.id ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Integration Example</h3>
        <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto">
{`curl -X POST ${API_BASE_URL}/api/submit-verification \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: vfy_live_sk_your_key_here" \\
  -d '{
    "customer_name": "James Okafor",
    "address": "12 Baker Street",
    "city": "London",
    "postcode": "NW1 6XE",
    "latitude": 51.5237,
    "longitude": -0.1585,
    "consent": true
  }'`}
        </pre>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ page, setPage, orgName, onLogout }) {
  const nav = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'send', label: 'Send Verification', icon: Send },
    { id: 'verifications', label: 'Verifications', icon: ClipboardList },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'apikeys', label: 'API Keys', icon: Key },
  ]

  return (
    <aside className="w-60 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">VerifyNow</div>
            <div className="text-xs text-gray-400 truncate max-w-32">{orgName}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              page === id
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

// ─── Analytics Page ───────────────────────────────────────────────────────────
function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
        <p className="text-sm text-gray-500 mt-0.5">Performance metrics and trends</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Avg. Risk Score" value="0.28" sub="Low risk overall" color="green" />
        <StatCard icon={MapPin} label="Avg. Distance" value="187m" sub="Within threshold" color="blue" />
        <StatCard icon={Activity} label="Verification Rate" value="94%" sub="Requests completed" color="green" />
        <StatCard icon={Clock} label="Avg. Response Time" value="8.2s" sub="Customer response" color="amber" />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Weekly Verification Volume</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={CHART_DATA} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Legend />
            <Bar dataKey="verified" fill="#22c55e" radius={[4, 4, 0, 0]} name="Verified" />
            <Bar dataKey="review" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Review" />
            <Bar dataKey="declined" fill="#ef4444" radius={[4, 4, 0, 0]} name="Declined" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={PIE_DATA} cx="50%" cy="50%" outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}%`} labelLine={false}>
                {PIE_DATA.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Risk Score Distribution</h3>
          <div className="space-y-3 mt-2">
            {[
              { label: 'Very Low (0.0–0.2)', count: 42, color: 'bg-green-500', pct: 62 },
              { label: 'Low (0.2–0.4)', count: 18, color: 'bg-green-300', pct: 26 },
              { label: 'Medium (0.4–0.7)', count: 5, color: 'bg-amber-400', pct: 7 },
              { label: 'High (0.7–1.0)', count: 3, color: 'bg-red-500', pct: 5 },
            ].map(r => (
              <div key={r.label}>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{r.label}</span>
                  <span>{r.count} verifications</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full">
                  <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('overview')

  if (!user) return <LoginScreen onLogin={setUser} />

  const pages = {
    overview: <OverviewPage />,
    send: <SendVerificationPage orgName={user.org} />,
    verifications: <VerificationsPage />,
    analytics: <AnalyticsPage />,
    apikeys: <ApiKeysPage />,
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar page={page} setPage={setPage} orgName={user.org} onLogout={() => setUser(null)} />
      <main className="flex-1 overflow-y-auto p-6">
        {pages[page]}
      </main>
    </div>
  )
}

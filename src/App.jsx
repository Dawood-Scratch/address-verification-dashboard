import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LayoutDashboard, Send, ClipboardList, BarChart2,
  Key, LogOut, CheckCircle2, XCircle, Clock, AlertTriangle,
  Search, Download, RefreshCw, Plus, Eye, Copy, ChevronDown,
  MapPin, Shield, TrendingUp, Users, Activity, Loader2,
  Upload, FileSpreadsheet, FileText, ChevronRight, AlertCircle
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://web-production-dc1f3.up.railway.app'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise a raw verification record from the backend into a consistent shape
 * for the dashboard. The backend returns two different record shapes:
 *   1. "sent" records  — created by /api/send-verification (have customer{} and token)
 *   2. "completed" records — created by /api/submit-verification (have personal_info{} and location_data{})
 */
function normaliseVerification(v) {
  // Completed verification (submitted by customer)
  if (v.personal_info) {
    const ld = v.location_data || {}
    const vr = v.verification_results || {}
    // Use verification_results.status first; fall back to top-level status (set when record is updated in-place)
    const rawStatus = vr.status || v.status || 'pending'
    // Map backend status strings to dashboard status keys
    const statusMap = {
      verified: 'verified',
      requires_review: 'review',
      requires_manual_verification: 'review',
      pending: 'pending',
      declined: 'declined',
    }
    return {
      id: String(v.id),
      customer: v.personal_info.full_name || v.customer?.name || '—',
      email: v.personal_info.email || v.customer?.email || '',
      phone: v.personal_info.phone || v.customer?.phone || '',
      address: v.personal_info.address || v.customer?.address || '',
      status: statusMap[rawStatus] || 'pending',
      risk: vr.risk_score ?? null,
      distance: ld.distance_meters != null ? Math.round(ld.distance_meters) : null,
      timestamp: v.timestamp,
      method: 'GPS',
      userCoords: ld.user_coordinates || null,
      addressCoords: ld.address_coordinates || null,
      consentProvided: v.consent_provided ?? null,
    }
  }

  // Sent-only record (customer hasn't responded yet)
  if (v.customer) {
    return {
      id: v.id || '—',
      customer: v.customer.name || '—',
      email: v.customer.email || '',
      phone: v.customer.phone || '',
      address: v.customer.address || '',
      status: v.status || 'pending',
      risk: null,
      distance: null,
      timestamp: v.timestamp,
      method: 'Pending',
      userCoords: null,
      addressCoords: null,
      consentProvided: null,
    }
  }

  // Fallback
  return {
    id: String(v.id || '—'),
    customer: '—',
    email: '',
    address: '',
    status: 'pending',
    risk: null,
    distance: null,
    timestamp: v.timestamp || new Date().toISOString(),
    method: '—',
    userCoords: null,
    addressCoords: null,
    consentProvided: null,
  }
}

function computeStats(verifications) {
  const total = verifications.length
  const verified = verifications.filter(v => v.status === 'verified').length
  const review = verifications.filter(v => v.status === 'review').length
  const declined = verifications.filter(v => v.status === 'declined').length
  const pending = verifications.filter(v => v.status === 'pending').length

  const distances = verifications.map(v => v.distance).filter(d => d != null)
  const avgDistance = distances.length ? Math.round(distances.reduce((a, b) => a + b, 0) / distances.length) : null

  const risks = verifications.map(v => v.risk).filter(r => r != null)
  const avgRisk = risks.length ? (risks.reduce((a, b) => a + b, 0) / risks.length).toFixed(2) : null

  return { total, verified, review, declined, pending, avgDistance, avgRisk }
}

function computeChartData(verifications) {
  // Group by day of week (last 7 days)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const now = new Date()
  const buckets = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = days[d.getDay()]
    buckets[key] = { day: key, verified: 0, review: 0, declined: 0, pending: 0 }
  }
  verifications.forEach(v => {
    const d = new Date(v.timestamp)
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24))
    if (diffDays <= 6) {
      const key = days[d.getDay()]
      if (buckets[key]) {
        const s = v.status === 'review' ? 'review' : v.status
        if (buckets[key][s] !== undefined) buckets[key][s]++
      }
    }
  })
  return Object.values(buckets)
}

function computePieData(verifications) {
  const total = verifications.length || 1
  const counts = { verified: 0, review: 0, declined: 0, pending: 0 }
  verifications.forEach(v => { if (counts[v.status] !== undefined) counts[v.status]++ })
  return [
    { name: 'Verified', value: Math.round((counts.verified / total) * 100), color: '#22c55e' },
    { name: 'Review', value: Math.round((counts.review / total) * 100), color: '#f59e0b' },
    { name: 'Declined', value: Math.round((counts.declined / total) * 100), color: '#ef4444' },
    { name: 'Pending', value: Math.round((counts.pending / total) * 100), color: '#94a3b8' },
  ].filter(d => d.value > 0)
}

// ─── Data Hook ────────────────────────────────────────────────────────────────
function useVerifications() {
  const [verifications, setVerifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`${API_BASE_URL}/api/verifications`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      const raw = Array.isArray(data) ? data : (data.verifications || [])
      const normalised = raw.map(normaliseVerification)
      // Sort newest first
      normalised.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      setVerifications(normalised)
      setLastRefresh(new Date())
    } catch (err) {
      setError('Could not load verifications. Check backend connectivity.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Auto-refresh every 30 seconds
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  return { verifications, loading, error, refresh: load, lastRefresh }
}

// ─── Shared Components ────────────────────────────────────────────────────────
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

function StatusBadge({ status }) {
  const map = {
    verified: 'bg-green-100 text-green-700',
    review: 'bg-amber-100 text-amber-700',
    declined: 'bg-red-100 text-red-700',
    pending: 'bg-gray-100 text-gray-600',
    not_found: 'bg-purple-100 text-purple-700',
  }
  const icons = {
    verified: <CheckCircle2 className="w-3 h-3" />,
    review: <AlertTriangle className="w-3 h-3" />,
    declined: <XCircle className="w-3 h-3" />,
    pending: <Clock className="w-3 h-3" />,
    not_found: <MapPin className="w-3 h-3" />,
  }
  const label = {
    verified: 'Verified',
    review: 'Requires Review',
    declined: 'Declined',
    pending: 'Pending',
    not_found: 'Address Not Found',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${map[status] || map.pending}`}>
      {icons[status] || icons.pending}
      {label[status] || 'Pending'}
    </span>
  )
}

function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">{message}</span>
    </div>
  )
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3 text-red-700 text-sm">
        <XCircle className="w-4 h-4 flex-shrink-0" />
        {message}
      </div>
      {onRetry && (
        <button onClick={onRetry} className="text-red-600 hover:text-red-800 text-xs font-medium flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  )
}

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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Overview Page ────────────────────────────────────────────────────────────
function OverviewPage({ verifications, loading, error, refresh }) {
  const stats = computeStats(verifications)
  const chartData = computeChartData(verifications)
  const pieData = computePieData(verifications)
  const recent = verifications.slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Overview</h2>
          <p className="text-sm text-gray-500 mt-0.5">Your verification activity at a glance</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-white"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Requests" value={loading ? '—' : stats.total} sub="All time" color="blue" />
        <StatCard icon={CheckCircle2} label="Verified" value={loading ? '—' : stats.verified} sub={stats.total ? `${Math.round((stats.verified / stats.total) * 100)}% success rate` : '—'} color="green" />
        <StatCard icon={AlertTriangle} label="Requires Review" value={loading ? '—' : stats.review} sub="Manual check needed" color="amber" />
        <StatCard icon={XCircle} label="Declined / Pending" value={loading ? '—' : stats.declined + stats.pending} sub="Not yet verified" color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Verifications This Week</h3>
          {loading ? <LoadingSpinner message="Loading chart..." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="verified" fill="#22c55e" radius={[4, 4, 0, 0]} name="Verified" />
                <Bar dataKey="review" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Review" />
                <Bar dataKey="declined" fill="#ef4444" radius={[4, 4, 0, 0]} name="Declined" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status Breakdown</h3>
          {loading ? <LoadingSpinner message="Loading chart..." /> : pieData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                <Tooltip formatter={(v) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Recent Verifications</h3>
          {!loading && <span className="text-xs text-gray-400">{verifications.length} total</span>}
        </div>
        {loading ? <LoadingSpinner message="Loading verifications..." /> : recent.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No verifications yet. Send your first one above.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map(v => (
              <div key={v.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                    {v.customer.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()}
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
        )}
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
  const [smsSent, setSmsSent] = useState(false)
  const [deliveryChannel, setDeliveryChannel] = useState('')
  const [deliveryMessage, setDeliveryMessage] = useState('')
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
        setSmsSent(result.sms_sent)
        setDeliveryChannel(result.delivery_channel || '')
        setDeliveryMessage(result.delivery_message || '')
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
          ) : smsSent ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 mb-4 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              SMS sent to <strong>{form.phone}</strong>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-4 text-sm text-amber-700">
              {deliveryMessage || 'Delivery failed — share the link below manually.'}
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
              onClick={() => { setSent(false); setSmsSent(false); setEmailSent(false); setDeliveryChannel(''); setDeliveryMessage(''); setForm({ name: '', email: '', phone: '', address: '', city: '', postcode: '' }) }}
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
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-gray-400 font-normal text-xs">(optional if phone provided)</span></label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="customer@email.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-gray-400 font-normal text-xs">(optional if email provided)</span></label>
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. 08012345678 or +2348012345678"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">At least one of email or phone is required.</p>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Registered Address *</label>
              <input
                required
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. 45b Palm Avenue"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City / Area *</label>
              <input
                required
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                placeholder="e.g. Lagos Island, Ikeja, Lekki, Victoria Island"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Enter the area or district — not the street name. E.g. for 36 Marina, enter &ldquo;Lagos Island&rdquo; not &ldquo;Marina&rdquo;.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
              <input
                value={form.postcode}
                onChange={e => setForm({ ...form, postcode: e.target.value })}
                placeholder="e.g. 100281"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
            <strong>What happens next:</strong> The customer will receive a verification link via <strong>email</strong> (if provided) or <strong>SMS</strong> (if phone only). When they tap the link, they will see the consent screen and verify their location in one tap.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Link...</> : <><Send className="w-4 h-4" /> Send Verification Request</>}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Verifications List Page ──────────────────────────────────────────────────
function VerificationsPage({ verifications, loading, error, refresh, lastRefresh }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const filtered = verifications.filter(v => {
    const matchSearch = v.customer.toLowerCase().includes(search.toLowerCase()) ||
      v.id.toLowerCase().includes(search.toLowerCase()) ||
      v.address.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || v.status === filter
    return matchSearch && matchFilter
  })

  const exportCSV = () => {
    const headers = ['ID', 'Customer', 'Email', 'Phone', 'Address', 'Status', 'Risk Score', 'Distance (m)', 'GPS Latitude', 'GPS Longitude', 'GPS Accuracy (m)', 'Geocoded Lat', 'Geocoded Lon', 'Timestamp']
    const rows = filtered.map(v => [
      v.id, v.customer, v.email || '', v.phone || '', v.address, v.status,
      v.risk != null ? (v.risk * 100).toFixed(0) + '%' : 'N/A',
      v.distance ?? 'N/A',
      v.userCoords?.latitude?.toFixed(6) ?? 'N/A',
      v.userCoords?.longitude?.toFixed(6) ?? 'N/A',
      v.userCoords?.accuracy != null ? Math.round(v.userCoords.accuracy) : 'N/A',
      v.addressCoords?.latitude?.toFixed(6) ?? 'N/A',
      v.addressCoords?.longitude?.toFixed(6) ?? 'N/A',
      new Date(v.timestamp).toLocaleString()
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'verifications.csv'; a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Verifications</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading...' : `${filtered.length} record${filtered.length !== 1 ? 's' : ''} found`}
            {lastRefresh && !loading && (
              <span className="ml-2 text-gray-400">· Updated {lastRefresh.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={refresh} />}

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
          <option value="not_found">Address Not Found</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? <LoadingSpinner message="Loading verifications..." /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Address</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Distance</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Risk</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">GPS Coordinates</th>
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
                        <span className="text-xs text-gray-500">{(v.risk * 100).toFixed(0)}%</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3.5 hidden xl:table-cell">
                    {v.userCoords ? (
                      <span className="font-mono text-xs text-gray-600">
                        {v.userCoords.latitude?.toFixed(6)}, {v.userCoords.longitude?.toFixed(6)}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
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
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            {verifications.length === 0 ? 'No verifications yet. Send your first one above.' : 'No verifications match your search.'}
          </div>
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
              {selected.email && <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="text-gray-800">{selected.email}</span></div>}
              <div className="flex justify-between items-start gap-4"><span className="text-gray-500 flex-shrink-0">Address</span><span className="text-gray-800 text-right">{selected.address}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><StatusBadge status={selected.status} /></div>
              <div className="flex justify-between"><span className="text-gray-500">Distance</span><span className="text-gray-800">{selected.distance !== null ? `${selected.distance}m` : 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Risk Score</span><span className="text-gray-800">{selected.risk !== null ? `${(selected.risk * 100).toFixed(0)}%` : 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="text-gray-800">{selected.method}</span></div>
              {selected.consentProvided !== null && (
                <div className="flex justify-between"><span className="text-gray-500">Consent</span><span className={selected.consentProvided ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{selected.consentProvided ? 'Provided' : 'Not provided'}</span></div>
              )}
              {selected.userCoords && (
                <>
                  <hr className="border-gray-100" />
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">GPS Data</div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">User Location</span>
                    <span className="text-gray-800 font-mono text-xs">{selected.userCoords.latitude?.toFixed(6)}, {selected.userCoords.longitude?.toFixed(6)}</span>
                  </div>
                  {selected.userCoords.accuracy != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">GPS Accuracy</span>
                      <span className="text-gray-800 text-xs">±{Math.round(selected.userCoords.accuracy)}m</span>
                    </div>
                  )}
                  {selected.addressCoords && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Geocoded Address</span>
                      <span className="text-gray-800 font-mono text-xs">{selected.addressCoords.latitude?.toFixed(6)}, {selected.addressCoords.longitude?.toFixed(6)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">View on Map</span>
                    <a
                      href={`https://www.google.com/maps?q=${selected.userCoords.latitude},${selected.userCoords.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-xs underline hover:text-blue-800"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                  <hr className="border-gray-100" />
                </>
              )}
              <div className="flex justify-between"><span className="text-gray-500">Timestamp</span><span className="text-gray-800">{new Date(selected.timestamp).toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Analytics Page ───────────────────────────────────────────────────────────
function AnalyticsPage({ verifications, loading }) {
  const stats = computeStats(verifications)
  const chartData = computeChartData(verifications)
  const pieData = computePieData(verifications)

  const riskBuckets = [
    { label: 'Very Low (0–20%)', color: 'bg-green-500', min: 0, max: 0.2 },
    { label: 'Low (20–40%)', color: 'bg-green-300', min: 0.2, max: 0.4 },
    { label: 'Medium (40–70%)', color: 'bg-amber-400', min: 0.4, max: 0.7 },
    { label: 'High (70–100%)', color: 'bg-red-500', min: 0.7, max: 1.01 },
  ].map(b => {
    const count = verifications.filter(v => v.risk != null && v.risk >= b.min && v.risk < b.max).length
    const pct = verifications.length ? Math.round((count / verifications.length) * 100) : 0
    return { ...b, count, pct }
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
        <p className="text-sm text-gray-500 mt-0.5">Performance metrics and trends</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Avg. Risk Score" value={loading ? '—' : (stats.avgRisk ? `${(stats.avgRisk * 100).toFixed(0)}%` : 'N/A')} sub="Lower is better" color="green" />
        <StatCard icon={MapPin} label="Avg. Distance" value={loading ? '—' : (stats.avgDistance != null ? `${stats.avgDistance}m` : 'N/A')} sub="From claimed address" color="blue" />
        <StatCard icon={Activity} label="Verification Rate" value={loading ? '—' : (stats.total ? `${Math.round((stats.verified / stats.total) * 100)}%` : 'N/A')} sub="Requests verified" color="green" />
        <StatCard icon={Clock} label="Total Processed" value={loading ? '—' : stats.total} sub="All time" color="amber" />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Weekly Verification Volume</h3>
        {loading ? <LoadingSpinner message="Loading chart..." /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend />
              <Bar dataKey="verified" fill="#22c55e" radius={[4, 4, 0, 0]} name="Verified" />
              <Bar dataKey="review" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Review" />
              <Bar dataKey="declined" fill="#ef4444" radius={[4, 4, 0, 0]} name="Declined" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status Distribution</h3>
          {loading ? <LoadingSpinner /> : pieData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}%`} labelLine={false}>
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Risk Score Distribution</h3>
          {loading ? <LoadingSpinner /> : (
            <div className="space-y-3 mt-2">
              {riskBuckets.map(r => (
                <div key={r.label}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{r.label}</span>
                    <span>{r.count} verifications</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full">
                    <div className={`h-full rounded-full ${r.color} transition-all duration-500`} style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Batch Upload Page ───────────────────────────────────────────────────────
function BatchUploadPage({ orgName }) {
  const [step, setStep] = useState('upload') // 'upload' | 'processing' | 'results'
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [batchResult, setBatchResult] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [selectedRow, setSelectedRow] = useState(null)
  const [batches, setBatches] = useState([])
  const [loadingBatches, setLoadingBatches] = useState(true)
  const fileInputRef = useRef(null)

  // Load previous batches on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/batches`)
      .then(r => r.json())
      .then(d => setBatches(d.batches || []))
      .catch(() => {})
      .finally(() => setLoadingBatches(false))
  }, [])

  const downloadTemplate = () => {
    const headers = 'full_name,email,phone,address,city,postcode'
    const note = '# NOTE: email and phone are both optional but at least one is required per row'
    const example1 = 'James Okafor,james@example.com,+2348012345678,12 Broad Street,Lagos Island,101001'
    const example2 = 'Amina Bello,,+2348098765432,5 Ahmadu Bello Way,Abuja,900001'
    const example3 = 'Chidi Okeke,chidi@example.com,,45 Allen Avenue,Ikeja,100281'
    const csv = [note, headers, example1, example2, example3].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'verifynow_batch_template.csv'; a.click()
  }

  const handleFile = (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setUploadError('Please upload a .csv or .xlsx file')
      return
    }
    setUploadError('')
    setFile(f)
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true)
    setUploadError('')
    setStep('processing')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('orgName', orgName)
      const resp = await fetch(`${API_BASE_URL}/api/batch-upload`, {
        method: 'POST',
        body: formData
      })
      const data = await resp.json()
      if (!resp.ok) {
        setUploadError(data.error || 'Upload failed')
        setStep('upload')
      } else {
        setBatchResult(data)
        setBatches(prev => [{
          batch_id: data.batch_id,
          org_name: orgName,
          created_at: new Date().toISOString(),
          total_rows: data.summary.total,
          sent: data.summary.sent,
          failed: data.summary.failed,
          skipped: data.summary.skipped
        }, ...prev])
        setStep('results')
      }
    } catch (err) {
      setUploadError('Network error — could not reach the server')
      setStep('upload')
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setStep('upload'); setFile(null); setBatchResult(null); setUploadError(''); setSelectedRow(null)
  }

  const exportResults = () => {
    if (!batchResult) return
    const headers = ['Row', 'Name', 'Email', 'Address', 'Status', 'Email Sent', 'Token', 'Error']
    const rows = batchResult.results.map(r => [
      r.row, r.full_name, r.email, r.address, r.status,
      r.email_sent ? 'Yes' : 'No', r.token || '', r.error || ''
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `batch_${batchResult.batch_id}_results.csv`; a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Batch Upload</h2>
          <p className="text-sm text-gray-500 mt-0.5">Send verification requests to multiple customers at once</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 shadow-sm"
        >
          <Download className="w-4 h-4" /> Download CSV Template
        </button>
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Required columns info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 mb-2">Required CSV/Excel columns:</p>
              <div className="flex flex-wrap gap-2">
                {['full_name', 'email', 'address', 'city'].map(c => (
                  <span key={c} className="bg-blue-100 text-blue-700 text-xs font-mono px-2.5 py-1 rounded-full">{c}</span>
                ))}
                <span className="text-xs text-blue-600 self-center">+ optional: phone, postcode</span>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragOver ? 'border-blue-400 bg-blue-50' :
                file ? 'border-green-400 bg-green-50' :
                'border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    {file.name.endsWith('.csv') ? <FileText className="w-6 h-6 text-green-600" /> : <FileSpreadsheet className="w-6 h-6 text-green-600" />}
                  </div>
                  <p className="font-semibold text-gray-800">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <Upload className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="font-semibold text-gray-700">Drop your file here, or click to browse</p>
                  <p className="text-sm text-gray-400">Supports .csv and .xlsx files</p>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {uploadError}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!file || uploading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" /> Send Verification Requests
            </button>
          </div>

          {/* Previous batches sidebar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Previous Batches</h3>
            </div>
            {loadingBatches ? <LoadingSpinner message="Loading..." /> : batches.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">No batches yet</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {batches.slice(0, 8).map(b => (
                  <div key={b.batch_id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-gray-500">{b.batch_id}</span>
                      <span className="text-xs text-gray-400">{new Date(b.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="text-gray-600">{b.total_rows} total</span>
                      <span className="text-green-600">{b.sent} sent</span>
                      {b.failed > 0 && <span className="text-red-500">{b.failed} failed</span>}
                      {b.skipped > 0 && <span className="text-amber-500">{b.skipped} skipped</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step: Processing */}
      {step === 'processing' && (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Processing Batch...</h3>
          <p className="text-sm text-gray-500">Parsing file, generating tokens, and sending emails. This may take a moment for large files.</p>
        </div>
      )}

      {/* Step: Results */}
      {step === 'results' && batchResult && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
              <div className="text-2xl font-bold text-gray-900">{batchResult.summary.total}</div>
              <div className="text-xs text-gray-500 mt-1">Total Rows</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100 text-center">
              <div className="text-2xl font-bold text-green-600">{batchResult.summary.sent}</div>
              <div className="text-xs text-gray-500 mt-1">Emails Sent</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100 text-center">
              <div className="text-2xl font-bold text-red-500">{batchResult.summary.failed}</div>
              <div className="text-xs text-gray-500 mt-1">Failed</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100 text-center">
              <div className="text-2xl font-bold text-amber-500">{batchResult.summary.skipped}</div>
              <div className="text-xs text-gray-500 mt-1">Skipped</div>
            </div>
          </div>

          {/* Batch ID + actions */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500">Batch ID: </span>
              <span className="text-sm font-mono font-semibold text-gray-800">{batchResult.batch_id}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={exportResults} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-xs font-medium hover:bg-gray-50">
                <Download className="w-3.5 h-3.5" /> Export Results
              </button>
              <button onClick={reset} className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-3 py-2 text-xs font-medium hover:bg-blue-700">
                <Upload className="w-3.5 h-3.5" /> New Batch
              </button>
            </div>
          </div>

          {/* Per-row results table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Row-by-Row Results</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Address</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {batchResult.results.map(r => (
                    <tr key={r.row} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">{r.row}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{r.full_name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.email}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{r.address}</td>
                      <td className="px-4 py-3">
                        {r.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3" /> Sent
                          </span>
                        ) : r.status === 'link_generated' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Copy className="w-3 h-3" /> Link Only
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <XCircle className="w-3 h-3" /> Skipped
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedRow(selectedRow?.row === r.row ? null : r)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Row detail panel */}
          {selectedRow && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-800">Row {selectedRow.row} — {selectedRow.full_name}</h4>
                <button onClick={() => setSelectedRow(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Email:</span> <span className="text-gray-800">{selectedRow.email}</span></div>
                <div><span className="text-gray-500">Address:</span> <span className="text-gray-800">{selectedRow.address}</span></div>
                <div><span className="text-gray-500">Email sent:</span> <span className={selectedRow.email_sent ? 'text-green-600 font-medium' : 'text-red-600'}>{selectedRow.email_sent ? 'Yes' : 'No'}</span></div>
                <div><span className="text-gray-500">Token:</span> <span className="font-mono text-gray-800">{selectedRow.token || 'N/A'}</span></div>
                {selectedRow.error && <div className="col-span-2"><span className="text-gray-500">Error:</span> <span className="text-red-600">{selectedRow.error}</span></div>}
                {selectedRow.verify_link && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Verify link:</span>
                    <div className="mt-1 bg-gray-50 rounded p-2 text-xs font-mono text-blue-600 break-all">{selectedRow.verify_link}</div>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedRow.verify_link)}
                      className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copy link
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── API Keys Page ────────────────────────────────────────────────────────────
function ApiKeysPage() {
  const [keys] = useState([
    { id: 1, name: 'Production Key', key: 'vfy_live_sk_••••••••••••••••••••••3f8a', created: '2026-01-15', lastUsed: '2026-06-21', active: true },
    { id: 2, name: 'Test Key', key: 'vfy_test_sk_••••••••••••••••••••••9c2d', created: '2026-03-01', lastUsed: '2026-06-20', active: true },
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
{`curl -X POST ${API_BASE_URL}/api/send-verification \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: vfy_live_sk_your_key_here" \\
  -d '{
    "customerName": "James Okafor",
    "customerEmail": "james@example.com",
    "address": "45b Palm Avenue",
    "city": "Ikeja",
    "postcode": "100281",
    "orgName": "Your Organisation"
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
    { id: 'batch', label: 'Batch Upload', icon: Upload },
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

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('overview')
  const { verifications, loading, error, refresh, lastRefresh } = useVerifications()

  if (!user) return <LoginScreen onLogin={setUser} />

  const sharedProps = { verifications, loading, error, refresh, lastRefresh }

  const pages = {
    overview: <OverviewPage {...sharedProps} />,
    send: <SendVerificationPage orgName={user.org} />,
    batch: <BatchUploadPage orgName={user.org} />,
    verifications: <VerificationsPage {...sharedProps} />,
    analytics: <AnalyticsPage {...sharedProps} />,
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
// GPS column + CSV export fix Fri Jun 26 12:35:07 UTC 2026

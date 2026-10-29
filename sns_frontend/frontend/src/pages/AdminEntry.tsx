import { ArrowLeft, ArrowUpRight, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/StorefrontParts'
import { getAdminPanelUrl } from '../services/api'

export function AdminEntry() {
  const panelUrl = getAdminPanelUrl()
  return <main className="admin-entry">
    <header className="admin-entry__header"><Brand /><Link to="/"><ArrowLeft size={16} /> Back to Buddyyaa</Link></header>
    <section className="admin-entry__card">
      <div className="admin-entry__icon"><ShieldCheck size={25} /></div>
      <span className="eyebrow">BUDDYYAA OPERATIONS</span>
      <h1>Administrator access<span className="title-period">.</span></h1>
      <p>Manage customers, Buddies, catalogue, Buddy-specific inventory and orders in the authenticated AdminJS panel.</p>
      {panelUrl ? <a className="button button--dark button--wide" href={panelUrl} target="_blank" rel="noreferrer">Open AdminJS panel <ArrowUpRight size={17} /></a> : <div className="admin-config-warning"><LockKeyhole size={18} /><div><strong>Admin panel URL isn’t configured.</strong><span>Set <code>VITE_ADMIN_PANEL_URL</code> to the backend’s actual AdminJS URL, then rebuild the website. This page does not replace the panel or its authentication.</span></div></div>}
      <div className="admin-security-note"><LockKeyhole size={15} /><span>AdminJS handles its own authentication. This frontend does not grant administrator access or call protected admin APIs.</span></div>
    </section>
  </main>
}

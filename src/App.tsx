/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Loader2, Zap, AlertTriangle, User, Layout, 
  TerminalSquare, Check, Plus, History, FolderOpen, Trash2, 
  ArrowRight, FileText, BarChart3, Clock, Rocket, Target, ShieldCheck,
  LogOut, LogIn, UserCircle, Mail, Lock, Upload, Search
} from 'lucide-react';
import { cn } from './lib/utils';
import { supabase } from './lib/supabase';
import { TmsService } from './lib/TmsService';

function LoginView({ onLogin }: { onLogin: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthError(error.message);
    } else {
      onLogin();
    }
    setAuthLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center text-black font-bold mb-4">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ChainGuard <span className="text-cyan-400">AI</span></h1>
          <p className="text-slate-500 text-sm mt-2">{isSignUp ? 'Create your Audit account' : 'Welcome back, Auditor'}</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 outline-none"
                placeholder="auditor@chainguard.ai"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          {authError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400">
              {authError}
            </div>
          )}

          <button 
            type="submit"
            disabled={authLoading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // TMS Autopilot state
  const [tmsAudits, setTmsAudits] = useState<any[]>([]);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [isTmsLoading, setIsTmsLoading] = useState(false);

  const activeAudit = tmsAudits.find(a => a.id === activeAuditId) || null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) loadTmsAudits();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadTmsAudits();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadTmsAudits = async () => {
    setIsTmsLoading(true);
    try {
      // Get the current user ID for the query
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const res = await fetch(`/api/tms/audits?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setTmsAudits(data);
        if (data.length > 0 && !activeAuditId) {
          setActiveAuditId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load audits:', e);
    } finally {
      setIsTmsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LoginView onLogin={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex flex-col items-stretch">
      {/* Navbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center text-black font-bold">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold text-white">ChainGuard <span className="text-cyan-400 font-light">AI</span></h1>
          
          <nav className="flex space-x-2 ml-8 border-l border-slate-800 pl-8">
            <div className="px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              TMS Autopilot (托管理赔)
            </div>
          </nav>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-800">
            <UserCircle className="h-3.5 w-3.5 text-cyan-500" />
            <span className="truncate max-w-[150px]">{session.user.email}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="text-slate-500 hover:text-rose-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-hidden flex flex-col">
        <TmsAutopilotPanel 
          tmsAudits={tmsAudits} 
          activeAuditId={activeAuditId} 
          setActiveAuditId={setActiveAuditId} 
          activeAudit={activeAudit} 
          isTmsLoading={isTmsLoading}
          onRefresh={loadTmsAudits}
          userId={session.user.id}
        />
      </main>
    </div>
  );
}

function TmsAutopilotPanel({ 
  tmsAudits, 
  activeAuditId, 
  setActiveAuditId, 
  activeAudit, 
  isTmsLoading,
  onRefresh,
  userId
}: { 
  tmsAudits: any[], 
  activeAuditId: string | null, 
  setActiveAuditId: (id: string) => void, 
  activeAudit: any, 
  isTmsLoading: boolean,
  onRefresh: () => void,
  userId: string | null
}) {
  const [activeSubTab, setActiveSubTab] = useState<'details' | 'claim'>('details');
  const [isAddingShipment, setIsAddingShipment] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Form states
  const [formShipmentId, setFormShipmentId] = useState('');
  const [formCarrier, setFormCarrier] = useState('');
  const [formShipper, setFormShipper] = useState('');
  const [formCommodity, setFormCommodity] = useState('');
  const [formWeightKg, setFormWeightKg] = useState<number>(180);
  const [formCargoValUsd, setFormCargoValUsd] = useState<number>(95000);
  const [formPackageCount, setFormPackageCount] = useState<number>(1);
  const [formLimitationClause, setFormLimitationClause] = useState('');
  const [formExemptions, setFormExemptions] = useState('');
  const [formJurisdiction, setFormJurisdiction] = useState('');
  const [selectedScenario, setSelectedScenario] = useState<'A' | 'B' | 'C'>('A');

  const handleFile = async (file: File) => {
    setIsParsing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (eEvent) => {
        const result = eEvent.target?.result as string;
        const base64 = result.split(',')[1];
        try {
          const res = await fetch('/api/tms/parse-contract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileBase64: base64,
              mimeType: file.type || 'application/pdf',
              fileName: file.name
            })
          });
          if (!res.ok) throw new Error('Contract parsing returned error');
          const parsed = await res.json();
          setFormShipmentId("SH-2026-" + Math.floor(Math.random() * 9000 + 1000));
          setFormCarrier(parsed.carrier || '');
          setFormShipper(parsed.shipper || '');
          setFormCommodity(parsed.commodity || '');
          setFormWeightKg(parsed.weightKg || 100);
          setFormCargoValUsd(parsed.cargoValUsd || 50000);
          setFormLimitationClause(parsed.limitationClause || '');
          setFormExemptions(parsed.exemptions || '');
          setFormJurisdiction(parsed.jurisdiction || '');
          setSelectedScenario(parsed.commodity?.toLowerCase().includes('vaccine') ? 'A' : (parsed.commodity?.toLowerCase().includes('fruit') ? 'B' : 'C'));
        } catch (err) {
          console.error("API parse failed", err);
          alert('无法解析合同，已加载默认模板。');
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsParsing(false);
    }
  };

  const handleSubmitAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    const scenarioData = SCENARIOS[selectedScenario];
    const logsWithMetadata = [
      ...scenarioData.logs,
      {
        meta: true,
        limitationClause: formLimitationClause,
        exemptions: formExemptions,
        jurisdiction: formJurisdiction,
        shipperName: formShipper
      }
    ];

    try {
      const res = await fetch('/api/tms/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: formShipmentId,
          carrier: formCarrier,
          commodity: formCommodity,
          weightKg: Number(formWeightKg),
          cargoValUsd: Number(formCargoValUsd),
          userId: userId,
          tempLogs: logsWithMetadata,
          packageCount: Number(formPackageCount)
        })
      });
      if (res.ok) {
        onRefresh();
        setIsAddingShipment(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulate = async () => {
    setIsTmsLoading(true);
    try {
      const res = await fetch('/api/tms/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: "SH-2026-MedEx" + Math.floor(Math.random() * 900 + 100),
          carrier: "MediGuard Air Freight",
          commodity: "COVID-19 Therapeutics (mRNA)",
          weightKg: 85,
          cargoValUsd: 120000,
          userId: userId,
          tempLogs: SCENARIOS.A.logs
        })
      });
      if (res.ok) {
        alert('模拟运单已生成');
        onRefresh();
      }
    } catch (e: any) {
      alert('请求失败：' + e.message);
    } finally {
      setIsTmsLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row flex-1 gap-6 w-full h-[calc(100vh-8rem)] relative">
      {/* Sidebar: Audit List */}
      <div className="flex flex-col w-full lg:w-80 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-full">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
          <div className="text-left text-xs uppercase tracking-wider text-slate-400 font-bold">Audit History</div>
          <button 
            onClick={() => setIsAddingShipment(!isAddingShipment)}
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {isTmsLoading && tmsAudits.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <span className="text-[10px]">Loading history...</span>
            </div>
          )}
          
          {tmsAudits.map(audit => (
            <div 
              key={audit.id} 
              onClick={() => setActiveAuditId(audit.id)} 
              className={cn(
                "px-3 py-3 rounded-lg cursor-pointer border transition-all duration-200 text-left relative overflow-hidden group", 
                activeAuditId === audit.id ? "bg-cyan-500/10 border-cyan-500/30" : "border-transparent hover:bg-slate-800/50"
              )}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={cn("text-[10px] font-black uppercase tracking-tighter", activeAuditId === audit.id ? "text-cyan-400" : "text-slate-400")}>
                  {audit.shipmentId}
                </span>
                <span className={cn(
                  "text-[8px] px-1.5 py-0.5 rounded-full font-bold",
                  audit.claimStatus === 'CLAIM_PENDING' ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                  audit.claimStatus === 'WARNING' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                  "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                )}>
                  {audit.claimStatus}
                </span>
              </div>
              <div className="text-[11px] font-semibold text-slate-300 truncate">{audit.commodity}</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-600 uppercase font-bold">Max Temp</span>
                  <span className="text-[10px] font-mono text-slate-400">{audit.maxTempSeen}°C</span>
                </div>
                <div className="w-px h-4 bg-slate-800"></div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-600 uppercase font-bold">Liability</span>
                  <span className="text-[10px] font-mono text-slate-400">{audit.liabilityScore}%</span>
                </div>
              </div>
            </div>
          ))}

          {tmsAudits.length === 0 && !isTmsLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600 text-center px-4">
              <ShieldCheck className="h-10 w-10 opacity-10 mb-4" />
              <p className="text-[11px] italic leading-relaxed">No shipments audited yet.<br/>Upload a contract or simulate a TMS webhook to begin.</p>
              <button onClick={handleSimulate} className="mt-4 text-[10px] text-cyan-500 hover:text-cyan-400 underline uppercase tracking-widest font-bold">Simulate Webhook</button>
            </div>
          )}
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-full">
        {isAddingShipment ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
             <div className="w-full max-w-lg space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-white">Initiate Digital Audit</h2>
                  <p className="text-sm text-slate-500 mt-1">Upload a transport contract (PDF) or fill manually to trigger analysis.</p>
                </div>

                {/* Drag and Drop Area */}
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer",
                    dragActive ? "border-cyan-500 bg-cyan-500/10" : "border-slate-800 bg-slate-950/50 hover:bg-slate-900",
                    isParsing && "opacity-50 cursor-wait"
                  )}
                  onDragOver={(e) => {e.preventDefault(); setDragActive(true);}}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files[0]);}}
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="h-10 w-10 text-cyan-500 animate-spin mb-4" />
                      <p className="text-sm font-bold text-cyan-400 animate-pulse">Extracting SDR Limits & SLA Clauses...</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Upload className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-300">Drop Contract PDF here</p>
                      <p className="text-xs text-slate-500 mt-2 italic">Automatically detects Carrier, SDR limits, and Governing Law.</p>
                      <input type="file" className="hidden" id="contract-upload" accept=".pdf" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
                      <label htmlFor="contract-upload" className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg cursor-pointer uppercase tracking-widest transition-all">Select File</label>
                    </>
                  )}
                </div>

                <form onSubmit={handleSubmitAudit} className="grid grid-cols-2 gap-4">
                   <div className="col-span-2">
                     <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Shipment ID</label>
                     <input value={formShipmentId} onChange={e => setFormShipmentId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500/50" placeholder="e.g. SH-992-CARGO" />
                   </div>
                   <div>
                     <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Carrier</label>
                     <input value={formCarrier} onChange={e => setFormCarrier(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500/50" />
                   </div>
                   <div>
                     <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Commodity</label>
                     <input value={formCommodity} onChange={e => setFormCommodity(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500/50" />
                   </div>
                   <div>
                     <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Value (USD)</label>
                     <input type="number" value={formCargoValUsd} onChange={e => setFormCargoValUsd(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500/50" />
                   </div>
                   <div>
                     <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Telemetry Scenario</label>
                     <select value={selectedScenario} onChange={e => setSelectedScenario(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500/50">
                        <option value="A">Scenario A: Pharma Excursion</option>
                        <option value="B">Scenario B: Banana Chilling Injury</option>
                        <option value="C">Scenario C: Normal Transit</option>
                     </select>
                   </div>
                   <div className="col-span-2 flex gap-3 pt-4">
                      <button type="button" onClick={() => setIsAddingShipment(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">Cancel</button>
                      <button type="submit" className="flex-[2] bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-cyan-500/20 active:scale-95">Run Automated Audit</button>
                   </div>
                </form>
             </div>
          </div>
        ) : activeAudit ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Audit Header */}
            <div className="px-8 py-6 border-b border-slate-800 bg-slate-800/20 flex justify-between items-end">
               <div className="text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-black text-white">{activeAudit.shipmentId}</h2>
                    <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono">{activeAudit.id}</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-slate-500" />
                      <span className="text-[10px] text-slate-400">{new Date(activeAudit.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3 w-3 text-emerald-500" />
                      <span className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-tighter">Cryptographically Verified</span>
                    </div>
                  </div>
               </div>
               <div className="flex gap-2">
                  <button 
                    onClick={() => setActiveSubTab('details')}
                    className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", activeSubTab === 'details' ? "bg-slate-700 text-white shadow-inner shadow-black/20" : "text-slate-500 hover:text-slate-300")}
                  >
                    Telemetry Logs
                  </button>
                  <button 
                    onClick={() => setActiveSubTab('claim')}
                    className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", activeSubTab === 'claim' ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/20" : "text-slate-500 hover:text-slate-300")}
                  >
                    理赔起诉书 (Claim)
                  </button>
               </div>
            </div>

            {/* Audit Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
               {activeSubTab === 'details' ? (
                 <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Score Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                           <h3 className="text-[9px] text-slate-500 uppercase font-black mb-1">Total Spoilage</h3>
                           <div className="text-2xl font-black text-white">{activeAudit.degradationRate}%</div>
                           <div className="mt-2 w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                              <div className="bg-rose-500 h-full transition-all duration-1000" style={{width: `${activeAudit.degradationRate}%`}}></div>
                           </div>
                        </div>
                        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 text-left">
                           <h3 className="text-[9px] text-slate-500 uppercase font-black mb-1">Liability Split</h3>
                           <div className="text-2xl font-black text-amber-400">{activeAudit.liabilityScore}% <span className="text-[10px] text-slate-600 font-normal">Carrier</span></div>
                        </div>
                        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 text-left">
                           <h3 className="text-[9px] text-slate-500 uppercase font-black mb-1">Liability Cap (SDR)</h3>
                           <div className="text-2xl font-black text-slate-300">${activeAudit.limitValUsd.toLocaleString()}</div>
                        </div>
                        <div className="bg-cyan-500/5 p-4 rounded-xl border border-cyan-500/20 text-left">
                           <h3 className="text-[9px] text-cyan-500/60 uppercase font-black mb-1">Max Potential Claim</h3>
                           <div className="text-2xl font-black text-cyan-400">${activeAudit.liableClaimUsd.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Reasoning Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <h3 className="text-[10px] uppercase text-slate-500 font-black tracking-widest flex items-center gap-2">
                             <TerminalSquare className="h-4 w-4 text-cyan-500" />
                             Biophysical Reasoning
                          </h3>
                          <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl text-left">
                             <div className="text-xs text-slate-300 leading-relaxed space-y-4">
                                {activeAudit.uncertaintyIntervals?.length > 0 && (
                                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
                                    <div className="flex items-center gap-2 mb-1">
                                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                                      <span className="text-[10px] text-amber-400 font-bold uppercase">Telemetry Gap Detected</span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 italic leading-snug">Sensor black-out of 4.5 hours. AI calculated uncertainty bounds: Max deviation +2.4°C / Min deviation -0.8°C.</p>
                                  </div>
                                )}
                                <p>The cargo was exposed to temperatures as high as <span className="text-rose-400 font-bold">{activeAudit.maxTempSeen}°C</span> for a cumulative period of <span className="text-rose-400 font-bold">{activeAudit.excursionDurationHours} hours</span>.</p>
                                <p>Based on the **Arrhenius kinetic model**, this thermal exposure triggered a metabolic surge, consuming approximately **{activeAudit.degradationRate}%** of the product's remaining shelf-life within {Math.round(activeAudit.excursionDurationHours)} hours of transit.</p>
                                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 font-mono text-[9px] text-slate-500">
                                   Equation: k = A * exp(-Ea / RT)<br/>
                                   Rate Multiplier (R_elevated / R_base) = {Math.pow(2, (activeAudit.maxTempSeen - 4) / 10).toFixed(2)}x decay speed.
                                </div>
                             </div>
                          </div>
                       </div>

                       <div className="space-y-4">
                          <h3 className="text-[10px] uppercase text-slate-500 font-black tracking-widest flex items-center gap-2">
                             <ShieldCheck className="h-4 w-4 text-emerald-500" />
                             Liability RAG Grounding
                          </h3>
                          <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl text-left">
                             <div className="text-xs text-slate-300 leading-relaxed space-y-4">
                                <div className="flex items-start gap-3">
                                   <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5"></div>
                                   <div>
                                      <p className="font-bold text-slate-200">Legal Precedent Applied</p>
                                      <p className="text-[10px] text-slate-500 mt-1">Automatic application of **Montreal Convention Article 22** for high-value air cargo. Liability capped at 22 SDR/kg.</p>
                                   </div>
                                </div>
                                <div className="flex items-start gap-3">
                                   <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5"></div>
                                   <div>
                                      <p className="font-bold text-slate-200">SLA Violation Detection</p>
                                      <p className="text-[10px] text-slate-500 mt-1">Contract specifies threshold of 25°C for pharma. Multi-agent debate confirms carrier failed to provide active cooling during tarmac wait.</p>
                                   </div>
                                </div>
                                <div className="flex items-start gap-3">
                                   <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5"></div>
                                   <div>
                                      <p className="font-bold text-slate-200">Exemption Rebuttal</p>
                                      <p className="text-[10px] text-slate-500 mt-1">Carrier's "Force Majeure" claim (extreme heat) rejected by AI Auditor: Tarmac wait is a controllable operational delay under standard carrier SOPs.</p>
                                   </div>
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Live Telemetry Rendering */}
                    <div className="space-y-4">
                       <h3 className="text-[10px] uppercase text-slate-500 font-black tracking-widest">IoT Sensor Time-Series Analysis</h3>
                       <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl h-64 flex flex-col justify-end">
                          <div className="flex items-end gap-2 flex-1 relative px-2">
                             {/* Telemetry Bars */}
                             {activeAudit.tempLogs?.filter((l: any) => !l.meta).map((log: any, i: number) => {
                               const height = (log.temperature / 30) * 100;
                               const isExcursion = log.temperature > 8 || log.temperature < 2;
                               return (
                                 <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                    <div 
                                      className={cn(
                                        "w-full rounded-t-sm transition-all duration-500 group-hover:opacity-80",
                                        isExcursion ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]" : "bg-cyan-500/40"
                                      )}
                                      style={{height: `${Math.max(5, height)}%`}}
                                    ></div>
                                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[8px] px-2 py-1 rounded whitespace-nowrap z-10">
                                       {log.temperature}°C @ {new Date(log.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    </div>
                                 </div>
                               );
                             })}
                             {/* Threshold Line */}
                             <div className="absolute bottom-[26.6%] left-0 right-0 border-t border-rose-500/50 border-dashed z-0 flex justify-end pr-2">
                                <span className="text-[8px] text-rose-500 font-bold -mt-3.5">Max Threshold (8°C)</span>
                             </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-900 flex justify-between">
                             <div className="text-[9px] text-slate-600 uppercase font-black flex gap-6">
                                <span>Loading Point</span>
                                <span>Transit</span>
                                <span>Arrival</span>
                             </div>
                             <div className="text-[9px] text-slate-500 uppercase font-bold flex gap-4">
                                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500/40"></div> Normal</div>
                                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Excursion</div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="animate-in zoom-in-95 fade-in duration-300">
                    <div className="max-w-2xl mx-auto bg-white p-12 text-slate-900 text-left shadow-2xl rounded shadow-cyan-900/10">
                       <div className="border-b-2 border-slate-900 pb-8 mb-8 flex justify-between items-start">
                          <div>
                             <h1 className="text-3xl font-black uppercase tracking-tighter">Notice of Claim</h1>
                             <p className="text-sm font-bold text-slate-500 mt-1 italic leading-relaxed">Formal liability assignment generated by ChainGuard AI Digital Auditor.</p>
                          </div>
                          <div className="text-right">
                             <div className="text-xs font-black uppercase text-slate-400">Claim Reference</div>
                             <div className="text-sm font-mono font-bold">{activeAudit.shipmentId} / TSA-{activeAudit.id?.substring(0,8)}</div>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-12 text-xs mb-10">
                          <div className="space-y-4">
                             <div>
                                <div className="font-black text-slate-400 uppercase tracking-widest mb-1">To: Carrier Representative</div>
                                <div className="text-sm font-bold uppercase">{activeAudit.carrier}</div>
                                <div className="text-slate-500 mt-0.5 italic">Cargo Handling Division</div>
                             </div>
                             <div>
                                <div className="font-black text-slate-400 uppercase tracking-widest mb-1">From: Cargo Owners</div>
                                <div className="text-sm font-bold uppercase underline decoration-cyan-500/50 decoration-2">Digital Claims Officer</div>
                             </div>
                          </div>
                          <div className="space-y-2 font-mono text-[11px]">
                             <div className="flex justify-between border-b border-slate-100 pb-1"><span>Received At:</span> <span className="font-bold">{new Date(activeAudit.created_at).toLocaleDateString()}</span></div>
                             <div className="flex justify-between border-b border-slate-100 pb-1"><span>Convention:</span> <span className="font-bold">Montreal Convention Art. 22</span></div>
                             <div className="flex justify-between border-b border-slate-100 pb-1"><span>Liability Split:</span> <span className="font-bold">{activeAudit.liabilityScore}% Carrier</span></div>
                             <div className="flex justify-between pt-1"><span>Status:</span> <span className="font-black text-rose-600 uppercase">Settlement Demanded</span></div>
                          </div>
                       </div>

                       <div className="space-y-6 text-[12px] leading-relaxed mb-12">
                          <p>We hereby provide formal notice of a cargo claim regarding Shipment **{activeAudit.shipmentId}**. Our digital auditing engine has performed a comprehensive biophysical and contractual analysis based on IoT telemetry and the carriage SLA.</p>
                          
                          <p><span className="font-black uppercase tracking-wider text-slate-400 text-[10px] block mb-2">Liability Reasoning:</span>
                          The analysis identifies critical temperature excursions reaching **{activeAudit.maxTempSeen}°C**, exceeding the mandatory threshold. Scientific modeling confirms an Arrhenius shelf-life degradation of **{activeAudit.degradationRate}%**. Under the Montreal Convention, the carrier is responsible for providing a temperature-controlled environment; the failure to maintain specific cooling protocols resulted in biological cargo spoilage.</p>

                          <p><span className="font-black uppercase tracking-wider text-slate-400 text-[10px] block mb-2">Compensation Summary:</span>
                          The estimated commercial loss is **${activeAudit.estimatedLossUsd.toLocaleString()}**. In accordance with the gross weight of **{activeAudit.weightKg}kg** and the SDR liability cap, we officially demand a settlement of:</p>
                          
                          <div className="bg-slate-50 border-l-4 border-cyan-500 p-6 flex justify-between items-center">
                             <span className="text-lg font-black text-slate-600 uppercase">Settlement Amount:</span>
                             <span className="text-3xl font-black text-slate-900">${activeAudit.liableClaimUsd.toLocaleString()} USD</span>
                          </div>
                       </div>

                       <div className="flex justify-between items-end border-t border-slate-200 pt-8">
                          <div className="space-y-1">
                             <div className="text-[10px] font-black uppercase text-slate-400">Digital Seal (SHA-256)</div>
                             <div className="text-[9px] font-mono text-slate-400 break-all max-w-sm">f48e2...{activeAudit.id?.substring(0,10)}...33d9a</div>
                          </div>
                          <div className="text-right">
                             <div className="font-bold text-sm underline decoration-slate-900/30">ChainGuard AI Ledger</div>
                             <div className="text-[10px] text-slate-400 uppercase mt-1 italic">Automated Compliance Officer</div>
                          </div>
                       </div>
                    </div>
                 </div>
               )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-6">
            <ShieldCheck className="h-16 w-16 opacity-5 mb-2" />
            <div className="max-w-md text-center space-y-2 px-6">
              <h3 className="text-lg font-bold text-white/40">Select a Shipment Audit</h3>
              <p className="text-sm italic leading-relaxed">Choose an entry from the sidebar to view biophysical analysis, liability reasoning, and the digital claim document.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SCENARIOS = {
  A: {
    name: 'Scenario A: Severe Temp Excursion (mRNA Vaccines)',
    description: '模拟疫苗运输过程中的严重温度超标（暴露于18°C以上2小时），导致货物活性丧失。',
    logs: [
      { time: new Date(Date.now() - 3600000 * 5).toISOString(), temp: 3.8, carrierCustody: true, durationHours: 1 },
      { time: new Date(Date.now() - 3600000 * 4).toISOString(), temp: 18.2, carrierCustody: true, durationHours: 2 },
      { time: new Date(Date.now() - 3600000 * 2).toISOString(), temp: 4.1, carrierCustody: true, durationHours: 2 }
    ]
  },
  B: {
    name: 'Scenario B: Banana Chilling Injury',
    description: '模拟热带水果运输中的低温损伤（低于13°C超过4小时）。',
    logs: [
      { time: new Date(Date.now() - 3600000 * 6).toISOString(), temp: 14.5, carrierCustody: true, durationHours: 1 },
      { time: new Date(Date.now() - 3600000 * 5).toISOString(), temp: 8.5, carrierCustody: true, durationHours: 4 },
      { time: new Date(Date.now() - 3600000 * 1).toISOString(), temp: 14.2, carrierCustody: true, durationHours: 1 }
    ]
  },
  C: {
    name: 'Scenario C: Normal Transit',
    description: '全程温控正常，无货损风险。',
    logs: [
      { time: new Date(Date.now() - 3600000 * 3).toISOString(), temp: 2.5, carrierCustody: true, durationHours: 3 }
    ]
  }
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { 
  Loader2, Zap, AlertTriangle, User, Layout, 
  TerminalSquare, Check, Plus, History, FolderOpen, Trash2, 
  ArrowRight, FileText, BarChart3, Clock, Rocket, Target, ShieldCheck,
  LogOut, LogIn, UserCircle, Mail, Lock, Upload, Search, MessageSquare
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
  const [activeTab, setActiveTab] = useState<'auditor' | 'tms_autopilot'>('tms_autopilot');

  // Auditor state
  const [inputText, setInputText] = useState('');
  const [reportText, setReportText] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const res = await fetch(`/api/tms/audits?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setTmsAudits(data);
        if (data.length > 0 && !activeAuditId) setActiveAuditId(data[0].id);
      }
    } catch (e) {
      console.error('Failed to load audits:', e);
    } finally {
      setIsTmsLoading(false);
    }
  };

  const handleGenerateAudit = async () => {
    if (!inputText) return;
    setIsGenerating(true);
    setReportText('');
    setExtractedData(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText, isBrutal: true })
      });
      
      const reader = res.body?.getReader();
      if (!reader) return;
      
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        fullText += chunk;
        setReportText(prev => (prev || '') + chunk);
      }

      // Extract scores
      const extractRes = await fetch('/api/analyze/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportText: fullText })
      });
      if (extractRes.ok) {
        const data = await extractRes.json();
        setExtractedData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
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
          
          <nav className="flex space-x-2 ml-8 border-l border-slate-800 pl-8 font-mono">
            <button 
              onClick={() => setActiveTab('tms_autopilot')}
              className={cn(
                "px-3 py-1 rounded-lg text-[10px] uppercase font-black transition-all", 
                activeTab === 'tms_autopilot' ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-500 hover:text-slate-300 border border-transparent"
              )}
            >
              TMS Autopilot
            </button>
            <button 
              onClick={() => setActiveTab('auditor')}
              className={cn(
                "px-3 py-1 rounded-lg text-[10px] uppercase font-black transition-all", 
                activeTab === 'auditor' ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-500 hover:text-slate-300 border border-transparent"
              )}
            >
              Expert Auditor
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-800">
            <UserCircle className="h-3.5 w-3.5 text-cyan-500" />
            <span className="truncate max-w-[150px]">{session.user.email}</span>
          </div>
          <button onClick={handleLogout} className="text-slate-500 hover:text-rose-400 transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-hidden flex flex-col">
        {activeTab === 'tms_autopilot' ? (
          <TmsAutopilotPanel 
            tmsAudits={tmsAudits} 
            activeAuditId={activeAuditId} 
            setActiveAuditId={setActiveAuditId} 
            activeAudit={activeAudit} 
            isTmsLoading={isTmsLoading}
            onRefresh={loadTmsAudits}
            userId={session.user.id}
          />
        ) : (
          <ExpertAuditorPanel 
            inputText={inputText}
            setInputText={setInputText}
            reportText={reportText}
            isGenerating={isGenerating}
            extractedData={extractedData}
            onGenerate={handleGenerateAudit}
          />
        )}
      </main>
    </div>
  );
}

function ExpertAuditorPanel({ inputText, setInputText, reportText, isGenerating, extractedData, onGenerate }: any) {
  const scoreDimensions = [
    { key: 'thermal', label: '温控完整性' },
    { key: 'stability', label: '物理稳定性' },
    { key: 'velocity', label: '运输时效性' },
    { key: 'sla', label: '合同合规度' },
    { key: 'exemption', label: '免责风险' },
    { key: 'loss', label: '货损预估' }
  ];

  return (
    <div className="flex flex-col lg:flex-row flex-1 gap-8 w-full h-full overflow-hidden">
      <div className="flex flex-col w-full lg:w-1/3 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
           <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
             <MessageSquare className="h-4 w-4 text-cyan-500" />
             Incident Description
           </h2>
           <textarea 
             value={inputText}
             onChange={e => setInputText(e.target.value)}
             className="w-full h-64 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none custom-scrollbar"
             placeholder="Describe the cargo incident, temperature excursion, or delay here..."
           />
           <button 
             onClick={onGenerate}
             disabled={isGenerating || !inputText}
             className="w-full mt-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95"
           >
             {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Zap className="h-5 w-5" /> Run Professional Audit</>}
           </button>
        </div>

        {extractedData && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-left-4 duration-500">
             <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Compliance Score Matrix</h2>
             <div className="grid grid-cols-2 gap-4">
                {scoreDimensions.map(dim => (
                  <div key={dim.key} className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                    <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">{dim.label}</div>
                    <div className="text-xl font-black text-white">{extractedData.dimensions?.[dim.key === 'thermal' ? 'thermal_integrity' : dim.key === 'stability' ? 'physical_stability' : dim.key === 'velocity' ? 'transit_velocity' : dim.key === 'sla' ? 'sla_compliance' : dim.key === 'exemption' ? 'exemption_risk' : 'loss_mitigation']?.score ?? 0}</div>
                  </div>
                ))}
             </div>
             <div className="mt-6 pt-6 border-t border-slate-800 flex justify-between items-center">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Audit Verdict</div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                  extractedData.verdict === 'CLEAR' ? "bg-emerald-500/20 text-emerald-400" :
                  extractedData.verdict === 'WARNING' ? "bg-amber-500/20 text-amber-400" :
                  "bg-rose-500/20 text-rose-400"
                )}>
                  {extractedData.verdict}
                </div>
             </div>
          </div>
        )}
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
         <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit Report Console</span>
            {isGenerating && <span className="text-[10px] text-cyan-400 animate-pulse font-bold">DEEPSEEK REASONING IN PROGRESS...</span>}
         </div>
         <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-950/30">
            {reportText ? (
              <div className="prose prose-invert prose-sm max-w-none markdown-body">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]} 
                  rehypePlugins={[rehypeRaw, [rehypeSanitize, {
                    ...defaultSchema,
                    attributes: {
                      ...defaultSchema.attributes,
                      '*': ['className', 'style']
                    }
                  }]]}
                >
                  {reportText}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-700">
                <TerminalSquare className="h-12 w-12 opacity-10 mb-4" />
                <p className="text-xs italic">Awaiting incident data for deep-reasoning audit...</p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
}

function TmsAutopilotPanel({ tmsAudits, activeAuditId, setActiveAuditId, activeAudit, isTmsLoading, onRefresh, userId }: any) {
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
            body: JSON.stringify({ fileBase64: base64, mimeType: file.type || 'application/pdf', fileName: file.name })
          });
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
        } catch (err) { alert('无法解析合同，已加载默认模板。'); } finally { setIsParsing(false); }
      };
      reader.readAsDataURL(file);
    } catch (err) { setIsParsing(false); }
  };

  const handleSubmitAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    const scenarioData = SCENARIOS[selectedScenario];
    try {
      const res = await fetch('/api/tms/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: formShipmentId, carrier: formCarrier, commodity: formCommodity, weightKg: Number(formWeightKg),
          cargoValUsd: Number(formCargoValUsd), userId: userId, packageCount: Number(formPackageCount),
          tempLogs: [...scenarioData.logs, { meta: true, limitationClause: formLimitationClause, exemptions: formExemptions, jurisdiction: formJurisdiction, shipperName: formShipper }]
        })
      });
      if (res.ok) { onRefresh(); setIsAddingShipment(false); }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="flex flex-col lg:flex-row flex-1 gap-6 w-full h-[calc(100vh-8rem)] relative">
      <div className="flex flex-col w-full lg:w-80 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-full">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
          <div className="text-left text-[10px] uppercase tracking-wider text-slate-400 font-black">Audit History</div>
          <button onClick={() => setIsAddingShipment(!isAddingShipment)} className="text-cyan-400 hover:text-cyan-300 transition-colors"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {tmsAudits.map(audit => (
            <div key={audit.id} onClick={() => setActiveAuditId(audit.id)} className={cn("px-3 py-3 rounded-lg cursor-pointer border transition-all duration-200 text-left relative overflow-hidden group", activeAuditId === audit.id ? "bg-cyan-500/10 border-cyan-500/30" : "border-transparent hover:bg-slate-800/50")}>
              <div className="flex justify-between items-center mb-1">
                <span className={cn("text-[10px] font-black uppercase tracking-tighter", activeAuditId === audit.id ? "text-cyan-400" : "text-slate-400")}>{audit.shipmentId}</span>
                <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full font-bold", audit.claimStatus === 'CLAIM_PENDING' ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400")}>{audit.claimStatus}</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-300 truncate">{audit.commodity}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-full">
        {isAddingShipment ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
             <div className="w-full max-w-lg space-y-6">
                <div className="text-center"><h2 className="text-xl font-bold text-white">Initiate Digital Audit</h2></div>
                <div 
                  className={cn("border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center", dragActive ? "border-cyan-500 bg-cyan-500/10" : "border-slate-800 bg-slate-950/50")}
                  onDragOver={(e) => {e.preventDefault(); setDragActive(true);}} onDragLeave={() => setDragActive(false)} onDrop={(e) => {e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files[0]);}}
                >
                  {isParsing ? <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" /> : <label htmlFor="contract-upload" className="cursor-pointer uppercase tracking-widest text-[10px] font-bold text-slate-400">Drop Contract or Click to Select</label>}
                  <input type="file" className="hidden" id="contract-upload" accept=".pdf" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
                </div>
                <form onSubmit={handleSubmitAudit} className="grid grid-cols-2 gap-4">
                   <input value={formShipmentId} onChange={e => setFormShipmentId(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white" placeholder="Shipment ID" />
                   <input value={formCarrier} onChange={e => setFormCarrier(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white" placeholder="Carrier" />
                   <button type="submit" className="col-span-2 bg-cyan-600 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest">Run Automated Audit</button>
                </form>
             </div>
          </div>
        ) : activeAudit ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-800 bg-slate-800/20 flex justify-between items-end">
               <h2 className="text-2xl font-black text-white">{activeAudit.shipmentId}</h2>
               <div className="flex gap-2">
                  <button onClick={() => setActiveSubTab('details')} className={cn("px-4 py-1.5 rounded-lg text-xs font-bold", activeSubTab === 'details' ? "bg-slate-700 text-white" : "text-slate-500")}>Telemetry</button>
                  <button onClick={() => setActiveSubTab('claim')} className={cn("px-4 py-1.5 rounded-lg text-xs font-bold", activeSubTab === 'claim' ? "bg-cyan-600 text-white" : "text-slate-500")}>Claim Doc</button>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
               {activeSubTab === 'details' ? (
                 <div className="space-y-6">
                    <div className="grid grid-cols-4 gap-4">
                       <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                          <div className="text-[9px] text-slate-500 uppercase font-black">Spoilage</div>
                          <div className="text-2xl font-black text-white">{activeAudit.degradationRate}%</div>
                       </div>
                       <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                          <div className="text-[9px] text-slate-500 uppercase font-black">Carrier Fault</div>
                          <div className="text-2xl font-black text-amber-400">{activeAudit.liabilityScore}%</div>
                       </div>
                    </div>
                    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 h-64 flex items-end gap-1 px-4 relative">
                       {activeAudit.tempLogs?.filter((l: any) => !l.meta).map((log: any, i: number) => (
                         <div key={i} className={cn("flex-1 rounded-t-sm", log.temperature > 8 ? "bg-rose-500" : "bg-cyan-500/40")} style={{height: `${(log.temperature/30)*100}%`}}></div>
                       ))}
                       <div className="absolute bottom-[26%] left-0 right-0 border-t border-rose-500/30 border-dashed"></div>
                    </div>
                 </div>
               ) : (
                 <div className="max-w-2xl mx-auto bg-white p-12 text-slate-900 rounded shadow-2xl">
                    <h1 className="text-3xl font-black uppercase border-b-2 border-slate-900 pb-4">Notice of Claim</h1>
                    <div className="mt-8 space-y-4 text-xs leading-relaxed">
                       <p>Shipment: **{activeAudit.shipmentId}**</p>
                       <p>Analysis identifies critical excursions reaching **{activeAudit.maxTempSeen}°C**. Arrhenius modeling confirms degradation of **{activeAudit.degradationRate}%**.</p>
                       <div className="bg-slate-50 p-6 border-l-4 border-cyan-500 flex justify-between items-center">
                          <span className="font-black">SETTLEMENT DEMAND:</span>
                          <span className="text-3xl font-black">${activeAudit.liableClaimUsd.toLocaleString()} USD</span>
                       </div>
                    </div>
                 </div>
               )}
            </div>
          </div>
        ) : <div className="flex-1 flex items-center justify-center text-slate-700 font-black uppercase tracking-tighter opacity-20 text-4xl italic">ChainGuard AI Terminal</div>}
      </div>
    </div>
  );
}

const SCENARIOS = {
  A: { name: 'Scenario A', logs: [ { time: new Date(Date.now() - 3600000 * 5).toISOString(), temp: 3.8 }, { time: new Date(Date.now() - 3600000 * 4).toISOString(), temp: 18.2 }, { time: new Date(Date.now() - 3600000 * 2).toISOString(), temp: 4.1 } ] },
  B: { name: 'Scenario B', logs: [ { time: new Date(Date.now() - 3600000 * 6).toISOString(), temp: 14.5 }, { time: new Date(Date.now() - 3600000 * 5).toISOString(), temp: 8.5 }, { time: new Date(Date.now() - 3600000 * 1).toISOString(), temp: 14.2 } ] },
  C: { name: 'Scenario C', logs: [ { time: new Date(Date.now() - 3600000 * 3).toISOString(), temp: 2.5 } ] }
};

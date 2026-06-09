import React, { useState, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Play,
  Flame,
  Sparkles,
  TrendingUp,
  Coins,
  Scale,
  FileText,
  Activity,
  FileCode,
  RefreshCw,
  Copy,
  Printer,
  Thermometer,
  Droplets,
  Zap,
  Mail,
  Lock,
  Loader2,
  LogOut,
  UserCircle
} from "lucide-react";
import { cn } from './lib/utils';
import { supabase } from './lib/supabase';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from "recharts";
import { ShipmentData, TelemetryPoint, AnalysisReport, Contract, Message } from "./types";
import { SCENARIOS } from "./scenariosData";

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
    if (error) setAuthError(error.message);
    else onLogin();
    setAuthLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-none shadow-[4px_4px_0px_rgba(20,20,20,1)] p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-red-650 rounded-none flex items-center justify-center text-white font-bold mb-4 shadow-[2px_2px_0px_rgba(20,20,20,1)]">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight font-mono uppercase">ChainGuard <span className="text-red-500">AI</span></h1>
          <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mt-2">{isSignUp ? 'Create your Audit account' : 'Access Secure Audit Terminal'}</p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4 font-mono">
          <div>
            <label className="block text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-zinc-950 border border-zinc-800 rounded-none py-2.5 pl-10 pr-4 text-xs text-white focus:ring-1 focus:ring-red-650 outline-none" placeholder="auditor@chainguard.ai" />
            </div>
          </div>
          <div>
            <label className="block text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-zinc-950 border border-zinc-800 rounded-none py-2.5 pl-10 pr-4 text-xs text-white focus:ring-1 focus:ring-red-650 outline-none" placeholder="••••••••" />
            </div>
          </div>
          {authError && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-none text-[10px] text-red-400">{authError}</div>}
          <button type="submit" disabled={authLoading} className="w-full bg-red-750 hover:bg-red-650 text-white font-bold py-2.5 rounded-none transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 uppercase text-xs tracking-widest shadow-[2px_2px_0px_rgba(20,20,20,1)]">
            {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isSignUp ? 'Register Account' : 'Initialize Session')}
          </button>
        </form>
        <div className="mt-6 text-center">
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-[10px] font-mono text-zinc-500 hover:text-red-500 transition-colors uppercase tracking-tight">
            {isSignUp ? 'Already registered? Sign In' : "No access? Request Audit Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const [selectedScenarioKey, setSelectedScenarioKey] = useState<string>("cherries_customs_delay");
  
  // Editable form states
  const [shipmentId, setShipmentId] = useState<string>("");
  const [cargoType, setCargoType] = useState<string>("");
  const [commercialValue, setCommercialValue] = useState<number>(0);
  const [contractTerms, setContractTerms] = useState<string>("");
  const [incidentContext, setIncidentContext] = useState<string>("");
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);

  // Telemetry modification items
  const [newTimestamp, setNewTimestamp] = useState<string>("");
  const [newTemp, setNewTemp] = useState<number>(5.0);
  const [newHumidity, setNewHumidity] = useState<number>(75);
  const [newShock, setNewShock] = useState<number>(0.2);

  // Core Intelligence API reports
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  const [errorLogs, setErrorLogs] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Staggered loading state simulation text
  const [loadingStep, setLoadingStep] = useState<string>("");

  // RAG PDF contracts
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContractPath, setSelectedContractPath] = useState<string>("contracts/cherries_sla_agreement.pdf");
  const [uploading, setUploading] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Google AI Studio Inspired UI States
  const [showCode, setShowCode] = useState<boolean>(false);
  const [showAssistant, setShowAssistant] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I am the ChainGuard AI assistant. Ask me anything about this shipment, the telemetry sensors, or liability proportions." }
  ]);
  const [currentMessageInput, setCurrentMessageInput] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [codeTab, setCodeTab] = useState<"curl" | "python" | "js">("curl");

  // Harness Engineering - Human-in-the-Loop States
  const [editedIncidentSummary, setEditedIncidentSummary] = useState<string>("");
  const [editedScientificReasoning, setEditedScientificReasoning] = useState<string>("");
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [overrideLiableParty, setOverrideLiableParty] = useState<string>("Carrier");
  const [overrideFaultPct, setOverrideFaultPct] = useState<number>(100);
  const [activeHighlightCategory, setActiveHighlightCategory] = useState<"deductible" | "exclusions" | "liability" | null>(null);
  const [isWebhookPolling, setIsWebhookPolling] = useState<boolean>(false);
  const [evalResults, setEvalResults] = useState<any>(null);

  // TMS states
  const [tmsEvents, setTmsEvents] = useState<any[]>([]);
  const [tmsLoading, setTmsLoading] = useState<boolean>(false);
  const [simulatorTms, setSimulatorTms] = useState<string>("CargoWise");
  const [simulatorScenario, setSimulatorScenario] = useState<string>("cherries_customs_delay");
  const [simulatorPayload, setSimulatorPayload] = useState<string>("{}");

  // Underwriting states & datasets
  const [calcCarrier, setCalcCarrier] = useState<string>("Maersk Cold Chain");
  const [calcLane, setCalcLane] = useState<string>("Rotterdam to Shanghai");
  const [calcCargoType, setCalcCargoType] = useState<string>("Fresh Cherries");
  const [calcCargoValue, setCalcCargoValue] = useState<number>(100000);

  // Verification states
  const [auditChain, setAuditChain] = useState<any[]>([]);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const CARRIERS_DATA = [
    { name: "Maersk Cold Chain", grade: "A", score: 94, spoilageRate: 1.2, tempDevs: 14, shockCount: 2, baseMultiplier: 0.8 },
    { name: "Hapag-Lloyd Reefer", grade: "B+", score: 88, spoilageRate: 2.1, tempDevs: 22, shockCount: 4, baseMultiplier: 1.0 },
    { name: "Apex Air Freight", grade: "A+", score: 98, spoilageRate: 0.5, tempDevs: 5, shockCount: 1, baseMultiplier: 0.6 },
    { name: "DHL Biotech Express", grade: "A", score: 93, spoilageRate: 1.4, tempDevs: 12, shockCount: 3, baseMultiplier: 0.85 },
    { name: "Generic Cold Carrier", grade: "C-", score: 71, spoilageRate: 5.4, tempDevs: 48, shockCount: 9, baseMultiplier: 1.5 }
  ];

  const ROUTES_DATA = [
    { lane: "Rotterdam to Shanghai", avgTempBreach: 1.4, shockFreq: 2.5, dangerLevel: "Low", multiplier: 1.0 },
    { lane: "Seattle to Tokyo", avgTempBreach: 2.2, shockFreq: 3.1, dangerLevel: "Medium", multiplier: 1.2 },
    { lane: "Santiago to Hamburg", avgTempBreach: 4.8, shockFreq: 4.0, dangerLevel: "High", multiplier: 1.5 },
    { lane: "Chicago to Munich (Air)", avgTempBreach: 0.8, shockFreq: 1.2, dangerLevel: "Low", multiplier: 0.9 },
    { lane: "Mumbai to Rotterdam", avgTempBreach: 5.2, shockFreq: 3.8, dangerLevel: "High", multiplier: 1.6 }
  ];

  const calculatePremium = () => {
    const carrier = CARRIERS_DATA.find(c => c.name === calcCarrier) || CARRIERS_DATA[0];
    const route = ROUTES_DATA.find(r => r.lane === calcLane) || ROUTES_DATA[0];
    
    let baseCargoPct = 0.5;
    const cargo = calcCargoType.toLowerCase();
    if (cargo.includes("cherry") || cargo.includes("cherries")) {
      baseCargoPct = 1.8;
    } else if (cargo.includes("vaccine") || cargo.includes("pharma") || cargo.includes("cov")) {
      baseCargoPct = 2.5;
    } else if (cargo.includes("wine")) {
      baseCargoPct = 1.2;
    } else if (cargo.includes("salmon")) {
      baseCargoPct = 1.5;
    }
    
    const finalRate = baseCargoPct * carrier.baseMultiplier * route.multiplier;
    const finalPremiumUsd = (calcCargoValue * finalRate) / 100;
    
    return {
      rate: parseFloat(finalRate.toFixed(2)),
      premiumUsd: Math.round(finalPremiumUsd),
      carrierMultiplier: carrier.baseMultiplier,
      routeMultiplier: route.multiplier,
      reliabilityScore: carrier.score
    };
  };

  // IoT Streaming states
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamIndex, setStreamIndex] = useState<number>(0);
  const [remainingShelfLifePct, setRemainingShelfLifePct] = useState<number>(100);
  const [activeAlerts, setActiveAlerts] = useState<string[]>([]);

  // IoT Streaming effect
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(async () => {
      const activeScenario = SCENARIOS[selectedScenarioKey];
      if (!activeScenario) {
        setIsStreaming(false);
        return;
      }
      
      const fullHistory = activeScenario.data.iot_telemetry_history;
      if (streamIndex >= fullHistory.length) {
        setIsStreaming(false); // Finished streaming
        clearInterval(interval);
        return;
      }

      const telemetrySlice = fullHistory.slice(0, streamIndex + 1);

      try {
        await fetch("/api/webhook/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shipment_id: shipmentId,
            telemetry: telemetrySlice
          })
        });

        setIsWebhookPolling(true);
        setStreamIndex((prev) => prev + 1);
      } catch (err) {
        console.error("Error streaming telemetry point:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isStreaming, streamIndex, selectedScenarioKey, shipmentId]);

  // Calculate Q10 Shelf Life Decay and Alerts dynamically based on telemetry updates
  useEffect(() => {
    if (telemetry.length === 0) {
      setRemainingShelfLifePct(100);
      setActiveAlerts([]);
      return;
    }

    let q10 = 2.0;
    let refTemp = 0.0;
    let refShelfLifeHours = 120.0;
    let maxTempLimit = 8.0;
    let maxShockLimit = 2.0;

    const cargo = cargoType.toLowerCase();
    if (cargo.includes("cherry") || cargo.includes("cherries")) {
      q10 = 2.5;
      refTemp = 1.0;
      refShelfLifeHours = 72.0;
      maxTempLimit = 8.0;
    } else if (cargo.includes("vaccine") || cargo.includes("pharma") || cargo.includes("cov")) {
      q10 = 3.5;
      refTemp = 4.0;
      refShelfLifeHours = 48.0;
      maxTempLimit = 8.0;
    } else if (cargo.includes("wine")) {
      q10 = 2.0;
      refTemp = 12.0;
      refShelfLifeHours = 240.0;
      maxTempLimit = 16.0;
    } else if (cargo.includes("salmon")) {
      q10 = 2.2;
      refTemp = 0.0;
      refShelfLifeHours = 96.0;
      maxTempLimit = 4.0;
    }

    let fractionConsumed = 0.0;
    let alerts: string[] = [];
    let hasTempBreach = false;
    let hasShockBreach = false;

    telemetry.forEach((pt) => {
      const temp = pt.temperature;
      const shock = pt.shock_g;

      const rateMultiplier = Math.pow(q10, (temp - refTemp) / 10.0);
      const durationHours = 1.0;
      fractionConsumed += (rateMultiplier / refShelfLifeHours) * durationHours;

      if (temp > maxTempLimit) {
        hasTempBreach = true;
      }
      if ((cargo.includes("vaccine") || cargo.includes("pharma")) && temp < 0) {
        hasTempBreach = true;
      }
      if (shock > maxShockLimit) {
        hasShockBreach = true;
      }
    });

    const remainingFraction = Math.max(0.0, 1.0 - fractionConsumed);
    setRemainingShelfLifePct(Math.round(remainingFraction * 100));

    if (hasTempBreach) {
      alerts.push(`Critical Temperature Breach (> ${maxTempLimit}°C) detected in telemetry log`);
    }
    if ((cargo.includes("vaccine") || cargo.includes("pharma")) && telemetry.some(t => t.temperature < 0)) {
      alerts.push(`Critical Freezing Breach (< 0°C) detected in telemetry log`);
    }
    if (hasShockBreach) {
      alerts.push(`Critical Mechanical Shock Force (> ${maxShockLimit}G) registered on container sensors`);
    }
    if (remainingFraction < 0.5 && remainingFraction >= 0.2) {
      alerts.push("Warning: Cargo Shelf-Life consumed exceeds 50% threshold");
    } else if (remainingFraction < 0.2) {
      alerts.push("CRITICAL ALERT: Cargo shelf-life exhausted - high risk of total spoilage");
    }

    setActiveAlerts(alerts);
  }, [telemetry, cargoType]);

  const fetchTmsEvents = async () => {
    try {
      const res = await fetch("/api/tms/events");
      if (res.ok) {
        const data = await res.json();
        setTmsEvents(data);
      }
    } catch (err) {
      console.error("Error fetching TMS events:", err);
    }
  };

  useEffect(() => {
    const sc = SCENARIOS[simulatorScenario];
    if (sc) {
      const pdfPath = simulatorScenario.includes("cherries") 
        ? "contracts/cherries_sla_agreement.pdf"
        : simulatorScenario.includes("pharma") || simulatorScenario.includes("biopharma")
        ? "contracts/pharma_global_transport.pdf"
        : "contracts/wine_logistics_spec.pdf";

      const payload = {
        tms_system: simulatorTms,
        event_type: "SHIPMENT_DELIVERED",
        shipment_id: sc.data.shipment_id + "-TMS",
        cargo_type: sc.data.cargo_type,
        commercial_value_usd: sc.data.commercial_value_usd,
        contract_pdf_path: pdfPath,
        incident_context: sc.data.incident_context,
        telemetry: sc.data.iot_telemetry_history
      };
      setSimulatorPayload(JSON.stringify(payload, null, 2));
    }
  }, [simulatorScenario, simulatorTms]);

  const dispatchTmsWebhook = async () => {
    setTmsLoading(true);
    try {
      let parsed;
      try {
        parsed = JSON.parse(simulatorPayload);
      } catch (e) {
        alert("Invalid JSON payload in simulator.");
        setTmsLoading(false);
        return;
      }

      const res = await fetch("/api/tms/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(parsed)
      });

      if (res.ok) {
        const result = await res.json();
        alert(`TMS Webhook Dispatched Successfully!\nEvent ID: ${result.event_id}\nStatus: ${result.status}`);
        await fetchTmsEvents();
      } else {
        const err = await res.json();
        alert(`Failed to dispatch TMS webhook: ${err.error || err.detail}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Network error dispatching TMS webhook: ${err.message}`);
    } finally {
      setTmsLoading(false);
    }
  };

  const loadTmsEventDetails = (event: any) => {
    setShipmentId(event.shipment_id);
    setCargoType(event.cargo_type);
    setCommercialValue(event.commercial_value_usd);
    setIncidentContext(event.incident_context || "");
    
    // Check if telemetry points exist in event.report or payload
    const tele = event.telemetry || [];
    setTelemetry(tele);

    const mockReport: AnalysisReport = {
      incident_summary: event.incident_context || "",
      action_items: event.report?.action_items || [],
      damage_assessment: event.report?.damage_assessment || {
        status: "UNKNOWN",
        estimated_loss_usd: 0,
        scientific_reasoning: "Not calculated."
      },
      liability_assignment: event.report?.liability_assignment || {
        liable_party: "UNKNOWN",
        fault_percentage: 0,
        evidence_citation: "No evidence."
      },
      extracted_terms: event.extracted_terms,
      assessor_output: event.assessor_output,
      legal_output: event.legal_output,
      dispatcher_output: event.dispatcher_output
    };

    setAnalysisReport(mockReport);
    setIsApproved(true);
    setEditedIncidentSummary(event.incident_context || "");
    setEditedScientificReasoning(mockReport.damage_assessment.scientific_reasoning);
    setOverrideLiableParty(mockReport.liability_assignment.liable_party);
    setOverrideFaultPct(mockReport.liability_assignment.fault_percentage);

    setActiveTab("overview");
  };

  // Fetch model evaluation metrics on developer panel load
  useEffect(() => {
    if (showCode) {
      fetch("/api/eval-results")
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) {
            setEvalResults(data);
          }
        })
        .catch((err) => console.error("Error loading eval metrics:", err));
    }
  }, [showCode]);

  // Webhook polling loop
  useEffect(() => {
    if (!isWebhookPolling) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/active-telemetry?shipment_id=${encodeURIComponent(shipmentId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.telemetry) {
            setTelemetry(data.telemetry);
          }
        }
      } catch (err) {
        console.error("Error polling active telemetry:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isWebhookPolling, shipmentId]);

  // Fetch contracts list from backend
  const fetchContracts = async () => {
    try {
      const res = await fetch("/api/contracts");
      if (res.ok) {
        const data = await res.json();
        setContracts(data);
      }
    } catch (err) {
      console.error("Error fetching contracts:", err);
    }
  };

  const handleContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/upload-contract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, file_base64: base64 })
        });
        if (res.ok) {
          const newContract = await res.json();
          setContracts((prev) => [...prev, newContract]);
          setSelectedContractPath(newContract.path);
          alert(`Contract uploaded successfully: ${newContract.name}`);
        } else {
          const errData = await res.json();
          alert(`Failed to upload contract: ${errData.error}`);
        }
      } catch (err) {
        console.error(err);
        alert("Network error uploading contract.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Prime the initial state with the first scenario
  useEffect(() => {
    loadScenario(selectedScenarioKey);
    fetchContracts();
    fetchTmsEvents();
    fetchAuditChain();
  }, []);

  const loadScenario = (key: string) => {
    const scenario = SCENARIOS[key];
    if (scenario) {
      setSelectedScenarioKey(key);
      setShipmentId(scenario.data.shipment_id);
      setCargoType(scenario.data.cargo_type);
      setCommercialValue(scenario.data.commercial_value_usd);
      setContractTerms(scenario.data.carrier_contract_terms);
      setIncidentContext(scenario.data.incident_context);
      
      // Auto-select PDF based on scenario key
      if (key.includes("cherries") || key.includes("customs")) {
        setSelectedContractPath("contracts/cherries_sla_agreement.pdf");
      } else if (key.includes("pharma") || key.includes("vaccine")) {
        setSelectedContractPath("contracts/pharma_global_transport.pdf");
      } else if (key.includes("wine")) {
        setSelectedContractPath("contracts/wine_logistics_spec.pdf");
      }

      // deep clone array
      setTelemetry(JSON.parse(JSON.stringify(scenario.data.iot_telemetry_history)));
      setAnalysisReport(null);
      setErrorLogs(null);
      
      // Reset HITL states
      setEditedIncidentSummary("");
      setEditedScientificReasoning("");
      setIsApproved(false);

      // Reset assistant chat
      setChatMessages([
        { role: "assistant", content: `Hello! I am the ChainGuard AI assistant. I see we have loaded scenario: "${scenario.name}". Ask me anything about this shipment, the telemetry sensors, or liability proportions.` }
      ]);
    }
  };

  // Telemetry updates
  const handleTelemetryChange = (index: number, key: keyof TelemetryPoint, val: any) => {
    const updated = [...telemetry];
    if (key === "timestamp") {
      updated[index][key] = val;
    } else {
      updated[index][key] = Number(val);
    }
    setTelemetry(updated);
  };

  const addTelemetryPoint = () => {
    if (!newTimestamp.trim()) {
      alert("Please provide a timestamp label (e.g., '02:00 PM')");
      return;
    }
    const newPoint: TelemetryPoint = {
      timestamp: newTimestamp,
      temperature: Number(newTemp),
      humidity: Number(newHumidity),
      shock_g: Number(newShock)
    };
    setTelemetry([...telemetry, newPoint]);
    setNewTimestamp("");
  };

  const removeTelemetryPoint = (index: number) => {
    const updated = telemetry.filter((_, i) => i !== index);
    setTelemetry(updated);
  };

  // Inject rapid anomalies for live testing
  const injectAnomaly = (type: "temp_spike" | "shock_impact") => {
    const updated = [...telemetry];
    const lastPoint = updated[updated.length - 1] || { timestamp: "12:00 PM", temperature: 4, humidity: 75, shock_g: 0.1 };
    
    // Parse time to make a sequence
    let nextHour = "01:00 PM";
    if (lastPoint.timestamp) {
      const match = lastPoint.timestamp.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let hr = parseInt(match[1]);
        const minStr = match[2];
        let ampm = match[3].toUpperCase();
        hr = hr + 1;
        if (hr > 12) {
          hr = hr - 12;
        } else if (hr === 12) {
          ampm = ampm === "AM" ? "PM" : "AM";
        }
        nextHour = `${hr}:${minStr} ${ampm}`;
      }
    }

    if (type === "temp_spike") {
      updated.push({
        timestamp: nextHour,
        temperature: 28.5,
        humidity: 62,
        shock_g: 0.1
      });
    } else if (type === "shock_impact") {
      updated.push({
        timestamp: nextHour,
        temperature: lastPoint.temperature,
        humidity: lastPoint.humidity,
        shock_g: 5.2
      });
    }

    setTelemetry(updated);
  };

  // Call server intelligence algorithm
  const handleAnalyzeShipment = async () => {
    setIsLoading(true);
    setErrorLogs(null);
    setAnalysisReport(null);
    setActiveTab("overview");

    const stages = [
      "Loading contract PDF via LangChain PyPDFLoader RAG...",
      "Extracting deductibles, exemptions, and disclaimers...",
      "Deploying CrewAI Agent: Cargo Damage Assessor (Evaluating biological decay)...",
      "Deploying CrewAI Agent: Liability Legal Officer (Arbitrating clauses & fault)...",
      "Deploying CrewAI Agent: Emergency Dispatcher (Drafting emergency operational salvage)...",
      "Compiling agent reports into legally defensible audit claim..."
    ];

    let currentStage = 0;
    setLoadingStep(stages[0]);
    const stageTimer = setInterval(() => {
      currentStage++;
      if (currentStage < stages.length) {
        setLoadingStep(stages[currentStage]);
      }
    }, 1200);

    try {
      const shipmentPayload = {
        shipment_id: shipmentId,
        cargo_type: cargoType,
        commercial_value_usd: commercialValue,
        iot_telemetry_history: telemetry,
        incident_context: incidentContext,
        pdf_path: selectedContractPath
      };

      const res = await fetch("/api/analyze-telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shipmentPayload)
      });

      clearInterval(stageTimer);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Server responded with status code ${res.status}`);
      }

      const data: AnalysisReport = await res.json();
      setAnalysisReport(data);
      setEditedIncidentSummary(data.incident_summary);
      setEditedScientificReasoning(data.damage_assessment?.scientific_reasoning || "");
      setOverrideLiableParty(data.liability_assignment?.liable_party || "Carrier");
      setOverrideFaultPct(data.liability_assignment?.fault_percentage || 0);
      setIsApproved(false);
    } catch (err: any) {
      clearInterval(stageTimer);
      console.error(err);
      setErrorLogs(err.message || "An unexpected network or engine error occurred compiling the report.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!analysisReport) return;
    navigator.clipboard.writeText(JSON.stringify(analysisReport, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadClaimPDF = async () => {
    if (!analysisReport) return;
    try {
      setDownloadingPdf(true);
      const res = await fetch("/api/audit/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipment_id: shipmentId || "unknown_shipment",
          cargo_type: cargoType,
          commercial_value: commercialValue,
          extracted_terms: analysisReport.extracted_terms || {},
          report: analysisReport,
          telemetry: telemetry
        })
      });

      if (!res.ok) {
        throw new Error("Failed to generate official claim PDF.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `claim_report_${shipmentId || "report"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An error occurred downloading the claim PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const fetchAuditChain = async () => {
    try {
      const res = await fetch("/api/audit/chain");
      if (res.ok) {
        const data = await res.json();
        setAuditChain(data);
      }
    } catch (err) {
      console.error("Failed to fetch audit chain:", err);
    }
  };

  const handleVerifyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVerifying(true);
    setVerificationResult(null);
    setVerificationError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64Str = (event.target?.result as string).split(",")[1];
        const payload: any = {
          file_base64: base64Str,
          filename: file.name
        };
        
        if (analysisReport) {
          payload.shipment_id = shipmentId;
          payload.telemetry = JSON.stringify(telemetry);
          payload.extracted_terms = JSON.stringify(analysisReport.extracted_terms || {});
        }

        const res = await fetch("/api/audit/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Verification failed on the proxy backend.");
        }

        const data = await res.json();
        setVerificationResult(data);
        fetchAuditChain(); // Refresh ledger
      } catch (err: any) {
        console.error(err);
        setVerificationError(err.message || "An error occurred verifying the claim PDF.");
      } finally {
        setVerifying(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const renderHighlightedContractText = () => {
    if (!analysisReport) return null;
    const rawText = analysisReport.extracted_terms?.raw_contract_text || "No original contract text parsed in the RAG payload.";
    if (!activeHighlightCategory) {
      return <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-hd-ink">{rawText}</pre>;
    }

    let keywords: string[] = [];
    if (activeHighlightCategory === "deductible") {
      keywords = ["deductible", "$5,000", "$10,000", "$2,500", "免赔额"];
    } else if (activeHighlightCategory === "exclusions") {
      keywords = ["exclusions", "customs", "exempt", "strike", "shock limit", "force majeure", "exemption", "免责"];
    } else if (activeHighlightCategory === "liability") {
      keywords = ["liability limits", "60%", "100%", "capped at", "limit", "recovery", "责任限制"];
    }

    const paragraphs = rawText.split("\n");
    return (
      <div className="font-mono text-[10px] leading-relaxed text-hd-ink flex flex-col gap-2">
        {paragraphs.map((p, idx) => {
          const lowerP = p.toLowerCase();
          const matches = keywords.some(kw => lowerP.includes(kw.toLowerCase()));
          if (matches) {
            return (
              <p key={idx} className="bg-amber-100 border-l-2 border-amber-600 pl-2.5 py-1.5 my-0.5 font-bold">
                {p}
              </p>
            );
          }
          return <p key={idx} className="my-0.5">{p}</p>;
        })}
      </div>
    );
  };

  const handlePrint = () => {
    window.print();
  };

  // Google AI Studio inspired helper methods
  const getCurlCode = () => {
    const payload = {
      shipment_id: shipmentId,
      cargo_type: cargoType,
      commercial_value_usd: commercialValue,
      pdf_path: selectedContractPath,
      incident_context: incidentContext,
      iot_telemetry_history: telemetry
    };
    return `curl -X POST http://localhost:3000/api/analyze-telemetry \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload, null, 2).replace(/'/g, "'\\''")}'`;
  };

  const getPythonCode = () => {
    const payload = {
      shipment_id: shipmentId,
      cargo_type: cargoType,
      commercial_value_usd: commercialValue,
      pdf_path: selectedContractPath,
      incident_context: incidentContext,
      iot_telemetry_history: telemetry
    };
    return `import requests
import json

url = "http://localhost:3000/api/analyze-telemetry"
payload = ${JSON.stringify(payload, null, 4)}

response = requests.post(url, json=payload)
print(response.json())`;
  };

  const getJsCode = () => {
    const payload = {
      shipment_id: shipmentId,
      cargo_type: cargoType,
      commercial_value_usd: commercialValue,
      pdf_path: selectedContractPath,
      incident_context: incidentContext,
      iot_telemetry_history: telemetry
    };
    return `const url = "http://localhost:3000/api/analyze-telemetry";
const payload = ${JSON.stringify(payload, null, 2)};

fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
})
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));`;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessageInput.trim()) return;

    const userMsg: Message = { role: "user", content: currentMessageInput.trim() };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setCurrentMessageInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          shipment_data: {
            shipment_id: shipmentId,
            cargo_type: cargoType,
            commercial_value_usd: commercialValue,
            incident_context: incidentContext,
            iot_telemetry_history: telemetry
          },
          analysis_report: analysisReport,
          pdf_path: selectedContractPath
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: "assistant", content: data.content }]);
      } else {
        const errData = await res.json();
        setChatMessages(prev => [...prev, { role: "assistant", content: `Error: ${errData.error || "Failed to process request"}` }]);
      }
    } catch (err: any) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: "assistant", content: "Connection error. Failed to reach the assistant server." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleTelemetryJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          const validated: TelemetryPoint[] = parsed.map((item: any, idx) => {
            if (
              typeof item.timestamp !== "string" ||
              typeof item.temperature !== "number" ||
              typeof item.humidity !== "number" ||
              typeof item.shock_g !== "number"
            ) {
              throw new Error(`Data point at index ${idx} is missing required fields or has invalid types.`);
            }
            return {
              timestamp: item.timestamp,
              temperature: item.temperature,
              humidity: item.humidity,
              shock_g: item.shock_g
            };
          });
          setTelemetry(validated);
          alert(`Successfully imported ${validated.length} telemetry points!`);
        } else {
          alert("Invalid telemetry format. Must be a JSON array of data points.");
        }
      } catch (err: any) {
        alert(`Failed to parse telemetry JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Real-time Anomaly Detection Engine
  const getTelemetryAlerts = () => {
    const alerts: { type: "temp" | "shock"; msg: string; time: string }[] = [];
    
    // Determine boundaries based on cargo type
    let tempMin = -0.5;
    let tempMax = 1.5;
    let maxShock = 2.0;
    
    const cargoLower = cargoType.toLowerCase();
    if (cargoLower.includes("pharma") || cargoLower.includes("vaccine")) {
      tempMin = 2.0;
      tempMax = 8.0;
    } else if (cargoLower.includes("wine")) {
      tempMin = 10.0;
      tempMax = 16.0;
    } else if (cargoLower.includes("salmon")) {
      tempMin = -1.5;
      tempMax = 1.5;
    } else if (cargoLower.includes("cherries")) {
      tempMin = -0.5;
      tempMax = 1.5;
    }

    telemetry.forEach((pt) => {
      if (pt.temperature < tempMin || pt.temperature > tempMax) {
        alerts.push({
          type: "temp",
          time: pt.timestamp,
          msg: `Temperature Breach: ${pt.temperature}°C at ${pt.timestamp} (SLA target: ${tempMin}°C to ${tempMax}°C)`
        });
      }
      if (pt.shock_g > maxShock) {
        alerts.push({
          type: "shock",
          time: pt.timestamp,
          msg: `Mechanical Impact Shock: ${pt.shock_g}G at ${pt.timestamp} (Limit: ${maxShock}G)`
        });
      }
    });

    return { alerts, tempMin, tempMax, maxShock };
  };

  const { alerts: telemetryAlerts, tempMin, tempMax, maxShock } = getTelemetryAlerts();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono">
        <Loader2 className="h-8 w-8 text-red-650 animate-spin" />
        <span className="ml-4 text-zinc-500 uppercase tracking-widest text-[10px] font-bold">Establishing Secure Link...</span>
      </div>
    );
  }

  if (!session) {
    return <LoginView onLogin={() => {}} />;
  }

  return (
    <div id="chainguard-app" className="min-h-screen bg-hd-bg text-hd-ink flex flex-col font-sans selection:bg-hd-ink selection:text-white p-4">
      
      {/* Dynamic Header */}
      <header id="app-header" className="flex flex-col md:flex-row justify-between items-baseline md:items-end mb-6 border-b-2 border-hd-ink pb-3 px-1">
        <div className="flex flex-col md:flex-row items-baseline gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-hd-ink font-sans">CHAINGUARD AI</h1>
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-60">
              Core Intelligence Agent / Compliance Engine
            </p>
          </div>
          <div className="hidden md:block h-10 w-px bg-hd-line/20"></div>
          <div>
            <span className="block text-[10px] opacity-60 uppercase font-bold">Active Shipment ID</span>
            <span className="font-mono text-lg font-bold uppercase text-hd-ink">{shipmentId || "N/A"}</span>
          </div>
        </div>
        <div className="text-left md:text-right mt-3 md:mt-0 flex flex-col md:items-end gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            {/* AI Studio Toggles */}
            <div className="flex gap-1.5 border border-hd-line p-0.5 bg-zinc-50 font-mono text-[9px] font-bold uppercase">
              <button
                onClick={() => setShowCode(!showCode)}
                id="btn-toggle-code"
                className={`px-2 py-1 transition cursor-pointer flex items-center gap-1 border-r border-hd-line last:border-r-0 ${
                  showCode ? "bg-hd-ink text-white" : "bg-white text-hd-ink hover:bg-zinc-150"
                }`}
                title="Toggle Developer API Code panel"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Show Code</span>
              </button>
              <button
                onClick={() => setShowAssistant(!showAssistant)}
                id="btn-toggle-assistant"
                className={`px-2 py-1 transition cursor-pointer flex items-center gap-1 border-r border-hd-line last:border-r-0 ${
                  showAssistant ? "bg-amber-650 text-white" : "bg-white text-hd-ink hover:bg-zinc-150"
                }`}
                title="Toggle Gemini AI Assistant chat"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Assistant</span>
              </button>
            </div>
            
            <div className="flex items-center gap-3 ml-4 bg-zinc-100 p-1 border border-hd-line font-mono text-[9px] font-bold uppercase">
              <div className="flex items-center gap-1.5 px-2">
                <UserCircle className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-zinc-600">{session.user.email}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="bg-zinc-800 text-white px-2 py-1 hover:bg-red-750 transition-colors cursor-pointer border-l border-hd-line"
                title="Terminate Session"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-block relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
              </span>
              <span className="font-mono text-xs font-bold uppercase border border-hd-line bg-white px-2 py-0.5 text-hd-ink">
                Telemetry Feed Online
              </span>
            </div>
          </div>
          <p className="text-[9px] uppercase font-bold opacity-60 font-mono">
            Compliance Node: v4.2.0-STABLE • Gemini 3.5 Active
          </p>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main id="app-main-content" className="flex-1 w-full mx-auto flex flex-col xl:flex-row gap-6 items-stretch">
        
        {/* Left and Center main content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 transition-all duration-300">
        
        {/* Left Side: Simulation Config & Raw Inputs */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Preset Selector */}
          <section id="preset-selector-card" className="bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)] relative">
            <div className="font-serif-georgia italic text-xs text-hd-ink/70 uppercase tracking-wider border-b border-hd-line pb-2 mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Logistics Incident Scenarios</span>
            </div>
            <p className="text-xs text-hd-ink/70 mb-4 font-sans leading-tight">
              Select a real-world cold-chain shipment template to pre-load calibrated IoT telemetries, cargo value, and contract terms.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(SCENARIOS).map(([key, item]) => {
                const isSelected = selectedScenarioKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => loadScenario(key)}
                    id={`btn-scenario-${key}`}
                    className={`text-left p-3 rounded-none border text-xs transition-all duration-150 flex flex-col gap-1 ${
                      isSelected
                        ? "bg-hd-ink text-white border-hd-line shadow-sm"
                        : "bg-white text-hd-ink border-zinc-300 hover:border-hd-line hover:bg-zinc-50"
                    }`}
                  >
                    <span className="font-bold flex items-center justify-between">
                      <span className={isSelected ? "text-white" : "text-hd-ink"}>{item.name}</span>
                      {isSelected && (
                        <span className="text-[9px] text-white bg-red-600 px-1.5 py-0.5 rounded-none font-mono font-bold uppercase">
                          Active State
                        </span>
                      )}
                    </span>
                    <span className={`text-[11px] leading-tight ${isSelected ? "text-zinc-300" : "text-zinc-600"}`}>
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Form Editor */}
          <section id="shipment-form" className="bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)] relative">
            <div className="flex items-center justify-between mb-4 border-b border-hd-line pb-2">
              <div className="font-serif-georgia italic text-xs text-hd-ink/70 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-hd-ink" />
                <span>Cargo Parameters & SLA Rules</span>
              </div>
              <button
                onClick={() => loadScenario(selectedScenarioKey)}
                id="btn-reset-form"
                className="text-[10px] flex items-center gap-1 bg-white border border-hd-line px-2.5 py-1 rounded-none hover:bg-hd-ink hover:text-white transition font-mono font-bold uppercase cursor-pointer"
                title="Revert modifications to scenario defaults"
              >
                <RefreshCw className="w-3 h-3" />
                Reset Preset
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-hd-ink/70 font-mono uppercase tracking-wide">
                  Shipment Identifier
                </label>
                <input
                  type="text"
                  value={shipmentId}
                  onChange={(e) => setShipmentId(e.target.value)}
                  id="input-shipment-id"
                  className="bg-zinc-50 border border-hd-line rounded-none px-3 py-1.5 text-xs text-hd-ink focus:outline-none focus:bg-white focus:border-red-600 focus:ring-1 focus:ring-red-600 transition font-mono font-semibold"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-hd-ink/70 font-mono uppercase tracking-wide">
                  Declared Value (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-hd-ink/50">$</span>
                  <input
                    type="number"
                    value={commercialValue}
                    onChange={(e) => setCommercialValue(Math.max(0, Number(e.target.value)))}
                    id="input-commercial-value"
                    className="w-full bg-zinc-50 border border-hd-line rounded-none pl-6 pr-3 py-1.5 text-xs text-hd-ink focus:outline-none focus:bg-white focus:border-red-600 focus:ring-1 focus:ring-red-600 transition font-mono font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-[10px] font-bold text-hd-ink/70 font-mono uppercase tracking-wide">
                Cargo Type & Substance Info
              </label>
              <input
                type="text"
                value={cargoType}
                onChange={(e) => setCargoType(e.target.value)}
                id="input-cargo-type"
                className="bg-zinc-50 border border-hd-line rounded-none px-3 py-1.5 text-xs text-hd-ink focus:outline-none focus:bg-white focus:border-red-600 focus:ring-1 focus:ring-red-600 transition font-mono font-semibold"
              />
            </div>

            <div className="flex flex-col gap-1.5 mb-4 border border-zinc-200 p-3 bg-zinc-50/50">
              <label className="text-[10px] font-bold text-hd-ink/70 font-mono uppercase tracking-wide flex items-center justify-between">
                <span>RAG Contract PDF Source</span>
                <span className="text-[8px] bg-red-105 text-red-700 px-1 font-mono font-bold uppercase rounded-none">
                  LangChain PyPDFLoader
                </span>
              </label>
              
              <div className="flex flex-col gap-2 mt-1">
                <select
                  value={selectedContractPath}
                  onChange={(e) => {
                    setSelectedContractPath(e.target.value);
                    // Update cargo parameters to match the contract preset
                    if (e.target.value.includes("cherries")) {
                      setCargoType("Fresh Produce (Cherries)");
                      setCommercialValue(120000);
                    } else if (e.target.value.includes("pharma")) {
                      setCargoType("Bio-Pharma (Vaccines)");
                      setCommercialValue(850000);
                    } else if (e.target.value.includes("wine")) {
                      setCargoType("High-End Wine");
                      setCommercialValue(45000);
                    }
                  }}
                  id="select-contract"
                  className="bg-white border border-hd-line text-xs rounded-none px-2 py-1.5 focus:outline-none focus:border-red-600 font-mono w-full cursor-pointer"
                >
                  {contracts.map((c) => (
                    <option key={c.path} value={c.path}>
                      📄 {c.name} ({c.filename})
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-[9px] text-zinc-500 uppercase font-mono font-bold">Or Upload Custom Contract:</span>
                  <label className="text-[9px] bg-white border border-hd-line hover:bg-hd-ink hover:text-white px-2 py-1 cursor-pointer font-mono font-bold uppercase transition">
                    {uploading ? "Uploading..." : "Browse PDF"}
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleContractUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-hd-ink/70 font-mono uppercase tracking-wide">
                Incident Context & Route Details
              </label>
              <textarea
                rows={3}
                value={incidentContext}
                onChange={(e) => setIncidentContext(e.target.value)}
                id="textarea-incident-context"
                className="bg-zinc-50 border border-hd-line rounded-none p-3 text-xs text-hd-ink focus:outline-none focus:bg-white focus:border-red-600 focus:ring-1 focus:ring-red-600 transition leading-snug resize-y font-mono"
              />
            </div>
          </section>

          {/* Interactive Telemetry Data Points Grid */}
          <section id="telemetry-editor" className="bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)] relative">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 border-b border-hd-line pb-2 gap-2">
              <div className="font-serif-georgia italic text-xs text-hd-ink/70 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-hd-ink" />
                <span>IoT Telemetry streams</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] text-hd-ink/60 font-mono font-bold uppercase">Quick Inject:</span>
                <button
                  type="button"
                  onClick={() => injectAnomaly("temp_spike")}
                  id="btn-inject-temp"
                  className="text-[9px] bg-rose-50 text-red-700 border border-red-300 px-2 py-0.5 hover:bg-rose-100 font-mono font-bold rounded-none uppercase transition cursor-pointer"
                  title="Appends a critical 28.5°C temperature spike to telemetry history to simulate failure."
                >
                  + Temp Spike
                </button>
                <button
                  type="button"
                  onClick={() => injectAnomaly("shock_impact")}
                  id="btn-inject-shock"
                  className="text-[9px] bg-amber-50 text-amber-700 border border-amber-300 px-2 py-0.5 hover:bg-amber-100 font-mono font-bold rounded-none uppercase transition cursor-pointer"
                  title="Appends a violent 5.2G mechanical drop shock event to history."
                >
                  + Limit Shock
                </button>
                <div className="h-4 w-px bg-hd-line/20 hidden sm:block mx-1"></div>
                <button
                  type="button"
                  onClick={() => setIsWebhookPolling(!isWebhookPolling)}
                  className={`text-[9px] border px-2 py-0.5 font-mono font-bold rounded-none uppercase transition cursor-pointer select-none ${
                    isWebhookPolling
                      ? "bg-emerald-600 text-white border-hd-line animate-pulse"
                      : "bg-white text-hd-ink border-hd-line hover:bg-zinc-50"
                  }`}
                  title="Enable real-time Webhook telemetry stream polling from external IoT devices."
                >
                  {isWebhookPolling ? "● Live Feed On" : "○ Live Feed Off"}
                </button>
                <div className="h-4 w-px bg-hd-line/20 hidden sm:block mx-1"></div>
                <label className="text-[9px] bg-white border border-hd-line hover:bg-hd-ink hover:text-white px-2 py-0.5 cursor-pointer font-mono font-bold uppercase transition select-none">
                  Import JSON
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleTelemetryJsonUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Real-time Threshold Alerting Node */}
            {telemetryAlerts.length > 0 ? (
              <div className="mb-4 bg-rose-50 border border-red-600 p-3.5 rounded-none shadow-[1px_1px_0px_rgba(20,20,20,1)]">
                <div className="flex items-center gap-2 text-red-700 font-mono text-[9px] font-black uppercase mb-1.5 tracking-wide">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                  </span>
                  <span>⚠️ Real-Time IoT Threshold Warning ({telemetryAlerts.length} Anomaly Logged)</span>
                </div>
                <div className="flex flex-col gap-1 text-[10px] font-mono text-red-800 leading-tight">
                  {telemetryAlerts.map((al, idx) => (
                    <div key={idx} className="flex items-start gap-1">
                      <span>•</span>
                      <span>{al.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4 bg-emerald-50 border border-emerald-600 p-2.5 rounded-none flex items-center gap-2 shadow-[1px_1px_0px_rgba(20,20,20,1)]">
                <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                <span className="text-[9px] font-mono font-black text-emerald-800 uppercase tracking-wide">
                  🟢 IoT Ingestion Normal (SLA Bounds: {tempMin}°C to {tempMax}°C, Shock &lt; {maxShock}G)
                </span>
              </div>
            )}

            {/* Existing points list */}
            <div className="max-h-60 overflow-y-auto mb-4 border border-hd-line rounded-none bg-white">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-zinc-100 text-hd-ink/60 uppercase text-[9px] tracking-wider font-bold border-b border-hd-line sticky top-0">
                    <th className="p-2 pl-3">Hour</th>
                    <th className="p-2">Temp (°C)</th>
                    <th className="p-2">Humid (%)</th>
                    <th className="p-2">Shock (G)</th>
                    <th className="p-2 w-10 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {telemetry.map((pt, index) => {
                    const isTempAnomaly = pt.temperature < tempMin || pt.temperature > tempMax;
                    const isShockAnomaly = pt.shock_g > maxShock;

                    return (
                      <tr key={index} className="hover:bg-zinc-50 transition-colors">
                        <td className="p-1 pl-3">
                          <input
                            type="text"
                            value={pt.timestamp}
                            onChange={(e) => handleTelemetryChange(index, "timestamp", e.target.value)}
                            id={`telemetry-time-${index}`}
                            className="bg-transparent border-0 w-24 text-hd-ink font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-hd-ink rounded-none px-1"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.1"
                            value={pt.temperature}
                            onChange={(e) => handleTelemetryChange(index, "temperature", e.target.value)}
                            id={`telemetry-temp-${index}`}
                            className={`bg-transparent border-b w-16 text-hd-ink font-semibold focus:bg-white focus:outline-none py-0.5 px-1 rounded-none ${
                              isTempAnomaly ? "border-red-600 text-red-700 font-bold bg-red-50" : "border-zinc-300 focus:border-hd-line"
                            }`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            value={pt.humidity}
                            onChange={(e) => handleTelemetryChange(index, "humidity", e.target.value)}
                            id={`telemetry-humidity-${index}`}
                            className="bg-transparent border-b border-zinc-300 focus:border-hd-line w-14 text-hd-ink font-semibold focus:bg-white focus:outline-none py-0.5 px-1 rounded-none"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.1"
                            value={pt.shock_g}
                            onChange={(e) => handleTelemetryChange(index, "shock_g", e.target.value)}
                            id={`telemetry-shock-${index}`}
                            className={`bg-transparent border-b w-14 text-hd-ink font-semibold focus:bg-white focus:outline-none py-0.5 px-1 rounded-none ${
                              isShockAnomaly ? "border-amber-600 text-amber-700 font-bold bg-amber-50" : "border-zinc-300 focus:border-hd-line"
                            }`}
                          />
                        </td>
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeTelemetryPoint(index)}
                            id={`btn-delete-telemetry-${index}`}
                            className="p-1 text-zinc-400 hover:text-red-600 hover:bg-zinc-100 rounded-none transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {telemetry.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-zinc-400 italic">
                        No telemetry logs in trace. Add raw data below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Quick manual entry form */}
            <div className="bg-zinc-100 p-3 rounded-none border border-zinc-200">
              <span className="text-[10px] uppercase font-mono font-bold text-hd-ink block mb-2 tracking-wider">
                Append Single Data Record
              </span>
              <div className="grid grid-cols-4 gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-zinc-500 font-bold uppercase font-mono">Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 05:00 PM"
                    value={newTimestamp}
                    onChange={(e) => setNewTimestamp(e.target.value)}
                    id="input-new-telemetry-time"
                    className="bg-white border border-hd-line text-hd-ink text-xs rounded-none px-2 py-1 focus:outline-none focus:border-red-600 font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-zinc-500 font-bold uppercase font-mono">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newTemp}
                    onChange={(e) => setNewTemp(Number(e.target.value))}
                    id="input-new-telemetry-temp"
                    className="bg-white border border-hd-line text-hd-ink text-xs rounded-none px-2 py-1 focus:outline-none focus:border-red-600 font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-zinc-500 font-bold uppercase font-mono">Humid %</label>
                  <input
                    type="number"
                    value={newHumidity}
                    onChange={(e) => setNewHumidity(Number(e.target.value))}
                    id="input-new-telemetry-humidity"
                    className="bg-white border border-hd-line text-hd-ink text-xs rounded-none px-2 py-1 focus:outline-none focus:border-red-600 font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-zinc-500 font-bold uppercase font-mono">Shock (G)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newShock}
                    onChange={(e) => setNewShock(Number(e.target.value))}
                    id="input-new-telemetry-shock"
                    className="bg-white border border-hd-line text-hd-ink text-xs rounded-none px-2 py-1 focus:outline-none focus:border-red-600 font-mono"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={addTelemetryPoint}
                id="btn-append-telemetry"
                className="w-full mt-3 flex items-center justify-center gap-1 bg-white hover:bg-hd-ink text-hd-ink hover:text-white font-mono text-xs font-bold py-1.5 border border-hd-line transition duration-150 rounded-none uppercase cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Record Entry
              </button>
            </div>
          </section>

          {/* Trigger compliance calculation */}
          <button
            onClick={handleAnalyzeShipment}
            disabled={isLoading || telemetry.length === 0}
            id="btn-trigger-compliance-analysis"
            className="w-full relative overflow-hidden bg-red-650 hover:bg-red-700 text-white font-mono font-bold uppercase py-4 rounded-none shadow-[3px_3px_0px_rgba(20,20,20,1)] hover:translate-x-[1px] hover:translate-y-[1px] duration-150 flex items-center justify-center gap-2 text-sm border-2 border-hd-ink disabled:opacity-55 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:shadow-none disabled:bg-zinc-400 cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                <span className="animate-pulse">Processing Compliance Audit...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white" />
                <span>Compile Compliance & Liability Assessment</span>
              </>
            )}
          </button>
        </div>

        {/* Right Side: Visual Data Analysis Panel */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          {/* Telemetry Visual Charts Section */}
          <section id="visual-charts-card" className="bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)] relative">
            <div className="flex items-center justify-between mb-4 border-b border-hd-line pb-2">
              <div className="font-serif-georgia italic text-xs text-hd-ink/70 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-hd-ink" />
                <span>Telemetry Trend Visualizer</span>
              </div>
              <span className="text-[10px] text-hd-ink font-mono uppercase bg-zinc-100 border border-zinc-300 px-2.5 py-0.5 rounded-none font-bold">
                Real-Time stream
              </span>
            </div>

            {activeAlerts.length > 0 && (
              <div className="mb-4 flex flex-col gap-2.5 animate-pulse">
                {activeAlerts.map((alert, idx) => (
                  <div key={idx} className="bg-red-50 border-l-4 border-red-650 p-3 rounded-none text-red-750 flex items-start gap-2.5 shadow-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-750 mt-0.5" />
                    <div>
                      <strong className="text-[10px] font-mono uppercase font-bold block">Active Sensor Breach Alarm</strong>
                      <p className="text-[10px] font-medium leading-tight mt-0.5 uppercase">{alert}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dual Axis Composed Chart */}
            <div className="h-68 w-full mt-2 select-none">
              {telemetry.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={telemetry}
                    margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1d1d1d" strokeOpacity={0.12} />
                    <XAxis
                      dataKey="timestamp"
                      stroke="#141414"
                      fontSize={10}
                      tickLine={true}
                      style={{ fontFamily: "Courier New, monospace", fontWeight: "bold" }}
                    />
                    {/* Primary Y-axis: Temp */}
                    <YAxis
                      yAxisId="left"
                      stroke="#D32F2F"
                      fontSize={10}
                      tickLine={true}
                      domain={["auto", "auto"]}
                      label={{ value: "Temp (°C)", angle: -90, position: "insideLeft", fill: "#D32F2F", style: { fontSize: 9, fontFamily: "monospace", fontWeight: "bold" } }}
                    />
                    {/* Secondary Y-axis: Humidity */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#0284c7"
                      fontSize={10}
                      tickLine={true}
                      domain={[0, 100]}
                      label={{ value: "Humidity (%) / Shock (G)", angle: 90, position: "insideRight", fill: "#0284c7", style: { fontSize: 9, fontFamily: "monospace", fontWeight: "bold" } }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderColor: "#141414",
                        borderWidth: "1px",
                        borderRadius: "0px",
                        fontSize: "11px",
                        color: "#141414",
                        fontFamily: "Courier New, monospace"
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "10px", marginTop: "10px", fontFamily: "monospace" }} />
                    
                    {/* Temperature Line */}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="temperature"
                      name="Temperature (°C)"
                      stroke="#D32F2F"
                      strokeWidth={2.5}
                      dot={{ r: 3, stroke: "#141414", strokeWidth: 1 }}
                      activeDot={{ r: 5 }}
                    />
                    
                    {/* Humidity Line */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="humidity"
                      name="Humidity (%)"
                      stroke="#0284c7"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />

                    {/* Shock Bar */}
                    <Bar
                      yAxisId="right"
                      dataKey="shock_g"
                      name="Shock Forces (G)"
                      fill="#F57C00"
                      barSize={12}
                    />

                    {/* Safe Shock line context */}
                    <ReferenceLine yAxisId="right" y={2.0} stroke="#F57C00" strokeDasharray="3 3" label={{ value: "Shock limit (2G)", fill: "#F57C00", fontSize: 8, position: "top" }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div id="no-telemetry-visual-state" className="h-full flex items-center justify-center text-zinc-400 italic text-xs">
                  Awaiting sensor feed points to generate mapping trends...
                </div>
              )}
            </div>
            
            {/* Visual Guidance Legends */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4 pt-3 border-t border-hd-line text-[9px] font-mono text-hd-ink font-bold uppercase">
              <div className="flex items-center gap-1.5 justify-center md:justify-start">
                <span className="w-2.5 h-2.5 bg-red-600 inline-block border border-black rounded-none"></span>
                <span>Opt Bio-temp: 0-2℃ / 2-8℃</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center">
                <span className="w-2.5 h-2.5 bg-sky-600 inline-block border border-black rounded-none"></span>
                <span>Carrier power indicator</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center md:justify-end">
                <span className="w-2.5 h-2.5 bg-amber-650 inline-block border border-black rounded-none"></span>
                <span>Critical handling limit: 2G</span>
              </div>
            </div>

            {/* IoT Live Streaming Control Panel */}
            <div className="mt-4 pt-4 border-t border-hd-line grid grid-cols-1 md:grid-cols-2 gap-4 font-sans text-xs">
              
              {/* Left Side: Live Stream controls */}
              <div className="flex flex-col gap-2 bg-zinc-50 border border-zinc-200 p-3 rounded-none">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase font-bold text-zinc-500">IoT Telemetry Feed Control</span>
                  <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase">
                    {isStreaming ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-none bg-red-650 animate-ping"></span>
                        <span className="text-red-750">Streaming Feed Active</span>
                      </>
                    ) : (
                      <span className="text-zinc-400">Feed Offline</span>
                    )}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    onClick={() => {
                      if (!isStreaming) {
                        setTelemetry([]);
                        setStreamIndex(0);
                        setIsStreaming(true);
                      }
                    }}
                    disabled={isStreaming}
                    className={`flex-1 font-mono text-[10px] font-bold py-1.5 px-3 border border-hd-line uppercase tracking-wide transition cursor-pointer ${
                      isStreaming 
                        ? "bg-zinc-150 text-zinc-400 border-zinc-350 cursor-not-allowed" 
                        : "bg-white text-hd-ink hover:bg-hd-ink hover:text-white"
                    }`}
                  >
                    Start Stream
                  </button>
                  <button
                    onClick={() => setIsStreaming(false)}
                    disabled={!isStreaming}
                    className={`flex-1 font-mono text-[10px] font-bold py-1.5 px-3 border border-hd-line uppercase tracking-wide transition cursor-pointer ${
                      !isStreaming 
                        ? "bg-zinc-150 text-zinc-400 border-zinc-350 cursor-not-allowed" 
                        : "bg-white text-hd-ink hover:bg-hd-ink hover:text-white"
                    }`}
                  >
                    Pause
                  </button>
                  <button
                    onClick={() => {
                      setIsStreaming(false);
                      setTelemetry([]);
                      setStreamIndex(0);
                      setRemainingShelfLifePct(100);
                      setActiveAlerts([]);
                      setIsWebhookPolling(false);
                    }}
                    className="font-mono text-[10px] font-bold py-1.5 px-3 border border-hd-line bg-white text-hd-ink hover:bg-zinc-100 uppercase tracking-wide transition cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <p className="text-[9px] text-zinc-500 font-mono uppercase mt-1">
                  Interval: 2s/point • Target Shipment: {shipmentId || "N/A"}
                </p>
              </div>

              {/* Right Side: Live Spoilage Indicator */}
              <div className="flex flex-col justify-between bg-zinc-50 border border-zinc-200 p-3 rounded-none">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[9px] uppercase font-bold text-zinc-500">Bio-degradation Progress (Q10)</span>
                    <strong className={`font-mono text-xs font-bold ${
                      remainingShelfLifePct < 20 ? "text-red-700" : remainingShelfLifePct < 50 ? "text-amber-700" : "text-emerald-700"
                    }`}>
                      {remainingShelfLifePct}% remaining
                    </strong>
                  </div>
                  
                  <div className="w-full bg-zinc-200 h-2 border border-hd-line overflow-hidden rounded-none">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        remainingShelfLifePct < 20 ? "bg-red-650" : remainingShelfLifePct < 50 ? "bg-amber-600" : "bg-emerald-650"
                      }`}
                      style={{ width: `${remainingShelfLifePct}%` }}
                    />
                  </div>
                </div>
                
                <span className="text-[9px] text-zinc-500 leading-normal font-mono uppercase mt-2 block">
                  Reference limits: {cargoType.toLowerCase().includes("cherr") ? "3-day life @ 1℃ ref" : cargoType.toLowerCase().includes("vacc") ? "2-day life @ 4℃ ref" : "Dynamic Q10 decay"}
                </span>
              </div>
              
            </div>
          </section>

          {/* ANALYSIS REPORTS OR EMPTY STATES */}
          {isLoading && (
            <div id="loading-report-state" className="bg-white border border-hd-line p-12 rounded-none shadow-[3px_3px_0px_rgba(20,20,20,1)] flex flex-col items-center justify-center text-center gap-4 font-sans">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-zinc-200 border-t-red-600 rounded-none animate-spin"></div>
                <Sparkles className="w-6 h-6 text-red-600 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="mt-2">
                <h3 className="text-hd-ink font-bold text-sm tracking-tight uppercase">ChainGuard AI Intelligence Unit active...</h3>
                <p className="text-xs text-red-700 font-mono mt-2 font-bold select-none uppercase">{loadingStep}</p>
                <div className="mt-4 flex flex-col gap-1 items-center max-w-sm mx-auto p-3 bg-zinc-50 border border-zinc-200 rounded-none">
                  <span className="text-[9px] uppercase font-mono font-bold text-hd-ink block">Engine Log stream</span>
                  <div className="text-[10px] text-zinc-650 font-mono text-left list-none divide-y divide-zinc-200/60 w-full">
                    <div className="py-1">✔ Loading shipment parameters: {cargoType} ($${commercialValue})</div>
                    <div className="py-1">⚡ Sending telemetry logs: {telemetry.length} data rows...</div>
                    <div className="py-1 animate-pulse text-red-700">⚙ Querying biological decay models on Gemini API...</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {errorLogs && (
            <div id="error-logs-card" className="bg-rose-50 border border-red-850 p-6 rounded-none shadow-sm flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-100 text-red-800 rounded-none border border-red-300">
                  <AlertTriangle className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-red-800 font-bold text-sm uppercase">Compliance Engine Connection Failed</h3>
                  <p className="text-xs text-zinc-700 mt-1 leading-relaxed">
                    The intelligence server encountered a failure responding to the parameters. Below are the internal logs:
                  </p>
                </div>
              </div>

              <div className="bg-zinc-950 p-4 rounded-none border border-hd-line text-xs font-mono text-red-400 overflow-x-auto whitespace-pre-wrap max-h-48 leading-relaxed">
                {errorLogs}
              </div>

              <div className="flex items-start gap-2 bg-zinc-100 p-3 rounded-none text-xs leading-relaxed text-hd-ink border border-zinc-300">
                <span className="font-bold text-red-700">Diagnostic tip:</span>
                <span>
                  Make sure you have configured a valid <strong className="font-bold">GEMINI_API_KEY</strong> inside the AI Studio Secrets panel. This application utilizes a server-side Gemini 3.5 Flash model for strict, precise legal liability claims generation.
                </span>
              </div>
            </div>
          )}

          {!isLoading && !errorLogs && (
            <div id="report-view-container" className="bg-white border border-hd-line rounded-none shadow-[3px_3px_0px_rgba(20,20,20,1)] overflow-hidden animate-fade-in relative block">
              
              {/* Report Header */}
              {analysisReport && activeTab !== "tms" && (
                <div className="bg-zinc-100 border-b border-hd-line p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-white border border-hd-line text-hd-ink rounded-none shadow-sm animate-pulse">
                      <FileCode className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-hd-ink font-bold text-sm tracking-tight uppercase">
                        Compliance Audit Claim Report
                      </h3>
                      <p className="text-[10px] text-zinc-500 mt-1 font-mono uppercase font-bold">
                        Case File: {shipmentId} • Generated {new Date().toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyToClipboard}
                      id="btn-copy-json"
                      className="flex items-center gap-1 text-[10px] uppercase font-bold text-hd-ink hover:text-white bg-white border border-hd-line px-2.5 py-1.5 rounded-none transition font-mono cursor-pointer hover:bg-hd-ink"
                      title="Copy structured JSON to clipboard"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? "Copied" : "Copy JSON"}
                    </button>
                    <button
                      onClick={handlePrint}
                      id="btn-print-report"
                      className="flex items-center gap-1 text-[10px] uppercase font-bold text-red-750 hover:text-white bg-white border border-red-650 px-2.5 py-1.5 rounded-none transition font-mono cursor-pointer hover:bg-red-650"
                      title="Open print layout of compliance report"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print PDF
                    </button>
                    <button
                      onClick={downloadClaimPDF}
                      id="btn-download-pdf"
                      disabled={!isApproved || downloadingPdf}
                      className={`flex items-center gap-1 text-[10px] uppercase font-bold px-2.5 py-1.5 rounded-none transition font-mono ${
                        isApproved 
                          ? "text-emerald-705 hover:text-white bg-white border border-emerald-650 hover:bg-emerald-650 cursor-pointer"
                          : "text-zinc-400 bg-zinc-50 border border-zinc-250 cursor-not-allowed"
                      }`}
                      title={isApproved ? "Download official signed claim PDF" : "Please sign and approve the claim below first"}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {downloadingPdf ? "Downloading..." : "Official PDF"}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab Navigation Menu */}
              <div className="flex border-b border-hd-line bg-zinc-50 font-mono text-[10px] font-bold uppercase overflow-x-auto">
                <button
                  onClick={() => setActiveTab("overview")}
                  id="tab-btn-overview"
                  className={`px-4 py-3 border-r border-hd-line flex items-center gap-2 transition duration-150 cursor-pointer ${
                    activeTab === "overview"
                      ? "bg-hd-ink text-white"
                      : "bg-white text-hd-ink hover:bg-zinc-100"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>1. Integrity Overview</span>
                </button>
                <button
                  onClick={() => setActiveTab("rag")}
                  id="tab-btn-rag"
                  disabled={!analysisReport}
                  className={`px-4 py-3 border-r border-hd-line flex items-center gap-2 transition duration-150 ${
                    !analysisReport 
                      ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" 
                      : activeTab === "rag"
                      ? "bg-hd-ink text-white cursor-pointer"
                      : "bg-white text-hd-ink hover:bg-zinc-100 cursor-pointer"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>2. RAG Contract Rules</span>
                </button>
                <button
                  onClick={() => setActiveTab("crew")}
                  id="tab-btn-crew"
                  disabled={!analysisReport}
                  className={`px-4 py-3 border-r border-hd-line flex items-center gap-2 transition duration-150 ${
                    !analysisReport 
                      ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" 
                      : activeTab === "crew"
                      ? "bg-hd-ink text-white cursor-pointer"
                      : "bg-white text-hd-ink hover:bg-zinc-100 cursor-pointer"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>3. CrewAI Agent Timeline</span>
                </button>
                <button
                  onClick={() => setActiveTab("tms")}
                  id="tab-btn-tms"
                  className={`px-4 py-3 border-r border-hd-line flex items-center gap-2 transition duration-150 cursor-pointer ${
                    activeTab === "tms"
                      ? "bg-hd-ink text-white"
                      : "bg-white text-hd-ink hover:bg-zinc-100"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>4. TMS Integrations</span>
                </button>
                <button
                  onClick={() => setActiveTab("analytics")}
                  id="tab-btn-analytics"
                  className={`px-4 py-3 border-r border-hd-line flex items-center gap-2 transition duration-150 cursor-pointer ${
                    activeTab === "analytics"
                      ? "bg-hd-ink text-white"
                      : "bg-white text-hd-ink hover:bg-zinc-100"
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>5. Underwriting Analytics</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("verification");
                    fetchAuditChain();
                  }}
                  id="tab-btn-verification"
                  className={`px-4 py-3 border-r border-hd-line flex items-center gap-2 transition duration-150 cursor-pointer ${
                    activeTab === "verification"
                      ? "bg-hd-ink text-white"
                      : "bg-white text-hd-ink hover:bg-zinc-100"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>6. Compliance Audit Chain</span>
                </button>
              </div>

              {/* Grid Metrics and Assessment */}
              <div className="p-5 flex flex-col gap-5">
                
                {activeTab === "overview" && (
                  analysisReport ? (
                    <div className="flex flex-col gap-5 animate-fade-in">
                    {/* Visual Status Indicator Panels */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Status Indicator Meter */}
                      <div className="bg-white border border-hd-line p-4.5 rounded-none flex items-center gap-4 relative shadow-[1px_1px_0px_rgba(20,20,20,1)]">
                        <div className="absolute top-2 right-2 flex items-center justify-center">
                          {analysisReport.damage_assessment.status === "TOTAL_LOSS" && (
                            <span className="w-2.5 h-2.5 rounded-none bg-red-600 animate-ping"></span>
                          )}
                          {analysisReport.damage_assessment.status === "PARTIAL_DAMAGE" && (
                            <span className="w-2.5 h-2.5 rounded-none bg-amber-600 animate-ping"></span>
                          )}
                        </div>

                        <div className={`p-4 rounded-none border-2 ${
                          analysisReport.damage_assessment.status === "TOTAL_LOSS"
                            ? "bg-rose-50 text-red-700 border-red-600"
                            : analysisReport.damage_assessment.status === "PARTIAL_DAMAGE"
                            ? "bg-amber-50 text-amber-700 border-amber-600"
                            : "bg-emerald-50 text-emerald-700 border-emerald-600"
                        }`}>
                          {analysisReport.damage_assessment.status === "TOTAL_LOSS" ? (
                            <ShieldAlert className="w-7 h-7" />
                          ) : analysisReport.damage_assessment.status === "PARTIAL_DAMAGE" ? (
                            <AlertTriangle className="w-7 h-7" />
                          ) : (
                            <ShieldCheck className="w-7 h-7" />
                          )}
                        </div>

                        <div>
                          <span className="text-[9px] uppercase font-mono text-zinc-500 block tracking-wider leading-none mb-1 font-bold">
                            Cargo Integrity Status
                          </span>
                          <strong className={`text-base font-bold tracking-tight uppercase block ${
                            analysisReport.damage_assessment.status === "TOTAL_LOSS"
                              ? "text-red-700"
                              : analysisReport.damage_assessment.status === "PARTIAL_DAMAGE"
                              ? "text-amber-700"
                              : "text-emerald-700"
                          }`}>
                            {analysisReport.damage_assessment.status.replace("_", " ")}
                          </strong>
                          <span className="text-[10px] text-zinc-600 font-sans mt-0.5 block leading-tight font-bold uppercase text-[9px] tracking-wide">
                            {analysisReport.damage_assessment.status === "TOTAL_LOSS"
                              ? "Spoiled / microbially contaminated."
                              : analysisReport.damage_assessment.status === "PARTIAL_DAMAGE"
                              ? "Thermal margin broken; decay applied."
                              : "Preserved within legal bio-safety limits."}
                          </span>
                        </div>
                      </div>

                      {/* Financial Loss Assessment */}
                      <div className="bg-white border border-hd-line p-4.5 rounded-none flex items-center gap-4 shadow-[1px_1px_0px_rgba(20,20,20,1)]">
                        <div className="p-4 rounded-none bg-zinc-100 text-hd-ink border-2 border-hd-line">
                          <Coins className="w-7 h-7" />
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-mono text-zinc-500 block tracking-wider leading-none mb-1 font-bold">
                            Estimated Impairment Valuation
                          </span>
                          <strong className="text-xl font-black tracking-tight text-hd-ink block font-mono">
                            ${analysisReport.damage_assessment.estimated_loss_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-xs font-normal text-zinc-500 ml-1">USD</span>
                          </strong>
                          {/* loss ratio bar */}
                          <div className="w-full bg-zinc-100 rounded-none h-2.5 mt-2 overflow-hidden border border-hd-line p-px">
                            <div
                              className={`h-full rounded-none ${
                                analysisReport.damage_assessment.status === "TOTAL_LOSS" ? "bg-red-600" : "bg-amber-600"
                              }`}
                              style={{ width: `${Math.min(100, (analysisReport.damage_assessment.estimated_loss_usd / (commercialValue || 1)) * 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-[9px] text-zinc-500 font-mono mt-1 block font-bold uppercase">
                            {((analysisReport.damage_assessment.estimated_loss_usd / (commercialValue || 1)) * 100).toFixed(1)}% / ${commercialValue.toLocaleString()} declared SLA
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Human-in-the-Loop Verification Dashboard */}
                    <div className="bg-zinc-50 border border-hd-line p-4 rounded-none mb-1 flex flex-col md:flex-row justify-between items-center gap-4 shadow-[1px_1px_0px_rgba(20,20,20,1)]">
                      <div className="flex-1 text-left">
                        <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wide block mb-0.5">
                          Harness Control: Human-in-the-Loop Gateway
                        </span>
                        <p className="text-xs text-hd-ink leading-tight font-sans font-semibold">
                          {isApproved 
                            ? "🟢 Verified and locked. Reference case saved to verified_cases/." 
                            : "✍️ Review and refine findings. Adjust liability overrides below if AI got it wrong."}
                        </p>
                        
                        {!isApproved && (
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-mono uppercase font-bold text-hd-ink">
                            <div className="flex items-center gap-1.5">
                              <span>Liable Party Override:</span>
                              <select
                                value={overrideLiableParty}
                                onChange={(e) => setOverrideLiableParty(e.target.value)}
                                className="bg-white border border-hd-line px-1.5 py-0.5 text-[10px]"
                              >
                                <option value="Carrier">Carrier</option>
                                <option value="Shipper">Shipper</option>
                                <option value="Port Authority">Port Authority</option>
                                <option value="Force Majeure">Force Majeure</option>
                                <option value="Shared">Shared</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span>Fault % Override:</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={overrideFaultPct}
                                onChange={(e) => setOverrideFaultPct(Number(e.target.value))}
                                className="bg-white border border-hd-line px-1.5 py-0.5 w-14 text-center text-[10px]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {isApproved ? (
                          <div className="border-2 border-emerald-650 bg-emerald-50 text-emerald-700 px-3 py-1 font-mono text-xs font-black uppercase tracking-wider transform -rotate-1 select-none flex items-center gap-1.5 shadow-[1px_1px_0px_rgba(20,20,20,1)]">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Claims Approved & Logged</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setIsApproved(true);
                              if (analysisReport) {
                                const updatedReport = {
                                  ...analysisReport,
                                  incident_summary: editedIncidentSummary,
                                  damage_assessment: {
                                    ...analysisReport.damage_assessment,
                                    scientific_reasoning: editedScientificReasoning
                                  },
                                  liability_assignment: {
                                    ...analysisReport.liability_assignment,
                                    liable_party: overrideLiableParty,
                                    fault_percentage: overrideFaultPct
                                  }
                                };
                                setAnalysisReport(updatedReport);
                                
                                // Post feedback to server to save verified study case
                                fetch("/api/feedback", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    shipment_id: shipmentId || "unknown_shipment",
                                    cargo_type: cargoType,
                                    incident_context: incidentContext,
                                    original_report: analysisReport,
                                    corrected_liability: {
                                      liable_party: overrideLiableParty,
                                      fault_percentage: overrideFaultPct,
                                      notes: editedIncidentSummary,
                                      timestamp: new Date().toISOString()
                                    }
                                  })
                                }).then(res => res.json())
                                  .then(data => console.log("[Feedback Loop] Stored verified study:", data))
                                  .catch(err => console.error("[Feedback Loop] Error:", err));
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-750 text-white border border-hd-line px-3 py-1.5 text-xs font-mono font-bold uppercase transition cursor-pointer shadow-[1px_1px_0px_rgba(20,20,20,1)] hover:shadow-none active:translate-y-px active:translate-x-px"
                          >
                            Sign & Approve Claim
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Narrative Summary panel */}
                    <div className="bg-zinc-50 border border-hd-line p-4 rounded-none relative text-left">
                      <div className="font-serif-georgia italic text-xs text-hd-ink/75 uppercase tracking-wider pb-1.5 mb-2 border-b border-hd-line/40 font-bold flex items-center gap-2">
                        <span>Incident Synthesis & Settlement Narrative</span>
                      </div>
                      {isApproved ? (
                        <p id="report-summary-text" className="text-xs text-hd-ink leading-relaxed font-sans font-medium">
                          {editedIncidentSummary}
                        </p>
                      ) : (
                        <textarea
                          rows={4}
                          value={editedIncidentSummary}
                          onChange={(e) => setEditedIncidentSummary(e.target.value)}
                          className="w-full bg-white border border-hd-line rounded-none p-2.5 text-xs font-sans text-hd-ink focus:outline-none focus:border-red-600 transition resize-y font-semibold leading-relaxed"
                          placeholder="Edit the claim narrative summary..."
                        />
                      )}
                    </div>

                    {/* Biophysical asset degradation scientific explanation */}
                    <div id="scientific-reasoning-card" className="bg-zinc-50 border border-hd-line p-4 rounded-none text-left">
                      <div className="font-serif-georgia italic text-xs text-hd-ink/75 uppercase tracking-wider pb-1.5 mb-2 border-b border-hd-line/40 font-bold flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-rose-600" />
                        <span>Biological Spoilage Thermodynamics Analysis</span>
                      </div>
                      {isApproved ? (
                        <p className="text-xs text-zinc-805 leading-relaxed font-sans whitespace-pre-line font-medium font-bold uppercase text-[9px] tracking-wide">
                          {editedScientificReasoning}
                        </p>
                      ) : (
                        <textarea
                          rows={4}
                          value={editedScientificReasoning}
                          onChange={(e) => setEditedScientificReasoning(e.target.value)}
                          className="w-full bg-white border border-hd-line rounded-none p-2.5 text-[10px] font-mono text-hd-ink focus:outline-none focus:border-red-600 transition resize-y font-bold uppercase leading-normal"
                          placeholder="Edit the biophysical spoilage explanation..."
                        />
                      )}
                    </div>

                    {/* Legal and Liability assignment detailed panel */}
                    <div id="liability-assignment" className="bg-white border border-hd-line rounded-none overflow-hidden">
                      
                      {/* liability top banner */}
                      <div className="bg-zinc-100 p-3.5 border-b border-hd-line flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-hd-ink" />
                          <span className="font-serif-georgia italic text-xs text-hd-ink font-bold">
                            Liability fault assignment & arbitration proportion
                          </span>
                        </div>
                        {/* Visual liability pill */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-zinc-500 font-mono uppercase font-bold">Assigned fault:</span>
                          <span className="text-[11px] font-mono font-bold bg-[#141414] text-white px-2 py-0.5 rounded-none uppercase">
                            {analysisReport.liability_assignment.liable_party} ({analysisReport.liability_assignment.fault_percentage}%)
                          </span>
                        </div>
                      </div>

                      {/* Liability context details */}
                      <div className="p-4 flex flex-col gap-3 font-sans">
                        
                        {/* Visual bar chart of fault assignment */}
                        <div className="flex flex-col gap-1 bg-zinc-50 p-3.5 rounded-none border border-zinc-200">
                          <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
                            <span className="text-hd-ink flex items-center gap-1.5">
                              🛡 {analysisReport.liability_assignment.liable_party} Arbitration fault fraction
                            </span>
                            <span className="font-mono text-red-650 font-bold">
                              {analysisReport.liability_assignment.fault_percentage}%
                            </span>
                          </div>
                          <div className="w-full bg-white rounded-none h-4 border border-hd-line p-0.5 overflow-hidden">
                            <div
                              className="h-full rounded-none bg-red-600 transition-all duration-500"
                              style={{ width: `${analysisReport.liability_assignment.fault_percentage}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-[9px] text-zinc-500 font-mono mt-1 font-bold uppercase">
                            <span>Safe (0%)</span>
                            <span>Co-proportional</span>
                            <span>100% Extreme negligence</span>
                          </div>
                        </div>

                        {/* Sensor evidence citations */}
                        <div className="bg-zinc-50 p-3 rounded-none border border-zinc-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-zinc-500 block mb-1.5">
                            Arbitration evidence & telemetry sensor trace logs
                          </span>
                          <p id="evidence-text" className="text-xs text-zinc-805 leading-relaxed font-sans leading-relaxed font-medium">
                            {analysisReport.liability_assignment.evidence_citation}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Sub-action items list */}
                    <div id="sub-action-items" className="bg-zinc-50 border border-hd-line p-4 rounded-none">
                      <div className="font-serif-georgia italic text-xs text-hd-ink/75 uppercase tracking-wider pb-1.5 mb-2.5 border-b border-hd-line/40 font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-750" />
                        <span>Arbitration protocols & claimant guide action list</span>
                      </div>
                      <ul className="flex flex-col gap-2.5">
                        {analysisReport.action_items.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-xs text-zinc-805 leading-relaxed font-medium">
                            <span className="text-red-700 font-mono select-none font-bold mt-0.5">{idx + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  ) : (
                    <div id="empty-claim-state" className="flex-1 bg-[#F5F4F0] border-2 border-hd-line border-dashed p-14 rounded-none flex flex-col items-center justify-center text-center gap-4 shadow-inner">
                      <div className="p-4 bg-white rounded-none border border-hd-line text-zinc-400">
                        <ShieldAlert className="w-10 h-10" />
                      </div>
                      <div>
                        <h3 className="text-hd-ink font-bold text-sm tracking-tight uppercase">Audit Claim Report Blocked</h3>
                        <p className="text-xs text-zinc-650 max-w-sm mx-auto mt-2 leading-snug">
                          Modify the telemetry values on the left panel or click "Compile Compliance & Liability Assessment" above to run biological decay calculations, liability proportional blame, and evidentiary legal text on model logs.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                        <span className="text-[10px] text-zinc-650 font-mono bg-white border border-hd-line px-2.5 py-1 rounded-none font-bold uppercase">
                          Arrhenius thermal biological decay
                        </span>
                        <span className="text-[10px] text-zinc-650 font-mono bg-white border border-hd-line px-2.5 py-1 rounded-none font-bold uppercase">
                          0-2°C boundaries model active
                        </span>
                      </div>
                    </div>
                  )
                )}

                {activeTab === "rag" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in font-sans text-left">
                    
                    {/* Left Column: Parsed Terms */}
                    <div className="lg:col-span-5 flex flex-col gap-4">
                      
                      {/* Deductible Card */}
                      <div 
                        onClick={() => setActiveHighlightCategory(activeHighlightCategory === "deductible" ? null : "deductible")}
                        className={`border p-4 rounded-none cursor-pointer transition shadow-[1px_1px_0px_rgba(20,20,20,1)] select-none ${
                          activeHighlightCategory === "deductible"
                            ? "bg-emerald-50 border-emerald-600 ring-1 ring-emerald-600"
                            : "bg-zinc-50 border-hd-line hover:bg-zinc-100"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-hd-line/20">
                          <span className="font-mono text-[10px] font-bold uppercase text-hd-ink flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5 text-emerald-650" />
                            <span>Deductible (免赔额)</span>
                          </span>
                          <span className={`text-[8px] font-mono font-bold border px-1.5 py-0.5 uppercase ${
                            activeHighlightCategory === "deductible" ? "bg-emerald-600 text-white border-emerald-700" : "bg-emerald-50 text-emerald-750 border-emerald-300"
                          }`}>
                            {activeHighlightCategory === "deductible" ? "Showing Source" : "Click to view"}
                          </span>
                        </div>
                        <p className="text-xs text-hd-ink font-mono font-bold whitespace-pre-wrap leading-relaxed">
                          {analysisReport.extracted_terms?.deductible || "No deductible term parsed."}
                        </p>
                      </div>

                      {/* Exclusions Card */}
                      <div 
                        onClick={() => setActiveHighlightCategory(activeHighlightCategory === "exclusions" ? null : "exclusions")}
                        className={`border p-4 rounded-none cursor-pointer transition shadow-[1px_1px_0px_rgba(20,20,20,1)] select-none ${
                          activeHighlightCategory === "exclusions"
                            ? "bg-rose-50 border-red-650 ring-1 ring-red-650"
                            : "bg-zinc-50 border-hd-line hover:bg-zinc-100"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-hd-line/20">
                          <span className="font-mono text-[10px] font-bold uppercase text-hd-ink flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5 text-red-650" />
                            <span>Exclusions & Disclaimers</span>
                          </span>
                          <span className={`text-[8px] font-mono font-bold border px-1.5 py-0.5 uppercase ${
                            activeHighlightCategory === "exclusions" ? "bg-rose-600 text-white border-rose-700" : "bg-rose-50 text-red-700 border-red-200"
                          }`}>
                            {activeHighlightCategory === "exclusions" ? "Showing Source" : "Click to view"}
                          </span>
                        </div>
                        <p className="text-xs text-hd-ink leading-relaxed font-semibold">
                          {analysisReport.extracted_terms?.exclusions || "No exclusions terms parsed."}
                        </p>
                      </div>

                      {/* Liability Limits Card */}
                      <div 
                        onClick={() => setActiveHighlightCategory(activeHighlightCategory === "liability" ? null : "liability")}
                        className={`border p-4 rounded-none cursor-pointer transition shadow-[1px_1px_0px_rgba(20,20,20,1)] select-none ${
                          activeHighlightCategory === "liability"
                            ? "bg-sky-50 border-sky-600 ring-1 ring-sky-600"
                            : "bg-zinc-50 border-hd-line hover:bg-zinc-100"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-hd-line/20">
                          <span className="font-mono text-[10px] font-bold uppercase text-hd-ink flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-sky-650" />
                            <span>Liability Limits (责任限制)</span>
                          </span>
                          <span className={`text-[8px] font-mono font-bold border px-1.5 py-0.5 uppercase ${
                            activeHighlightCategory === "liability" ? "bg-sky-600 text-white border-sky-700" : "bg-sky-50 text-sky-750 border-sky-200"
                          }`}>
                            {activeHighlightCategory === "liability" ? "Showing Source" : "Click to view"}
                          </span>
                        </div>
                        <p className="text-xs text-hd-ink leading-relaxed font-semibold">
                          {analysisReport.extracted_terms?.liability_limits || "No liability limits term parsed."}
                        </p>
                      </div>

                    </div>

                    {/* Right Column: PDF Source Document Viewer */}
                    <div className="lg:col-span-7 flex flex-col border border-hd-line bg-zinc-50 shadow-[1px_1px_0px_rgba(20,20,20,1)]">
                      <div className="bg-zinc-100 border-b border-hd-line px-4 py-2.5 flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase text-hd-ink flex items-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-zinc-650" />
                          <span>PDF Original Document Viewer</span>
                        </span>
                        {activeHighlightCategory && (
                          <button
                            onClick={() => setActiveHighlightCategory(null)}
                            className="text-[9px] font-mono font-bold bg-white border border-hd-line px-2 py-0.5 uppercase hover:bg-zinc-200 cursor-pointer"
                          >
                            Clear Highlight
                          </button>
                        )}
                      </div>
                      <div className="p-4 overflow-y-auto max-h-[380px] min-h-[300px] bg-white border-b border-hd-line select-text text-left">
                        {renderHighlightedContractText()}
                      </div>
                      <div className="p-3 text-[9px] font-mono text-zinc-500 uppercase leading-snug">
                        💡 Click a parsed term card on the left to highlight its source paragraph and see original contract wording.
                      </div>
                    </div>

                  </div>
                )}

                {activeTab === "crew" && (
                  <div className="flex flex-col gap-6 animate-fade-in relative pl-5 border-l border-zinc-300 ml-3 mt-2 font-sans">
                    
                    {/* Timeline Node 1 */}
                    <div className="relative">
                      {/* Timeline marker */}
                      <span className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center bg-red-650 text-white font-mono text-[10px] font-bold border border-hd-line">
                        1
                      </span>
                      
                      <div className="bg-white border border-hd-line p-4 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hd-line pb-2 mb-3">
                          <div>
                            <h4 className="font-bold text-xs text-hd-ink uppercase tracking-tight flex items-center gap-1.5 font-mono">
                              <Activity className="w-3.5 h-3.5 text-red-600" />
                              <span>Cargo Damage Assessor (货损评估师)</span>
                            </h4>
                            <p className="text-[9px] text-zinc-500 font-mono uppercase mt-0.5">
                              Agent Role: cold-chain bio-physicist
                            </p>
                          </div>
                          <span className="text-[9px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 font-mono font-bold uppercase rounded-none self-start sm:self-center">
                            Step 1: Bio-degradation
                          </span>
                        </div>

                        <details className="mb-3 text-[10px] bg-zinc-50 border border-zinc-200 p-2 cursor-pointer select-none">
                          <summary className="font-bold uppercase tracking-wider text-zinc-650 font-mono">
                            Show Agent Backstory & Goal
                          </summary>
                          <div className="mt-1.5 text-zinc-700 normal-case leading-normal">
                            <p className="mb-1"><strong>Goal:</strong> Evaluate perishable cargo's physical and biological degradation and determine exact financial damage.</p>
                            <p><strong>Backstory:</strong> World-class cold-chain logistics bio-physicist. Specializes in calculating product shelf-life decay using Arrhenius equations and physical/chemical thresholds. Computes damage and raw financial loss in USD.</p>
                          </div>
                        </details>

                        <div className="bg-zinc-950 p-4 border border-hd-line text-xs font-mono text-zinc-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          {analysisReport.assessor_output || "No agent output recorded."}
                        </div>
                      </div>
                    </div>

                    {/* Timeline Node 2 */}
                    <div className="relative">
                      {/* Timeline marker */}
                      <span className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center bg-hd-ink text-white font-mono text-[10px] font-bold border border-hd-line">
                        2
                      </span>
                      
                      <div className="bg-white border border-hd-line p-4 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hd-line pb-2 mb-3">
                          <div>
                            <h4 className="font-bold text-xs text-hd-ink uppercase tracking-tight flex items-center gap-1.5 font-mono">
                              <Scale className="w-3.5 h-3.5 text-hd-ink" />
                              <span>Liability Legal Officer (定责法务官)</span>
                            </h4>
                            <p className="text-[9px] text-zinc-500 font-mono uppercase mt-0.5">
                              Agent Role: supply chain counsel
                            </p>
                          </div>
                          <span className="text-[9px] bg-zinc-100 text-hd-ink border border-zinc-300 px-2 py-0.5 font-mono font-bold uppercase rounded-none self-start sm:self-center">
                            Step 2: Arbitration
                          </span>
                        </div>

                        <details className="mb-3 text-[10px] bg-zinc-50 border border-zinc-200 p-2 cursor-pointer select-none">
                          <summary className="font-bold uppercase tracking-wider text-zinc-650 font-mono">
                            Show Agent Backstory & Goal
                          </summary>
                          <div className="mt-1.5 text-zinc-700 normal-case leading-normal">
                            <p className="mb-1"><strong>Goal:</strong> Analyze liability, parse contract exclusions/deductibles, and assign fault percentage.</p>
                            <p><strong>Backstory:</strong> Expert in international maritime, carriage of goods, and supply chain law. Specializes in analyzing SLAs, carrier exemptions, shipper obligations, disclaimers, and applying deductibles and liability limits to compute net insurance claims.</p>
                          </div>
                        </details>

                        <div className="bg-zinc-950 p-4 border border-hd-line text-xs font-mono text-zinc-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          {analysisReport.legal_output || "No agent output recorded."}
                        </div>
                      </div>
                    </div>

                    {/* Timeline Node 3 */}
                    <div className="relative">
                      {/* Timeline marker */}
                      <span className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center bg-amber-600 text-white font-mono text-[10px] font-bold border border-hd-line">
                        3
                      </span>
                      
                      <div className="bg-white border border-hd-line p-4 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hd-line pb-2 mb-3">
                          <div>
                            <h4 className="font-bold text-xs text-hd-ink uppercase tracking-tight flex items-center gap-1.5 font-mono">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Emergency Dispatcher (应急调度员)</span>
                            </h4>
                            <p className="text-[9px] text-zinc-500 font-mono uppercase mt-0.5">
                              Agent Role: crisis controller
                            </p>
                          </div>
                          <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 font-mono font-bold uppercase rounded-none self-start sm:self-center">
                            Step 3: Rescue Dispatch
                          </span>
                        </div>

                        <details className="mb-3 text-[10px] bg-zinc-50 border border-zinc-200 p-2 cursor-pointer select-none">
                          <summary className="font-bold uppercase tracking-wider text-zinc-650 font-mono">
                            Show Agent Backstory & Goal
                          </summary>
                          <div className="mt-1.5 text-zinc-700 normal-case leading-normal">
                            <p className="mb-1"><strong>Goal:</strong> Generate emergency operational procedures, salvage checklists, and claimant legal wording.</p>
                            <p><strong>Backstory:</strong> Veteran logistics emergency responder. Coordinates salvage, rerouting, active cooling, product disposal, and compiles final claim filing documents.</p>
                          </div>
                        </details>

                        <div className="bg-zinc-950 p-4 border border-hd-line text-xs font-mono text-zinc-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          {analysisReport.dispatcher_output || "No agent output recorded."}
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {activeTab === "tms" && (
                  <div className="flex flex-col gap-6 animate-fade-in font-sans">
                    {/* Active Connections Card */}
                    <div className="bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)]">
                      <h4 className="font-bold text-xs text-hd-ink uppercase tracking-wider font-mono border-b border-hd-line pb-2 mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-650" />
                        <span>Active Enterprise Connections</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { name: "CargoWise", status: "Connected", apiKey: "cw_live_891238_prod", desc: "Marine shipment bookings sync" },
                          { name: "Flexport", status: "Connected", apiKey: "flxp_key_674512_live", desc: "Air and ocean freight webhook" },
                          { name: "SAP LBN", status: "Active", apiKey: "sap_lbn_9028_active", desc: "Enterprise resource log stream" },
                          { name: "Generic Webhook", status: "Active", apiKey: "cg_wh_token_8892_sec", desc: "Universal JSON REST payload" }
                        ].map((conn, idx) => (
                          <div key={idx} className="bg-zinc-50 border border-zinc-200 p-3.5 rounded-none flex flex-col justify-between hover:border-hd-line transition duration-150">
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <strong className="text-xs font-bold text-hd-ink uppercase font-mono">{conn.name}</strong>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 font-mono uppercase ${
                                  conn.status === "Connected" ? "bg-emerald-50 text-emerald-700 border border-emerald-250" : "bg-blue-50 text-blue-700 border border-blue-250"
                                }`}>
                                  {conn.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-650 leading-tight mb-3">{conn.desc}</p>
                            </div>
                            <div className="bg-zinc-100 border border-zinc-200 p-1.5 font-mono text-[8px] text-zinc-500 overflow-x-auto select-all">
                              Key: {conn.apiKey}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Event Log Column */}
                      <div className="lg:col-span-2 bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)] flex flex-col">
                        <h4 className="font-bold text-xs text-hd-ink uppercase tracking-wider font-mono border-b border-hd-line pb-2 mb-4 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-hd-ink" />
                          <span>TMS Webhook Incoming Event Log</span>
                        </h4>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-[11px] font-sans">
                            <thead>
                              <tr className="border-b border-hd-line bg-zinc-50 text-zinc-600 font-mono text-[9px] uppercase font-bold">
                                <th className="p-2.5">Origin</th>
                                <th className="p-2.5">Shipment ID</th>
                                <th className="p-2.5">Cargo Type</th>
                                <th className="p-2.5">Received At</th>
                                <th className="p-2.5 text-center">Status</th>
                                <th className="p-2.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200">
                              {tmsEvents.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="p-8 text-center text-zinc-400 font-mono uppercase text-[10px]">
                                    No incoming webhook events detected yet. Use the Simulator to dispatch events.
                                  </td>
                                </tr>
                              ) : (
                                tmsEvents.map((evt) => (
                                  <tr key={evt.event_id} className="hover:bg-zinc-50/80 transition duration-100">
                                    <td className="p-2.5 font-mono font-bold text-hd-ink uppercase">{evt.tms_system}</td>
                                    <td className="p-2.5 font-mono font-bold text-indigo-700">{evt.shipment_id}</td>
                                    <td className="p-2.5 text-zinc-700 font-medium">{evt.cargo_type}</td>
                                    <td className="p-2.5 text-zinc-500 font-mono text-[10px]">
                                      {new Date(evt.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </td>
                                    <td className="p-2.5 text-center">
                                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-250 text-[8px] font-bold px-1.5 py-0.5 font-mono uppercase">
                                        {evt.status}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-right flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => loadTmsEventDetails(evt)}
                                        className="text-[9px] font-mono font-bold uppercase border border-hd-line bg-white text-hd-ink px-2 py-1 hover:bg-hd-ink hover:text-white transition cursor-pointer"
                                      >
                                        Inspect
                                      </button>
                                      <a
                                        href={`/api/tms/download-pdf/${encodeURIComponent(evt.shipment_id)}`}
                                        className="text-[9px] font-mono font-bold uppercase border border-emerald-600 bg-white text-emerald-705 px-2 py-1 hover:bg-emerald-650 hover:text-white transition"
                                      >
                                        PDF
                                      </a>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Event Simulator Column */}
                      <div className="bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)] flex flex-col">
                        <h4 className="font-bold text-xs text-hd-ink uppercase tracking-wider font-mono border-b border-hd-line pb-2 mb-4 flex items-center gap-2">
                          <Play className="w-3.5 h-3.5 text-red-650" />
                          <span>TMS Event Webhook Simulator</span>
                        </h4>

                        <div className="flex flex-col gap-3 text-xs mb-4">
                          <div>
                            <label className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
                              Simulated TMS Platform
                            </label>
                            <select
                              value={simulatorTms}
                              onChange={(e) => setSimulatorTms(e.target.value)}
                              className="w-full bg-white border border-hd-line p-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-hd-ink"
                            >
                              <option value="CargoWise">CargoWise (海运定责)</option>
                              <option value="Flexport">Flexport (跨国航运)</option>
                              <option value="SAP LBN">SAP Logistics Business Network</option>
                              <option value="Generic REST Webhook">Generic Webhook</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
                              Select Shipping Scenario
                            </label>
                            <select
                              value={simulatorScenario}
                              onChange={(e) => setSimulatorScenario(e.target.value)}
                              className="w-full bg-white border border-hd-line p-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-hd-ink"
                            >
                              <option value="cherries_customs_delay">Rainier Cherries (Customs Exemption)</option>
                              <option value="biopharma_reefer_failure">mRNA Vaccine (Carrier Failure)</option>
                              <option value="wine_handling_error">Burgundy Wine (Mechanical Drop Shock)</option>
                              <option value="perfect_salmon_transit">Atlantic Salmon (Compliant Cold Chain)</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex-1 flex flex-col gap-1.5 mb-4">
                          <label className="block text-[10px] font-mono uppercase font-bold text-zinc-500">
                            Webhook Payload JSON Editor
                          </label>
                          <textarea
                            value={simulatorPayload}
                            onChange={(e) => setSimulatorPayload(e.target.value)}
                            rows={12}
                            className="w-full flex-1 bg-zinc-950 text-zinc-200 border border-hd-line p-3 font-mono text-[10px] leading-normal focus:outline-none"
                          />
                        </div>

                        <button
                          onClick={dispatchTmsWebhook}
                          disabled={tmsLoading}
                          className="w-full border-2 border-hd-line bg-red-650 hover:bg-hd-ink text-white font-mono text-xs font-bold py-2.5 uppercase tracking-wider transition cursor-pointer shadow-[2px_2px_0px_rgba(20,20,20,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
                        >
                          {tmsLoading ? "Auditing Webhook Ingest..." : "Dispatch Webhook Event"}
                        </button>
                      </div>

                    </div>
                  </div>
                )}

                {activeTab === "analytics" && (
                  <div className="flex flex-col gap-6 animate-fade-in font-sans">
                    {/* Carrier Leaderboard and Premium Engine Split */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Carrier Performance Leaderboard */}
                      <div className="lg:col-span-2 bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)]">
                        <h4 className="font-bold text-xs text-hd-ink uppercase tracking-wider font-mono border-b border-hd-line pb-2 mb-4 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-hd-ink" />
                          <span>Cold-Chain Carrier Reliability Ledger</span>
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                              <tr className="border-b border-hd-line bg-zinc-50 text-zinc-600 font-mono text-[9px] uppercase font-bold">
                                <th className="p-2.5">Carrier</th>
                                <th className="p-2.5 text-center">Score</th>
                                <th className="p-2.5 text-center">Spoilage %</th>
                                <th className="p-2.5 text-center">Temp Breaches</th>
                                <th className="p-2.5 text-center">Shock Events</th>
                                <th className="p-2.5 text-right">Grade</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200">
                              {CARRIERS_DATA.map((c, idx) => (
                                <tr key={idx} className="hover:bg-zinc-50 transition">
                                  <td className="p-2.5 font-bold text-hd-ink uppercase font-mono">{c.name}</td>
                                  <td className="p-2.5 text-center font-mono font-bold text-indigo-700">{c.score}</td>
                                  <td className="p-2.5 text-center font-mono text-zinc-650">{c.spoilageRate}%</td>
                                  <td className="p-2.5 text-center font-mono text-zinc-650">{c.tempDevs}</td>
                                  <td className="p-2.5 text-center font-mono text-zinc-650">{c.shockCount}</td>
                                  <td className="p-2.5 text-right font-mono font-bold">
                                    <span className={`px-1.5 py-0.5 border text-[9px] ${
                                      c.grade.startsWith("A") 
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                        : c.grade.startsWith("B")
                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                        : "bg-red-50 text-red-700 border-red-200"
                                    }`}>
                                      {c.grade}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Interactive Premium pricing tool */}
                      <div className="bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)] flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-xs text-hd-ink uppercase tracking-wider font-mono border-b border-hd-line pb-2 mb-4 flex items-center gap-2">
                            <Coins className="w-3.5 h-3.5 text-red-650" />
                            <span>Risk Underwriting Pricing Engine</span>
                          </h4>
                          
                          <div className="flex flex-col gap-3 text-xs">
                            <div>
                              <label className="block text-[9px] font-mono uppercase font-bold text-zinc-500 mb-1">Carrier selection</label>
                              <select
                                value={calcCarrier}
                                onChange={(e) => setCalcCarrier(e.target.value)}
                                className="w-full bg-white border border-hd-line p-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-hd-ink"
                              >
                                {CARRIERS_DATA.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[9px] font-mono uppercase font-bold text-zinc-500 mb-1">Transit lane</label>
                              <select
                                value={calcLane}
                                onChange={(e) => setCalcLane(e.target.value)}
                                className="w-full bg-white border border-hd-line p-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-hd-ink"
                              >
                                {ROUTES_DATA.map(r => <option key={r.lane} value={r.lane}>{r.lane}</option>)}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[9px] font-mono uppercase font-bold text-zinc-500 mb-1">Cargo classification</label>
                              <select
                                value={calcCargoType}
                                onChange={(e) => setCalcCargoType(e.target.value)}
                                className="w-full bg-white border border-hd-line p-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-hd-ink"
                              >
                                <option value="Fresh Cherries">Rainier Cherries (Highly Perishable)</option>
                                <option value="mRNA Vaccine">mRNA Vaccine Concentrate (Ultra-Cold Critical)</option>
                                <option value="Grand Cru Wine">Grand Cru Burgundy Wine (Shock & Heat Sensitive)</option>
                                <option value="Atlantic Salmon">Atlantic Salmon (Sub-zero Fresh)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[9px] font-mono uppercase font-bold text-zinc-500 mb-1">Cargo Insured Value ($USD)</label>
                              <input
                                type="range"
                                min={10000}
                                max={1000000}
                                step={10000}
                                value={calcCargoValue}
                                onChange={(e) => setCalcCargoValue(Number(e.target.value))}
                                className="w-full h-1 bg-zinc-200 accent-red-650 mt-1 cursor-pointer"
                              />
                              <div className="flex justify-between items-center mt-1 font-mono text-[9px] text-zinc-500 font-bold">
                                <span>$10K</span>
                                <span className="text-hd-ink text-xs font-bold">${calcCargoValue.toLocaleString()} USD</span>
                                <span>$1M</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-zinc-50 border border-zinc-200 p-3.5 rounded-none mt-4 font-mono">
                          <div className="flex justify-between items-center border-b border-zinc-200 pb-1.5 mb-1.5 text-[9px] font-bold text-zinc-500 uppercase">
                            <span>Premium rate:</span>
                            <span className="text-hd-ink text-[11px]">{calculatePremium().rate}%</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-zinc-200 pb-1.5 mb-1.5 text-[9px] font-bold text-zinc-500 uppercase">
                            <span>Policy Cost:</span>
                            <span className="text-red-750 text-sm font-bold">${calculatePremium().premiumUsd.toLocaleString()} USD</span>
                          </div>
                          <div className="text-[8px] leading-tight text-zinc-400 uppercase mt-2">
                            Policy pricing derives from dynamic risk multipliers:
                            Carrier Factor ({calculatePremium().carrierMultiplier}x) • 
                            Lane Risk ({calculatePremium().routeMultiplier}x) • 
                            Reliability Score ({calculatePremium().reliabilityScore} points).
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Route Danger Heatmap */}
                    <div className="bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)]">
                      <h4 className="font-bold text-xs text-hd-ink uppercase tracking-wider font-mono border-b border-hd-line pb-2 mb-4 flex items-center gap-2">
                        <Scale className="w-4 h-4 text-hd-ink" />
                        <span>Logistics Corridor Thermal Risk Log</span>
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="border-b border-hd-line bg-zinc-50 text-zinc-600 font-mono text-[9px] uppercase font-bold">
                              <th className="p-2.5">Shipping lane</th>
                              <th className="p-2.5 text-center">Avg Temp Breach (°C)</th>
                              <th className="p-2.5 text-center">Avg Shock Freq / Trip</th>
                              <th className="p-2.5 text-center">Risk Multiplier</th>
                              <th className="p-2.5 text-right">Danger Rating</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200">
                            {ROUTES_DATA.map((r, idx) => (
                              <tr key={idx} className="hover:bg-zinc-50 transition">
                                <td className="p-2.5 font-bold text-hd-ink uppercase font-mono">{r.lane}</td>
                                <td className="p-2.5 text-center font-mono text-zinc-650">+{r.avgTempBreach}°C</td>
                                <td className="p-2.5 text-center font-mono text-zinc-650">{r.shockFreq} shocks</td>
                                <td className="p-2.5 text-center font-mono font-bold text-indigo-700">{r.multiplier}x</td>
                                <td className="p-2.5 text-right font-mono font-bold">
                                  <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-none uppercase ${
                                    r.dangerLevel === "Low" 
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-250" 
                                      : r.dangerLevel === "Medium"
                                      ? "bg-blue-50 text-blue-700 border border-blue-250"
                                      : "bg-red-50 text-red-700 border border-red-250 animate-pulse"
                                  }`}>
                                    {r.dangerLevel}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "verification" && (
                  <div className="flex flex-col gap-6 animate-fade-in font-sans">
                    {/* Top Split: Ledger on Left, Interactive Verifier on Right */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Secure Ledger Fingerprints list */}
                      <div className="lg:col-span-2 bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)] text-left">
                        <h4 className="font-bold text-xs text-hd-ink uppercase tracking-wider font-mono border-b border-hd-line pb-2 mb-4 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-hd-ink" />
                          <span>Cryptographic Seal Ledger Database (Immutable Registry)</span>
                        </h4>
                        
                        <div className="overflow-x-auto max-h-96">
                          {auditChain.length > 0 ? (
                            <table className="w-full text-left border-collapse text-[10px] font-mono">
                              <thead>
                                <tr className="border-b border-hd-line bg-zinc-50 text-zinc-600 text-[9px] uppercase font-bold">
                                  <th className="p-2.5">Shipment ID</th>
                                  <th className="p-2.5">Registered Timestamp</th>
                                  <th className="p-2.5">PDF Hash</th>
                                  <th className="p-2.5">Combined Seal</th>
                                  <th className="p-2.5 text-right">Ledger Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-200">
                                {auditChain.map((entry, idx) => (
                                  <tr key={idx} className="hover:bg-zinc-50 transition">
                                    <td className="p-2.5 font-bold text-hd-ink font-mono">{entry.shipment_id}</td>
                                    <td className="p-2.5 text-zinc-500 font-mono">{new Date(entry.timestamp).toLocaleString()}</td>
                                    <td className="p-2.5 font-mono text-zinc-650" title={entry.pdf_hash}>
                                      {entry.pdf_hash ? `${entry.pdf_hash.slice(0, 8)}...` : "N/A"}
                                    </td>
                                    <td className="p-2.5 font-mono text-zinc-650" title={entry.combined_hash}>
                                      {entry.combined_hash ? `${entry.combined_hash.slice(0, 10)}...` : "N/A"}
                                    </td>
                                    <td className="p-2.5 text-right">
                                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[8px] font-bold uppercase">
                                        SECURED
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="py-12 text-center text-zinc-400 italic text-xs">
                              No registered cryptographic seals found in the local ledger.
                              <p className="mt-1 text-[10px] text-zinc-500 uppercase font-mono font-normal">
                                Audited shipments will automatically save their SHA-256 seals here.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Interactive Verification Console */}
                      <div className="bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)] text-left flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-xs text-hd-ink uppercase tracking-wider font-mono border-b border-hd-line pb-2 mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-650" />
                            <span>Claim Audit Verification Portal</span>
                          </h4>
                          
                          <div className="flex flex-col gap-4 text-xs font-sans mt-3">
                            <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-none">
                              <span className="text-[9px] font-mono uppercase font-bold text-zinc-500 block mb-1">
                                Verification Context
                              </span>
                              <p className="text-[10px] leading-tight text-hd-ink font-semibold">
                                {analysisReport 
                                  ? `Active Shipment: ${shipmentId} (${cargoType})`
                                  : "No active shipment loaded. Matches will be checked against the ledger database dynamically."}
                              </p>
                            </div>

                            <div className="border-2 border-dashed border-zinc-300 p-6 text-center bg-zinc-50 hover:bg-zinc-100 transition relative">
                              <input
                                type="file"
                                accept=".pdf"
                                onChange={handleVerifyFile}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={verifying}
                              />
                              <FileText className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                              <span className="block text-[10px] font-mono uppercase font-bold text-hd-ink">
                                {verifying ? "Computing PDF Fingerprint..." : "Upload Official PDF Report"}
                              </span>
                              <span className="block text-[9px] text-zinc-500 mt-1">
                                Supports .pdf claims document
                              </span>
                            </div>
                            
                            {verificationError && (
                              <div className="p-3 bg-red-50 border border-red-200 text-red-750 text-[10px] font-mono uppercase font-bold">
                                {verificationError}
                              </div>
                            )}

                            {verificationResult && (
                              <div className="flex flex-col gap-3">
                                <div className={`p-3 border flex items-start gap-2.5 ${
                                  verificationResult.status === "VERIFIED"
                                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                    : verificationResult.status === "TAMPERED"
                                    ? "bg-red-50 border-red-300 text-red-850 animate-bounce"
                                    : "bg-amber-50 border-amber-300 text-amber-800"
                                }`}>
                                  {verificationResult.status === "VERIFIED" ? (
                                    <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                                  ) : (
                                    <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-750" />
                                  )}
                                  <div>
                                    <strong className="font-mono text-[10px] uppercase block tracking-wider font-black">
                                      Fingerprint Status: {verificationResult.status}
                                    </strong>
                                    <p className="text-[10px] leading-tight mt-1 font-semibold">
                                      {verificationResult.status === "VERIFIED"
                                        ? `Audit seal verified! The claims document is authentic and unaltered.`
                                        : verificationResult.status === "TAMPERED"
                                        ? "Security Warning: The PDF bytes or input data has been modified. Do NOT honor this claim."
                                        : "Fingerprint not found. This document is not registered in the audit ledger."}
                                    </p>
                                  </div>
                                </div>

                                <div className="bg-zinc-900 text-[9px] font-mono text-zinc-350 p-3 rounded-none overflow-x-auto select-all leading-normal flex flex-col gap-1 text-left">
                                  <span className="text-zinc-500 font-bold block uppercase border-b border-zinc-800 pb-1 mb-1">
                                    SHA-256 Hashing Fingerprints:
                                  </span>
                                  <div className="flex justify-between">
                                    <span>Uploaded PDF Hash:</span>
                                    <span className="text-white font-bold">{verificationResult.uploaded_pdf_hash?.slice(0, 16)}...</span>
                                  </div>
                                  {verificationResult.stored_hashes && (
                                    <>
                                      <div className="flex justify-between border-t border-zinc-800/40 pt-1 mt-1">
                                        <span>Stored PDF Hash:</span>
                                        <span className="text-white font-bold">{verificationResult.stored_hashes.pdf_hash?.slice(0, 16)}...</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Telemetry Hash:</span>
                                        <span className={`font-bold ${verificationResult.telemetry_verified ? "text-emerald-400" : "text-red-400"}`}>
                                          {verificationResult.stored_hashes.telemetry_hash?.slice(0, 16)}...
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>SLA Terms Hash:</span>
                                        <span className={`font-bold ${verificationResult.terms_verified ? "text-emerald-400" : "text-red-400"}`}>
                                          {verificationResult.stored_hashes.terms_hash?.slice(0, 16)}...
                                        </span>
                                      </div>
                                      <div className="flex justify-between mt-1 border-t border-zinc-800 pt-1 uppercase text-[8px] font-bold text-zinc-500">
                                        <span>Combined Seal:</span>
                                        <span className="text-white">{verificationResult.stored_hashes.combined_hash?.slice(0, 20)}...</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                          </div>
                        </div>

                        <p className="text-[9px] text-zinc-400 font-mono uppercase mt-4">
                          Security Protocol: SHA-256 Hashing • ChainGuard AI v2.0
                        </p>
                      </div>

                    </div>
                  </div>
                )}

                {/* Legal Disclaimer / Code Block */}
                {analysisReport && activeTab !== "tms" && activeTab !== "analytics" && activeTab !== "verification" && (
                  <div className="mt-2 text-[9px] font-mono text-zinc-500 leading-normal border-t border-zinc-200 pt-4 flex flex-col md:flex-row items-center justify-between gap-2 uppercase font-bold">
                    <span>ChainGuard AI automated legally-defensible log analyzer • Ref Code: SHELF_LIFE_Arrhenius_3.5</span>
                    <span>CONFIDENTIAL INSURANCE FILING SPECIFIED</span>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* INITIAL EMPTY STATE REMOVED - NESTED IN OVERVIEW TAB */}

        </div>
      </div>

      {/* Side Drawers */}
      {(showCode || showAssistant) && (
        <div className="w-full xl:w-[450px] flex flex-col gap-6 shrink-0 transition-all duration-300">
          {showCode && (
            <section id="developer-code-panel" className="bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)] flex flex-col">
              <div className="flex items-center justify-between border-b border-hd-line pb-2 mb-3">
                <div className="font-serif-georgia italic text-xs text-hd-ink/70 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                  <FileCode className="w-3.5 h-3.5 text-indigo-650" />
                  <span>Developer API Code</span>
                </div>
                <button 
                  onClick={() => setShowCode(false)}
                  className="text-xs hover:text-red-600 font-mono font-bold cursor-pointer uppercase"
                >
                  [Close]
                </button>
              </div>
              
              <p className="text-[10px] text-zinc-500 mb-3 leading-tight uppercase font-bold font-mono">
                Reproduce this analysis call via API in your own client application:
              </p>
              
              {/* Tab Selector */}
              <div className="flex border border-hd-line bg-zinc-50 mb-3 text-[10px] font-mono font-bold uppercase">
                {["curl", "python", "js"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCodeTab(tab as any)}
                    className={`flex-1 py-1.5 text-center transition duration-150 cursor-pointer border-r border-hd-line last:border-r-0 ${
                      codeTab === tab ? "bg-hd-ink text-white" : "hover:bg-zinc-100 text-hd-ink"
                    }`}
                  >
                    {tab === "curl" ? "cURL" : tab === "python" ? "Python" : "JavaScript"}
                  </button>
                ))}
              </div>
              
              {/* Code Block Container */}
              <div className="relative group flex-1 min-h-[250px] flex flex-col">
                <pre className="bg-zinc-950 p-3 border border-hd-line text-[10px] font-mono text-zinc-200 overflow-auto whitespace-pre leading-normal flex-1 max-h-[400px]">
                  <code>
                    {codeTab === "curl" && getCurlCode()}
                    {codeTab === "python" && getPythonCode()}
                    {codeTab === "js" && getJsCode()}
                  </code>
                </pre>
                <button
                  onClick={() => {
                    const code = codeTab === "curl" ? getCurlCode() : codeTab === "python" ? getPythonCode() : getJsCode();
                    navigator.clipboard.writeText(code);
                    alert("Code snippet copied to clipboard!");
                  }}
                  className="absolute top-2 right-2 bg-zinc-900 border border-zinc-700 hover:border-white text-[9px] font-mono text-zinc-300 hover:text-white px-2 py-1 transition rounded-none uppercase cursor-pointer"
                >
                  Copy Code
                </button>
              </div>

              {/* Model Accuracy Performance Metrics */}
              {evalResults && (
                <div className="mt-5 pt-4 border-t border-hd-line text-left flex flex-col gap-2">
                  <div className="font-serif-georgia italic text-[11px] text-hd-ink/75 uppercase tracking-wider font-bold flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-650" />
                    <span>CrewAI Model Performance Metrics</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-2 font-mono">
                    <div className="bg-zinc-50 border border-hd-line p-2">
                      <span className="text-[7px] text-zinc-500 uppercase block font-bold">Accuracy</span>
                      <span className="text-xs font-black text-emerald-650">{evalResults.accuracy_rate}</span>
                    </div>
                    <div className="bg-zinc-50 border border-hd-line p-2">
                      <span className="text-[7px] text-zinc-500 uppercase block font-bold">Loss Error</span>
                      <span className="text-xs font-black text-emerald-650">{evalResults.average_deviation_error}</span>
                    </div>
                    <div className="bg-zinc-50 border border-hd-line p-2">
                      <span className="text-[7px] text-zinc-500 uppercase block font-bold">Avg Latency</span>
                      <span className="text-xs font-black text-hd-ink">{evalResults.avg_latency_sec}s</span>
                    </div>
                  </div>
                  
                  <div className="border border-hd-line bg-zinc-950 text-zinc-300 font-mono text-[9px] p-2 leading-relaxed max-h-48 overflow-y-auto">
                    <div className="text-white border-b border-zinc-700 pb-1 mb-1 font-bold uppercase tracking-wider text-[8px] flex justify-between">
                      <span>Test cases battery results</span>
                      <span className="text-[7px] text-zinc-400 font-normal">Updated: {evalResults.timestamp}</span>
                    </div>
                    {evalResults.results.map((res: any, idx: number) => (
                      <div key={idx} className="border-b border-zinc-800 last:border-b-0 py-1.5 flex flex-col gap-0.5">
                        <div className="flex justify-between font-bold text-white uppercase text-[8px] leading-tight">
                          <span className="max-w-[70%] truncate">{res.name}</span>
                          <span className={res.party_correct.includes("MATCH") ? "text-emerald-500" : "text-rose-500"}>
                            {res.party_correct}
                          </span>
                        </div>
                        <div className="text-zinc-400 text-[8px] flex justify-between">
                          <span>Blame: expected {res.expected_party}, got {res.actual_party}</span>
                          <span className="text-zinc-500 font-bold">{res.latency_sec}s</span>
                        </div>
                        <div className="text-zinc-400 text-[8px]">
                          Loss Dev: expected ${res.expected_loss.toLocaleString()}, got ${res.actual_loss.toLocaleString()} (err: {res.deviation_pct})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
          
          {showAssistant && (
            <section id="interactive-assistant-panel" className="bg-white border border-hd-line p-5 rounded-none shadow-[2px_2px_0px_rgba(20,20,20,1)] flex flex-col min-h-[400px]">
              <div className="flex items-center justify-between border-b border-hd-line pb-2 mb-3">
                <div className="font-serif-georgia italic text-xs text-hd-ink/70 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-650" />
                  <span>Gemini AI Assistant</span>
                </div>
                <button 
                  onClick={() => setShowAssistant(false)}
                  className="text-xs hover:text-red-650 font-mono font-bold cursor-pointer uppercase"
                >
                  [Close]
                </button>
              </div>
              
              <p className="text-[10px] text-zinc-500 mb-3 leading-tight uppercase font-bold font-mono">
                Ask questions about liability allocations, telemetry charts, or RAG insurance terms:
              </p>

              {/* Chat Message Logs */}
              <div className="flex-1 border border-hd-line bg-zinc-50 p-3 overflow-y-auto max-h-[350px] min-h-[250px] flex flex-col gap-3 font-sans">
                {chatMessages.map((msg, i) => {
                  const isUser = msg.role === "user";
                  return (
                    <div key={i} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                      <span className="text-[8px] font-mono font-bold text-zinc-400 uppercase mb-0.5">
                        {isUser ? "You" : "ChainGuard AI Assistant"}
                      </span>
                      <div className={`p-2.5 max-w-[85%] border text-xs leading-relaxed ${
                        isUser 
                          ? "bg-hd-ink text-white border-hd-line" 
                          : "bg-white text-hd-ink border-zinc-300"
                      }`}>
                        <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
                {chatLoading && (
                  <div className="flex flex-col items-start">
                    <span className="text-[8px] font-mono font-bold text-zinc-400 uppercase mb-0.5">
                      Assistant is thinking...
                    </span>
                    <div className="p-2.5 bg-white border border-zinc-300 text-xs text-zinc-500 flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                      <span className="font-mono text-[10px] font-bold uppercase animate-pulse">Running logic chains...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Form */}
              <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={currentMessageInput}
                  onChange={(e) => setCurrentMessageInput(e.target.value)}
                  placeholder="Ask about liability, spoilage..."
                  disabled={chatLoading}
                  className="flex-1 bg-zinc-50 border border-hd-line rounded-none px-3 py-1.5 text-xs text-hd-ink focus:outline-none focus:bg-white focus:border-red-600 transition font-mono font-semibold"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !currentMessageInput.trim()}
                  className="bg-hd-ink text-white border border-hd-line hover:bg-white hover:text-hd-ink px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </form>
            </section>
          )}
        </div>
      )}
    </main>

      {/* Footer Info */}
      <footer className="border-t border-hd-line bg-hd-bg py-6 px-1 text-center text-[10px] font-mono text-zinc-600 mt-12 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-hd-line mb-6 uppercase tracking-wider font-bold">
        <p>© 2026 ChainGuard AI Logistics. All biological telemetry assets monitored securely.</p>
        <div className="flex items-center gap-4">
          <span>Secure AES Endpoint HTTPS</span>
          <span>•</span>
          <span>Legal IoT Tamper-Free Logs</span>
        </div>
      </footer>
    </div>
  );
}

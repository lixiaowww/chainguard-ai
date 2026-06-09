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
  Loader2, Zap, AlertTriangle, Lightbulb, User, Layout, 
  TerminalSquare, Check, Plus, History, FolderOpen, Trash2, 
  ArrowRight, FileText, BarChart3, Clock, Rocket, Target, ShieldCheck,
  LogOut, LogIn, UserCircle, Mail, Lock, Upload
} from 'lucide-react';
import { cn } from './lib/utils';
import { supabase } from './lib/supabase';
import { ProjectService, Project, ProjectVersion } from './lib/ProjectService';
import { RadarService, WatchArea, DiscoveredPain } from './lib/RadarService';
import { TmsService } from './lib/TmsService';

const SYSTEM_INSTRUCTION = `你是一个顶级的“全球冷链审计与货损合规专家（ChainGuard AI - Senior Cargo Auditor）”。你的核心任务是分析由于温度波动、物理冲击或延误导致的易腐货物损坏，并根据国际海运/空运法规（如《蒙特利尔公约》、《海牙-维斯比规则》）进行责任判定。

### 核心规则：
- **输出格式**: 优先使用 HTML 标签来增强报告的可读性和视觉表现力（如表格、警告色标签、卡片式布局），主体保持 Markdown。

### 审计逻辑：
1. **生物物理分析**: 利用 Arrhenius 方程分析货物腐败率和剩余保质期。
2. **法律合规判定**: 严格比对合同 SLA 和国际公约条款。
3. **责任判定 (Fault Allocation)**: 明确承运人、托运人或港口的责任百分比。
4. **行动建议**: 提供紧急冷藏、货物拒收或理赔申请的专业指导。

### 输出报告结构:
1. **审计官简报**: 事故定性分析。
2. **遥测数据证据链**: 引用传感器时间戳和异常值。
3. **法律判定依据**: 引用具体公约条款（SDR 赔偿限额计算）。
4. **理赔与处置建议**: 方案 A (紧急抢救) 与 方案 B (正式索赔)。`;

type TagGroup = {
  id: string;
  label: string;
  options: { id: string; label: string; promptText: string }[];
};

const STRATEGY_GROUPS: TagGroup[] = [
  {
    id: 'opportunity',
    label: '目标: 寻找什么样的机会',
    options: [
      { id: 'b2b_pain', label: 'B2B 高付费痛点', promptText: '高付费 B2B 痛点，寻找企业愿意为解决问题掏钱的刚需。' },
      { id: 'vertical', label: '垂直行业机会', promptText: '垂直行业机会，发掘特定行业（如医疗、法律、建筑等）的专属痛点。' },
      { id: 'ai_replace', label: 'AI 可替代人工', promptText: 'AI 可替代的人工流程，寻找目前仍由人力完成的高重复性、陈旧繁琐的工作。' },
      { id: 'workaround', label: '高频 Workaround', promptText: '高频 workaround 场景，因为现有系统烂而不得不拼接多个工具或自行发明的“土办法”。' },
      { id: 'mass_complaint', label: '大众高频吐槽', promptText: '大量普通消费者或中小企业的高频吐槽 and 痛点。' },
    ]
  },
  {
    id: 'audience',
    label: '受众: 目标画像限定',
    options: [
      { id: 'smb', label: '中小企业 (SMB)', promptText: '中小企业用户群 (SMB)。' },
      { id: 'enterprise', label: '中大型企业', promptText: '中大型企业 (Enterprise) 及团队管理者。' },
      { id: 'traditional', label: '传统行业人', promptText: '传统行业从业者，通常远离前沿科技，但拥有深厚业务流。' },
    ]
  },
  {
    id: 'signal',
    label: '关键: 必须包含的痛点信号',
    options: [
      { id: 'excel', label: '导出 Excel 依赖', promptText: '【强烈信号】必须包含抱怨“还需要导出 Excel 处理”或深度依赖 Spreadsheet，意味着现有工具功能断点。' },
      { id: 'manual', label: '极度耗时/繁琐', promptText: '【强烈信号】大量提及“pure manual, waste time, frustrating”等消耗时间的繁琐操作。' },
      { id: 'pay', label: '明确付费意愿', promptText: '【强烈信号】挖掘带有强烈商业化价值的痛点表达（Willingness to pay）。' },
      { id: 'churn', label: '导致退订核心', promptText: '【强烈信号】分析导致用户从旧软件流失、取消订阅的最不可忍受的原因。' },
    ]
  },
  {
    id: 'teamSize',
    label: '资源/团队: 适合什么样的开发者',
    options: [
      { id: 'indie', label: '独立开发者 (1人)', promptText: '【资源限定】只寻找适合 Indie Hacker 单人作战的项目（技术栈简单，最好是全栈 JS/TS，无巨量运维，MVP 1-2个月内能出）。' },
      { id: 'small_team', label: '小团队 (3-5人)', promptText: '【资源限定】适合 3-5 人小团队的项目（可以应对一定复杂度的前后端分离、部分算法或合规要求，有一定的护城河壁垒）。' },
    ]
  }
];

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
            <Zap className="h-8 w-8" />
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const activeProject = projects.find(p => p.id === activeProjectId) || null;
  const currentVersion = activeProject?.versions?.[0] || null;

  const [isGeneratingKit, setIsGeneratingKit] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Record<string, string[]>>({ opportunity: [], audience: [], signal: [], teamSize: [] });
  const [focusHint, setFocusHint] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [reportText, setReportText] = useState<string | null>(null);
  const [isBrutal, setIsBrutal] = useState(true);
  const [isCuriosityEnabled, setIsCuriosityEnabled] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<{
    scores: Record<string, number> | null;
    finalScore: number | null;
    confidenceLevel: string | null;
  }>({ scores: null, finalScore: null, confidenceLevel: null });

  const [enableSearch, setEnableSearch] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash');

  // Pain Radar state
  const [activeTab, setActiveTab] = useState<'auditor' | 'radar' | 'tms_autopilot'>('tms_autopilot');
  const [tmsAudits, setTmsAudits] = useState<any[]>([]);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [isTmsLoading, setIsTmsLoading] = useState(false);

  const activeAudit = tmsAudits.find(a => a.id === activeAuditId) || null;

  const [watchAreas, setWatchAreas] = useState<WatchArea[]>([]);
  const [activeWatchAreaId, setActiveWatchAreaId] = useState<string | null>(null);
  const [pains, setPains] = useState<DiscoveredPain[]>([]);
  const [activePainId, setActivePainId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaKeywords, setNewAreaKeywords] = useState('');
  const [isAddingWatchArea, setIsAddingWatchArea] = useState(false);

  const activeWatchArea = watchAreas.find(w => w.id === activeWatchAreaId) || null;
  const activePain = pains.find(p => p.id === activePainId) || null;

  // Load Watch Areas when switching to Radar tab
  useEffect(() => {
    if (session && activeTab === 'radar') {
      loadWatchAreas();
    }
  }, [session, activeTab]);

  // Load Pains when active watch area changes
  useEffect(() => {
    if (activeWatchAreaId) {
      loadPains(activeWatchAreaId);
    } else {
      setPains([]);
      setActivePainId(null);
    }
  }, [activeWatchAreaId]);

  // Load TMS Audits when switching to TMS Autopilot tab
  useEffect(() => {
    if (session && activeTab === 'tms_autopilot') {
      loadTmsAudits();
    }
  }, [session, activeTab]);

  const loadTmsAudits = async () => {
    setIsTmsLoading(true);
    try {
      const data = await TmsService.getShipments();
      setTmsAudits(data as any[]);
      if (data.length > 0 && !activeAuditId) {
        setActiveAuditId(data[0].id || null);
      }
    } catch (e) {
      console.error("Failed to load TMS audits", e);
    } finally {
      setIsTmsLoading(false);
    }
  };

  const loadWatchAreas = async () => {
    const data = await RadarService.getWatchAreas();
    setWatchAreas(data);
    if (data.length > 0 && !activeWatchAreaId) {
      setActiveWatchAreaId(data[0].id);
    }
  };

  const loadPains = async (id: string) => {
    const data = await RadarService.getPains(id);
    setPains(data);
    if (data.length > 0) {
      setActivePainId(data[0].id);
    } else {
      setActivePainId(null);
    }
  };

  const handleCreateWatchArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim() || !newAreaKeywords.trim()) return;
    const newArea = await RadarService.createWatchArea(
      newAreaName, 
      newAreaKeywords, 
      { opportunity: [], audience: [], signal: [], teamSize: [] }
    );
    if (newArea) {
      setNewAreaName('');
      setNewAreaKeywords('');
      setIsAddingWatchArea(false);
      await loadWatchAreas();
      setActiveWatchAreaId(newArea.id);
    }
  };

  const handleDeleteWatchArea = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除该监控领域吗？其名下的侦察痛点也会被清空。')) {
      const ok = await RadarService.deleteWatchArea(id);
      if (ok) {
        await loadWatchAreas();
        if (activeWatchAreaId === id) {
          setActiveWatchAreaId(null);
        }
      }
    }
  };

  const handleTriggerScan = async () => {
    if (!activeWatchAreaId || !activeWatchArea) return;
    setIsScanning(true);
    try {
      const updatedPains = await RadarService.triggerScan(
        activeWatchArea.id, 
        activeWatchArea.keywords, 
        activeWatchArea.tags
      );
      setPains(updatedPains);
      if (updatedPains.length > 0) {
        setActivePainId(updatedPains[0].id);
      }
      await loadWatchAreas(); // Refresh scan time
      alert('全网需求雷达探测完毕！');
    } catch (err: any) {
      alert(`侦察失败：${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConvertToAudit = (pain: DiscoveredPain) => {
    // 转化填充至 Auditor 的焦点领域和设置
    setFocusHint(
      `【痛点名称】：${pain.title}\n` +
      `【痛点背景】：${pain.description}\n` +
      `【真实抱怨证据】：${pain.raw_evidence || '无'}\n` +
      `【潜在商业方案】：${pain.potential_solution || '无'}`
    );
    setGithubUrl('');
    setCompetitors('');
    
    // 自动重置并切换 Tab
    setActiveProjectId(null);
    setReportText(null);
    setActiveTab('auditor');
  };

  // Auth State Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Projects when session exists
  useEffect(() => {
    if (session) {
      loadProjects();
    } else {
      setProjects([]);
    }
  }, [session]);

  const loadProjects = async () => {
    const data = await ProjectService.getProjects();
    setProjects(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setActiveProjectId(null);
    setReportText(null);
  };

  const toggleTag = (groupId: string, optionId: string) => {
    setSelectedTags(prev => {
      const groupTags = prev[groupId] || [];
      if (groupTags.includes(optionId)) {
        return { ...prev, [groupId]: groupTags.filter(id => id !== optionId) };
      } else {
        return { ...prev, [groupId]: [...groupTags, optionId] };
      }
    });
  };

  const generateInputText = () => {
    let structuredInput = '【研究策略】\n';
    let hasStrategy = false;
    STRATEGY_GROUPS.forEach(group => {
      const selectedInGroup = selectedTags[group.id];
      if (selectedInGroup && selectedInGroup.length > 0) {
        hasStrategy = true;
        const texts = selectedInGroup.map(optId => group.options.find(o => o.id === optId)?.promptText).filter(Boolean);
        structuredInput += `- ${group.label}:\n  ${texts.join('\n  ')}\n`;
      }
    });

    if (!hasStrategy) {
      structuredInput = '';
    }

    if (focusHint.trim()) {
      structuredInput += `\n【补充焦点/行业限制】\n${focusHint}\n`;
    }
    return structuredInput;
  };

  const handleGenerateReport = async () => {
    const finalInputText = generateInputText();
    
    if (!finalInputText.trim()) {
      setError('请至少选择一个研究策略或输入补充焦点。');
      return;
    }

    setIsGenerating(true);
    setReportText('');
    setExtractedData({ scores: null, finalScore: null, confidenceLevel: null });
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText: finalInputText,
          githubUrl,
          competitors,
          isBrutal,
          isCuriosityEnabled,
          model: selectedModel,
          enableSearch
        }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('Response stream not available');

      let accumulatedText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        setReportText(accumulatedText);
      }

      // 串流结束后，发起结构化提取接口调用
      if (accumulatedText.trim()) {
        try {
          const extractRes = await fetch('/api/analyze/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportText: accumulatedText }),
          });
          if (extractRes.ok) {
            const data = await extractRes.json();
            setExtractedData({
              scores: {
                Demand: data.dimensions?.demand?.score ?? 0,
                Competition: data.dimensions?.competition?.score ?? 0,
                Monetization: data.dimensions?.monetization?.score ?? 0,
                Distribution: data.dimensions?.distribution?.score ?? 0,
                Retention: data.dimensions?.retention?.score ?? 0,
                'Founder-Market Fit': data.dimensions?.founder_market_fit?.score ?? 0,
              },
              finalScore: data.finalScore,
              confidenceLevel: data.confidence?.level || 'LOW'
            });
          }
        } catch (extractErr) {
          console.error('Failed to extract structured scores, will fallback to regex:', extractErr);
        }
      }
    } catch (err: any) {
      setError(err.message || '引擎逻辑过热。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToMemory = async () => {
    if (!reportText || finalScore === null || !session) return;
    
    let pid = activeProjectId;
    const projectName = focusHint.trim() || (githubUrl ? githubUrl.split('/').pop() : 'New Idea') || 'New Idea';

    if (!pid) {
      const newP = await ProjectService.createProject(projectName, {
        github_url: githubUrl,
        competitors,
        focus_hint: focusHint,
        tags: selectedTags
      });
      if (!newP) return;
      pid = newP.id;
      setActiveProjectId(pid);
    }

    await ProjectService.addVersion(pid, {
      score: finalScore,
      confidence: confidenceLevel || 'LOW',
      report: reportText,
      verdict: finalScore >= 75 ? 'PURSUE' : finalScore >= 55 ? 'TEST' : finalScore >= 35 ? 'PIVOT' : 'DROP',
      dimensions: scores
    });
    
    await loadProjects();
    alert('分析已安全存入您的云端 I2B Pro 空间');
  };

  const extractScores = (text: string | null) => {
    if (!text) return null;
    const scores: Record<string, number> = {};
    const dimensions = ['Demand', 'Competition', 'Monetization', 'Distribution', 'Retention', 'Founder-Market Fit'];
    dimensions.forEach(dim => {
      const regex = new RegExp(`${dim}.*?(\\d+)/100`, 'i');
      const match = text.match(regex);
      if (match) scores[dim] = parseInt(match[1]);
    });
    const finalScoreMatch = text.match(/(?:最终评分|Final Score).*?(\d+)/i);
    const finalScore = finalScoreMatch ? parseInt(finalScoreMatch[1]) : null;
    const confidenceMatch = text.match(/(?:置信度等级|Confidence Level).*?(HIGH|MEDIUM|LOW)/i);
    const confidenceLevel = confidenceMatch ? confidenceMatch[1] : null;
    return { scores, finalScore, confidenceLevel };
  };

  const getDerivedScores = () => {
    if (extractedData.finalScore !== null) {
      return extractedData;
    }
    const derived = extractScores(reportText);
    return {
      scores: derived?.scores || null,
      finalScore: derived?.finalScore || null,
      confidenceLevel: derived?.confidenceLevel || null
    };
  };

  const { scores, finalScore, confidenceLevel } = getDerivedScores();

  const handleUpdateRATStatus = async (status: 'Pending' | 'In Progress' | 'Passed' | 'Failed') => {
    if (!activeProjectId || !currentVersion) return;
    await ProjectService.updateVersion(activeProjectId, currentVersion.id, {
      rat: { ...currentVersion.rat, status }
    });
    await loadProjects();
  };

  const handleGenerateLaunchKit = async () => {
    if (!activeProjectId || !currentVersion || !reportText) return;
    setIsGeneratingKit(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText: `Generate Launch Kit based on: ${reportText.substring(0, 1000)}`,
          model: selectedModel,
          enableSearch: false
        }),
      });
      if (!response.ok) throw new Error('Launch Kit failed');
    } catch (err) { console.error(err); } finally { setIsGeneratingKit(false); }
  };

  const handleSelectProject = (project: Project) => {
    setActiveProjectId(project.id);
    setSelectedTags(project.tags);
    setFocusHint(project.focus_hint || '');
    setGithubUrl(project.github_url || '');
    setCompetitors(project.competitors || '');
    const latestVersion = project.versions?.[0] || null;
    setReportText(latestVersion?.report || null);
    if (latestVersion) {
      setExtractedData({
        scores: latestVersion.dimensions || null,
        finalScore: latestVersion.score || null,
        confidenceLevel: latestVersion.confidence || null
      });
    } else {
      setExtractedData({ scores: null, finalScore: null, confidenceLevel: null });
    }
  };

  const handleCreateNew = () => {
    setActiveProjectId(null);
    setSelectedTags({ opportunity: [], audience: [], signal: [], teamSize: [] });
    setFocusHint('');
    setGithubUrl('');
    setCompetitors('');
    setReportText(null);
    setExtractedData({ scores: null, finalScore: null, confidenceLevel: null });
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除吗？')) {
      await ProjectService.deleteProject(id);
      await loadProjects();
      if (activeProjectId === id) handleCreateNew();
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="h-8 w-8 text-cyan-500 animate-spin" /></div>;
  if (!session) return <LoginView onLogin={loadProjects} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex flex-col items-stretch">
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-10 px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Zap className="h-6 w-6 text-cyan-500" />
          <h1 className="text-xl font-semibold text-white">ChainGuard <span className="text-cyan-400 font-light">AI</span></h1>
          
          <nav className="flex space-x-2 ml-8 border-l border-slate-800 pl-8">
            <button 
              onClick={() => setActiveTab('auditor')}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200", 
                activeTab === 'auditor' ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-500 hover:text-slate-300 border border-transparent"
              )}
            >
              Intelligence Auditor (智能审计)
            </button>
            <button 
              onClick={() => setActiveTab('radar')}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200", 
                activeTab === 'radar' ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-500 hover:text-slate-300 border border-transparent"
              )}
            >
              Cargo Radar (货运雷达)
            </button>
            <button 
              onClick={() => setActiveTab('tms_autopilot')}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200", 
                activeTab === 'tms_autopilot' ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-500 hover:text-slate-300 border border-transparent"
              )}
            >
              TMS Autopilot (托管理赔)
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <UserCircle className="h-4 w-4" />
            <span>{session.user.email}</span>
          </div>
          <button onClick={handleLogout} className="text-slate-500 hover:text-rose-400"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl w-full mx-auto p-8 flex flex-col lg:flex-row gap-6">
        {activeTab === 'auditor' ? (
          <>
            {/* Sidebar */}
            <div className="hidden xl:flex flex-col w-64 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-[calc(100vh-8rem)]">
              <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
                <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Workspace</h2>
                <button onClick={handleCreateNew} className="text-cyan-400"><Plus className="h-4 w-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {projects.map(p => (
                  <div key={p.id} onClick={() => handleSelectProject(p)} className={cn("px-3 py-2 rounded-lg cursor-pointer border transition-all", activeProjectId === p.id ? "bg-cyan-500/10 border-cyan-500/30 text-white" : "border-transparent hover:bg-slate-800/50 text-slate-400")}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-semibold truncate">{p.name}</span>
                      <Trash2 onClick={(e) => handleDeleteProject(e, p.id)} className="h-3 w-3 hover:text-rose-400" />
                    </div>
                    <span className={cn("text-[8px] px-1 rounded font-bold uppercase", p.status === 'Pursue' ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-500")}>{p.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Intelligence Probe */}
            <div className="flex flex-col flex-1 max-w-xl bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-[calc(100vh-8rem)] p-5 space-y-6">
              <div className="space-y-4">
                {STRATEGY_GROUPS.map(group => (
                  <div key={group.id}>
                    <h3 className="text-[10px] uppercase text-slate-500 font-bold mb-2">{group.label}</h3>
                    <div className="flex flex-wrap gap-2">
                      {group.options.map(opt => (
                        <button key={opt.id} onClick={() => toggleTag(group.id, opt.id)} className={cn("px-2 py-1 text-[10px] rounded border transition-all", selectedTags[group.id]?.includes(opt.id) ? "border-cyan-500 text-cyan-400" : "border-slate-700 text-slate-500")}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-800">
                 <label className="text-[10px] text-slate-500 uppercase font-bold">GitHub Repo</label>
                 <input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white mt-1" />
              </div>

              <div className="flex-1">
                 <label className="text-[10px] text-slate-500 uppercase font-bold">Focus Area</label>
                 <textarea value={focusHint} onChange={(e) => setFocusHint(e.target.value)} className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white mt-1 resize-none" />
              </div>

              <div className="flex gap-4">
                <button onClick={() => setIsCuriosityEnabled(!isCuriosityEnabled)} className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", isCuriosityEnabled ? "bg-pink-600 text-white" : "bg-slate-800 text-slate-400")}>
                  Curiosity Probe {isCuriosityEnabled ? 'ON' : 'OFF'}
                </button>
                <button onClick={handleGenerateReport} disabled={isGenerating} className="flex-[2] bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Audit Idea
                </button>
              </div>
            </div>

            {/* Blueprint */}
            <div className="flex flex-col flex-[1.5] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-[calc(100vh-8rem)]">
              <div className="p-6 overflow-y-auto article-scroll">
                {reportText && (
                  <div className="space-y-8">
                    {finalScore && (
                      <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 flex justify-between items-center">
                        <div>
                          <h3 className="text-[10px] text-slate-500 font-bold uppercase">Commercial Score</h3>
                          <div className="text-4xl font-black text-white">{finalScore} <span className="text-sm text-slate-500">/ 100</span></div>
                        </div>
                        <div className="text-right">
                          <h3 className="text-[10px] text-slate-500 font-bold uppercase">Confidence</h3>
                          <div className={cn("text-lg font-bold", confidenceLevel === 'HIGH' ? 'text-emerald-400' : 'text-amber-400')}>{confidenceLevel}</div>
                        </div>
                      </div>
                    )}
                    <div className="markdown-body prose prose-invert prose-slate max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, { ...defaultSchema, attributes: { ...defaultSchema.attributes, '*': ['style', 'className'] } }]]}>
                        {reportText}
                      </ReactMarkdown>
                    </div>
                    <button onClick={handleSaveToMemory} className="w-full bg-cyan-600/10 border border-cyan-500/30 text-cyan-400 py-3 rounded-xl font-bold hover:bg-cyan-500/10 transition-all">
                      Save to Cloud Memory
                    </button>
                  </div>
                )}
                {!reportText && !isGenerating && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                    <FolderOpen className="h-12 w-12 opacity-20" />
                    <p className="text-sm italic">Select a project or audit a new idea.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : activeTab === 'radar' ? (
          <>
            {/* Watch Areas Sidebar */}
            <div className="hidden xl:flex flex-col w-64 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-[calc(100vh-8rem)]">
              <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
                <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Monitor Areas</h2>
                <button onClick={() => setIsAddingWatchArea(!isAddingWatchArea)} className="text-cyan-400">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {isAddingWatchArea && (
                <form onSubmit={handleCreateWatchArea} className="p-3 bg-slate-950 border-b border-slate-800 space-y-2">
                  <input 
                    type="text" 
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    placeholder="领域名称 (如: 律师合同)"
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                    required
                  />
                  <input 
                    type="text" 
                    value={newAreaKeywords}
                    onChange={(e) => setNewAreaKeywords(e.target.value)}
                    placeholder="搜索关键词 (如: contract pain)"
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                    required
                  />
                  <div className="flex gap-2 justify-end">
                    <button 
                      type="button" 
                      onClick={() => setIsAddingWatchArea(false)} 
                      className="px-2 py-1 text-[10px] text-slate-500 hover:text-white"
                    >
                      取消
                    </button>
                    <button 
                      type="submit" 
                      className="px-2 py-1 text-[10px] bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold"
                    >
                      添加
                    </button>
                  </div>
                </form>
              )}

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {watchAreas.map(w => (
                  <div 
                    key={w.id} 
                    onClick={() => setActiveWatchAreaId(w.id)} 
                    className={cn(
                      "px-3 py-2.5 rounded-lg cursor-pointer border transition-all duration-200 text-left", 
                      activeWatchAreaId === w.id ? "bg-cyan-500/10 border-cyan-500/30 text-white" : "border-transparent hover:bg-slate-800/50 text-slate-400"
                    )}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-semibold truncate">{w.name}</span>
                      <Trash2 onClick={(e) => handleDeleteWatchArea(e, w.id)} className="h-3 w-3 hover:text-rose-400" />
                    </div>
                    <div className="text-[8px] text-slate-500 truncate">{w.keywords}</div>
                  </div>
                ))}
                {watchAreas.length === 0 && (
                  <div className="text-center text-[10px] text-slate-600 mt-4 italic">点击右上角 + 添加领域</div>
                )}
              </div>
            </div>

            {/* Pain Points Feed List */}
            <div className="flex flex-col flex-1 max-w-xl bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-[calc(100vh-8rem)]">
              {activeWatchArea ? (
                <>
                  <div className="p-4 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
                    <div className="text-left">
                      <h2 className="text-xs font-bold text-white uppercase">{activeWatchArea.name}</h2>
                      <p className="text-[9px] text-slate-500 truncate mt-0.5">关键词: {activeWatchArea.keywords}</p>
                    </div>
                    <button 
                      onClick={handleTriggerScan}
                      disabled={isScanning}
                      className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                    >
                      {isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                      {isScanning ? '侦察中...' : '深度侦察'}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {pains.map(p => {
                      let badgeColor = "bg-slate-800 text-slate-400";
                      if (p.pain_score >= 75) badgeColor = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
                      else if (p.pain_score >= 50) badgeColor = "bg-amber-500/20 text-amber-400 border border-amber-500/30";

                      return (
                        <div 
                          key={p.id} 
                          onClick={() => setActivePainId(p.id)}
                          className={cn(
                            "p-3.5 rounded-xl cursor-pointer border transition-all duration-200 text-left",
                            activePainId === p.id ? "bg-slate-800/50 border-cyan-500/40" : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                          )}
                        >
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <h3 className="text-xs font-bold text-slate-200 leading-tight">{p.title}</h3>
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-black", badgeColor)}>
                              {p.pain_score}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{p.description}</p>
                          {p.raw_evidence && (
                            <div className="mt-2 text-[9px] text-slate-500 italic truncate border-t border-slate-800/60 pt-1.5">
                              原声: "{p.raw_evidence}"
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {pains.length === 0 && !isScanning && (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 py-16">
                        <Rocket className="h-10 w-10 opacity-20" />
                        <p className="text-xs italic">该监控领域尚未运行深度侦察，点击右上角启动扫描。</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
                  <Target className="h-10 w-10 opacity-20" />
                  <p className="text-xs italic">请先在左侧选择或创建一个监控领域</p>
                </div>
              )}
            </div>

            {/* Pain Details and Action Loop Panel */}
            <div className="flex flex-col flex-[1.5] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-[calc(100vh-8rem)]">
              {activePain ? (
                <div className="p-6 overflow-y-auto article-scroll flex flex-col h-full justify-between">
                  <div className="space-y-6 text-left">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                      <div>
                        <h2 className="text-sm font-black text-white">{activePain.title}</h2>
                        <span className="text-[9px] text-slate-500 uppercase">侦察痛点详情报告</span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-cyan-400">{activePain.pain_score} <span className="text-[10px] text-slate-500">/ 100</span></div>
                        <span className="text-[8px] text-slate-500 uppercase tracking-widest font-semibold">Pain Severity</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider mb-1.5">破坏的工作流与痛点背景</h3>
                        <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs text-slate-300 leading-relaxed">
                          {activePain.description}
                        </div>
                      </div>

                      {activePain.raw_evidence && (
                        <div>
                          <h3 className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider mb-1.5">真实用户吐槽原声</h3>
                          <blockquote className="p-3.5 bg-slate-950/40 border-l-2 border-amber-500 text-xs text-amber-200/90 italic rounded-r-xl leading-relaxed">
                            "{activePain.raw_evidence}"
                          </blockquote>
                          {activePain.source_url && (
                            <a 
                              href={activePain.source_url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-1 text-[9px] text-slate-500 hover:text-cyan-400 mt-1.5 transition-colors"
                            >
                              <FileText className="h-3 w-3" />
                              点击查看原始来源网页
                            </a>
                          )}
                        </div>
                      )}

                      {activePain.potential_solution && (
                        <div className="pt-2">
                          <h3 className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider mb-1.5">AI 产品/SaaS 方案切入建议</h3>
                          <div className="p-4 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-xs text-cyan-300/90 leading-relaxed shadow-inner shadow-cyan-900/10">
                            {activePain.potential_solution}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-800 mt-6">
                    <button 
                      onClick={() => handleConvertToAudit(activePain)}
                      className="w-full bg-cyan-600/10 border border-cyan-500/30 text-cyan-400 py-3.5 rounded-xl font-bold hover:bg-cyan-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Rocket className="h-4 w-4" />
                      一键转化为想法审计项目 (Convert to Project)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
                  <FolderOpen className="h-10 w-10 opacity-20" />
                  <p className="text-xs italic">请选择或等待最新的侦察痛点进行查看</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <TmsAutopilotPanel 
            tmsAudits={tmsAudits} 
            activeAuditId={activeAuditId} 
            setActiveAuditId={setActiveAuditId} 
            activeAudit={activeAudit} 
            isTmsLoading={isTmsLoading}
            onRefresh={loadTmsAudits}
            userId={session ? session.user.id : null}
          />
        )}
      </main>
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
    name: 'Scenario B: Minor Excursion (Fresh Bananas)',
    description: '模拟热带水果运输中轻微的温控偏离（暴露于15.5°C约2小时），引发温控警告。',
    logs: [
      { time: new Date(Date.now() - 3600000 * 5).toISOString(), temp: 12.0, carrierCustody: true, durationHours: 1 },
      { time: new Date(Date.now() - 3600000 * 4).toISOString(), temp: 15.5, carrierCustody: true, durationHours: 2 },
      { time: new Date(Date.now() - 3600000 * 2).toISOString(), temp: 12.5, carrierCustody: true, durationHours: 2 }
    ]
  },
  C: {
    name: 'Scenario C: Compliance Transit (No excursions)',
    description: '冷链全程符合温控标准，未发生任何超标事件。',
    logs: [
      { time: new Date(Date.now() - 3600000 * 5).toISOString(), temp: 3.5, carrierCustody: true, durationHours: 1 },
      { time: new Date(Date.now() - 3600000 * 4).toISOString(), temp: 3.8, carrierCustody: true, durationHours: 2 },
      { time: new Date(Date.now() - 3600000 * 2).toISOString(), temp: 4.0, carrierCustody: true, durationHours: 2 }
    ]
  }
};

interface TelemetryChartProps {
  tempLogs: any[];
  commodity: string;
  uncertaintyIntervals?: any[];
}

export function TelemetryChart({ tempLogs, commodity, uncertaintyIntervals }: TelemetryChartProps) {
  const displayLogs = (tempLogs || []).filter((l: any) => !l.meta);
  if (displayLogs.length === 0) {
    return <div className="text-slate-500 text-xs italic text-center py-4 bg-slate-950/40 rounded-xl border border-slate-900">暂无遥测轨迹数据</div>;
  }

  const commLower = commodity.toLowerCase();
  const isVaccine = commLower.includes('vaccine') || commLower.includes('pharm');
  const isBanana = commLower.includes('banana') || commLower.includes('fruit') || commLower.includes('produce');

  // Optimal range and boundaries
  let optimalMin = 0;
  let optimalMax = 2;
  let chartMinTemp = -2;
  let chartMaxTemp = 10;

  if (isVaccine) {
    optimalMin = 2;
    optimalMax = 8;
    chartMinTemp = -5;
    chartMaxTemp = 28;
  } else if (isBanana) {
    optimalMin = 13;
    optimalMax = 15;
    chartMinTemp = 5;
    chartMaxTemp = 20;
  } else {
    // Cherry or general
    optimalMin = 0;
    optimalMax = 2;
    chartMinTemp = -2;
    chartMaxTemp = 15;
  }

  // Adjust chart y-bounds dynamically if telemetry exceeds defaults
  const temps = displayLogs.map(l => l.temp !== undefined ? l.temp : (l.temperature || 0));
  const minSeen = Math.min(...temps);
  const maxSeen = Math.max(...temps);
  chartMinTemp = Math.min(chartMinTemp, Math.floor(minSeen - 2));
  chartMaxTemp = Math.max(chartMaxTemp, Math.ceil(maxSeen + 2));

  const width = 500;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 15;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // X coordinate mapping
  const getX = (index: number) => {
    if (displayLogs.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (displayLogs.length - 1)) * chartWidth;
  };

  // Y coordinate mapping
  const getY = (temp: number) => {
    const range = chartMaxTemp - chartMinTemp;
    if (range === 0) return paddingTop + chartHeight / 2;
    return paddingTop + chartHeight - ((temp - chartMinTemp) / range) * chartHeight;
  };

  const optYMax = getY(optimalMax);
  const optYMin = getY(optimalMin);

  // Generate temperature line path
  const linePoints = displayLogs.map((log, idx) => {
    const t = log.temp !== undefined ? log.temp : (log.temperature || 0);
    return `${getX(idx)},${getY(t)}`;
  });
  const linePath = `M ${linePoints.join(' L ')}`;

  // Generate gaps shading polygons
  const gapElements: any[] = [];
  if (uncertaintyIntervals && uncertaintyIntervals.length > 0) {
    uncertaintyIntervals.forEach((gap, gapIdx) => {
      const startIdx = displayLogs.findIndex(l => (l.time || l.timestamp) === gap.gap_start);
      const endIdx = displayLogs.findIndex(l => (l.time || l.timestamp) === gap.gap_end);
      if (startIdx !== -1 && endIdx !== -1) {
        const xStart = getX(startIdx);
        const xEnd = getX(endIdx);
        
        const yStartTemp = getY(displayLogs[startIdx].temp !== undefined ? displayLogs[startIdx].temp : displayLogs[startIdx].temperature);
        const yUpper = getY(gap.upper_bound_temp);
        const yLower = getY(gap.lower_bound_temp);

        const pointsString = `${xStart},${yStartTemp} ${xEnd},${yUpper} ${xEnd},${yLower} ${xStart},${yStartTemp}`;

        gapElements.push(
          <g key={`gap-${gapIdx}`}>
            <polygon 
              points={pointsString} 
              fill="url(#gapGrad)" 
              opacity="0.25"
            />
            <line 
              x1={xStart} y1={yStartTemp} 
              x2={xEnd} y2={yUpper} 
              stroke="#22d3ee" strokeWidth="1" strokeDasharray="2,2"
            />
            <line 
              x1={xStart} y1={yStartTemp} 
              x2={xEnd} y2={yLower} 
              stroke="#22d3ee" strokeWidth="1" strokeDasharray="2,2"
            />
            <text 
              x={(xStart + xEnd) / 2} 
              y={Math.min(yUpper, yLower) - 4} 
              fill="#22d3ee" 
              fontSize="7" 
              fontWeight="bold"
              textAnchor="middle"
              className="pointer-events-none select-none animate-pulse"
            >
              数据断流 ({gap.gap_duration_hours.toFixed(1)}h)
            </text>
          </g>
        );
      }
    });
  }

  // Draw grid lines
  const gridLines: any[] = [];
  const range = chartMaxTemp - chartMinTemp;
  const step = range > 10 ? 5 : (range > 4 ? 2 : 1);
  const startGrid = Math.ceil(chartMinTemp / step) * step;
  for (let t = startGrid; t <= chartMaxTemp; t += step) {
    const yVal = getY(t);
    gridLines.push(
      <g key={`grid-${t}`}>
        <line 
          x1={paddingLeft} y1={yVal} 
          x2={width - paddingRight} y2={yVal} 
          stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2"
          opacity="0.4"
        />
        <text 
          x={paddingLeft - 6} y={yVal + 3} 
          fill="#64748b" fontSize="7" textAnchor="end" className="font-mono"
        >
          {t}°C
        </text>
      </g>
    );
  }

  return (
    <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl flex flex-col space-y-3">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center text-[10px] font-semibold text-slate-400 gap-2">
        <span>温度波动审计曲线与物理退化包络线</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1.5 bg-emerald-500/10 border border-emerald-500/30 border-dashed rounded-sm"></span>
            安全范围 ({optimalMin}-{optimalMax}°C)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-cyan-400 rounded-sm"></span>
            遥测实测值
          </span>
          {gapElements.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-1.5 bg-cyan-400/10 border border-cyan-400/30 rounded-sm"></span>
              断流退化区间
            </span>
          )}
        </div>
      </div>
      
      <div className="relative w-full h-[180px] bg-slate-950/20 rounded-lg overflow-hidden border border-slate-900/60">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="optGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="gapGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#0891b2" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {gridLines}

          {/* Optimal range band */}
          {optYMax >= 0 && optYMin >= 0 && (
            <rect 
              x={paddingLeft} 
              y={optYMax} 
              width={chartWidth} 
              height={Math.abs(optYMin - optYMax)} 
              fill="url(#optGrad)" 
              stroke="#10b981" 
              strokeWidth="0.5" 
              strokeDasharray="3,3"
              opacity="0.6"
            />
          )}

          {/* Telemetry Gap polygons */}
          {gapElements}

          {/* Temperature Path */}
          <path 
            d={linePath} 
            fill="none" 
            stroke="url(#lineGrad)" 
            strokeWidth="2" 
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Individual points */}
          {displayLogs.map((log, idx) => {
            const t = log.temp !== undefined ? log.temp : (log.temperature || 0);
            const x = getX(idx);
            const y = getY(t);
            const isExcur = t < optimalMin || t > optimalMax;

            return (
              <g key={`pt-${idx}`} className="group">
                <circle 
                  cx={x} cy={y} 
                  r={isExcur ? "4" : "3"} 
                  fill={isExcur ? "#ef4444" : "#06b6d4"} 
                  stroke={isExcur ? "#fee2e2" : "#ecfeff"} 
                  strokeWidth="1" 
                  className="transition-all duration-150 group-hover:r-5 cursor-pointer"
                />
                {isExcur && (
                  <circle 
                    cx={x} cy={y} 
                    r="7" 
                    fill="none" 
                    stroke="#ef4444" 
                    strokeWidth="0.5" 
                    className="animate-ping"
                  />
                )}
                <title>
                  时间: {new Date(log.time || log.timestamp).toLocaleString([], {hour: '2-digit', minute:'2-digit'})}
                  {"\n"}温度: {t}°C {isExcur ? '⚠️ 温度超标' : '✅ 正常'}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
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
  activeAudit: any | null, 
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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  };

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
          
          const commLower = (parsed.commodity || '').toLowerCase();
          if (commLower.includes('vaccine') || commLower.includes('pharm') || commLower.includes('med')) {
            setSelectedScenario('A');
          } else if (commLower.includes('banana') || commLower.includes('fruit') || commLower.includes('produce')) {
            setSelectedScenario('B');
          } else {
            setSelectedScenario('C');
          }
        } catch (err) {
          console.error("API parse failed, loading realistic fallback data", err);
          setFormShipmentId("SH-2026-" + Math.floor(Math.random() * 9000 + 1000));
          setFormCarrier("COSCO Shipping Lines");
          setFormShipper("Sinopharm Biotech Ltd");
          setFormCommodity("Refrigerated Medical Therapeutics (mRNA Vaccines)");
          setFormWeightKg(180);
          setFormCargoValUsd(95000);
          setFormLimitationClause("Montreal Convention Article 22 limit of 22 SDR per kilogram applies.");
          setFormExemptions("Act of God, strikes, shipper's package defect.");
          setFormJurisdiction("Shanghai Maritime Court");
          setSelectedScenario('A');
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
    if (!formShipmentId || !formCarrier || !formCommodity || !formWeightKg || !formCargoValUsd) {
      alert('请填齐运单必填信息');
      return;
    }

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
        setFormShipmentId('');
        setFormCarrier('');
        setFormShipper('');
        setFormCommodity('');
        setFormWeightKg(180);
        setFormCargoValUsd(95000);
        setFormPackageCount(1);
        setFormLimitationClause('');
        setFormExemptions('');
        setFormJurisdiction('');
      } else {
        const errData = await res.json();
        alert('提交失败: ' + (errData.error || '未知错误'));
      }
    } catch (err) {
      console.error(err);
      alert('网络连接错误');
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
          tempLogs: [
            { time: new Date(Date.now() - 3600000 * 5).toISOString(), temp: 3.8, carrierCustody: true, durationHours: 1 },
            { time: new Date(Date.now() - 3600000 * 4).toISOString(), temp: 18.2, carrierCustody: true, durationHours: 2 },
            { time: new Date(Date.now() - 3600000 * 2).toISOString(), temp: 4.1, carrierCustody: true, durationHours: 2 }
          ]
        })
      });
      if (res.ok) {
        alert('模拟运单 Webhook 已发送成功！正在刷新列表...');
        onRefresh();
      } else {
        const err = await res.json();
        alert('模拟失败：' + (err.error || '未知错误'));
      }
    } catch (e: any) {
      alert('网络请求失败：' + e.message);
    } finally {
      setIsTmsLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row flex-1 gap-6 w-full h-[calc(100vh-8rem)] relative">
      <div className="flex flex-col w-full lg:w-80 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-full">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center text-left">
          <div>
            <h2 className="text-xs uppercase tracking-wider text-slate-400 font-bold">TMS Order Webhooks</h2>
            <p className="text-[9px] text-slate-500">Autopilot Cargo Claim Auditor</p>
          </div>
          <div className="flex gap-1.5">
            <button 
              onClick={() => setIsAddingShipment(true)} 
              className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[10px] font-bold"
              title="智能合同解析与定责"
            >
              上传合同
            </button>
            <button 
              onClick={handleSimulate} 
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[10px] font-bold"
              title="模拟新订单Webhook"
            >
              模拟
            </button>
            <button 
              onClick={onRefresh} 
              disabled={isTmsLoading}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded flex items-center justify-center"
            >
              {isTmsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {tmsAudits.map(audit => {
            const isSelected = activeAuditId === audit.id;
            let statusColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
            if (audit.claimStatus === 'WARNING') statusColor = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
            else if (audit.claimStatus === 'CLAIM_PENDING') statusColor = "bg-rose-500/10 text-rose-400 border border-rose-500/20";

            return (
              <div 
                key={audit.id} 
                onClick={() => setActiveAuditId(audit.id)}
                className={cn(
                  "p-3 rounded-lg cursor-pointer border transition-all duration-200 text-left",
                  isSelected ? "bg-cyan-500/10 border-cyan-500/40 text-white" : "border-slate-800 hover:bg-slate-800/50 text-slate-400"
                )}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-slate-200">{audit.shipmentId}</span>
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-black", statusColor)}>
                    {audit.claimStatus}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">{audit.commodity}</div>
                <div className="text-[9px] text-slate-600 mt-1 flex justify-between items-center">
                  <span>Carrier: {audit.carrier}</span>
                  <span className="font-bold text-cyan-400">Score: {audit.liabilityScore}</span>
                </div>
              </div>
            );
          })}

          {tmsAudits.length === 0 && !isTmsLoading && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 py-16">
              <Rocket className="h-10 w-10 opacity-20 animate-bounce" />
              <p className="text-xs italic">尚未监听到 TMS orders Webhook。点击“模拟”或运行 simulator 脚本触发。</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-full flex flex-col">
        {activeAudit ? (
          <div className="flex-1 flex flex-col overflow-hidden h-full">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="text-left">
                <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold uppercase">Shipment Audit File</span>
                <h2 className="text-base font-bold text-white mt-1">{activeAudit.shipmentId}</h2>
                <p className="text-[10px] text-slate-500 mt-0.5">载体: {activeAudit.carrier} | 货物: {activeAudit.commodity} ({activeAudit.weightKg} kg)</p>
              </div>

              <div className="flex space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button 
                  onClick={() => setActiveSubTab('details')}
                  className={cn("px-3 py-1 text-xs rounded-md transition-all", activeSubTab === 'details' ? "bg-cyan-600 text-white font-bold" : "text-slate-500 hover:text-slate-300")}
                >
                  温度与定责细节
                </button>
                <button 
                  onClick={() => setActiveSubTab('claim')}
                  className={cn("px-3 py-1 text-xs rounded-md transition-all", activeSubTab === 'claim' ? "bg-cyan-600 text-white font-bold" : "text-slate-500 hover:text-slate-300")}
                >
                  AI 索赔文书
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 article-scroll text-left">
              {activeSubTab === 'details' ? (
                (() => {
                  const logs = activeAudit.tempLogs || activeAudit.temp_logs || [];
                  const contractMeta = logs.find((l: any) => l.meta);
                  const hasContractMeta = !!contractMeta;
                  const displayLogs = logs.filter((l: any) => !l.meta);

                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
                          <span className="text-[8px] text-slate-500 uppercase font-black font-semibold">定责得分 (Liability Score)</span>
                          <div className="text-3xl font-black text-cyan-400 mt-1">{activeAudit.liabilityScore} <span className="text-xs text-slate-600">/ 100</span></div>
                          <p className="text-[9px] text-slate-500 mt-1">分数越高，承运人理赔责任越明确</p>
                        </div>

                        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
                          <span className="text-[8px] text-slate-500 uppercase font-black font-semibold">生物退化率 (Arrhenius Rate)</span>
                          <div className="text-3xl font-black text-amber-400 mt-1">{activeAudit.degradationRate}%</div>
                          <p className="text-[9px] text-slate-500 mt-1">计算自 IoT 历史轨迹活性流失</p>
                        </div>

                        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
                          <span className="text-[8px] text-slate-500 uppercase font-black font-semibold">承运人赔偿上限</span>
                          <div className="text-xl font-bold text-rose-400 mt-2">${activeAudit.limitValUsd.toLocaleString()}</div>
                          <p className="text-[9px] text-slate-500 mt-1">根据蒙特利尔公约 (SDR 22/kg) 测算</p>
                        </div>

                        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
                          <span className="text-[8px] text-slate-500 uppercase font-black font-semibold">估计货损 / 货值</span>
                          <div className="text-xl font-bold text-slate-200 mt-2">${activeAudit.estimatedLossUsd.toLocaleString()} <span className="text-xs text-slate-500">/ ${activeAudit.cargoValUsd.toLocaleString()}</span></div>
                          <p className="text-[9px] text-slate-500 mt-1">物理损失与申报价值配比</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider">Arrhenius 生物退化动力学评估</h3>
                        <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl">
                          <p className="text-xs text-slate-300 leading-relaxed">
                            ChainGuard AI 根据阿伦尼乌斯公式（Arrhenius Equation）对该货物的热力学和生物动力学降解率进行了建模：
                            <code className="block my-2 text-cyan-300 bg-slate-950 p-2 rounded text-[11px] text-center font-mono">
                              k = A * e^(-Ea / (R * T))
                            </code>
                            测定该批次货物 {activeAudit.commodity} 在最高温度达到 <span className="text-amber-400 font-bold">{activeAudit.maxTempSeen}°C</span>，且累计处于温差异常区达 <span className="text-amber-400 font-bold">{activeAudit.excursionDurationHours} 小时</span> 的情况下，发生了 <span className="text-rose-400 font-bold">{activeAudit.degradationRate}%</span> 的活性衰退/生物质变。该结论已达到理赔起诉的安全边界值。
                          </p>
                        </div>
                        
                        {/* Newtonian Telemetry Chart */}
                        <TelemetryChart 
                          tempLogs={logs} 
                          commodity={activeAudit.commodity}
                          uncertaintyIntervals={activeAudit.uncertaintyIntervals}
                        />
                      </div>

                      {hasContractMeta && (
                        <div className="space-y-2">
                          <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider">运输合同与法律条款分析 (Contract-RAG)</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl">
                              <span className="text-[8px] text-slate-500 uppercase font-black font-semibold">责任限制条款 (Limitation Clause)</span>
                              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{contractMeta.limitationClause || '未在合同中明示'}</p>
                            </div>
                            <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl">
                              <span className="text-[8px] text-slate-500 uppercase font-black font-semibold">承运人免责声明 (Exemption Terms)</span>
                              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{contractMeta.exemptions || '无特别免责规定'}</p>
                            </div>
                            <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl">
                              <span className="text-[8px] text-slate-500 uppercase font-black font-semibold">法律争议管辖 (Jurisdiction)</span>
                              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{contractMeta.jurisdiction || '常规公约法院'}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider">IoT 轨迹温度与托管状态审计 Timeline</h3>
                        <div className="bg-slate-950/30 border border-slate-800/60 rounded-xl divide-y divide-slate-800/50 overflow-hidden">
                          {displayLogs.map((log: any, idx: number) => {
                            const isExcursion = log.temp > (activeAudit.commodity.toLowerCase().includes('vaccine') ? 4 : 13);
                            return (
                              <div key={idx} className="p-3 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-3">
                                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                                  <span className="text-slate-400">{new Date(log.time).toLocaleTimeString()}</span>
                                  <span className={cn("px-2 py-0.5 rounded text-[10px]", log.carrierCustody ? "bg-cyan-500/10 text-cyan-400" : "bg-slate-800 text-slate-500")}>
                                    {log.carrierCustody ? "承运人托管中" : "货主仓储期"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className={cn("font-bold", isExcursion ? "text-rose-400" : "text-slate-300")}>
                                    {log.temp}°C
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-semibold">
                                    {isExcursion ? "⚠️ 温度超标" : "正常"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider">符合《蒙特利尔公约》与海事理赔要求的索赔文书</h3>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generateClaimLetter(activeAudit));
                        alert('索赔文书已复制到剪贴板！');
                      }}
                      className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold"
                    >
                      复制全文
                    </button>
                  </div>
                  <pre className="bg-slate-950 border border-slate-800 p-5 rounded-xl text-xs text-slate-300 font-mono overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap text-left leading-relaxed">
                    {generateClaimLetter(activeAudit)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 py-32">
            <FolderOpen className="h-10 w-10 opacity-20" />
            <p className="text-xs italic">请在左侧选择一笔已审计的货单查看细节</p>
          </div>
        )}
      </div>

      {isAddingShipment && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col custom-scrollbar">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <div className="text-left">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">智能合同解析与理赔审计 (Contract-RAG Auditor)</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">上传海运提单/运输合同 PDF/图片，自动提取关键参数并加载冷链传感器轨迹</p>
              </div>
              <button 
                onClick={() => setIsAddingShipment(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 text-left">
              <div 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-all flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden",
                  dragActive ? "border-cyan-500 bg-cyan-950/10" : "border-slate-800 bg-slate-950/30 hover:border-slate-700 hover:bg-slate-950/40"
                )}
                onClick={() => document.getElementById('file-upload-input')?.click()}
              >
                <input 
                  id="file-upload-input"
                  type="file" 
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden" 
                  onChange={handleFileInputChange}
                />
                
                {isParsing ? (
                  <div className="flex flex-col items-center space-y-3 py-4">
                    <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
                    <p className="text-xs text-cyan-400 font-bold animate-pulse">Gemini 3.5 Flash 正在理解运输合同并提取法理条款...</p>
                    <p className="text-[10px] text-slate-500">正在分析提单格式、承运人限制及免责定义</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-3 py-2">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg group-hover:border-cyan-500/50 transition-colors">
                      <Upload className="h-6 w-6 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-300 font-bold"><span className="text-cyan-400 hover:underline">点击上传</span> 或拖拽运输合同/提单文件到此处</p>
                      <p className="text-[10px] text-slate-500 mt-1">支持 PDF、PNG、JPG 格式文件 (免 OCR 识别)</p>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmitAudit} className="space-y-4">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 pb-1.5 flex items-center justify-between">
                  <span>合同参数审计核对 (Extracted Details)</span>
                  {formCarrier && (
                    <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-black">
                      ✓ Gemini 提取成功
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">运单标识 (Shipment ID) *</label>
                    <input 
                      type="text"
                      required
                      value={formShipmentId}
                      onChange={(e) => setFormShipmentId(e.target.value)}
                      placeholder="例如: SH-2026-COSC-9923"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">承运人 (Carrier) *</label>
                    <input 
                      type="text"
                      required
                      value={formCarrier}
                      onChange={(e) => setFormCarrier(e.target.value)}
                      placeholder="例如: COSCO Shipping Lines"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">发货人/货主 (Shipper)</label>
                    <input 
                      type="text"
                      value={formShipper}
                      onChange={(e) => setFormShipper(e.target.value)}
                      placeholder="例如: Sinopharm Biotech Ltd"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">货物商品 (Commodity) *</label>
                    <input 
                      type="text"
                      required
                      value={formCommodity}
                      onChange={(e) => setFormCommodity(e.target.value)}
                      placeholder="例如: mRNA Vaccines"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">货物毛重 (Gross Weight kg) *</label>
                    <input 
                      type="number"
                      required
                      value={formWeightKg || ''}
                      onChange={(e) => setFormWeightKg(Number(e.target.value))}
                      placeholder="例如: 180"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">申报货值 (Declared Value USD) *</label>
                    <input 
                      type="number"
                      required
                      value={formCargoValUsd || ''}
                      onChange={(e) => setFormCargoValUsd(Number(e.target.value))}
                      placeholder="例如: 95000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">包裹件数 (Package Count)</label>
                    <input 
                      type="number"
                      value={formPackageCount || ''}
                      onChange={(e) => setFormPackageCount(Number(e.target.value))}
                      placeholder="例如: 1"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">责任限制条款 (Limitation Clause)</label>
                    <textarea 
                      value={formLimitationClause}
                      onChange={(e) => setFormLimitationClause(e.target.value)}
                      placeholder="例如: Montreal Convention Article 22 limit of 22 SDR per kilogram applies."
                      rows={2}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">免责条款定义 (Exemption Terms)</label>
                      <input 
                        type="text"
                        value={formExemptions}
                        onChange={(e) => setFormExemptions(e.target.value)}
                        placeholder="例如: Act of God, strike, shipper's fault"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">司法管辖权 (Jurisdiction)</label>
                      <input 
                        type="text"
                        value={formJurisdiction}
                        onChange={(e) => setFormJurisdiction(e.target.value)}
                        placeholder="例如: Shanghai Maritime Court"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">选择模拟 IoT 传感器温度轨迹 (Simulated Excursion Profiles)</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(SCENARIOS).map(([key, sc]) => (
                      <div 
                        key={key}
                        onClick={() => setSelectedScenario(key as 'A' | 'B' | 'C')}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer transition-all text-left",
                          selectedScenario === key 
                            ? "bg-cyan-500/10 border-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.15)]" 
                            : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-400"
                        )}
                      >
                        <div className="text-xs font-bold text-slate-200">{sc.name.split(':')[0]}</div>
                        <p className="text-[9px] text-slate-500 mt-1 leading-snug">{sc.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsAddingShipment(false)}
                    className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-bold transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-colors shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                  >
                    启动物理定责与入库
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function generateClaimLetter(audit: any): string {
  const montrealLimitPerKg = 22 * 1.31;
  const dateStr = new Date(audit.created_at).toLocaleDateString('en-US');
  
  return `FORMAL NOTICE OF CARGO LIABILITY CLAIM

Date: ${dateStr}

To: Claims Department, ${audit.carrier}
From: Claims Operations Team (Authorized on behalf of shipper)
Re: Cargo damage liability claim for Shipment ${audit.shipmentId}

Dear Sir/Madam,

This serves as a formal notice of cargo liability claim regarding temperature abuse and physical cargo degradation occurred during transit of the shipment detailed below under your carrier custody:

1. SHIPMENT SUMMARY
   - Shipment ID: ${audit.shipmentId}
   - Commodity: ${audit.commodity}
   - Total Gross Weight: ${audit.weightKg} kg
   - Declared Cargo Value: $${audit.cargoValUsd.toLocaleString()} USD

2. PHYSICAL DAMAGE EVIDENCE (ARRHENIUS DYNAMICS ANALYSIS)
   Using the integrated ChainGuard AI Arrhenius biophysics degradation engine, the raw temperature data telemetry extracted from the reefer container logs has been audited. The cargo experienced a maximum temperature of ${audit.maxTempSeen}°C, remaining in the critical heat excursion threshold for a total of ${audit.excursionDurationHours} hours.
   Based on the activation energy parameters of ${audit.commodity}, the biological degradation/life-loss rate of the cargo reached ${audit.degradationRate}%. As a direct biological result, the cargo has been deemed unmarketable and represents a total loss.
   - Estimated Cargo Loss: $${audit.estimatedLossUsd.toLocaleString()} USD

3. CARRIER LIABILITY & CONVENTION LAW APPLICABILITY
   Telemetry timeline analysis confirms that the critical temperature excursion occurred while the cargo was under your carrier's direct custody (carrier custody flag active in telemetry history).
   According to Article 18 of the Montreal Convention (Convention for the Unification of Certain Rules for International Carriage by Air) or relevant maritime transport contracts:
   - The carrier is liable for damage sustained in the event of the destruction or loss of, or damage to, cargo.
   - Under the Montreal Convention rules, the carrier's liability limit is capped at 22 SDR per kilogram (approximately $${Math.round(montrealLimitPerKg * 100)/100} USD/kg).
   - Maximum legal carrier liability limit: $${audit.limitValUsd.toLocaleString()} USD (${audit.weightKg} kg * 22 SDR/kg)

4. CLAIM DEMAND SUMMARY
   - Estimated Cargo Damage Value: $${audit.estimatedLossUsd.toLocaleString()} USD
   - Applicable Legal Liability Limit: $${audit.limitValUsd.toLocaleString()} USD
   - Demanded Recovery Amount: $${audit.liableClaimUsd.toLocaleString()} USD

We expect you to acknowledge the receipt of this claim within 7 business days and proceed with immediate settlement. A complete breakdown of the temperature sensors time-series log and Arrhenius biophysics calibration chart can be provided upon request.

Sincerely,

ChainGuard AI Digital Claims Officer
(On behalf of the Cargo Owner)
`;
}

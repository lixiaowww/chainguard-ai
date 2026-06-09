
/**
 * ProjectService.ts
 * 管理 ChainGuard AI 中的审计项目生命周期、状态机和历史版本。
 * SaaS 版：使用 Supabase 进行云端持久化。
 */
import { supabase } from './supabase';

export type ProjectStatus = 'Draft' | 'Validating' | 'Pursue' | 'Test' | 'Pivot' | 'Drop';

export interface ProjectVersion {
  id: string;
  project_id: string;
  created_at: string;
  score: number;
  confidence: string;
  report: string;
  verdict: string;
  dimensions: any;
  rat?: any;
  launch_kit?: any;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  github_url?: string;
  competitors?: string;
  focus_hint?: string;
  tags: any;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  versions?: ProjectVersion[];
}

export class ProjectService {
  static async getProjects(): Promise<Project[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('projects')
      .select('*, versions(*)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Fetch projects error:', error);
      return [];
    }

    return data || [];
  }

  static async createProject(name: string, data: Partial<Project>): Promise<Project | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: name || '未命名想法',
        github_url: data.github_url || '',
        competitors: data.competitors || '',
        focus_hint: data.focus_hint || '',
        tags: data.tags || { opportunity: [], audience: [], signal: [], teamSize: [] },
        status: 'Draft'
      })
      .select()
      .single();

    if (error) {
      console.error('Create project error:', error);
      return null;
    }

    return newProject;
  }

  static async addVersion(projectId: string, versionData: any) {
    const { data: newVersion, error } = await supabase
      .from('versions')
      .insert({
        project_id: projectId,
        ...versionData
      })
      .select()
      .single();

    if (error) {
      console.error('Add version error:', error);
      return null;
    }

    // 更新项目状态
    const v = versionData.verdict.toUpperCase();
    let status: ProjectStatus = 'Validating';
    if (v.includes('PURSUE')) status = 'Pursue';
    else if (v.includes('TEST')) status = 'Test';
    else if (v.includes('PIVOT')) status = 'Pivot';
    else if (v.includes('DROP')) status = 'Drop';

    await supabase
      .from('projects')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', projectId);

    return newVersion;
  }

  static async deleteProject(projectId: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);
    
    if (error) console.error('Delete project error:', error);
  }

  static async updateVersion(projectId: string, versionId: string, updates: any) {
    const { data: updatedVersion, error } = await supabase
      .from('versions')
      .update(updates)
      .eq('id', versionId)
      .select()
      .single();

    if (error) {
      console.error('Update version error:', error);
      return null;
    }

    return updatedVersion;
  }
}

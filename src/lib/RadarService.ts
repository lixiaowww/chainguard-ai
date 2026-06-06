import { supabase } from './supabase';

export interface WatchArea {
  id: string;
  user_id: string;
  name: string;
  keywords: string;
  tags: {
    opportunity?: string[];
    audience?: string[];
    signal?: string[];
    teamSize?: string[];
  };
  last_scanned_at?: string;
  created_at: string;
}

export interface DiscoveredPain {
  id: string;
  watch_area_id: string;
  title: string;
  description: string;
  source_url?: string;
  raw_evidence?: string;
  pain_score: number;
  potential_solution?: string;
  created_at: string;
}

export class RadarService {
  static async getWatchAreas(): Promise<WatchArea[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('watch_areas')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch watch areas error:', error);
      return [];
    }

    return data || [];
  }

  static async createWatchArea(name: string, keywords: string, tags: WatchArea['tags']): Promise<WatchArea | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('watch_areas')
      .insert({
        user_id: user.id,
        name: name || '未命名监控领域',
        keywords: keywords || '',
        tags: tags || { opportunity: [], audience: [], signal: [], teamSize: [] }
      })
      .select()
      .single();

    if (error) {
      console.error('Create watch area error:', error);
      return null;
    }

    return data;
  }

  static async deleteWatchArea(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('watch_areas')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete watch area error:', error);
      return false;
    }
    return true;
  }

  static async getPains(watchAreaId: string): Promise<DiscoveredPain[]> {
    const { data, error } = await supabase
      .from('discovered_pains')
      .select('*')
      .eq('watch_area_id', watchAreaId)
      .order('pain_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch discovered pains error:', error);
      return [];
    }

    return data || [];
  }

  static async triggerScan(watchAreaId: string, keywords: string, tags: WatchArea['tags']): Promise<DiscoveredPain[]> {
    const response = await fetch('/api/radar/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watchAreaId,
        keywords,
        tags
      }),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Radar scan failed');
    }

    const resultPains = await response.json();
    if (Array.isArray(resultPains) && resultPains.length > 0) {
      // 1. 删除当前监控区旧的扫描数据，确保每次扫描仅保留最新侦察结果
      await supabase
        .from('discovered_pains')
        .delete()
        .eq('watch_area_id', watchAreaId);

      // 2. 批量写入新的扫描数据
      const rowsToInsert = resultPains.map(pain => ({
        watch_area_id: watchAreaId,
        title: pain.title,
        description: pain.description,
        source_url: pain.source_url || '',
        raw_evidence: pain.raw_evidence || '',
        pain_score: pain.pain_score || 0,
        potential_solution: pain.potential_solution || ''
      }));

      const { error: insertError } = await supabase
        .from('discovered_pains')
        .insert(rowsToInsert);

      if (insertError) {
        console.error('Insert discovered pains error:', insertError);
      }

      // 3. 更新监控区的最后扫描时间
      await supabase
        .from('watch_areas')
        .update({ last_scanned_at: new Date().toISOString() })
        .eq('id', watchAreaId);
    }

    // 扫描成功并入库后，重新获取该监控领域下的所有痛点数据
    return this.getPains(watchAreaId);
  }
}

/**
 * TmsService.ts
 * 管理 TMS Autopilot 理赔托管模块的运单自动审计结果及数据。
 * SaaS 版：使用 Supabase 进行云端持久化。
 */
import { supabase } from './supabase';

export interface TmsShipment {
  id?: string;
  user_id?: string;
  shipment_id: string;
  carrier: string;
  commodity: string;
  weight_kg: number;
  cargo_val_usd: number;
  limit_val_usd: number;
  degradation_rate: number;
  excursion_duration_hours: number;
  max_temp_seen: number;
  excursion_in_custody: boolean;
  estimated_loss_usd: number;
  liable_claim_usd: number;
  liability_score: number;
  claim_status: 'CLEAR' | 'WARNING' | 'CLAIM_PENDING';
  temp_logs: any;
  created_at?: string;
}

export class TmsService {
  /**
   * 获取当前登录用户的所有已审计运单
   */
  static async getShipments(): Promise<TmsShipment[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('tms_shipments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch TMS shipments error:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 模拟往 Supabase 插入一笔新的运单数据（通常由 Webhook 或前端测试触发）
   */
  static async createShipment(shipment: TmsShipment): Promise<TmsShipment | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('tms_shipments')
      .insert({
        user_id: user.id,
        ...shipment
      })
      .select()
      .single();

    if (error) {
      console.error('Create TMS shipment error:', error);
      return null;
    }

    return data;
  }
}

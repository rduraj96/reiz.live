import type { SupabaseClient } from "@supabase/supabase-js";
import type { Station } from "@/lib/radio/types";

const TABLE = "saved_stations";

export async function listSaved(sb: SupabaseClient): Promise<Station[]> {
  const { data, error } = await sb.from(TABLE).select("station").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: { station: Station }) => row.station);
}

export async function saveStation(sb: SupabaseClient, userId: string, s: Station): Promise<void> {
  const { error } = await sb
    .from(TABLE)
    .upsert({ user_id: userId, station_id: s.id, station: s }, { onConflict: "user_id,station_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function unsaveStation(sb: SupabaseClient, userId: string, id: string): Promise<void> {
  const { error } = await sb.from(TABLE).delete().eq("user_id", userId).eq("station_id", id);
  if (error) throw error;
}

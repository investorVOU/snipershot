import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export interface UserProfile {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function upsertProfile(userId: string, fields: Partial<Omit<UserProfile, 'user_id'>>) {
  await supabase.from('profiles').upsert({ user_id: userId, ...fields }, { onConflict: 'user_id' });
}

export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  // Request permission
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const ext = asset.uri.split('.').pop() ?? 'jpg';
  const path = `avatars/${userId}.${ext}`;

  // Read file as blob
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const { error } = await supabase.storage
    .from('profiles')
    .upload(path, arrayBuffer, {
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: true,
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('profiles').getPublicUrl(path);
  const publicUrl = data.publicUrl + `?t=${Date.now()}`; // cache-bust

  await upsertProfile(userId, { avatar_url: publicUrl });
  return publicUrl;
}

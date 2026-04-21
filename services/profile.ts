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
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true, // get base64 directly — avoids FileSystem.EncodingType issues
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  if (!asset.base64) throw new Error('Could not read image data');

  const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase().replace(/\?.*$/, '');
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  const path = `avatars/${userId}.${ext}`;

  const buffer = Buffer.from(asset.base64, 'base64');

  const { error } = await supabase.storage
    .from('profiles')
    .upload(path, buffer, { contentType: mime, upsert: true });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('profiles').getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

  await upsertProfile(userId, { avatar_url: publicUrl });
  return publicUrl;
}

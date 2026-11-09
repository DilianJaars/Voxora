export type Voice = {
  id: string;           // internal id
  name: string;
  edge: string;         // Edge TTS voice short name
  gender: 'Male' | 'Female';
  accent: 'US' | 'UK' | 'AU' | 'ZA';
  style: string;        // short description shown in picker
  free: boolean;
  rate?: string;        // baseline prosody tweaks to give each voice character
  pitch?: string;
};

export const VOICES: Voice[] = [
  // ---- 5 free voices (US / UK / ZA, male + female) ----
  { id: 'jenny', name: 'Jenny', edge: 'en-US-JennyNeural', gender: 'Female', accent: 'US', style: 'Warm, friendly narrator', free: true },
  { id: 'guy', name: 'Guy', edge: 'en-US-GuyNeural', gender: 'Male', accent: 'US', style: 'Clear, steady storyteller', free: true },
  { id: 'sonia', name: 'Sonia', edge: 'en-GB-SoniaNeural', gender: 'Female', accent: 'UK', style: 'Calm British narrator', free: true, rate: '-3%' },
  { id: 'ryan', name: 'Ryan', edge: 'en-GB-RyanNeural', gender: 'Male', accent: 'UK', style: 'Confident British voice', free: true },
  { id: 'leah', name: 'Leah', edge: 'en-ZA-LeahNeural', gender: 'Female', accent: 'ZA', style: 'Friendly South African', free: true },

  // ---- Premium voices ----
  { id: 'luke', name: 'Luke', edge: 'en-ZA-LukeNeural', gender: 'Male', accent: 'ZA', style: 'Relaxed South African', free: false },
  { id: 'aria', name: 'Aria', edge: 'en-US-AriaNeural', gender: 'Female', accent: 'US', style: 'Expressive, energetic storyteller', free: false, rate: '+4%', pitch: '+2Hz' },
  { id: 'andrew', name: 'Andrew', edge: 'en-US-AndrewNeural', gender: 'Male', accent: 'US', style: 'Warm, conversational', free: false },
  { id: 'emma', name: 'Emma', edge: 'en-US-EmmaNeural', gender: 'Female', accent: 'US', style: 'Soft, gentle female voice', free: false, rate: '-4%', pitch: '-1Hz' },
  { id: 'brian', name: 'Brian', edge: 'en-US-BrianNeural', gender: 'Male', accent: 'US', style: 'Deep podcast voice', free: false, rate: '-3%', pitch: '-6Hz' },
  { id: 'ava', name: 'Ava', edge: 'en-US-AvaNeural', gender: 'Female', accent: 'US', style: 'Natural, expressive', free: false },
  { id: 'christopher', name: 'Christopher', edge: 'en-US-ChristopherNeural', gender: 'Male', accent: 'US', style: 'Authoritative documentary', free: false, rate: '-2%' },
  { id: 'michelle', name: 'Michelle', edge: 'en-US-MichelleNeural', gender: 'Female', accent: 'US', style: 'Bright and upbeat', free: false },
  { id: 'roger', name: 'Roger', edge: 'en-US-RogerNeural', gender: 'Male', accent: 'US', style: 'Calm narrator', free: false, rate: '-5%' },
  { id: 'libby', name: 'Libby', edge: 'en-GB-LibbyNeural', gender: 'Female', accent: 'UK', style: 'Gentle British storyteller', free: false },
  { id: 'maisie', name: 'Maisie', edge: 'en-GB-MaisieNeural', gender: 'Female', accent: 'UK', style: 'Young, cheerful British', free: false },
  { id: 'thomas', name: 'Thomas', edge: 'en-GB-ThomasNeural', gender: 'Male', accent: 'UK', style: 'Smooth British narrator', free: false },
  { id: 'natasha', name: 'Natasha', edge: 'en-AU-NatashaNeural', gender: 'Female', accent: 'AU', style: 'Clear Australian narrator', free: false },
  { id: 'william', name: 'William', edge: 'en-AU-WilliamNeural', gender: 'Male', accent: 'AU', style: 'Deep Australian voice', free: false, pitch: '-3Hz' },
  { id: 'annette', name: 'Annette', edge: 'en-AU-AnnetteNeural', gender: 'Female', accent: 'AU', style: 'Soft Australian voice', free: false },
  { id: 'darren', name: 'Darren', edge: 'en-AU-DarrenNeural', gender: 'Male', accent: 'AU', style: 'Energetic Australian storyteller', free: false, rate: '+4%' },
  { id: 'eric', name: 'Eric', edge: 'en-US-EricNeural', gender: 'Male', accent: 'US', style: 'Smooth radio host', free: false },
  { id: 'steffan', name: 'Steffan', edge: 'en-US-SteffanNeural', gender: 'Male', accent: 'US', style: 'Rich, mature narrator', free: false, pitch: '-2Hz' },
];

export const DEFAULT_VOICE = 'jenny';
export const FREE_VOICE_IDS = VOICES.filter((v) => v.free).map((v) => v.id);
export const getVoice = (id: string) => VOICES.find((v) => v.id === id);

// Voices used when reading translated text
export const LANGUAGES: Record<string, { label: string; edge: string }> = {
  es: { label: 'Spanish', edge: 'es-ES-ElviraNeural' },
  fr: { label: 'French', edge: 'fr-FR-DeniseNeural' },
  de: { label: 'German', edge: 'de-DE-KatjaNeural' },
  pt: { label: 'Portuguese', edge: 'pt-BR-FranciscaNeural' },
  af: { label: 'Afrikaans', edge: 'af-ZA-AdriNeural' },
  zu: { label: 'Zulu', edge: 'zu-ZA-ThandoNeural' },
  it: { label: 'Italian', edge: 'it-IT-ElsaNeural' },
};

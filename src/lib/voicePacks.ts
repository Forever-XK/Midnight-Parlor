/** The Taiwan pack uses different names for the same game events. Chat clips
 * have unrelated text, so they deliberately retain the existing spoken text. */
export function taiwanVoiceName(name: string): string | null {
  const key = name.toLowerCase();
  if (/^voice\d+$/.test(key)) return null;
  if (/^sange\d+$/.test(key)) return key.replace('sange', 'tuple');
  if (/^yapai[123]$/.test(key)) return key.replace('yapai', 'dani');
  return ({ bujiao: 'scorenoorder', buqiang: 'scorenoorder',
    jiaodizhu: 'scoreorder1', qiangdizhu1: 'scoreorder2', qiangdizhu2: 'scoreorder3',
  } as Record<string, string>)[key] ?? key;
}

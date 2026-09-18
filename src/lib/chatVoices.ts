// 局内快捷语音：Sound/Man|Woman/voice{N}.wav 对应的文本内容（源自 voices.txt）
export interface ChatVoice {
  index: number;   // 语音编号（voice{index}.wav）
  text: string;    // 语音内容
}

export const CHAT_VOICES: ChatVoice[] = [
  { index: 1, text: '不要吵了，专心玩游戏吧' },
  { index: 2, text: '不要走，决战到天亮' },
  { index: 3, text: '大家好，很高兴见到各位' },
  { index: 4, text: '真是不好意思，我得离开一会儿' },
  { index: 5, text: '和你合作真是太愉快了' },
  { index: 6, text: '快点啊，等的我花都谢了' },
  { index: 7, text: '你的牌打的也太好了' },
  { index: 8, text: '你是MM还是GG' },
  { index: 9, text: '交个朋友吧，能告诉我你的联系方式吗' },
  { index: 10, text: '下次再玩吧，我要走了' },
  { index: 11, text: '再见了，我会想念大家的' },
  { index: 12, text: '怎么又断线了，网络怎么这么差呀' },
];

export function chatVoiceText(index: number): string {
  return CHAT_VOICES.find((v) => v.index === index)?.text ?? '';
}

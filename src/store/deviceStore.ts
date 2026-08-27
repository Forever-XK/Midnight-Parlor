// 设备/视口状态 —— 竖屏手机旋转适配
import { create } from 'zustand';

interface DeviceState {
  /** 触屏设备（pointer: coarse） */
  coarse: boolean;
  /** 竖屏手机 → 页面整体旋转 90° 横置展示（平板/PC 不旋转） */
  rotated: boolean;
  /** 逻辑可用宽度（旋转后 = 物理视口高度，即横置后的横向尺寸） */
  availW: number;
  /** 逻辑可用高度（旋转后 = 物理视口宽度） */
  availH: number;
}

export const useDeviceStore = create<DeviceState>(() => ({
  coarse: false,
  rotated: false,
  availW: typeof window !== 'undefined' ? window.innerWidth : 1280,
  availH: typeof window !== 'undefined' ? window.innerHeight : 800,
}));

import { create } from 'zustand';

type ProjectState = {
  current: string | null;
  setCurrent(name: string | null): void;
};

export const useProjectStore = create<ProjectState>((set) => ({
  current: null,
  setCurrent: (current) => set({ current }),
}));

import { create } from 'zustand'

interface AgentsStore {
  activeAgent: string | null
  setActiveAgent: (agentId: string | null) => void
}

export const useAgentsStore = create<AgentsStore>()((set) => ({
  activeAgent: '1',
  setActiveAgent: (agentId: string | null) => set({ activeAgent: agentId }),
}))

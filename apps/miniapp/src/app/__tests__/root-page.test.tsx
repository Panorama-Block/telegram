import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}))

vi.mock('@/features/landing', () => ({
  default: () => <div>Landing Page</div>,
}))

import Page from '../page'

describe('miniapp root page', () => {
  beforeEach(() => {
    replace.mockReset()
    localStorage.clear()
  })

  it('redirects authenticated users to home', async () => {
    localStorage.setItem('authToken', 'test-token')

    render(<Page />)

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/home')
    })

    expect(screen.queryByText('Landing Page')).not.toBeInTheDocument()
  })

  it('shows the landing page for unauthenticated users', async () => {
    render(<Page />)

    expect(await screen.findByText('Landing Page')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })
})

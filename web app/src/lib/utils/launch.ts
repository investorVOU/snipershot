import type { LaunchPayload, LaunchProvider, LaunchSocialLinks } from '../../types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const URL_FIELDS: Array<keyof LaunchSocialLinks> = ['twitterUrl', 'telegramUrl', 'websiteUrl', 'discordUrl']

export function sanitizeSymbol(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10)
}

export function validateSocialLinks(socials: LaunchSocialLinks): Partial<Record<keyof LaunchSocialLinks, string>> {
  const errors: Partial<Record<keyof LaunchSocialLinks, string>> = {}
  URL_FIELDS.forEach((field) => {
    const value = socials[field].trim()
    if (!value) return
    try {
      const url = new URL(value)
      if (!/^https?:$/.test(url.protocol)) {
        errors[field] = 'Use an http or https URL.'
      }
    } catch {
      errors[field] = 'Enter a valid URL.'
    }
  })
  return errors
}

export function validateImageFile(file: File | null): string | null {
  if (!file) return 'Upload a token image.'
  if (!file.type.startsWith('image/')) return 'Upload an image file.'
  if (file.size > MAX_IMAGE_BYTES) return 'Image must be 5MB or smaller.'
  return null
}

export function estimateLaunchSpend(initialBuyEnabled: boolean, initialBuyAmount: number): number {
  return Number((0.02 + (initialBuyEnabled ? initialBuyAmount : 0)).toFixed(4))
}

export function launchProviderLabel(provider: LaunchProvider): string {
  return provider === 'bags' ? 'Bags' : 'Pump.fun'
}

export function parseTagString(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5)
}

export interface LaunchFormErrors {
  name?: string
  symbol?: string
  description?: string
  totalSupply?: string
  decimals?: string
  imageFile?: string
  socials?: Partial<Record<keyof LaunchSocialLinks, string>>
  initialBuyAmount?: string
  wallet?: string
  provider?: string
}

export function validateLaunchPayload(payload: LaunchPayload, walletConnected: boolean): LaunchFormErrors {
  const errors: LaunchFormErrors = {}

  if (!payload.provider) errors.provider = 'Choose a launch provider.'
  if (!walletConnected) errors.wallet = 'Connect your wallet to launch.'
  if (payload.name.trim().length < 2 || payload.name.trim().length > 32) {
    errors.name = 'Name must be 2-32 characters.'
  }
  if (payload.symbol.trim().length < 2 || payload.symbol.trim().length > 10) {
    errors.symbol = 'Symbol must be 2-10 characters.'
  }
  if (payload.description.trim().length < 12 || payload.description.trim().length > 500) {
    errors.description = 'Description must be 12-500 characters.'
  }
  if (!Number.isFinite(payload.totalSupply) || payload.totalSupply <= 0) {
    errors.totalSupply = 'Supply must be greater than zero.'
  }
  if (!Number.isInteger(payload.decimals) || payload.decimals < 0 || payload.decimals > 9) {
    errors.decimals = 'Decimals must be a whole number between 0 and 9.'
  }
  const imageError = validateImageFile(payload.imageFile)
  if (imageError) errors.imageFile = imageError

  const socialErrors = validateSocialLinks(payload.socials)
  if (Object.keys(socialErrors).length > 0) errors.socials = socialErrors

  if (payload.initialBuy.enabled && payload.initialBuy.amount <= 0) {
    errors.initialBuyAmount = 'Enter an initial buy amount greater than zero.'
  }

  return errors
}

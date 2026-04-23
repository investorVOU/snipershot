import { Plus } from 'lucide-react'

interface Props {
  onClick: () => void
  disabled?: boolean
}

export function CreateCoinButton({ onClick, disabled = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#9945ff33] bg-[#9945ff14] px-4 py-2.5 text-sm font-semibold text-[#c7adff] transition-colors hover:bg-[#9945ff22] disabled:opacity-50"
    >
      <Plus size={15} />
      Create Coin
    </button>
  )
}


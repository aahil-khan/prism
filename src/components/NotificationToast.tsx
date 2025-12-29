import { useState, useEffect } from "react"

interface NotificationToastProps {
  message: string
  onOpenAll: () => void
  onDismiss: () => void
  duration?: number
}

export function NotificationToast({
  message,
  onOpenAll,
  onDismiss,
  duration = 10000,
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onDismiss()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onDismiss])

  if (!isVisible) return null

  return (
    <div className="fixed top-4 left-4 right-4 bg-blue-600 text-white rounded-lg shadow-lg p-4 flex items-start justify-between gap-3 z-50 animate-slideIn">
      <div className="flex-1">
        <p className="font-semibold text-sm">Similar pages found</p>
        <p className="text-xs mt-1 text-blue-100">{message}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onOpenAll}
          className="bg-white text-blue-600 hover:bg-blue-50 px-3 py-1 rounded text-xs font-medium transition-colors"
        >
          Open all
        </button>
        <button
          onClick={() => {
            setIsVisible(false)
            onDismiss()
          }}
          className="text-blue-200 hover:text-white text-lg font-bold leading-none transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  )
}

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogOverlay
} from "@/components/ui/dialog"

interface WelcomeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WelcomeModal({ open, onOpenChange }: WelcomeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="hidden" />
      <DialogContent 
        className="sm:max-w-[360px] w-[360px] max-h-[90vh] overflow-y-auto border-0 shadow-none [&>button]:hidden" 
        style={{ 
          backgroundColor: '#FFFFFF', 
          padding: '20px'
        }}>
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-6 top-6 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none"
          style={{ color: 'var(--gray)' }}>
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>
        
        <div className="flex flex-col items-center">
          {/* Placeholder Logo */}
          <div className="w-14 h-14 rounded-2xl mb-2" style={{ backgroundColor: 'var(--primary)' }} />
          
          <DialogTitle className="text-2xl font-semibold text-center mb-3" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
            Welcome to Aegis
          </DialogTitle>
        
          <p className="text-center text-base leading-relaxed mb-4" style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
            Your private memory assistant. All your browsing history stays on your device, searchable and secure.
          </p>

          <Button 
            onClick={() => onOpenChange(false)}
            className="w-full font-semibold h-10"
            style={{ backgroundColor: 'var(--primary)', color: 'white', fontFamily: "'Breeze Sans'" }}>
            Get Started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

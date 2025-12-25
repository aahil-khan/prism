import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogOverlay
} from "@/components/ui/dialog"

interface WelcomeBackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenPanel: () => void
}

export function WelcomeBackModal({ open, onOpenChange, onOpenPanel }: WelcomeBackModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="hidden" />
      <DialogContent 
        className="sm:max-w-[360px] w-[360px] max-h-[90vh] border-0 shadow-none [&>button]:hidden duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 !data-[state=closed]:slide-out-to-none !data-[state=open]:slide-in-from-none !data-[state=closed]:zoom-out-0 !data-[state=open]:zoom-in-0"
        style={{ 
          backgroundColor: '#FFFFFF', 
          padding: '24px'
        }}>
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none"
          style={{ color: 'var(--gray)' }}>
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>
        
        <div className="flex flex-col items-center gap-3">
          {/* Placeholder Logo */}
          <div className="w-12 h-12 rounded-2xl" style={{ backgroundColor: 'var(--primary)' }} />
          
          <DialogTitle className="text-2xl font-semibold text-center" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
            Welcome Back
          </DialogTitle>
        
          <p className="text-center text-sm leading-snug" style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
            Your memory timeline is ready. Open the side panel to browse your history.
          </p>

          <Button 
            onClick={onOpenPanel}
            className="w-full font-semibold h-10 mt-2"
            style={{ backgroundColor: 'var(--primary)', color: 'white', fontFamily: "'Breeze Sans'" }}>
            Open Side Panel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogOverlay
} from "@/components/ui/dialog"

interface ConsentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccept: () => void
}

export function ConsentModal({ open, onOpenChange, onAccept }: ConsentModalProps) {
  const [agreed, setAgreed] = useState(false)

  const handleAccept = () => {
    if (agreed) {
      onAccept()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="hidden" />
      <DialogContent 
        className="sm:max-w-[360px] w-[360px] max-h-[90vh] border-0 shadow-none [&>button]:hidden" 
        style={{ 
          backgroundColor: '#FFFFFF', 
          padding: '20px'
        }}>
        <div className="flex flex-col -mt-5">
          <DialogTitle className="text-2xl font-semibold text-center mb-3" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
            Your Privacy Matters
          </DialogTitle>
        
          <p className="text-center text-sm leading-relaxed mb-4" style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
            We take your privacy seriously. Here's how Aegis protects you:
          </p>

          {/* Privacy Features List */}
          <div className="space-y-2 mb-5">
            {[
              "All data stays on your device",
              "No cloud storage or syncing",
              "No tracking or analytics",
              "No third-party sharing",
              "Full local encryption"
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-sm flex-shrink-0" style={{ color: 'var(--primary)' }}>•</span>
                <p className="text-sm leading-tight" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                  {feature}
                </p>
              </div>
            ))}
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-start gap-2 mb-5">
            <Checkbox
              id="consent"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked as boolean)}
              className="mt-1"
            />
            <label
              htmlFor="consent"
              className="text-sm cursor-pointer"
              style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
              I understand and agree to Aegis privacy practices
            </label>
          </div>

          {/* Buttons */}
          <div className="space-y-2">
            <Button 
              onClick={handleAccept}
              disabled={!agreed}
              className="w-full font-semibold h-10"
              style={{ 
                backgroundColor: agreed ? 'var(--primary)' : '#CCCCCC', 
                color: 'white', 
                fontFamily: "'Breeze Sans'",
                cursor: agreed ? 'pointer' : 'not-allowed'
              }}>
              I Agree
            </Button>
            
            <div className="text-center">
              <button className="text-xs transition-opacity hover:opacity-80" style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
                Learn more about our privacy policy
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
